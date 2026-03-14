// src/utils/diagnostics.js
// Diagnostic utility to troubleshoot Tally connection issues

const net = require('net');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const os = require('os');

class TallyDiagnostics {
  constructor(host) {
    // Parse the host URL
    const url = new URL(host);
    this.fullHost = host;
    this.hostname = url.hostname;
    this.port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
    this.protocol = url.protocol;
  }

  /**
   * Run all diagnostic tests
   */
  async runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 TALLY CONNECTION DIAGNOSTICS');
    console.log('='.repeat(60));
    console.log(`📍 Target Host: ${this.fullHost}`);
    console.log(`📍 Hostname: ${this.hostname}`);
    console.log(`📍 Port: ${this.port}`);
    console.log(`📍 Your IP (local): ${this.getLocalIP()}`);
    console.log('='.repeat(60) + '\n');

    const results = {
      timestamp: new Date().toISOString(),
      host: this.fullHost,
      tests: {}
    };

    // Test 1: DNS Resolution
    console.log('📋 Test 1: DNS Resolution...');
    results.tests.dns = await this.testDNS();
    this.logResult('DNS Resolution', results.tests.dns);

    // Test 2: TCP Port Connection
    console.log('\n📋 Test 2: TCP Port Connection...');
    results.tests.tcpPort = await this.testTCPPort();
    this.logResult('TCP Port', results.tests.tcpPort);

    // Test 3: HTTP/HTTPS Connection
    console.log('\n📋 Test 3: HTTP Connection...');
    results.tests.http = await this.testHTTPConnection();
    this.logResult('HTTP Connection', results.tests.http);

    // Test 4: Ping (if available)
    console.log('\n📋 Test 4: Network Ping...');
    results.tests.ping = await this.testPing();
    this.logResult('Ping', results.tests.ping);

    // Test 5: Traceroute (simplified)
    console.log('\n📋 Test 5: Route Trace...');
    results.tests.traceroute = await this.testTraceroute();
    this.logResult('Route Trace', results.tests.traceroute);

    // Test 6: Tally XML Request
    console.log('\n📋 Test 6: Tally XML Request...');
    results.tests.tallyXML = await this.testTallyXMLRequest();
    this.logResult('Tally XML Request', results.tests.tallyXML);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));

    let passedTests = 0;
    let totalTests = Object.keys(results.tests).length;

    for (const [testName, result] of Object.entries(results.tests)) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${testName}: ${result.message}`);
      if (result.success) passedTests++;
    }

    console.log('='.repeat(60));
    console.log(`📈 Results: ${passedTests}/${totalTests} tests passed`);
    console.log('='.repeat(60) + '\n');

    // Recommendations
    this.printRecommendations(results);

    return results;
  }

  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'Unable to detect';
  }

  logResult(testName, result) {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.message}`);
    if (result.details) {
      console.log(`   📝 Details: ${result.details}`);
    }
    if (result.error) {
      console.log(`   ⚠️ Error: ${result.error}`);
    }
  }

  /**
   * Test DNS resolution
   */
  async testDNS() {
    return new Promise((resolve) => {
      const dns = require('dns');
      
      // Check if it's an IP address (no DNS needed)
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(this.hostname)) {
        resolve({
          success: true,
          message: 'Direct IP address used (no DNS lookup needed)',
          ip: this.hostname
        });
        return;
      }

      dns.lookup(this.hostname, (err, address) => {
        if (err) {
          resolve({
            success: false,
            message: 'DNS resolution failed',
            error: err.message
          });
        } else {
          resolve({
            success: true,
            message: `Resolved to ${address}`,
            ip: address
          });
        }
      });
    });
  }

  /**
   * Test TCP port connectivity
   */
  async testTCPPort() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 10000; // 10 seconds

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve({
          success: true,
          message: `Successfully connected to port ${this.port}`,
          details: 'TCP handshake completed'
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          success: false,
          message: `Connection to port ${this.port} timed out after ${timeout/1000}s`,
          error: 'TIMEOUT',
          details: 'Port may be blocked by firewall or not listening'
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          success: false,
          message: `Cannot connect to port ${this.port}`,
          error: err.code || err.message,
          details: this.getPortErrorDetails(err.code)
        });
      });

      socket.connect(this.port, this.hostname);
    });
  }

  getPortErrorDetails(code) {
    const errorDetails = {
      'ECONNREFUSED': 'Port is not listening - Tally may not be running or XML Server not enabled',
      'ETIMEDOUT': 'Connection timed out - Firewall may be blocking the port',
      'ENOTFOUND': 'Hostname not found - Check the IP address or domain name',
      'ENETUNREACH': 'Network unreachable - Check network connectivity',
      'EHOSTUNREACH': 'Host unreachable - Check if the host is online',
      'ECONNRESET': 'Connection reset by peer - Server may have closed the connection'
    };
    return errorDetails[code] || 'Unknown error';
  }

  /**
   * Test HTTP connection
   */
  async testHTTPConnection() {
    return new Promise((resolve) => {
      const lib = this.protocol === 'https:' ? https : http;
      const timeout = 15000; // 15 seconds

      const req = lib.request({
        hostname: this.hostname,
        port: this.port,
        path: '/',
        method: 'GET',
        timeout: timeout,
        headers: {
          'User-Agent': 'TallyDiagnostics/1.0'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            success: true,
            message: `HTTP response received (Status: ${res.statusCode})`,
            statusCode: res.statusCode,
            details: `Response length: ${data.length} bytes`,
            headers: res.headers
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          message: 'HTTP request timed out',
          error: 'TIMEOUT',
          details: `No response after ${timeout/1000} seconds`
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          message: 'HTTP request failed',
          error: err.code || err.message,
          details: this.getPortErrorDetails(err.code)
        });
      });

      req.end();
    });
  }

  /**
   * Test ping (Windows compatible)
   */
  async testPing() {
    return new Promise((resolve) => {
      const command = os.platform() === 'win32' 
        ? `ping -n 4 ${this.hostname}` 
        : `ping -c 4 ${this.hostname}`;

      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            message: 'Ping failed or timed out',
            error: error.message,
            details: stderr || stdout
          });
        } else {
          // Check if we got valid ping response
          const hasReply = stdout.includes('TTL=') || stdout.includes('ttl=') || 
                          stdout.includes('time=') || stdout.includes('bytes from');
          
          resolve({
            success: hasReply,
            message: hasReply ? 'Host is reachable via ICMP' : 'No ping response (ICMP may be blocked)',
            details: stdout.substring(0, 500)
          });
        }
      });
    });
  }

  /**
   * Test traceroute (simplified)
   */
  async testTraceroute() {
    return new Promise((resolve) => {
      const command = os.platform() === 'win32'
        ? `tracert -d -h 10 ${this.hostname}`
        : `traceroute -n -m 10 ${this.hostname}`;

      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error && !stdout) {
          resolve({
            success: false,
            message: 'Route trace failed',
            error: error.message,
            details: 'Could not trace route to host'
          });
        } else {
          const lines = stdout.split('\n').filter(l => l.trim());
          const hopCount = lines.filter(l => /^\s*\d+/.test(l)).length;
          
          resolve({
            success: true,
            message: `Route trace completed (${hopCount} hops detected)`,
            details: stdout.substring(0, 1000)
          });
        }
      });
    });
  }

  /**
   * Test Tally XML Request
   */
  async testTallyXMLRequest() {
    return new Promise((resolve) => {
      const lib = this.protocol === 'https:' ? https : http;
      const timeout = 30000; // 30 seconds
      
      // Simple XML request to get companies
      const xmlRequest = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="List of Companies">
            <TYPE>Company</TYPE>
            <FETCH>NAME</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

      const req = lib.request({
        hostname: this.hostname,
        port: this.port,
        path: '/',
        method: 'POST',
        timeout: timeout,
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(xmlRequest, 'utf8')
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // Check if response contains Tally XML structure
          const isTallyResponse = data.includes('ENVELOPE') || 
                                  data.includes('COLLECTION') ||
                                  data.includes('COMPANY');
          
          if (isTallyResponse) {
            resolve({
              success: true,
              message: 'Received valid Tally XML response!',
              statusCode: res.statusCode,
              details: `Response: ${data.substring(0, 500)}...`
            });
          } else {
            resolve({
              success: false,
              message: 'Response is not valid Tally XML',
              statusCode: res.statusCode,
              details: `Response: ${data.substring(0, 500)}`
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          message: 'Tally XML request timed out',
          error: 'TIMEOUT',
          details: `No response after ${timeout/1000} seconds - This indicates network/firewall issues`
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          message: 'Tally XML request failed',
          error: err.code || err.message,
          details: this.getPortErrorDetails(err.code)
        });
      });

      req.write(xmlRequest);
      req.end();
    });
  }

  /**
   * Print recommendations based on test results
   */
  printRecommendations(results) {
    console.log('\n📌 RECOMMENDATIONS:');
    console.log('-'.repeat(60));

    const { tests } = results;

    // DNS check
    if (!tests.dns?.success) {
      console.log('1. ❗ DNS Resolution failed - verify the hostname/IP address is correct');
    }

    // TCP Port check
    if (!tests.tcpPort?.success) {
      console.log(`
1. ❗ TCP Port ${this.port} is NOT accessible. Possible causes:
   
   a) FIREWALL BLOCKING:
      - Ask your client to check if port ${this.port} is open in their firewall
      - Ask them to run: netsh advfirewall firewall add rule name="Tally XML Server" dir=in action=allow protocol=tcp localport=${this.port}
   
   b) TALLY XML SERVER NOT ENABLED:
      - In Tally, go to: F12 > Set Tally as a Server > Yes
      - Also check: Gateway of Tally > Configuration > Enable ODBC Server
      - In tally.ini, verify: TSOPENPORT = ${this.port}
   
   c) NAT/PORT FORWARDING:
      - The client's router may need port forwarding configured
      - Internal IP of Tally server needs to be correctly mapped
   
   d) ISP BLOCKING:
      - Some ISPs block non-standard ports
      - Try using a VPN or ask client to use port 80/443
`);
    }

    // HTTP check
    if (tests.tcpPort?.success && !tests.http?.success) {
      console.log(`
2. ❗ TCP port is open but HTTP failed. Tally might need:
   - XML Server to be specifically enabled (not just the port)
   - Check if the correct protocol (HTTP vs HTTPS) is being used
`);
    }

    // Ping check
    if (!tests.ping?.success) {
      console.log(`
3. ⚠️ ICMP Ping failed. This is often normal (ICMP may be blocked).
   - If other tests pass, this can be ignored
   - If other tests fail, check basic network connectivity
`);
    }

    // Tally XML check
    if (tests.tcpPort?.success && !tests.tallyXML?.success) {
      console.log(`
4. ❗ Port is open but Tally XML request failed:
   - Tally may not be running or is in the wrong mode
   - Ensure a company is open in Tally
   - Check if ODBC/XML Server feature is enabled in Tally license
`);
    }

    // If TCP and HTTP fail but Ping works
    if (!tests.tcpPort?.success && tests.ping?.success) {
      console.log(`
5. ⚠️ Host responds to ping but port is blocked:
   - Most likely a FIREWALL issue at the client's end
   - Request them to whitelist your PUBLIC IP address (not local IP)
   - Your public IP: Visit https://whatismyip.com to find it
`);
    }

    // General network tips
    console.log(`
📋 ADDITIONAL STEPS TO TRY:

1. GET YOUR PUBLIC IP:
   - Visit https://whatismyip.com
   - Share this IP with your client for whitelisting
   - Your local IP is: ${this.getLocalIP()} (this is NOT what needs to be whitelisted)

2. ASK CLIENT TO VERIFY:
   - Tally is running and a company is open
   - Tally.exe is allowed through Windows Firewall
   - XML Server port ${this.port} is allowed inbound
   - Their router/firewall has port ${this.port} forwarded to Tally server

3. TEST FROM CLIENT'S NETWORK:
   - Ask client to test: curl -X POST http://localhost:${this.port} --data "<ENVELOPE></ENVELOPE>"
   - If this works locally but not remotely, it's definitely a network/firewall issue

4. TRY SSH TUNNEL (if available):
   - If client has SSH access, try: ssh -L ${this.port}:localhost:${this.port} user@${this.hostname}
   - Then connect to http://localhost:${this.port}

5. CONSIDER VPN:
   - If direct access is blocked, a site-to-site VPN may be needed
`);
  }
}

// Export for use
module.exports = TallyDiagnostics;

// CLI usage
if (require.main === module) {
  const host = process.argv[2] || process.env.TALLY_HOST || 'http://localhost:9000';
  console.log(`Running diagnostics for: ${host}`);
  
  const diagnostics = new TallyDiagnostics(host);
  diagnostics.runAllTests().then(() => {
    console.log('\n✅ Diagnostics complete!\n');
  }).catch(err => {
    console.error('Diagnostics error:', err);
  });
}
