// src/utils/derivedLogic.js
// Derived computation layers applied on top of raw Tally data
// Does NOT change how data is fetched — only adds computed fields

/**
 * Parse a date string from Tally into a JS Date
 * Tally dates come in YYYYMMDD or DD-Mon-YYYY or various formats
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseTallyDate(dateStr) {
    if (!dateStr) return null;

    // YYYYMMDD format
    if (/^\d{8}$/.test(dateStr)) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day);
    }

    // Try standard date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
}

/**
 * Get today's date at midnight for consistent comparisons
 */
function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Calculate difference in days between two dates
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Get the Nth day of the next month from today
 * @param {number} dayOfMonth - e.g. 7, 11, 20
 * @returns {Date}
 */
function getNthOfNextMonth(dayOfMonth) {
    const today = getToday();
    let nextMonth = today.getMonth() + 1;
    let year = today.getFullYear();
    if (nextMonth > 11) {
        nextMonth = 0;
        year++;
    }
    return new Date(year, nextMonth, dayOfMonth);
}

/**
 * Format date as YYYY-MM-DD string
 */
function formatDate(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Format date as YYYYMMDD for Tally queries
 */
function formatTallyDate(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

// ============================================
// 1. RECEIVABLES — Ageing & Overdue Logic
// ============================================

/**
 * Add derived fields to receivables data
 * @param {Array} receivables - Raw receivables array
 * @param {number} mtdCollections - MTD receipts total (fetched separately)
 * @returns {object} - Enhanced receivables with ageing and totals
 */
function deriveReceivables(receivables, mtdCollections = 0) {
    const today = getToday();

    const ageingBuckets = {
        '0-30': { count: 0, total: 0, bills: [] },
        '31-60': { count: 0, total: 0, bills: [] },
        '61-90': { count: 0, total: 0, bills: [] },
        '90+': { count: 0, total: 0, bills: [] },
    };

    let totalOutstanding = 0;
    let totalOverdue = 0;

    const enhanced = receivables.map((bill) => {
        const dueDate = parseTallyDate(bill.dueDate) || parseTallyDate(bill.billDate);
        const pendingAmount = Math.abs(parseFloat(bill.pendingAmount) || 0);
        let daysOverdue = 0;
        let isOverdue = false;
        let ageingBucket = '0-30';

        if (dueDate) {
            daysOverdue = daysBetween(dueDate, today);
            isOverdue = daysOverdue > 0;

            if (daysOverdue <= 0) ageingBucket = '0-30';
            else if (daysOverdue <= 30) ageingBucket = '0-30';
            else if (daysOverdue <= 60) ageingBucket = '31-60';
            else if (daysOverdue <= 90) ageingBucket = '61-90';
            else ageingBucket = '90+';
        }

        totalOutstanding += pendingAmount;
        if (isOverdue) totalOverdue += pendingAmount;

        // Populate ageing buckets
        if (pendingAmount > 0) {
            ageingBuckets[ageingBucket].count++;
            ageingBuckets[ageingBucket].total += pendingAmount;
        }

        return {
            ...bill,
            daysOverdue: Math.max(0, daysOverdue),
            isOverdue,
            ageingBucket,
            dueDateFormatted: dueDate ? formatDate(dueDate) : '',
        };
    });

    return {
        bills: enhanced,
        summary: {
            totalOutstanding,
            totalOverdue,
            totalBills: enhanced.length,
            overdueBills: enhanced.filter((b) => b.isOverdue).length,
            ageingBuckets,
            mtdCollections,
        },
    };
}

// ============================================
// 2. PAYABLES — Due This Week & TDS Logic
// ============================================

/**
 * Add derived fields to payables data
 * @param {object} payablesData - Raw payables object { payables, tdsPayable, advancePayments }
 * @returns {object} - Enhanced payables with due flags
 */
function derivePayables(payablesData) {
    const today = getToday();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // TDS challan due date = 7th of next month
    const tdsChallanDueDate = getNthOfNextMonth(7);
    const daysUntilTdsDue = daysBetween(today, tdsChallanDueDate);

    const enhancedPayables = payablesData.payables.map((bill) => {
        const dueDate = parseTallyDate(bill.dueDate) || parseTallyDate(bill.billDate);
        let isDueThisWeek = false;

        if (dueDate) {
            isDueThisWeek = dueDate >= today && dueDate <= nextWeek;
        }

        return {
            ...bill,
            isDueThisWeek,
            dueDateFormatted: dueDate ? formatDate(dueDate) : '',
        };
    });

    return {
        payables: enhancedPayables,
        tdsPayable: payablesData.tdsPayable,
        advancePayments: payablesData.advancePayments,
        summary: {
            totalPayables: enhancedPayables.length,
            dueThisWeek: enhancedPayables.filter((b) => b.isDueThisWeek).length,
            tdsChallanDueDate: formatDate(tdsChallanDueDate),
            daysUntilTdsDue,
        },
    };
}

// ============================================
// 3. PROFIT & LOSS — Net Profit & Comparisons
// ============================================

/**
 * Add derived fields to profit & loss data
 * @param {object} plData - Enhanced P&L data
 * @param {object|null} lastMonthData - Previous month P&L data
 * @param {object|null} sameMonthLastYearData - Same month last year P&L data
 * @returns {object} - Enhanced P&L with derived metrics
 */
function deriveProfitLoss(plData, lastMonthData, sameMonthLastYearData) {
    const totalRevenue = (plData.revenueLedgers || []).reduce(
        (sum, l) => sum + Math.abs(parseFloat(l.amount) || 0),
        0
    );
    const totalExpenses = (plData.expenseLedgers || []).reduce(
        (sum, l) => sum + Math.abs(parseFloat(l.amount) || 0),
        0
    );

    const netProfit = totalRevenue - totalExpenses;
    const netProfitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // Comparison with last month
    let revenueVsLastMonth = null;
    if (lastMonthData) {
        const lastMonthRevenue = (lastMonthData.revenueLedgers || []).reduce(
            (sum, l) => sum + Math.abs(parseFloat(l.amount) || 0),
            0
        );
        const lastMonthExpenses = (lastMonthData.expenseLedgers || []).reduce(
            (sum, l) => sum + Math.abs(parseFloat(l.amount) || 0),
            0
        );
        revenueVsLastMonth = {
            currentMonthRevenue: totalRevenue,
            lastMonthRevenue,
            changeAmount: totalRevenue - lastMonthRevenue,
            changePercent: lastMonthRevenue > 0 ? (((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0,
            lastMonthNetProfit: lastMonthRevenue - lastMonthExpenses,
        };
    }

    // Comparison with same month last year
    let revenueVsSameMonthLastYear = null;
    if (sameMonthLastYearData) {
        const lyRevenue = (sameMonthLastYearData.revenueLedgers || []).reduce(
            (sum, l) => sum + Math.abs(parseFloat(l.amount) || 0),
            0
        );
        const lyExpenses = (sameMonthLastYearData.expenseLedgers || []).reduce(
            (sum, l) => sum + Math.abs(parseFloat(l.amount) || 0),
            0
        );
        revenueVsSameMonthLastYear = {
            currentMonthRevenue: totalRevenue,
            sameMonthLastYearRevenue: lyRevenue,
            changeAmount: totalRevenue - lyRevenue,
            changePercent: lyRevenue > 0 ? (((totalRevenue - lyRevenue) / lyRevenue) * 100) : 0,
            sameMonthLastYearNetProfit: lyRevenue - lyExpenses,
        };
    }

    return {
        ...plData,
        derived: {
            totalRevenue,
            totalExpenses,
            netProfit,
            netProfitMarginPercent: Math.round(netProfitMarginPercent * 100) / 100,
            revenueVsLastMonth,
            revenueVsSameMonthLastYear,
        },
    };
}

// ============================================
// 4. GST SUMMARY — Net Payable & Filing Dates
// ============================================

/**
 * Add derived fields to GST summary data
 * @param {object} gstData - Raw GST summary
 * @returns {object} - Enhanced GST with filing reminders
 */
function deriveGSTSummary(gstData) {
    const today = getToday();

    const outputTotal =
        (gstData.outputGST?.cgst?.total || 0) +
        (gstData.outputGST?.sgst?.total || 0) +
        (gstData.outputGST?.igst?.total || 0);

    const itcTotal = gstData.inputTaxCredit?.totalITC || 0;
    const netGSTPayable = Math.abs(outputTotal) - Math.abs(itcTotal);

    // Filing due dates
    const gstr1DueDate = getNthOfNextMonth(11);
    const gstr3bDueDate = getNthOfNextMonth(20);
    const tdsChallanDueDate = getNthOfNextMonth(7);

    return {
        ...gstData,
        derived: {
            outputGSTTotal: outputTotal,
            itcTotal,
            netGSTPayable,
            filingDueDates: {
                gstr1: {
                    dueDate: formatDate(gstr1DueDate),
                    daysRemaining: daysBetween(today, gstr1DueDate),
                },
                gstr3b: {
                    dueDate: formatDate(gstr3bDueDate),
                    daysRemaining: daysBetween(today, gstr3bDueDate),
                },
                tdsChallan: {
                    dueDate: formatDate(tdsChallanDueDate),
                    daysRemaining: daysBetween(today, tdsChallanDueDate),
                },
            },
        },
    };
}

// ============================================
// 5. CLIENT BILLING — Payment Status & Realisation
// ============================================

/**
 * Add derived fields to client billing data
 * @param {Array} billingData - Raw client billing invoices
 * @returns {object} - Enhanced billing with payment status and realisation rates
 */
function deriveClientBilling(billingData) {
    const enhanced = billingData.map((invoice) => {
        const grossAmount = Math.abs(parseFloat(invoice.grossAmount) || 0);
        const outstandingAmount = Math.abs(parseFloat(invoice.outstandingAmount) || 0);

        let paymentStatus = 'Unpaid';
        if (outstandingAmount === 0 && grossAmount > 0) {
            paymentStatus = 'Paid';
        } else if (outstandingAmount > 0 && outstandingAmount < grossAmount) {
            paymentStatus = 'Partial';
        }

        return {
            ...invoice,
            paymentStatus,
            amountCollected: grossAmount - outstandingAmount,
        };
    });

    // Fee realisation rate per client
    const clientMap = {};
    enhanced.forEach((inv) => {
        const client = inv.clientName || 'Unknown';
        if (!clientMap[client]) {
            clientMap[client] = { totalBilled: 0, totalCollected: 0 };
        }
        const gross = Math.abs(parseFloat(inv.grossAmount) || 0);
        const outstanding = Math.abs(parseFloat(inv.outstandingAmount) || 0);
        clientMap[client].totalBilled += gross;
        clientMap[client].totalCollected += gross - outstanding;
    });

    const clientRealisationRates = Object.entries(clientMap).map(([client, data]) => ({
        clientName: client,
        totalBilled: data.totalBilled,
        totalCollected: data.totalCollected,
        feeRealisationRatePercent:
            data.totalBilled > 0
                ? Math.round(((data.totalCollected / data.totalBilled) * 100) * 100) / 100
                : 0,
    }));

    return {
        invoices: enhanced,
        clientRealisationRates,
        summary: {
            totalInvoices: enhanced.length,
            paidCount: enhanced.filter((i) => i.paymentStatus === 'Paid').length,
            partialCount: enhanced.filter((i) => i.paymentStatus === 'Partial').length,
            unpaidCount: enhanced.filter((i) => i.paymentStatus === 'Unpaid').length,
        },
    };
}

// ============================================
// 6. BANK POSITION — Total Liquid Funds
// ============================================

/**
 * Add derived fields to bank position data
 * @param {object} bankData - Raw bank position
 * @returns {object} - Enhanced with total liquid funds
 */
function deriveBankPosition(bankData) {
    const totalBankBalance = bankData.totalBankBalance || 0;
    const totalCashBalance = bankData.totalCashBalance || 0;
    const totalLiquidFunds = totalBankBalance + totalCashBalance;

    return {
        ...bankData,
        derived: {
            totalLiquidFunds,
        },
    };
}

// ============================================
// 7. INVOICE REGISTER — Payment Status & Overdue
// ============================================

/**
 * Add derived fields to invoice register data
 * @param {Array} invoices - Raw invoice register
 * @param {string|null} paymentStatusFilter - Optional filter: Paid/Partial/Unpaid/Overdue
 * @returns {object} - Enhanced invoices with payment status
 */
function deriveInvoiceRegister(invoices, paymentStatusFilter) {
    const today = getToday();

    let enhanced = invoices.map((inv) => {
        const grossAmount = Math.abs(inv.grossAmount || 0);
        const outstandingBalance = Math.abs(inv.outstandingBalance || 0);
        const dueDate = parseTallyDate(inv.dueDate);
        const isOverdue = dueDate ? dueDate < today : false;

        let paymentStatus = 'Unpaid';
        if (outstandingBalance === 0 && grossAmount > 0) {
            paymentStatus = 'Paid';
        } else if (outstandingBalance > 0 && outstandingBalance < grossAmount) {
            paymentStatus = isOverdue ? 'Overdue' : 'Partial';
        } else if (outstandingBalance >= grossAmount && isOverdue) {
            paymentStatus = 'Overdue';
        }

        return {
            ...inv,
            paymentStatus,
            isOverdue,
            dueDateFormatted: dueDate ? formatDate(dueDate) : '',
        };
    });

    // Apply paymentStatus filter if provided
    if (paymentStatusFilter) {
        const filter = paymentStatusFilter.toLowerCase();
        enhanced = enhanced.filter((inv) => inv.paymentStatus.toLowerCase() === filter);
    }

    return {
        invoices: enhanced,
        summary: {
            totalInvoices: enhanced.length,
            paidCount: enhanced.filter((i) => i.paymentStatus === 'Paid').length,
            partialCount: enhanced.filter((i) => i.paymentStatus === 'Partial').length,
            unpaidCount: enhanced.filter((i) => i.paymentStatus === 'Unpaid').length,
            overdueCount: enhanced.filter((i) => i.paymentStatus === 'Overdue').length,
        },
    };
}

// ============================================
// 8. BALANCE SHEET — Is Balanced Check
// ============================================

/**
 * Add derived fields to balance sheet data
 * @param {object} bsData - Enhanced balance sheet
 * @returns {object} - With is_balanced and balance_difference
 */
function deriveBalanceSheet(bsData) {
    const categories = bsData.categories || {};

    const sumLedgers = (ledgers) =>
        (ledgers || []).reduce((sum, l) => sum + Math.abs(parseFloat(l.closingBalance) || 0), 0);

    // Calculate total assets
    const totalFixedAssets = sumLedgers(categories.fixedAssets);
    const totalCurrentAssets =
        sumLedgers(categories.currentAssets?.debtors) +
        sumLedgers(categories.currentAssets?.advances) +
        sumLedgers(categories.currentAssets?.cashAndBank) +
        sumLedgers(categories.currentAssets?.others);
    const totalInvestments = sumLedgers(categories.investments);
    const totalAssets = totalFixedAssets + totalCurrentAssets + totalInvestments;

    // Calculate total liabilities
    const totalCapitalReserves = sumLedgers(categories.capitalAndReserves);
    const totalLongTermLiabilities = sumLedgers(categories.longTermLiabilities);
    const totalCurrentLiabilities =
        sumLedgers(categories.currentLiabilities?.creditors) +
        sumLedgers(categories.currentLiabilities?.gstPayable) +
        sumLedgers(categories.currentLiabilities?.tdsPayable) +
        sumLedgers(categories.currentLiabilities?.others);
    const totalLiabilities = totalCapitalReserves + totalLongTermLiabilities + totalCurrentLiabilities;

    const balanceDifference = Math.round((totalAssets - totalLiabilities) * 100) / 100;
    const isBalanced = Math.abs(balanceDifference) < 1; // Allow ₹1 tolerance for rounding

    return {
        ...bsData,
        derived: {
            totalAssets,
            totalFixedAssets,
            totalCurrentAssets,
            totalInvestments,
            totalLiabilities,
            totalCapitalReserves,
            totalLongTermLiabilities,
            totalCurrentLiabilities,
            isBalanced,
            balanceDifference,
        },
    };
}

// ============================================
// 9. TRIAL BALANCE — Dormancy Detection
// ============================================

/**
 * Add derived fields to trial balance data
 * @param {object} tbData - Enhanced trial balance data
 * @param {string|null} statusFilter - Optional filter: 'active' or 'dormant'
 * @returns {object} - With dormancy flags
 */
function deriveTrialBalance(tbData, statusFilter) {
    const today = getToday();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let enhancedLedgers = (tbData.ledgersWithDates || []).map((ledger) => {
        const lastEntryDate = parseTallyDate(ledger.lastEntryDate);
        let daysSinceLastEntry = null;
        let isDormant = true; // Default to dormant if no date

        if (lastEntryDate) {
            daysSinceLastEntry = daysBetween(lastEntryDate, today);
            isDormant = lastEntryDate < currentMonthStart; // No activity in current month
        }

        return {
            ...ledger,
            daysSinceLastEntry,
            isDormant,
            lastEntryDateFormatted: lastEntryDate ? formatDate(lastEntryDate) : '',
        };
    });

    // Apply status filter
    if (statusFilter) {
        const filter = statusFilter.toLowerCase();
        if (filter === 'active') {
            enhancedLedgers = enhancedLedgers.filter((l) => !l.isDormant);
        } else if (filter === 'dormant') {
            enhancedLedgers = enhancedLedgers.filter((l) => l.isDormant);
        }
    }

    return {
        ...tbData,
        ledgersWithDates: enhancedLedgers,
        derived: {
            totalLedgers: enhancedLedgers.length,
            activeLedgers: enhancedLedgers.filter((l) => !l.isDormant).length,
            dormantLedgers: enhancedLedgers.filter((l) => l.isDormant).length,
        },
    };
}

// ============================================
// HELPER: Get date ranges for P&L comparisons
// ============================================

/**
 * Get previous month date range in YYYYMMDD format
 * @returns {{ fromDate: string, toDate: string }}
 */
function getPreviousMonthRange() {
    const today = getToday();
    const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
        fromDate: formatTallyDate(firstOfLastMonth),
        toDate: formatTallyDate(lastOfLastMonth),
    };
}

/**
 * Get same month last year date range in YYYYMMDD format
 * @returns {{ fromDate: string, toDate: string }}
 */
function getSameMonthLastYearRange() {
    const today = getToday();
    const firstOfSameMonthLastYear = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const lastOfSameMonthLastYear = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0);
    return {
        fromDate: formatTallyDate(firstOfSameMonthLastYear),
        toDate: formatTallyDate(lastOfSameMonthLastYear),
    };
}

/**
 * Get current month date range in YYYYMMDD format (for MTD)
 * @returns {{ fromDate: string, toDate: string }}
 */
function getCurrentMonthRange() {
    const today = getToday();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
        fromDate: formatTallyDate(firstOfMonth),
        toDate: formatTallyDate(today),
    };
}

/**
 * Calendar year to date: 1 Jan (current year) through today (server local date).
 * Use when the API omits fromDate/toDate so Tally gets an explicit period (e.g. P&L / Trial Balance).
 */
function getCalendarYearToDateRange() {
    const today = getToday();
    const jan1 = new Date(today.getFullYear(), 0, 1);
    return {
        fromDate: formatTallyDate(jan1),
        toDate: formatTallyDate(today),
    };
}

module.exports = {
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
};
