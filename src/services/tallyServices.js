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
      ignoreAttrs: false,
      trim: true,
    });
    
    // XML builder options
    this.xmlBuilder = new xml2js.Builder({
      headless: true,
      renderOpts: { pretty: false },
    });
  }

  /**
   * Send XML request to Tally
   * @param {string} xmlRequest - XML request string
   * @param {object} headers - HTTP headers (optional)
   * @returns {Promise<object>} - Parsed XML response
   */
  async sendRequest(xmlRequest, headers = {}) {
    try {
      // Default headers for Tally requests
      const defaultHeaders = {
        'Content-Type': 'text/xml;charset=utf-16',
        'Content-Length': Buffer.byteLength(xmlRequest),
      };

      // Merge custom headers with defaults
      const finalHeaders = { ...defaultHeaders, ...headers };

      console.log(`📤 Sending request to Tally: ${this.tallyHost}`);

      // Send POST request to Tally
      const response = await axios.post(this.tallyHost, xmlRequest, {
        headers: finalHeaders,
        timeout: 30000, // 30 second timeout
      });

      // Parse XML response to JavaScript object
      const parsedResponse = await this.xmlParser.parseStringPromise(
        response.data
      );

      console.log('✅ Response received from Tally');
      
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
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Tally request timed out. Please try again.');
      } else {
        throw new Error(`Tally API Error: ${error.message}`);
      }
    }
  }

  /**
   * Build XML envelope for Tally requests
   * @param {object} options - Request options
   * @returns {string} - XML request string
   */
  buildXMLRequest(options) {
    const {
      requestType = 'Export',
      type = 'Data',
      id,
      staticVariables = {},
      tdl = null,
    } = options;

    // Build XML structure
    const envelope = {
      ENVELOPE: {
        HEADER: {
          VERSION: '1',
          TALLYREQUEST: requestType,
          TYPE: type,
          ID: id,
        },
        BODY: {
          DESC: {
            STATICVARIABLES: staticVariables,
          },
        },
      },
    };

    // Add session ID and token if available (for cloud)
    if (this.sessionId) {
      envelope.ENVELOPE.HEADER.SessionID = this.sessionId;
      envelope.ENVELOPE.HEADER.Token = this.tokenCounter.toString();
    }

    // Add TDL if provided
    if (tdl) {
      envelope.ENVELOPE.BODY.DESC.TDL = tdl;
    }

    // Convert JavaScript object to XML
    return this.xmlBuilder.buildObject(envelope);
  }

  /**
   * Get list of companies from Tally
   * @returns {Promise<Array>} - List of companies
   */
  async getCompanies() {
    try {
      const xmlRequest = this.buildXMLRequest({
        type: 'Collection',
        id: 'List of Companies',
        staticVariables: {
          SVEXPORTFORMAT: '$$SysName:XML',
        },
        tdl: {
          TDLMESSAGE: {
            COLLECTION: {
              $: { NAME: 'List of Companies', ISMODIFY: 'No' },
              TYPE: 'Company',
              FETCH: 'NAME',
            },
          },
        },
      });

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
      const xmlRequest = this.buildXMLRequest({
        type: 'Data',
        id: 'TrialBalance',
        staticVariables: {
          SVCurrentCompany: this.companyName,
          SVFromDate: fromDate || '20240401', // Default: Apr 1, 2024
          SVToDate: toDate || '20250331', // Default: Mar 31, 2025
          EXPLODEFLAG: 'Yes',
          SVEXPORTFORMAT: '$$SysName:XML',
        },
      });

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
      const xmlRequest = this.buildXMLRequest({
        type: 'Collection',
        id: 'AllLedgers',
        staticVariables: {
          SVCurrentCompany: this.companyName,
          SVEXPORTFORMAT: '$$SysName:XML',
        },
        tdl: {
          TDLMESSAGE: {
            COLLECTION: {
              $: { NAME: 'AllLedgers', ISMODIFY: 'No' },
              TYPE: 'Ledger',
              FETCH: 'NAME, PARENT, CLOSINGBALANCE, OPENINGBALANCE',
            },
          },
        },
      });

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
      const xmlRequest = this.buildXMLRequest({
        type: 'Data',
        id: 'DayBook',
        staticVariables: {
          SVCurrentCompany: this.companyName,
          SVFromDate: fromDate || '20240401',
          SVToDate: toDate || '20250331',
          EXPLODEFLAG: 'Yes',
          SVEXPORTFORMAT: '$$SysName:XML',
        },
      });

      const response = await this.sendRequest(xmlRequest);

      // Parse and return day book data
      return this.parseDayBookResponse(response);
    } catch (error) {
      throw new Error(`Failed to get day book: ${error.message}`);
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
      const companyList =
        response.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;

      if (!companyList) {
        return companies;
      }

      // Handle single company vs multiple companies
      const companyArray = Array.isArray(companyList)
        ? companyList
        : [companyList];

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
      // Extract relevant data from XML response
      // Note: Actual structure may vary based on Tally version
      const data = response.ENVELOPE?.BODY?.DATA;
      
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
      const ledgerList =
        response.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

      if (!ledgerList) {
        return ledgers;
      }

      // Handle single ledger vs multiple ledgers
      const ledgerArray = Array.isArray(ledgerList)
        ? ledgerList
        : [ledgerList];

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
      const data = response.ENVELOPE?.BODY?.DATA;
      
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