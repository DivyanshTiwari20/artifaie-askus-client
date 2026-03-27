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
        ${this.companyName ? `<SVCURRENTCOMPANY>${this.companyName}</SVCURRENTCOMPANY>` : ''}
        ${fromDate ? `<SVFROMDATE>${fromDate}</SVFROMDATE>` : ''}
        ${toDate ? `<SVTODATE>${toDate}</SVTODATE>` : ''}
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
        ${this.companyName ? `<SVCURRENTCOMPANY>${this.companyName}</SVCURRENTCOMPANY>` : ''}
        ${fromDate ? `<SVFROMDATE>${fromDate}</SVFROMDATE>` : ''}
        ${toDate ? `<SVTODATE>${toDate}</SVTODATE>` : ''}
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
