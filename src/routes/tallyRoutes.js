// src/routes/tallyRoutes.js
// This file defines Tally data fetching API endpoints

const express = require('express');
const router = express.Router();
const tallyService = require('../services/tallyServices');
const { protect, authorize } = require('../middleware/auth');
const TallyDiagnostics = require('../utils/diagnostics');
const {
  deriveReceivables,
  derivePayables,
  deriveProfitLoss,
  deriveGSTSummary,
  deriveClientBilling,
  deriveBankPosition,
  deriveInvoiceRegister,
  deriveBalanceSheet,
  deriveTrialBalance,
  getPreviousMonthRange,
  getSameMonthLastYearRange,
  getCurrentMonthRange,
  getCalendarYearToDateRange,
} = require('../utils/derivedLogic');

/** If fromDate/toDate are omitted, use 1 Jan → today (YYYYMMDD, server local). */
function resolveReportDates(fromDate, toDate) {
  const d = getCalendarYearToDateRange();
  return {
    fromDate: fromDate || d.fromDate,
    toDate: toDate || d.toDate,
  };
}

/**
 * Middleware: auto-detect Tally company name before data requests.
 * Skips /companies, /test*, /diagnostics (they don't need SVCURRENTCOMPANY).
 */
router.use(async (req, res, next) => {
  const skip = ['/companies', '/test', '/test-public', '/diagnostics', '/reports/summary', '/debug-company'];
  if (skip.some(p => req.path === p || req.path.startsWith(p))) {
    return next();
  }
  try {
    await tallyService.ensureCompanyResolved();
  } catch (err) {
    console.warn('⚠️ Company auto-detect warning:', err.message);
  }
  next();
});

/**
 * @route   GET /api/tally/debug-company
 * @desc    Debug company name detection — shows env, Tally company list, raw XML, and resolved name
 * @access  Public (no auth required for debugging)
 */
router.get('/debug-company', async (req, res) => {
  try {
    const results = {
      envCompanyName: tallyService.companyName || null,
      envCompanyNameLength: (tallyService.companyName || '').length,
      tallyHost: tallyService.tallyHost,
      resolvedBefore: tallyService._resolvedCompanyName,
    };

    // Force re-detection
    tallyService._resolvedCompanyName = null;
    tallyService.clearTraceBuffer();

    const resolved = await tallyService.autoDetectCompanyName();
    results.resolvedAfterAutoDetect = resolved;

    // Test: try a simple ledger request WITH the resolved company name
    try {
      const testXml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>TestLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${tallyService.currentCompanyXml()}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TestLedgers">
            <TYPE>Ledger</TYPE>
            <FETCH>NAME, PARENT, CLOSINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
      const testRes = await tallyService.sendRequest(testXml);
      const ledgers = tallyService.extractLedgerListFromCollectionResponse(testRes);
      results.dataTest = {
        success: true,
        ledgerCount: ledgers.length,
        sampleLedgers: ledgers.slice(0, 5).map(l => ({
          name: l.NAME || '',
          parent: l.PARENT || '',
          closingBalance: l.CLOSINGBALANCE || '0',
        })),
        companyNameUsed: resolved,
      };
    } catch (e) {
      results.dataTest = { success: false, error: e.message };
    }

    // Show trace from all calls
    results.trace = tallyService.getTraceBuffer();

    res.status(200).json({ success: true, debug: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/tally/diagnostics
 * @desc    Run comprehensive diagnostics to troubleshoot Tally connection
 * @access  Public (no auth required for debugging)
 */
router.get('/diagnostics', async (req, res) => {
  try {
    console.log('🔍 Running Tally connection diagnostics...');
    console.log(`   Target Host: ${tallyService.tallyHost}`);

    const diagnostics = new TallyDiagnostics(tallyService.tallyHost);
    const results = await diagnostics.runAllTests();

    res.status(200).json({
      success: true,
      message: 'Diagnostics completed - check response for details',
      tallyHost: tallyService.tallyHost,
      results: results
    });
  } catch (error) {
    console.error('❌ Diagnostics error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run diagnostics',
      error: error.message,
      tallyHost: tallyService.tallyHost,
    });
  }
});

/**
 * @route   GET /api/tally/test-public
 * @desc    Test Tally connection (public endpoint for debugging)
 * @access  Public
 */
router.get('/test-public', async (req, res) => {
  try {
    console.log('🔍 Testing Tally connection (public)...');
    console.log(`   Tally Host: ${tallyService.tallyHost}`);

    await tallyService.getCompanies();

    res.status(200).json({
      success: true,
      message: 'Successfully connected to Tally',
      tallyHost: tallyService.tallyHost,
    });
  } catch (error) {
    console.error('❌ Connection test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect to Tally',
      error: error.message,
      tallyHost: tallyService.tallyHost,
    });
  }
});

/**
 * @route   GET /api/tally/test
 * @desc    Test Tally connection
 * @access  Private/Admin
 */
router.get('/test', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('🔍 Testing Tally connection...');
    console.log(`   Tally Host: ${tallyService.tallyHost}`);

    // Test connection by trying to get companies
    // This will throw an error if connection fails, giving us the actual error message
    await tallyService.getCompanies();

    res.status(200).json({
      success: true,
      message: 'Successfully connected to Tally',
      tallyHost: tallyService.tallyHost,
    });
  } catch (error) {
    console.error('❌ Connection test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect to Tally',
      error: error.message,
      tallyHost: tallyService.tallyHost,
    });
  }
});

/**
 * @route   GET /api/tally/companies
 * @desc    Get list of companies from Tally
 * @access  Private (All authenticated users)
 */
router.get('/companies', protect, async (req, res) => {
  try {
    console.log('📊 Fetching companies from Tally...');

    const companies = await tallyService.getCompanies();

    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.error('❌ Get companies error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/trial-balance
 * @desc    Get enhanced Trial Balance with last entry dates and group filtering
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 * @query   ledgerGroup - Filter by ledger group (optional)
 */
router.get('/trial-balance', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { ledgerGroup, status, fromDate: qFrom, toDate: qTo } = req.query;
    const { fromDate, toDate } = resolveReportDates(qFrom, qTo);

    console.log('📊 Fetching Enhanced Trial Balance from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);
    if (ledgerGroup) console.log(`   Ledger Group: ${ledgerGroup}`);
    if (status) console.log(`   Status Filter: ${status}`);

    const trialBalance = await tallyService.getEnhancedTrialBalance(fromDate, toDate, ledgerGroup);
    const derived = deriveTrialBalance(trialBalance, status);

    res.status(200).json({
      success: true,
      data: derived,
      filters: {
        fromDate,
        toDate,
        ledgerGroup: ledgerGroup || 'All',
        status: status || 'All',
      },
    });
  } catch (error) {
    console.error('❌ Get trial balance error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/ledgers
 * @desc    Get list of all ledgers
 * @access  Private (Admin & Manager only)
 */
router.get('/ledgers', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const wantTrace = req.query.trace === '1' || req.query.trace === 'true';
    if (wantTrace) tallyService.clearTraceBuffer();

    console.log('📊 Fetching Ledgers from Tally...');

    const ledgers = await tallyService.getLedgers();

    res.status(200).json({
      success: true,
      count: ledgers.length,
      data: ledgers,
      ...(wantTrace ? { tallyTrace: tallyService.getTraceBuffer() } : {}),
    });
  } catch (error) {
    console.error('❌ Get ledgers error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/day-book
 * @desc    Get Day Book report
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/day-book', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Day Book from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);

    const dayBook = await tallyService.getDayBook(fromDate, toDate);

    res.status(200).json({
      success: true,
      data: dayBook,
      filters: {
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get day book error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/reports/summary
 * @desc    Get summary of available reports (for dashboard)
 * @access  Private (All authenticated users - role-based filtering)
 */
router.get('/reports/summary', protect, async (req, res) => {
  try {
    const userRole = req.user.role;

    // Define available reports based on user role
    const reportsAccess = {
      admin: [
        { name: 'Trial Balance', endpoint: '/api/tally/trial-balance', access: true },
        { name: 'Ledgers', endpoint: '/api/tally/ledgers', access: true },
        { name: 'Day Book', endpoint: '/api/tally/day-book', access: true },
        { name: 'Companies', endpoint: '/api/tally/companies', access: true },
      ],
      manager: [
        { name: 'Trial Balance', endpoint: '/api/tally/trial-balance', access: true },
        { name: 'Ledgers', endpoint: '/api/tally/ledgers', access: true },
        { name: 'Day Book', endpoint: '/api/tally/day-book', access: true },
        { name: 'Companies', endpoint: '/api/tally/companies', access: true },
      ],
      employee: [
        { name: 'Companies', endpoint: '/api/tally/companies', access: true },
        { name: 'Trial Balance', endpoint: '/api/tally/trial-balance', access: false },
        { name: 'Ledgers', endpoint: '/api/tally/ledgers', access: false },
        { name: 'Day Book', endpoint: '/api/tally/day-book', access: false },
      ],
    };

    res.status(200).json({
      success: true,
      role: userRole,
      availableReports: reportsAccess[userRole] || [],
    });
  } catch (error) {
    console.error('❌ Get reports summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/stock-items
 * @desc    Get list of all stock items
 * @access  Private (Admin & Manager only)
 */
router.get('/stock-items', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    console.log('📊 Fetching Stock Items from Tally...');

    const stockItems = await tallyService.getStockItems();

    res.status(200).json({
      success: true,
      count: stockItems.length,
      data: stockItems,
    });
  } catch (error) {
    console.error('❌ Get stock items error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/stock-groups
 * @desc    Get list of all stock groups
 * @access  Private (Admin & Manager only)
 */
router.get('/stock-groups', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    console.log('📊 Fetching Stock Groups from Tally...');

    const stockGroups = await tallyService.getStockGroups();

    res.status(200).json({
      success: true,
      count: stockGroups.length,
      data: stockGroups,
    });
  } catch (error) {
    console.error('❌ Get stock groups error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/vouchers/:type
 * @desc    Get vouchers by type (Sales, Purchase, Receipt, Payment, etc.)
 * @access  Private (Admin & Manager only)
 * @param   type - Voucher type (Sales, Purchase, Receipt, Payment, Journal, Contra)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/vouchers/:type', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { type } = req.params;
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    // Validate voucher type
    const validTypes = ['Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra', 'Credit Note', 'Debit Note'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid voucher type. Valid types are: ${validTypes.join(', ')}`,
      });
    }

    console.log(`📊 Fetching ${type} Vouchers from Tally...`);
    console.log(`   Period: ${fromDate} to ${toDate}`);

    const vouchers = await tallyService.getVouchers(type, fromDate, toDate);

    res.status(200).json({
      success: true,
      voucherType: type,
      count: vouchers.length,
      data: vouchers,
      filters: {
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get vouchers error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/receivables
 * @desc    Get accounts receivable (outstanding bills from Sundry Debtors)
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/receivables', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Receivables from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);

    // Fetch receivables + MTD receipts in parallel
    const mtdRange = getCurrentMonthRange();
    const [receivables, mtdReceipts] = await Promise.all([
      tallyService.getReceivables(fromDate, toDate),
      tallyService.getVouchers('Receipt', mtdRange.fromDate, mtdRange.toDate).catch(() => []),
    ]);

    const mtdCollections = mtdReceipts.reduce(
      (sum, v) => sum + Math.abs(parseFloat(v.amount) || 0), 0
    );

    const derived = deriveReceivables(receivables, mtdCollections);

    res.status(200).json({
      success: true,
      count: derived.bills.length,
      data: derived,
      filters: {
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get receivables error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/payables
 * @desc    Get accounts payable (outstanding bills from Sundry Creditors + TDS + Advances)
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/payables', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Payables from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);

    const result = await tallyService.getPayables(fromDate, toDate);
    const derived = derivePayables(result);

    res.status(200).json({
      success: true,
      data: derived,
      filters: {
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get payables error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/profit-loss
 * @desc    Get enhanced Profit & Loss report with revenue/expense breakup and major expense heads
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/profit-loss', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate, trace } = req.query;
    const wantTrace = trace === '1' || trace === 'true';

    const { fromDate: fd, toDate: td } = resolveReportDates(fromDate, toDate);

    console.log('📊 Fetching Enhanced Profit & Loss from Tally...');
    console.log(`   Period: ${fd} to ${td}`);

    // Auto-detect the correct company name from Tally before any data requests
    const resolvedCompany = await tallyService.ensureCompanyResolved();
    console.log(`   Resolved company: "${resolvedCompany}"`);

    const lastMonthRange = getPreviousMonthRange();
    const sameMonthLYRange = getSameMonthLastYearRange();

    if (wantTrace) tallyService.clearTraceBuffer();

    const profitLoss = await tallyService.getEnhancedProfitLoss(fd, td);
    const tallyTrace = wantTrace ? tallyService.getTraceBuffer() : undefined;

    const lastMonthPL = await tallyService.getEnhancedProfitLoss(lastMonthRange.fromDate, lastMonthRange.toDate).catch(() => null);
    const sameMonthLYPL = await tallyService.getEnhancedProfitLoss(sameMonthLYRange.fromDate, sameMonthLYRange.toDate).catch(() => null);

    const derived = deriveProfitLoss(profitLoss, lastMonthPL, sameMonthLYPL);

    res.status(200).json({
      success: true,
      data: derived,
      filters: {
        fromDate: fd,
        toDate: td,
        comparedWith: {
          lastMonth: `${lastMonthRange.fromDate} - ${lastMonthRange.toDate}`,
          sameMonthLastYear: `${sameMonthLYRange.fromDate} - ${sameMonthLYRange.toDate}`,
        },
      },
      ...(wantTrace && tallyTrace
        ? {
            tallyTrace: {
              ...tallyTrace,
              resolvedCompanyName: resolvedCompany,
              envCompanyName: tallyService.companyName || null,
            },
            tallyTraceNote:
              'Shows Tally host, resolved company name, and each XML exchange. Look for hasLineError, empty responseLen, or missing LEDGER in responseHead.',
          }
        : {}),
    });
  } catch (error) {
    console.error('❌ Get profit & loss error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/gst-summary
 * @desc    Get GST summary (Output GST, ITC, TDS, RCM)
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/gst-summary', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching GST Summary from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);

    const gstSummary = await tallyService.getGSTSummary(fromDate, toDate);
    const derived = deriveGSTSummary(gstSummary);

    res.status(200).json({
      success: true,
      data: derived,
      filters: {
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get GST summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/client-billing
 * @desc    Get client billing (Sales vouchers + outstanding per invoice)
 * @access  Private (Admin & Manager only)
 * @query   clientName - Client/party name (optional, filters by specific client)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/client-billing', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { clientName } = req.query;
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Client Billing from Tally...');
    console.log(`   Client: ${clientName || 'All'}`);
    console.log(`   Period: ${fromDate} to ${toDate}`);

    const billing = await tallyService.getClientBilling(clientName, fromDate, toDate);
    const derived = deriveClientBilling(billing);

    res.status(200).json({
      success: true,
      count: derived.invoices.length,
      data: derived,
      filters: {
        clientName: clientName || 'All',
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get client billing error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/bank-position
 * @desc    Get bank position (bank ledgers, cash, uncleared cheques, receipts/payments)
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/bank-position', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Bank Position from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);

    const bankPosition = await tallyService.getBankPosition(fromDate, toDate);
    const derived = deriveBankPosition(bankPosition);

    res.status(200).json({
      success: true,
      data: derived,
      filters: {
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error('❌ Get bank position error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/invoice-register
 * @desc    Get invoice register with tax breakup, outstanding, and GSTIN
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 * @query   clientName - Client/party name (optional, filters by specific client)
 */
router.get('/invoice-register', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { clientName, paymentStatus } = req.query;
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Invoice Register from Tally...');
    console.log(`   Client: ${clientName || 'All'}`);
    console.log(`   Period: ${fromDate} to ${toDate}`);
    if (paymentStatus) console.log(`   Filter: ${paymentStatus}`);

    const invoices = await tallyService.getInvoiceRegister(fromDate, toDate, clientName);
    const derived = deriveInvoiceRegister(invoices, paymentStatus);

    res.status(200).json({
      success: true,
      count: derived.invoices.length,
      data: derived,
      filters: {
        clientName: clientName || 'All',
        fromDate,
        toDate,
        paymentStatus: paymentStatus || 'All',
      },
    });
  } catch (error) {
    console.error('❌ Get invoice register error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/balance-sheet
 * @desc    Get enhanced Balance Sheet with categorized ledgers and comparison
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 * @query   compareDate - Compare to date for side-by-side (YYYYMMDD format, optional)
 */
router.get('/balance-sheet', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { compareDate } = req.query;
    const { fromDate, toDate } = resolveReportDates(req.query.fromDate, req.query.toDate);

    console.log('📊 Fetching Enhanced Balance Sheet from Tally...');
    console.log(`   Period: ${fromDate} to ${toDate}`);
    if (compareDate) console.log(`   Compare to: ${compareDate}`);

    const balanceSheet = await tallyService.getEnhancedBalanceSheet(fromDate, toDate, compareDate);
    const derived = deriveBalanceSheet(balanceSheet);

    res.status(200).json({
      success: true,
      data: derived,
      filters: {
        fromDate,
        toDate,
        compareDate: compareDate || 'None',
      },
    });
  } catch (error) {
    console.error('❌ Get balance sheet error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/ledger-groups
 * @desc    Get list of all ledger groups
 * @access  Private (Admin & Manager only)
 */
router.get('/ledger-groups', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    console.log('📊 Fetching Ledger Groups from Tally...');

    const ledgerGroups = await tallyService.getLedgerGroups();

    res.status(200).json({
      success: true,
      count: ledgerGroups.length,
      data: ledgerGroups,
    });
  } catch (error) {
    console.error('❌ Get ledger groups error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;