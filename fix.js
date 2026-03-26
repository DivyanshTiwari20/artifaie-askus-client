const fs = require('fs');
let s = fs.readFileSync('src/services/tallyServices.js', 'utf8');

s = s.replace(/<SVCURRENTCOMPANY>\$\{this\.companyName\}<\/SVCURRENTCOMPANY>/g, '\\\n        d:\work\tally-backend{this.companyName ? <SVCURRENTCOMPANY>d:\work\tally-backend{this.companyName}</SVCURRENTCOMPANY> : <!-- No specific company -->}');

s = s.replace(/<SVFROMDATE>\$\{fromDate \|\| '20240401'\}<\/SVFROMDATE>/g, '\\\n        d:\work\tally-backend{fromDate ? <SVFROMDATE>d:\work\tally-backend{fromDate}</SVFROMDATE> : <!-- Default from date -->}');

s = s.replace(/<SVTODATE>\$\{toDate \|\| '20250331'\}<\/SVTODATE>/g, '\\\n        d:\work\tally-backend{toDate ? <SVTODATE>d:\work\tally-backend{toDate}</SVTODATE> : <!-- Default to date -->}');

fs.writeFileSync('src/services/tallyServices.js', s);
console.log('File updated successfully.');
