const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/services/tallyServices.js');
let s = fs.readFileSync(file, 'utf8');

const reCompany =
  /\s*\\\s*\r?\n\s*d:work[\t ]+ally-backend\{this\.companyName \? <SVCURRENTCOMPANY>d:work[\t ]+ally-backend\{this\.companyName\}<\/SVCURRENTCOMPANY> : <!-- No specific company -->\}/g;
const reFrom =
  /\s*\\\s*\r?\n\s*d:work[\t ]+ally-backend\{fromDate \? <SVFROMDATE>d:work[\t ]+ally-backend\{fromDate\}<\/SVFROMDATE> : <!-- Default from date -->\}/g;
const reTo =
  /\s*\\\s*\r?\n\s*d:work[\t ]+ally-backend\{toDate \? <SVTODATE>d:work[\t ]+ally-backend\{toDate\}<\/SVTODATE> : <!-- Default to date -->\}/g;

const n0 = (s.match(/d:work/g) || []).length;

s = s.replace(
  reCompany,
  "\n        \\\n        ${this.companyName ? `<SVCURRENTCOMPANY>${this.companyName}</SVCURRENTCOMPANY>` : ''}"
);
s = s.replace(
  reFrom,
  "\n        \\\n        ${fromDate ? `<SVFROMDATE>${fromDate}</SVFROMDATE>` : ''}"
);
s = s.replace(
  reTo,
  "\n        \\\n        ${toDate ? `<SVTODATE>${toDate}</SVTODATE>` : ''}"
);

const n1 = (s.match(/d:work/g) || []).length;
fs.writeFileSync(file, s);
console.log('d:work occurrences before:', n0, 'after:', n1);
