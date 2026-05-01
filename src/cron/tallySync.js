const { pool } = require('../config/database');
const tallyService = require('../services/tallyServices');
const {
  deriveReceivables,
  deriveProfitLoss,
  deriveClientBilling,
  deriveBankPosition,
  getPreviousMonthRange,
  getSameMonthLastYearRange,
  getCalendarYearToDateRange,
  getCurrentMonthRange
} = require('../utils/derivedLogic');

async function syncTallyData() {
  console.log('🔄 [CRON] Starting background Tally sync...');
  try {
    await tallyService.ensureCompanyResolved();
    
    const { fromDate: fd, toDate: td } = getCalendarYearToDateRange();
    
    // Profit & Loss
    try {
      const lastMonthRange = getPreviousMonthRange();
      const sameMonthLYRange = getSameMonthLastYearRange();
      
      const profitLoss = await tallyService.getEnhancedProfitLoss(fd, td);
      const lastMonthPL = await tallyService.getEnhancedProfitLoss(lastMonthRange.fromDate, lastMonthRange.toDate).catch(() => null);
      const sameMonthLYPL = await tallyService.getEnhancedProfitLoss(sameMonthLYRange.fromDate, sameMonthLYRange.toDate).catch(() => null);
      const derivedPL = deriveProfitLoss(profitLoss, lastMonthPL, sameMonthLYPL);
      
      await pool.query(
        `INSERT INTO tally_cache (cache_key, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['profit_loss_default', derivedPL]
      );
    } catch (e) {
      console.warn('⚠️ [CRON] Failed to sync Profit & Loss:', e.message);
    }

    // Receivables
    try {
      const mtdRange = getCurrentMonthRange();
      const [receivables, mtdReceipts] = await Promise.all([
        tallyService.getReceivables(fd, td),
        tallyService.getVouchers('Receipt', mtdRange.fromDate, mtdRange.toDate).catch(() => []),
      ]);
      const mtdCollections = mtdReceipts.reduce((sum, v) => sum + Math.abs(parseFloat(v.amount) || 0), 0);
      const derivedRec = deriveReceivables(receivables, mtdCollections);
      await pool.query(
        `INSERT INTO tally_cache (cache_key, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['receivables_default', derivedRec]
      );
    } catch (e) {
      console.warn('⚠️ [CRON] Failed to sync Receivables:', e.message);
    }

    // Bank Position
    try {
      const bankPosition = await tallyService.getBankPosition(fd, td);
      const derivedBank = deriveBankPosition(bankPosition);
      await pool.query(
        `INSERT INTO tally_cache (cache_key, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['bank_position_default', derivedBank]
      );
    } catch (e) {
      console.warn('⚠️ [CRON] Failed to sync Bank Position:', e.message);
    }

    // Client Billing
    try {
      const billing = await tallyService.getClientBilling(null, fd, td);
      const derivedBilling = deriveClientBilling(billing);
      await pool.query(
        `INSERT INTO tally_cache (cache_key, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['client_billing_default', derivedBilling]
      );
    } catch (e) {
      console.warn('⚠️ [CRON] Failed to sync Client Billing:', e.message);
    }
    
    console.log('✅ [CRON] Tally sync complete!');
  } catch (err) {
    console.error('❌ [CRON] Tally sync failed:', err.message);
  }
}

function startCron() {
  // Run every 5 minutes
  setInterval(syncTallyData, 5 * 60 * 1000);
  // Initial run after 5 seconds
  setTimeout(syncTallyData, 5000);
}

module.exports = { startCron, syncTallyData };
