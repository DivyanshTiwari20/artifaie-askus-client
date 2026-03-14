// Simple diagnostic script for Tally connection
// Run: node simple-diag.js

const net = require('net');
const http = require('http');

const TALLY_HOST = 'http://103.171.134.4:16937';
const hostname = '103.171.134.4';
const port = 16937;

console.log('==================================================');
console.log('TALLY CONNECTION DIAGNOSTICS');
console.log('==================================================');
console.log('Target: ' + TALLY_HOST);
console.log('');

async function testTCPPort() {
    return new Promise((resolve) => {
        console.log('[TEST 1] Testing TCP port connectivity...');
        const socket = new net.Socket();
        const timeout = 15000;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            console.log('[TEST 1] SUCCESS - Port ' + port + ' is OPEN');
            resolve(true);
        });

        socket.on('timeout', () => {
            socket.destroy();
            console.log('[TEST 1] FAILED - Connection TIMED OUT after ' + (timeout / 1000) + ' seconds');
            console.log('         This means the port is likely BLOCKED by a firewall');
            resolve(false);
        });

        socket.on('error', (err) => {
            socket.destroy();
            console.log('[TEST 1] FAILED - Error: ' + err.code);
            if (err.code === 'ECONNREFUSED') {
                console.log('         Port is not listening - Tally may not be running');
            } else if (err.code === 'ETIMEDOUT') {
                console.log('         Connection timed out - Firewall is blocking');
            }
            resolve(false);
        });

        socket.connect(port, hostname);
    });
}

async function testHTTPRequest() {
    return new Promise((resolve) => {
        console.log('');
        console.log('[TEST 2] Testing HTTP request...');

        const xmlRequest = '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';

        const req = http.request({
            hostname: hostname,
            port: port,
            path: '/',
            method: 'POST',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/xml',
                'Content-Length': Buffer.byteLength(xmlRequest, 'utf8')
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('[TEST 2] SUCCESS - Got HTTP response!');
                console.log('         Status Code: ' + res.statusCode);
                console.log('         Response length: ' + data.length + ' bytes');
                console.log('         Response preview: ' + data.substring(0, 200));
                resolve(true);
            });
        });

        req.on('timeout', () => {
            req.destroy();
            console.log('[TEST 2] FAILED - HTTP request TIMED OUT');
            console.log('         This confirms the server is not responding');
            resolve(false);
        });

        req.on('error', (err) => {
            console.log('[TEST 2] FAILED - HTTP error: ' + err.code);
            resolve(false);
        });

        req.write(xmlRequest);
        req.end();
    });
}

async function run() {
    const tcpResult = await testTCPPort();
    const httpResult = await testHTTPRequest();

    console.log('');
    console.log('==================================================');
    console.log('SUMMARY');
    console.log('==================================================');
    console.log('TCP Port Test: ' + (tcpResult ? 'PASSED' : 'FAILED'));
    console.log('HTTP Test: ' + (httpResult ? 'PASSED' : 'FAILED'));
    console.log('');

    if (!tcpResult) {
        console.log('DIAGNOSIS: Port ' + port + ' is NOT reachable from your machine.');
        console.log('');
        console.log('POSSIBLE CAUSES:');
        console.log('1. Client firewall is blocking inbound connections');
        console.log('2. Port forwarding not configured on client router');
        console.log('3. ISP is blocking the port');
        console.log('4. Tally XML Server not running');
        console.log('');
        console.log('SOLUTION STEPS:');
        console.log('1. Get your PUBLIC IP from https://whatismyip.com');
        console.log('2. Ask client to whitelist THAT public IP (not your local IP)');
        console.log('3. Ask client to verify port ' + port + ' is forwarded to Tally server');
        console.log('4. Ask client to check Windows Firewall allows inbound on port ' + port);
        console.log('5. Ask client to run this command on Tally server:');
        console.log('   netsh advfirewall firewall add rule name="Tally" dir=in action=allow protocol=tcp localport=' + port);
    }

    console.log('');
}

run().catch(console.error);
