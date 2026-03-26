// src/services/tallyService.js
// This file handles all Tally XML API communications

const axios = require('axios');
const xml2js = require('xml2js');

/**
 * TallyService Class
 * Manages all interactions with Tally API
 */
class TallyService {
  constructor() {
    // Get Tally configuration from environment variables
    this.tallyHost = process.env.TALLY_HOST || 'http://localhost:9000';
    this.companyName = process.env.TALLY_COMPANY_NAME;

    // Token counter for Tally requests (increments with each request)
    this.tokenCounter = 1;

    // Session ID (will be set if using Tally Cloud)
    this.sessionId = '';

    // XML parser options
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true,
      trim: true,
      mergeAttrs: true,
    });
  }

  /**
   * Send XML request to Tally
   * @param {string} xmlRequest - XML request string
   * @returns {Promise<object>} - Parsed XML response
   */
  async sendRequest(xmlRequest) {
    try {
      console.log(`📤 Sending request to Tally: ${this.tallyHost}`);
      console.log('📄 Request XML:', xmlRequest.substring(0, 200) + '...');

      // Send POST request to Tally
      const response = await axios.post(this.tallyHost, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(xmlRequest, 'utf8'),
        },
        timeout: 30000, // 30 second timeout
        validateStatus: () => true, // Accept any status code
      });

      console.log('✅ Response received from Tally');
      console.log('📄 Response status:', response.status);
      console.log('📄 Response data:', typeof response.data === 'string' ? response.data.substring(0, 200) : 'Binary data');

      // Check if response is valid
      if (!response.data) {
        throw new Error('Empty response from Tally');
      }

      // Parse XML response to JavaScript object
      const parsedResponse = await this.xmlParser.parseStringPromise(
        response.data
      );

      console.log('✅ Response parsed successfully');

      // Increment token counter for next request
      this.tokenCounter++;

      return parsedResponse;
    } catch (error) {
      console.error('❌ Tally Request Error:', error.message);

      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Tally. Please ensure Tally is running and API is enabled.'
        );
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new Error('Tally request timed out. The server may be slow or not responding.');
      } else if (error.response) {
        throw new Error(`Tally returned error: ${error.response.status} - ${error.response.statusText}`);
      } else {
        throw new Error(`Tally API Error: ${error.message}`);
      }
    }
  }

  /**
   * Build simple XML request for Tally
   * @param {string} reportType - Type of report/collection
   * @returns {string} - XML request string
   */
  buildSimpleXMLRequest(reportType) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>${reportType}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="${reportType}">
            <TYPE>Company</TYPE>
            <FETCH>NAME</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for ledgers
   * @returns {string} - XML request string
   */
  buildLedgersXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllLedgerEntries</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllLedgerEntries">
            <TYPE>Ledger</TYPE>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Trial Balance
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {string} - XML request string
   */
  buildTrialBalanceXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Trial Balance</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Day Book
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {string} - XML request string
   */
  buildDayBookXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Day Book</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Get list of companies from Tally
   * @returns {Promise<Array>} - List of companies
   */
  async getCompanies() {
    try {
      const xmlRequest = this.buildSimpleXMLRequest('List of Companies');
      const response = await this.sendRequest(xmlRequest);

      // Parse response
      const companies = this.parseCompaniesResponse(response);
      return companies;
    } catch (error) {
      throw new Error(`Failed to get companies: ${error.message}`);
    }
  }

  /**
   * Fetch Trial Balance report from Tally
   * @param {string} fromDate - Start date (YYYYMMDD format)
   * @param {string} toDate - End date (YYYYMMDD format)
   * @returns {Promise<object>} - Trial balance data
   */
  async getTrialBalance(fromDate, toDate) {
    try {
      const xmlRequest = this.buildTrialBalanceXMLRequest(fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);

      // Parse and return trial balance data
      return this.parseTrialBalanceResponse(response);
    } catch (error) {
      throw new Error(`Failed to get trial balance: ${error.message}`);
    }
  }

  /**
   * Fetch list of ledgers from Tally
   * @returns {Promise<Array>} - List of ledgers
   */
  async getLedgers() {
    try {
      const xmlRequest = this.buildLedgersXMLRequest();
      const response = await this.sendRequest(xmlRequest);

      // Parse and return ledgers
      return this.parseLedgersResponse(response);
    } catch (error) {
      throw new Error(`Failed to get ledgers: ${error.message}`);
    }
  }

  /**
   * Fetch Day Book report from Tally
   * @param {string} fromDate - Start date (YYYYMMDD format)
   * @param {string} toDate - End date (YYYYMMDD format)
   * @returns {Promise<object>} - Day book data
   */
  async getDayBook(fromDate, toDate) {
    try {
      const xmlRequest = this.buildDayBookXMLRequest(fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);

      // Parse and return day book data
      return this.parseDayBookResponse(response);
    } catch (error) {
      throw new Error(`Failed to get day book: ${error.message}`);
    }
  }

  /**
   * Build XML request for Stock Items
   * @returns {string} - XML request string
   */
  buildStockItemsXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllStockItems</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllStockItems">
            <TYPE>Stock Item</TYPE>
            <FETCH>NAME, PARENT, BASEUNITS, OPENINGBALANCE, OPENINGVALUE, CLOSINGBALANCE, CLOSINGVALUE, OPENINGRATE, CLOSINGRATE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Stock Groups
   * @returns {string} - XML request string
   */
  buildStockGroupsXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllStockGroups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllStockGroups">
            <TYPE>Stock Group</TYPE>
            <FETCH>NAME, PARENT</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Vouchers (Sales, Purchase, etc.)
   * @param {string} voucherType - Type of voucher (Sales, Purchase, Receipt, Payment, etc.)
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {string} - XML request string
   */
  buildVouchersXMLRequest(voucherType, fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>VoucherCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="VoucherCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>VoucherTypeFilter</FILTER>
            <FETCH>DATE, VOUCHERTYPENAME, VOUCHERNUMBER, PARTYLEDGERNAME, AMOUNT, NARRATION</FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="VoucherTypeFilter">$VOUCHERTYPENAME = "${voucherType}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Balance Sheet
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {string} - XML request string
   */
  buildBalanceSheetXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Balance Sheet</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Profit & Loss
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {string} - XML request string
   */
  buildProfitLossXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Profit and Loss</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Build XML request for Ledger Groups
   * @returns {string} - XML request string
   */
  buildLedgerGroupsXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllGroups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllGroups">
            <TYPE>Group</TYPE>
            <FETCH>NAME, PARENT, ISREVENUE, ISDEEMEDPOSITIVE, AFFECTSGROSSPROFIT</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Fetch Stock Items from Tally
   * @returns {Promise<Array>} - List of stock items
   */
  async getStockItems() {
    try {
      const xmlRequest = this.buildStockItemsXMLRequest();
      const response = await this.sendRequest(xmlRequest);
      return this.parseStockItemsResponse(response);
    } catch (error) {
      throw new Error(`Failed to get stock items: ${error.message}`);
    }
  }

  /**
   * Fetch Stock Groups from Tally
   * @returns {Promise<Array>} - List of stock groups
   */
  async getStockGroups() {
    try {
      const xmlRequest = this.buildStockGroupsXMLRequest();
      const response = await this.sendRequest(xmlRequest);
      return this.parseStockGroupsResponse(response);
    } catch (error) {
      throw new Error(`Failed to get stock groups: ${error.message}`);
    }
  }

  /**
   * Fetch Vouchers from Tally (Sales, Purchase, etc.)
   * @param {string} voucherType - Type of voucher
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {Promise<Array>} - List of vouchers
   */
  async getVouchers(voucherType, fromDate, toDate) {
    try {
      const xmlRequest = this.buildVouchersXMLRequest(voucherType, fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);
      return this.parseVouchersResponse(response);
    } catch (error) {
      throw new Error(`Failed to get ${voucherType} vouchers: ${error.message}`);
    }
  }

  /**
   * Fetch Balance Sheet from Tally
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {Promise<object>} - Balance sheet data
   */
  async getBalanceSheet(fromDate, toDate) {
    try {
      const xmlRequest = this.buildBalanceSheetXMLRequest(fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);
      return this.parseBalanceSheetResponse(response);
    } catch (error) {
      throw new Error(`Failed to get balance sheet: ${error.message}`);
    }
  }

  /**
   * Fetch Profit & Loss from Tally
   * @param {string} fromDate - Start date (YYYYMMDD)
   * @param {string} toDate - End date (YYYYMMDD)
   * @returns {Promise<object>} - Profit & Loss data
   */
  async getProfitLoss(fromDate, toDate) {
    try {
      const xmlRequest = this.buildProfitLossXMLRequest(fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);
      return this.parseProfitLossResponse(response);
    } catch (error) {
      throw new Error(`Failed to get profit & loss: ${error.message}`);
    }
  }

  /**
   * Fetch Ledger Groups from Tally
   * @returns {Promise<Array>} - List of ledger groups
   */
  async getLedgerGroups() {
    try {
      const xmlRequest = this.buildLedgerGroupsXMLRequest();
      const response = await this.sendRequest(xmlRequest);
      return this.parseLedgerGroupsResponse(response);
    } catch (error) {
      throw new Error(`Failed to get ledger groups: ${error.message}`);
    }
  }

  /**
   * Parse Stock Items response
   */
  parseStockItemsResponse(response) {
    try {
      const items = [];
      const itemList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM;

      if (!itemList) return items;

      const itemArray = Array.isArray(itemList) ? itemList : [itemList];

      itemArray.forEach((item) => {
        items.push({
          name: item.NAME || 'Unknown',
          parent: item.PARENT || '',
          baseUnits: item.BASEUNITS || '',
          openingBalance: item.OPENINGBALANCE || '0',
          openingValue: item.OPENINGVALUE || '0',
          closingBalance: item.CLOSINGBALANCE || '0',
          closingValue: item.CLOSINGVALUE || '0',
          openingRate: item.OPENINGRATE || '0',
          closingRate: item.CLOSINGRATE || '0',
        });
      });

      return items;
    } catch (error) {
      console.error('Error parsing stock items:', error);
      return [];
    }
  }

  /**
   * Parse Stock Groups response
   */
  parseStockGroupsResponse(response) {
    try {
      const groups = [];
      const groupList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKGROUP;

      if (!groupList) return groups;

      const groupArray = Array.isArray(groupList) ? groupList : [groupList];

      groupArray.forEach((group) => {
        groups.push({
          name: group.NAME || 'Unknown',
          parent: group.PARENT || '',
        });
      });

      return groups;
    } catch (error) {
      console.error('Error parsing stock groups:', error);
      return [];
    }
  }

  /**
   * Parse Vouchers response
   */
  parseVouchersResponse(response) {
    try {
      const vouchers = [];
      const voucherList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;

      if (!voucherList) return vouchers;

      const voucherArray = Array.isArray(voucherList) ? voucherList : [voucherList];

      voucherArray.forEach((voucher) => {
        vouchers.push({
          date: voucher.DATE || '',
          voucherType: voucher.VOUCHERTYPENAME || '',
          voucherNumber: voucher.VOUCHERNUMBER || '',
          partyLedger: voucher.PARTYLEDGERNAME || '',
          amount: voucher.AMOUNT || '0',
          narration: voucher.NARRATION || '',
        });
      });

      return vouchers;
    } catch (error) {
      console.error('Error parsing vouchers:', error);
      return [];
    }
  }

  /**
   * Parse Balance Sheet response
   */
  parseBalanceSheetResponse(response) {
    try {
      const data = response?.ENVELOPE?.BODY?.DATA;
      return {
        success: true,
        data: data || {},
        message: 'Balance sheet fetched successfully',
      };
    } catch (error) {
      console.error('Error parsing balance sheet:', error);
      return { success: false, data: {}, message: 'Failed to parse balance sheet' };
    }
  }

  /**
   * Parse Profit & Loss response
   */
  parseProfitLossResponse(response) {
    try {
      const data = response?.ENVELOPE?.BODY?.DATA;
      return {
        success: true,
        data: data || {},
        message: 'Profit & Loss fetched successfully',
      };
    } catch (error) {
      console.error('Error parsing profit & loss:', error);
      return { success: false, data: {}, message: 'Failed to parse profit & loss' };
    }
  }

  /**
   * Parse Ledger Groups response
   */
  parseLedgerGroupsResponse(response) {
    try {
      const groups = [];
      const groupList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GROUP;

      if (!groupList) return groups;

      const groupArray = Array.isArray(groupList) ? groupList : [groupList];

      groupArray.forEach((group) => {
        groups.push({
          name: group.NAME || 'Unknown',
          parent: group.PARENT || '',
          isRevenue: group.ISREVENUE || 'No',
          isDeemedPositive: group.ISDEEMEDPOSITIVE || 'No',
          affectsGrossProfit: group.AFFECTSGROSSPROFIT || 'No',
        });
      });

      return groups;
    } catch (error) {
      console.error('Error parsing ledger groups:', error);
      return [];
    }
  }

  /**
   * Parse companies list response from Tally
   * @param {object} response - XML response object
   * @returns {Array} - Parsed companies list
   */
  parseCompaniesResponse(response) {
    try {
      const companies = [];
      const companyList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;

      if (!companyList) {
        return companies;
      }

      // Handle single company vs multiple companies
      const companyArray = Array.isArray(companyList) ? companyList : [companyList];

      companyArray.forEach((company) => {
        companies.push({
          name: company.NAME || 'Unknown',
        });
      });

      return companies;
    } catch (error) {
      console.error('Error parsing companies response:', error);
      return [];
    }
  }

  /**
   * Parse trial balance response from Tally
   * @param {object} response - XML response object
   * @returns {object} - Parsed trial balance data
   */
  parseTrialBalanceResponse(response) {
    try {
      const data = response?.ENVELOPE?.BODY?.DATA;

      return {
        success: true,
        data: data || {},
        message: 'Trial balance fetched successfully',
      };
    } catch (error) {
      console.error('Error parsing trial balance:', error);
      return {
        success: false,
        data: {},
        message: 'Failed to parse trial balance',
      };
    }
  }

  /**
   * Parse ledgers list response from Tally
   * @param {object} response - XML response object
   * @returns {Array} - Parsed ledgers list
   */
  parseLedgersResponse(response) {
    try {
      const ledgers = [];
      const ledgerList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

      if (!ledgerList) {
        return ledgers;
      }

      // Handle single ledger vs multiple ledgers
      const ledgerArray = Array.isArray(ledgerList) ? ledgerList : [ledgerList];

      ledgerArray.forEach((ledger) => {
        ledgers.push({
          name: ledger.NAME || 'Unknown',
          parent: ledger.PARENT || '',
          openingBalance: ledger.OPENINGBALANCE || '0',
          closingBalance: ledger.CLOSINGBALANCE || '0',
        });
      });

      return ledgers;
    } catch (error) {
      console.error('Error parsing ledgers response:', error);
      return [];
    }
  }

  /**
   * Parse day book response from Tally
   * @param {object} response - XML response object
   * @returns {object} - Parsed day book data
   */
  parseDayBookResponse(response) {
    try {
      const data = response?.ENVELOPE?.BODY?.DATA;

      return {
        success: true,
        data: data || {},
        message: 'Day book fetched successfully',
      };
    } catch (error) {
      console.error('Error parsing day book:', error);
      return {
        success: false,
        data: {},
        message: 'Failed to parse day book',
      };
    }
  }

  // ============================================
  // RECEIVABLES
  // ============================================

  buildReceivablesXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ReceivableBills</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ReceivableBills">
            <TYPE>Bill</TYPE>
            <CHILDOF>$$GroupSundryDebtors</CHILDOF>
            <BELONGTO>Yes</BELONGTO>
            <FETCH>NAME, PARENT, BILLDATE, BILLCREDITPERIOD, OPENINGBALANCE, CLOSINGBALANCE, BILLREF</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildReceivablesLedgersXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SundryDebtorLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SundryDebtorLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Sundry Debtors</CHILDOF>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE, BILLALLOCATIONS.NAME, BILLALLOCATIONS.BILLDATE, BILLALLOCATIONS.BILLCREDITPERIOD, BILLALLOCATIONS.OPENINGBALANCE, BILLALLOCATIONS.CLOSINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getReceivables(fromDate, toDate) {
    try {
      const xmlRequest = this.buildReceivablesLedgersXMLRequest(fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);
      return this.parseReceivablesResponse(response);
    } catch (error) {
      throw new Error(`Failed to get receivables: ${error.message}`);
    }
  }

  parseReceivablesResponse(response) {
    try {
      const receivables = [];
      const ledgerList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
      if (!ledgerList) return receivables;

      const ledgerArray = Array.isArray(ledgerList) ? ledgerList : [ledgerList];

      ledgerArray.forEach((ledger) => {
        const bills = ledger.BILLALLOCATIONS;
        if (bills) {
          const billArray = Array.isArray(bills) ? bills : [bills];
          billArray.forEach((bill) => {
            receivables.push({
              clientName: ledger.NAME || 'Unknown',
              billRef: bill.NAME || bill.BILLREF || '',
              billDate: bill.BILLDATE || '',
              dueDate: bill.BILLCREDITPERIOD || '',
              billAmount: bill.OPENINGBALANCE || '0',
              pendingAmount: bill.CLOSINGBALANCE || '0',
            });
          });
        } else {
          // Ledger with no bill breakup — show aggregate
          receivables.push({
            clientName: ledger.NAME || 'Unknown',
            billRef: '',
            billDate: '',
            dueDate: '',
            billAmount: ledger.OPENINGBALANCE || '0',
            pendingAmount: ledger.CLOSINGBALANCE || '0',
          });
        }
      });

      return receivables;
    } catch (error) {
      console.error('Error parsing receivables:', error);
      return [];
    }
  }

  // ============================================
  // PAYABLES
  // ============================================

  buildPayablesLedgersXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SundryCreditorsLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SundryCreditorsLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Sundry Creditors</CHILDOF>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE, BILLALLOCATIONS.NAME, BILLALLOCATIONS.BILLDATE, BILLALLOCATIONS.BILLCREDITPERIOD, BILLALLOCATIONS.OPENINGBALANCE, BILLALLOCATIONS.CLOSINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildTDSPayableXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>TDSPayableLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TDSPayableLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Duties &amp; Taxes</CHILDOF>
            <FETCH>NAME, CLOSINGBALANCE</FETCH>
            <FILTER>TDSFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="TDSFilter">$$StringContains:$NAME:"TDS"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildAdvancePaymentsXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AdvancePaymentLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AdvancePaymentLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Loans &amp; Advances (Asset)</CHILDOF>
            <FETCH>NAME, CLOSINGBALANCE, PARENT</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getPayables(fromDate, toDate) {
    try {
      // Fetch all three in parallel
      const [payablesRes, tdsRes, advancesRes] = await Promise.all([
        this.sendRequest(this.buildPayablesLedgersXMLRequest(fromDate, toDate)),
        this.sendRequest(this.buildTDSPayableXMLRequest()).catch(() => null),
        this.sendRequest(this.buildAdvancePaymentsXMLRequest()).catch(() => null),
      ]);

      return this.parsePayablesResponse(payablesRes, tdsRes, advancesRes);
    } catch (error) {
      throw new Error(`Failed to get payables: ${error.message}`);
    }
  }

  parsePayablesResponse(payablesRes, tdsRes, advancesRes) {
    try {
      const payables = [];
      const ledgerList = payablesRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
      if (ledgerList) {
        const ledgerArray = Array.isArray(ledgerList) ? ledgerList : [ledgerList];
        ledgerArray.forEach((ledger) => {
          const bills = ledger.BILLALLOCATIONS;
          if (bills) {
            const billArray = Array.isArray(bills) ? bills : [bills];
            billArray.forEach((bill) => {
              payables.push({
                vendorName: ledger.NAME || 'Unknown',
                billRef: bill.NAME || '',
                billDate: bill.BILLDATE || '',
                dueDate: bill.BILLCREDITPERIOD || '',
                billAmount: bill.OPENINGBALANCE || '0',
                pendingAmount: bill.CLOSINGBALANCE || '0',
              });
            });
          } else {
            payables.push({
              vendorName: ledger.NAME || 'Unknown',
              billRef: '',
              billDate: '',
              dueDate: '',
              billAmount: ledger.OPENINGBALANCE || '0',
              pendingAmount: ledger.CLOSINGBALANCE || '0',
            });
          }
        });
      }

      // TDS payable
      let tdsPayable = [];
      if (tdsRes) {
        const tdsList = tdsRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (tdsList) {
          const tdsArray = Array.isArray(tdsList) ? tdsList : [tdsList];
          tdsPayable = tdsArray.map((l) => ({
            name: l.NAME || '',
            closingBalance: l.CLOSINGBALANCE || '0',
          }));
        }
      }

      // Advance payments
      let advancePayments = [];
      if (advancesRes) {
        const advList = advancesRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (advList) {
          const advArray = Array.isArray(advList) ? advList : [advList];
          advancePayments = advArray.map((l) => ({
            name: l.NAME || '',
            parent: l.PARENT || '',
            closingBalance: l.CLOSINGBALANCE || '0',
          }));
        }
      }

      return {
        payables,
        tdsPayable,
        advancePayments,
      };
    } catch (error) {
      console.error('Error parsing payables:', error);
      return { payables: [], tdsPayable: [], advancePayments: [] };
    }
  }

  // ============================================
  // ENHANCED PROFIT & LOSS
  // ============================================

  buildEnhancedProfitLossXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Profit and Loss</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildRevenueLedgersXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>RevenueLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="RevenueLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Revenue</CHILDOF>
            <FETCH>NAME, PARENT, CLOSINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildExpenseLedgersXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ExpenseLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ExpenseLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Expenses</CHILDOF>
            <FETCH>NAME, PARENT, CLOSINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getEnhancedProfitLoss(fromDate, toDate) {
    try {
      const [plRes, revenueRes, expenseRes] = await Promise.all([
        this.sendRequest(this.buildEnhancedProfitLossXMLRequest(fromDate, toDate)),
        this.sendRequest(this.buildRevenueLedgersXMLRequest(fromDate, toDate)).catch(() => null),
        this.sendRequest(this.buildExpenseLedgersXMLRequest(fromDate, toDate)).catch(() => null),
      ]);

      return this.parseEnhancedProfitLossResponse(plRes, revenueRes, expenseRes);
    } catch (error) {
      throw new Error(`Failed to get enhanced profit & loss: ${error.message}`);
    }
  }

  parseEnhancedProfitLossResponse(plRes, revenueRes, expenseRes) {
    try {
      const plData = plRes?.ENVELOPE?.BODY?.DATA || {};

      // Revenue ledgers
      let revenueLedgers = [];
      if (revenueRes) {
        const revList = revenueRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (revList) {
          const arr = Array.isArray(revList) ? revList : [revList];
          revenueLedgers = arr.map((l) => ({
            name: l.NAME || '',
            parent: l.PARENT || '',
            amount: l.CLOSINGBALANCE || '0',
          }));
        }
      }

      // Expense ledgers
      let expenseLedgers = [];
      const majorExpenseHeads = {
        staffCost: 0,
        rent: 0,
        travel: 0,
        professionalFees: 0,
      };

      if (expenseRes) {
        const expList = expenseRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (expList) {
          const arr = Array.isArray(expList) ? expList : [expList];
          expenseLedgers = arr.map((l) => {
            const name = (l.NAME || '').toLowerCase();
            const amount = parseFloat(l.CLOSINGBALANCE) || 0;

            // Categorize major expense heads
            if (name.includes('salary') || name.includes('staff') || name.includes('wage') || name.includes('payroll')) {
              majorExpenseHeads.staffCost += amount;
            } else if (name.includes('rent') || name.includes('lease')) {
              majorExpenseHeads.rent += amount;
            } else if (name.includes('travel') || name.includes('conveyance') || name.includes('transport')) {
              majorExpenseHeads.travel += amount;
            } else if (name.includes('professional') || name.includes('consultancy') || name.includes('legal')) {
              majorExpenseHeads.professionalFees += amount;
            }

            return {
              name: l.NAME || '',
              parent: l.PARENT || '',
              amount: l.CLOSINGBALANCE || '0',
            };
          });
        }
      }

      return {
        success: true,
        data: plData,
        revenueLedgers,
        expenseLedgers,
        majorExpenseHeads,
        message: 'Enhanced Profit & Loss fetched successfully',
      };
    } catch (error) {
      console.error('Error parsing enhanced P&L:', error);
      return { success: false, data: {}, revenueLedgers: [], expenseLedgers: [], majorExpenseHeads: {}, message: 'Failed to parse' };
    }
  }

  // ============================================
  // GST SUMMARY
  // ============================================

  buildGSTLedgersXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>GSTLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="GSTLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Duties &amp; Taxes</CHILDOF>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getGSTSummary(fromDate, toDate) {
    try {
      const xmlRequest = this.buildGSTLedgersXMLRequest(fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);
      return this.parseGSTSummaryResponse(response);
    } catch (error) {
      throw new Error(`Failed to get GST summary: ${error.message}`);
    }
  }

  parseGSTSummaryResponse(response) {
    try {
      const ledgerList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
      const allLedgers = [];
      if (ledgerList) {
        const arr = Array.isArray(ledgerList) ? ledgerList : [ledgerList];
        arr.forEach((l) => allLedgers.push({ name: l.NAME || '', closingBalance: l.CLOSINGBALANCE || '0' }));
      }

      const findLedger = (keywords) => {
        return allLedgers.filter((l) => {
          const name = l.name.toLowerCase();
          return keywords.some((kw) => name.includes(kw.toLowerCase()));
        });
      };

      const sumBalances = (ledgers) => {
        return ledgers.reduce((sum, l) => sum + (parseFloat(l.closingBalance) || 0), 0);
      };

      const outputCGST = findLedger(['Output CGST', 'CGST Output', 'CGST Payable']);
      const outputSGST = findLedger(['Output SGST', 'SGST Output', 'SGST Payable']);
      const outputIGST = findLedger(['Output IGST', 'IGST Output', 'IGST Payable']);
      const inputCGST = findLedger(['Input CGST', 'CGST Input', 'CGST Credit']);
      const inputSGST = findLedger(['Input SGST', 'SGST Input', 'SGST Credit']);
      const inputIGST = findLedger(['Input IGST', 'IGST Input', 'IGST Credit']);
      const tdsLedgers = findLedger(['TDS']);
      const rcmLedgers = findLedger(['RCM', 'Reverse Charge']);

      return {
        outputGST: {
          cgst: { ledgers: outputCGST, total: sumBalances(outputCGST) },
          sgst: { ledgers: outputSGST, total: sumBalances(outputSGST) },
          igst: { ledgers: outputIGST, total: sumBalances(outputIGST) },
        },
        inputTaxCredit: {
          cgst: { ledgers: inputCGST, total: sumBalances(inputCGST) },
          sgst: { ledgers: inputSGST, total: sumBalances(inputSGST) },
          igst: { ledgers: inputIGST, total: sumBalances(inputIGST) },
          totalITC: sumBalances([...inputCGST, ...inputSGST, ...inputIGST]),
        },
        tdsDeducted: { ledgers: tdsLedgers, total: sumBalances(tdsLedgers) },
        rcmLiability: { ledgers: rcmLedgers, total: sumBalances(rcmLedgers) },
        allTaxLedgers: allLedgers,
      };
    } catch (error) {
      console.error('Error parsing GST summary:', error);
      return { outputGST: {}, inputTaxCredit: {}, tdsDeducted: {}, rcmLiability: {}, allTaxLedgers: [] };
    }
  }

  // ============================================
  // CLIENT BILLING
  // ============================================

  buildClientBillingXMLRequest(clientName, fromDate, toDate) {
    const filterClause = clientName
      ? `<SYSTEM TYPE="Formulae" NAME="ClientFilter">$PARTYLEDGERNAME = "${clientName}"</SYSTEM>`
      : '';
    const filterRef = clientName ? '<FILTER>ClientFilter</FILTER>' : '';

    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ClientBillingVouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ClientBillingVouchers">
            <TYPE>Voucher</TYPE>
            <FILTER>SalesFilter</FILTER>
            ${filterRef}
            <FETCH>DATE, VOUCHERNUMBER, PARTYLEDGERNAME, NARRATION, AMOUNT, BASICBUYERNAME, BILLALLOCATIONS.NAME, BILLALLOCATIONS.BILLCREDITPERIOD, BILLALLOCATIONS.OPENINGBALANCE, BILLALLOCATIONS.CLOSINGBALANCE</FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SalesFilter">$VOUCHERTYPENAME = "Sales"</SYSTEM>
          ${filterClause}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getClientBilling(clientName, fromDate, toDate) {
    try {
      const xmlRequest = this.buildClientBillingXMLRequest(clientName, fromDate, toDate);
      const response = await this.sendRequest(xmlRequest);
      return this.parseClientBillingResponse(response);
    } catch (error) {
      throw new Error(`Failed to get client billing: ${error.message}`);
    }
  }

  parseClientBillingResponse(response) {
    try {
      const invoices = [];
      const voucherList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
      if (!voucherList) return invoices;

      const arr = Array.isArray(voucherList) ? voucherList : [voucherList];

      arr.forEach((v) => {
        const bills = v.BILLALLOCATIONS;
        let outstandingAmount = '0';
        if (bills) {
          const billArr = Array.isArray(bills) ? bills : [bills];
          outstandingAmount = billArr.reduce((sum, b) => sum + (parseFloat(b.CLOSINGBALANCE) || 0), 0).toString();
        }

        invoices.push({
          voucherNumber: v.VOUCHERNUMBER || '',
          date: v.DATE || '',
          clientName: v.PARTYLEDGERNAME || v.BASICBUYERNAME || '',
          narration: v.NARRATION || '',
          grossAmount: v.AMOUNT || '0',
          outstandingAmount,
        });
      });

      return invoices;
    } catch (error) {
      console.error('Error parsing client billing:', error);
      return [];
    }
  }

  // ============================================
  // BANK POSITION
  // ============================================

  buildBankLedgersXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>BankLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="BankLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Bank Accounts</CHILDOF>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildCashLedgersXMLRequest() {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CashLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CashLedgers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>Cash-in-Hand</CHILDOF>
            <FETCH>NAME, CLOSINGBALANCE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildBankReconXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>BankReconVouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="BankReconVouchers">
            <TYPE>Voucher</TYPE>
            <FILTER>BankVoucherFilter</FILTER>
            <FETCH>DATE, VOUCHERTYPENAME, VOUCHERNUMBER, PARTYLEDGERNAME, AMOUNT, NARRATION, BANKALLOCATIONS.BANKERSDATE, BANKALLOCATIONS.INSTRUMENTNUMBER, BANKALLOCATIONS.INSTRUMENTDATE, BANKALLOCATIONS.TRANSACTIONTYPE</FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="BankVoucherFilter">$$IsSysNameEqual:$VOUCHERTYPENAME:"Receipt" OR $$IsSysNameEqual:$VOUCHERTYPENAME:"Payment" OR $$IsSysNameEqual:$VOUCHERTYPENAME:"Contra"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getBankPosition(fromDate, toDate) {
    try {
      const [bankRes, cashRes, reconRes] = await Promise.all([
        this.sendRequest(this.buildBankLedgersXMLRequest(fromDate, toDate)),
        this.sendRequest(this.buildCashLedgersXMLRequest()).catch(() => null),
        this.sendRequest(this.buildBankReconXMLRequest(fromDate, toDate)).catch(() => null),
      ]);

      return this.parseBankPositionResponse(bankRes, cashRes, reconRes);
    } catch (error) {
      throw new Error(`Failed to get bank position: ${error.message}`);
    }
  }

  parseBankPositionResponse(bankRes, cashRes, reconRes) {
    try {
      // Bank accounts
      let bankAccounts = [];
      const bankList = bankRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
      if (bankList) {
        const arr = Array.isArray(bankList) ? bankList : [bankList];
        bankAccounts = arr.map((l) => ({
          name: l.NAME || '',
          openingBalance: l.OPENINGBALANCE || '0',
          closingBalance: l.CLOSINGBALANCE || '0',
        }));
      }

      // Cash accounts
      let cashAccounts = [];
      if (cashRes) {
        const cashList = cashRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (cashList) {
          const arr = Array.isArray(cashList) ? cashList : [cashList];
          cashAccounts = arr.map((l) => ({
            name: l.NAME || '',
            closingBalance: l.CLOSINGBALANCE || '0',
          }));
        }
      }

      // Bank reconciliation — uncleared cheques & PDCs
      let unclearedCheques = [];
      let receiptsInPeriod = [];
      let paymentsInPeriod = [];
      if (reconRes) {
        const voucherList = reconRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
        if (voucherList) {
          const arr = Array.isArray(voucherList) ? voucherList : [voucherList];
          arr.forEach((v) => {
            const bankAlloc = v.BANKALLOCATIONS;
            const bankersDate = bankAlloc?.BANKERSDATE || '';
            const isUncleared = !bankersDate || bankersDate === '';

            const entry = {
              date: v.DATE || '',
              voucherType: v.VOUCHERTYPENAME || '',
              voucherNumber: v.VOUCHERNUMBER || '',
              party: v.PARTYLEDGERNAME || '',
              amount: v.AMOUNT || '0',
              narration: v.NARRATION || '',
              instrumentNumber: bankAlloc?.INSTRUMENTNUMBER || '',
              instrumentDate: bankAlloc?.INSTRUMENTDATE || '',
              transactionType: bankAlloc?.TRANSACTIONTYPE || '',
              bankersDate: bankersDate,
            };

            if (isUncleared) {
              unclearedCheques.push(entry);
            }

            const type = (v.VOUCHERTYPENAME || '').toLowerCase();
            if (type === 'receipt') {
              receiptsInPeriod.push(entry);
            } else if (type === 'payment') {
              paymentsInPeriod.push(entry);
            }
          });
        }
      }

      return {
        bankAccounts,
        cashAccounts,
        totalBankBalance: bankAccounts.reduce((sum, a) => sum + (parseFloat(a.closingBalance) || 0), 0),
        totalCashBalance: cashAccounts.reduce((sum, a) => sum + (parseFloat(a.closingBalance) || 0), 0),
        unclearedCheques,
        unclearedCount: unclearedCheques.length,
        receiptsInPeriod: receiptsInPeriod.length,
        paymentsInPeriod: paymentsInPeriod.length,
      };
    } catch (error) {
      console.error('Error parsing bank position:', error);
      return { bankAccounts: [], cashAccounts: [], totalBankBalance: 0, totalCashBalance: 0, unclearedCheques: [], unclearedCount: 0, receiptsInPeriod: 0, paymentsInPeriod: 0 };
    }
  }

  // ============================================
  // INVOICE REGISTER
  // ============================================

  buildInvoiceRegisterXMLRequest(fromDate, toDate, clientName) {
    const filterClause = clientName
      ? `<SYSTEM TYPE="Formulae" NAME="ClientFilter">$PARTYLEDGERNAME = "${clientName}"</SYSTEM>`
      : '';
    const filterRef = clientName ? '<FILTER>ClientFilter</FILTER>' : '';

    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>InvoiceRegister</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="InvoiceRegister">
            <TYPE>Voucher</TYPE>
            <FILTER>SalesVoucherFilter</FILTER>
            ${filterRef}
            <FETCH>DATE, VOUCHERNUMBER, PARTYLEDGERNAME, NARRATION, AMOUNT, BASICBUYERNAME, PARTYGSTIN, PLACEOFSUPPLY, LEDGERENTRIES.LEDGERNAME, LEDGERENTRIES.AMOUNT, LEDGERENTRIES.ISPARTYLEDGER, BILLALLOCATIONS.NAME, BILLALLOCATIONS.BILLCREDITPERIOD, BILLALLOCATIONS.OPENINGBALANCE, BILLALLOCATIONS.CLOSINGBALANCE</FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SalesVoucherFilter">$VOUCHERTYPENAME = "Sales"</SYSTEM>
          ${filterClause}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getInvoiceRegister(fromDate, toDate, clientName) {
    try {
      const xmlRequest = this.buildInvoiceRegisterXMLRequest(fromDate, toDate, clientName);
      const response = await this.sendRequest(xmlRequest);
      return this.parseInvoiceRegisterResponse(response);
    } catch (error) {
      throw new Error(`Failed to get invoice register: ${error.message}`);
    }
  }

  parseInvoiceRegisterResponse(response) {
    try {
      const invoices = [];
      const voucherList = response?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
      if (!voucherList) return invoices;

      const arr = Array.isArray(voucherList) ? voucherList : [voucherList];

      arr.forEach((v) => {
        // Extract tax breakup from ledger entries
        let taxableValue = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        const ledgerEntries = v.LEDGERENTRIES;
        if (ledgerEntries) {
          const entryArr = Array.isArray(ledgerEntries) ? ledgerEntries : [ledgerEntries];
          entryArr.forEach((entry) => {
            const name = (entry.LEDGERNAME || '').toLowerCase();
            const amt = parseFloat(entry.AMOUNT) || 0;

            if (name.includes('cgst') && (name.includes('output') || name.includes('payable'))) {
              cgst += Math.abs(amt);
            } else if (name.includes('sgst') && (name.includes('output') || name.includes('payable'))) {
              sgst += Math.abs(amt);
            } else if (name.includes('igst') && (name.includes('output') || name.includes('payable'))) {
              igst += Math.abs(amt);
            } else if (entry.ISPARTYLEDGER !== 'Yes' && !name.includes('gst') && !name.includes('tax')) {
              taxableValue += Math.abs(amt);
            }
          });
        }

        // Bill allocations
        let billRef = '';
        let dueDate = '';
        let amountReceived = 0;
        let outstandingBalance = 0;

        const bills = v.BILLALLOCATIONS;
        if (bills) {
          const billArr = Array.isArray(bills) ? bills : [bills];
          billRef = billArr.map((b) => b.NAME || '').join(', ');
          dueDate = billArr[0]?.BILLCREDITPERIOD || '';
          billArr.forEach((b) => {
            const opening = parseFloat(b.OPENINGBALANCE) || 0;
            const closing = parseFloat(b.CLOSINGBALANCE) || 0;
            outstandingBalance += closing;
            amountReceived += opening - closing;
          });
        }

        const grossAmount = parseFloat(v.AMOUNT) || 0;

        invoices.push({
          voucherNumber: v.VOUCHERNUMBER || '',
          date: v.DATE || '',
          clientName: v.PARTYLEDGERNAME || v.BASICBUYERNAME || '',
          narration: v.NARRATION || '',
          grossAmount: Math.abs(grossAmount),
          taxableValue,
          cgst,
          sgst,
          igst,
          billRef,
          dueDate,
          amountReceived: Math.abs(amountReceived),
          outstandingBalance,
          clientGSTIN: v.PARTYGSTIN || '',
          placeOfSupply: v.PLACEOFSUPPLY || '',
        });
      });

      return invoices;
    } catch (error) {
      console.error('Error parsing invoice register:', error);
      return [];
    }
  }

  // ============================================
  // ENHANCED BALANCE SHEET
  // ============================================

  buildEnhancedBalanceSheetXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Balance Sheet</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildBalanceSheetGroupsXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>BSGroups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="BSGroups">
            <TYPE>Ledger</TYPE>
            <FETCH>NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE</FETCH>
            <FILTER>BSGroupFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="BSGroupFilter">NOT $$IsRevenue:$PARENT</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getEnhancedBalanceSheet(fromDate, toDate, compareDate) {
    try {
      const tasks = [
        this.sendRequest(this.buildEnhancedBalanceSheetXMLRequest(fromDate, toDate)),
        this.sendRequest(this.buildBalanceSheetGroupsXMLRequest(fromDate, toDate)).catch(() => null),
      ];

      // If compareDate is provided, fetch a second balance sheet
      if (compareDate) {
        tasks.push(
          this.sendRequest(this.buildEnhancedBalanceSheetXMLRequest(fromDate, compareDate)).catch(() => null)
        );
      }

      const [bsRes, groupsRes, compareBsRes] = await Promise.all(tasks);
      return this.parseEnhancedBalanceSheetResponse(bsRes, groupsRes, compareBsRes);
    } catch (error) {
      throw new Error(`Failed to get enhanced balance sheet: ${error.message}`);
    }
  }

  parseEnhancedBalanceSheetResponse(bsRes, groupsRes, compareBsRes) {
    try {
      const bsData = bsRes?.ENVELOPE?.BODY?.DATA || {};

      // Categorize ledgers from groups response
      const categories = {
        fixedAssets: [],
        currentAssets: { debtors: [], advances: [], cashAndBank: [], others: [] },
        investments: [],
        capitalAndReserves: [],
        longTermLiabilities: [],
        currentLiabilities: { creditors: [], gstPayable: [], tdsPayable: [], others: [] },
      };

      if (groupsRes) {
        const ledgerList = groupsRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (ledgerList) {
          const arr = Array.isArray(ledgerList) ? ledgerList : [ledgerList];
          arr.forEach((l) => {
            const parent = (l.PARENT || '').toLowerCase();
            const name = (l.NAME || '').toLowerCase();
            const entry = {
              name: l.NAME || '',
              parent: l.PARENT || '',
              closingBalance: l.CLOSINGBALANCE || '0',
              openingBalance: l.OPENINGBALANCE || '0',
            };

            if (parent.includes('fixed assets') || parent.includes('depreciation')) {
              categories.fixedAssets.push(entry);
            } else if (parent.includes('sundry debtors')) {
              categories.currentAssets.debtors.push(entry);
            } else if (parent.includes('advance') || parent.includes('loans & advances')) {
              categories.currentAssets.advances.push(entry);
            } else if (parent.includes('bank') || parent.includes('cash')) {
              categories.currentAssets.cashAndBank.push(entry);
            } else if (parent.includes('current assets') || parent.includes('current asset')) {
              categories.currentAssets.others.push(entry);
            } else if (parent.includes('investment')) {
              categories.investments.push(entry);
            } else if (parent.includes('capital') || parent.includes('reserves') || parent.includes('retained')) {
              categories.capitalAndReserves.push(entry);
            } else if (parent.includes('secured loan') || parent.includes('unsecured loan') || parent.includes('long-term') || parent.includes('deferred')) {
              categories.longTermLiabilities.push(entry);
            } else if (parent.includes('sundry creditors')) {
              categories.currentLiabilities.creditors.push(entry);
            } else if (name.includes('gst') || name.includes('cgst') || name.includes('sgst') || name.includes('igst')) {
              categories.currentLiabilities.gstPayable.push(entry);
            } else if (name.includes('tds')) {
              categories.currentLiabilities.tdsPayable.push(entry);
            } else if (parent.includes('current liabilit') || parent.includes('duties') || parent.includes('provisions')) {
              categories.currentLiabilities.others.push(entry);
            }
          });
        }
      }

      const result = {
        success: true,
        data: bsData,
        categories,
        message: 'Enhanced Balance Sheet fetched successfully',
      };

      // Comparative balance sheet
      if (compareBsRes) {
        result.comparativeData = compareBsRes?.ENVELOPE?.BODY?.DATA || {};
      }

      return result;
    } catch (error) {
      console.error('Error parsing enhanced balance sheet:', error);
      return { success: false, data: {}, categories: {}, message: 'Failed to parse' };
    }
  }

  // ============================================
  // ENHANCED TRIAL BALANCE
  // ============================================

  buildEnhancedTrialBalanceXMLRequest(fromDate, toDate) {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Trial Balance</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  buildLedgerWithLastEntryDateXMLRequest(fromDate, toDate, ledgerGroup) {
    const groupFilter = ledgerGroup
      ? `<FILTER>GroupFilter</FILTER>`
      : '';
    const groupSystem = ledgerGroup
      ? `<SYSTEM TYPE="Formulae" NAME="GroupFilter">$PARENT = "${ledgerGroup}"</SYSTEM>`
      : '';

    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>LedgerWithDates</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        \
        d:work	ally-backend{this.companyName ? <SVCURRENTCOMPANY>d:work	ally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}
        \
        d:work	ally-backend{fromDate ? <SVFROMDATE>d:work	ally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}
        \
        d:work	ally-backend{toDate ? <SVTODATE>d:work	ally-backend{toDate}</SVTODATE> : <!-- Default to date -->}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="LedgerWithDates">
            <TYPE>Ledger</TYPE>
            ${groupFilter}
            <FETCH>NAME, PARENT, OPENINGBALANCE, CLOSINGBALANCE, LASTENTRYDATE</FETCH>
          </COLLECTION>
          ${groupSystem}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  async getEnhancedTrialBalance(fromDate, toDate, ledgerGroup) {
    try {
      const [tbRes, ledgerRes] = await Promise.all([
        this.sendRequest(this.buildEnhancedTrialBalanceXMLRequest(fromDate, toDate)),
        this.sendRequest(this.buildLedgerWithLastEntryDateXMLRequest(fromDate, toDate, ledgerGroup)).catch(() => null),
      ]);

      return this.parseEnhancedTrialBalanceResponse(tbRes, ledgerRes);
    } catch (error) {
      throw new Error(`Failed to get enhanced trial balance: ${error.message}`);
    }
  }

  parseEnhancedTrialBalanceResponse(tbRes, ledgerRes) {
    try {
      const tbData = tbRes?.ENVELOPE?.BODY?.DATA || {};

      let ledgersWithDates = [];
      if (ledgerRes) {
        const ledgerList = ledgerRes?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
        if (ledgerList) {
          const arr = Array.isArray(ledgerList) ? ledgerList : [ledgerList];
          ledgersWithDates = arr.map((l) => ({
            name: l.NAME || '',
            parent: l.PARENT || '',
            openingBalance: l.OPENINGBALANCE || '0',
            closingBalance: l.CLOSINGBALANCE || '0',
            lastEntryDate: l.LASTENTRYDATE || '',
          }));
        }
      }

      return {
        success: true,
        data: tbData,
        ledgersWithDates,
        message: 'Enhanced Trial Balance fetched successfully',
      };
    } catch (error) {
      console.error('Error parsing enhanced trial balance:', error);
      return { success: false, data: {}, ledgersWithDates: [], message: 'Failed to parse' };
    }
  }

  /**
   * Test Tally connection
   * @returns {Promise<boolean>} - True if connected
   */
  async testConnection() {
    try {
      await this.getCompanies();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new TallyService();