const http = require('http');
const url = require('url');
const dns = require('dns').promises;
const net = require('net');

const PORT = process.env.PORT || 8080;

// Enhanced email regex patterns for double-checking
const basicEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const strictEmailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

// CORS middleware
function enableCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function writeJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Enhanced email syntax validation with double-checking
function validateEmailSyntax(email) {
  // Basic checks
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321 limit
  if ((email.match(/@/g) || []).length !== 1) return false;
  
  const [localPart, domain] = email.split('@');
  
  // Local part checks
  if (!localPart || localPart.length > 64) return false; // RFC 5321 limit
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..')) return false;
  
  // Domain checks
  if (!domain || domain.length > 253) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  
  // Apply both regex patterns for double-checking
  return basicEmailRegex.test(email) && strictEmailRegex.test(email);
}

// Enhanced SMTP check with proper handshake
async function performSMTPCheck(mxHost, email) {
  const logs = [`Attempting SMTP connection to ${mxHost}:25`];
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseBuffer = '';
    let currentStep = 'greeting';
    let stepTimeout;
    
    const cleanup = () => {
      if (stepTimeout) clearTimeout(stepTimeout);
      socket.destroy();
    };
    
    const connectionTimeout = setTimeout(() => {
      logs.push('Connection timeout (10s)');
      cleanup();
      resolve({ success: false, logs });
    }, 10000);
    
    // Set step timeout for each SMTP command
    const setStepTimeout = (step, duration = 5000) => {
      if (stepTimeout) clearTimeout(stepTimeout);
      stepTimeout = setTimeout(() => {
        logs.push(`Step timeout: ${step}`);
        cleanup();
        resolve({ success: false, logs });
      }, duration);
    };
    
    socket.connect(25, mxHost, () => {
      logs.push(`Connected to ${mxHost}:25`);
      setStepTimeout('greeting');
    });
    
    socket.on('data', (data) => {
      responseBuffer += data.toString();
      
      // Process complete lines
      const lines = responseBuffer.split('\r\n');
      responseBuffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        if (line.trim()) {
          logs.push(`S: ${line}`);
          
          const responseCode = line.substring(0, 3);
          const isPositive = responseCode.startsWith('2') || responseCode.startsWith('3');
          
          if (currentStep === 'greeting' && isPositive) {
            currentStep = 'helo';
            setStepTimeout('helo');
            const heloCmd = 'HELO verifier.example.com\r\n';
            logs.push(`C: ${heloCmd.trim()}`);
            socket.write(heloCmd);
            
          } else if (currentStep === 'helo' && isPositive) {
            currentStep = 'mail_from';
            setStepTimeout('mail_from');
            const mailFromCmd = 'MAIL FROM:<verifier@example.com>\r\n';
            logs.push(`C: ${mailFromCmd.trim()}`);
            socket.write(mailFromCmd);
            
          } else if (currentStep === 'mail_from' && isPositive) {
            currentStep = 'rcpt_to';
            setStepTimeout('rcpt_to');
            const rcptToCmd = `RCPT TO:<${email}>\r\n`;
            logs.push(`C: ${rcptToCmd.trim()}`);
            socket.write(rcptToCmd);
            
          } else if (currentStep === 'rcpt_to') {
            clearTimeout(connectionTimeout);
            const quitCmd = 'QUIT\r\n';
            logs.push(`C: ${quitCmd.trim()}`);
            socket.write(quitCmd);
            
            // Wait a moment for QUIT response, then resolve
            setTimeout(() => {
              cleanup();
              resolve({ 
                success: isPositive, 
                logs: [...logs, `RCPT TO result: ${isPositive ? 'ACCEPTED' : 'REJECTED'}`]
              });
            }, 1000);
            return;
            
          } else if (!isPositive) {
            clearTimeout(connectionTimeout);
            logs.push(`SMTP error at step ${currentStep}: ${line}`);
            const quitCmd = 'QUIT\r\n';
            logs.push(`C: ${quitCmd.trim()}`);
            socket.write(quitCmd);
            
            setTimeout(() => {
              cleanup();
              resolve({ success: false, logs });
            }, 1000);
            return;
          }
        }
      }
    });
    
    socket.on('error', (err) => {
      clearTimeout(connectionTimeout);
      logs.push(`Socket error: ${err.message}`);
      cleanup();
      resolve({ success: false, logs });
    });
    
    socket.on('close', () => {
      clearTimeout(connectionTimeout);
      if (currentStep !== 'rcpt_to') {
        logs.push('Connection closed unexpectedly');
        resolve({ success: false, logs });
      }
    });
  });
}

// Main verification handler
async function handleVerify(req, res) {
  if (req.method === 'OPTIONS') {
    enableCORS(res);
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method !== 'POST') {
    enableCORS(res);
    writeJSON(res, 405, { error: 'Method not allowed' });
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    enableCORS(res);
    
    try {
      const { email } = JSON.parse(body);
      
      if (!email) {
        writeJSON(res, 400, { error: 'Email is required' });
        return;
      }
      
      const response = {
        email,
        syntax_valid: false,
        domain: '',
        domain_has_mx: false,
        smtp_deliverable: false,
        mx_host_tried: '',
        logs: []
      };
      
      // Step 1: Enhanced syntax validation with double-checking
      response.logs.push('Step 1: Validating email syntax...');
      if (!validateEmailSyntax(email)) {
        response.logs.push('Syntax validation failed: Invalid email format');
        writeJSON(res, 200, response);
        return;
      }
      response.syntax_valid = true;
      response.logs.push('Syntax validation passed');
      
      // Extract domain
      const domain = email.split('@')[1];
      response.domain = domain;
      
      // Step 2: DNS MX record lookup
      response.logs.push(`Step 2: Looking up MX records for domain: ${domain}`);
      try {
        const mxRecords = await dns.resolveMx(domain);
        if (!mxRecords || mxRecords.length === 0) {
          response.logs.push('No MX records found for domain');
          writeJSON(res, 200, response);
          return;
        }
        response.domain_has_mx = true;
        response.logs.push(`Found ${mxRecords.length} MX record(s)`);
        
        // Sort by priority (lower number = higher priority)
        mxRecords.sort((a, b) => a.priority - b.priority);
        
        // Step 3: SMTP handshake testing
        response.logs.push('Step 3: Testing SMTP deliverability...');
        const maxAttempts = Math.min(3, mxRecords.length);
        
        for (let i = 0; i < maxAttempts; i++) {
          const mxHost = mxRecords[i].exchange;
          response.logs.push(`Trying MX server ${i + 1}/${maxAttempts}: ${mxHost} (priority: ${mxRecords[i].priority})`);
          
          const smtpResult = await performSMTPCheck(mxHost, email);
          response.logs.push(...smtpResult.logs);
          
          if (smtpResult.success) {
            response.smtp_deliverable = true;
            response.mx_host_tried = mxHost;
            response.logs.push(`SMTP verification successful via ${mxHost}`);
            break;
          } else {
            response.logs.push(`SMTP verification failed for ${mxHost}`);
          }
        }
        
        if (!response.smtp_deliverable) {
          response.logs.push('SMTP verification failed for all MX servers');
        }
        
      } catch (dnsError) {
        response.logs.push(`DNS lookup error: ${dnsError.message}`);
      }
      
      writeJSON(res, 200, response);
      
    } catch (error) {
      response.logs.push(`JSON parsing error: ${error.message}`);
      writeJSON(res, 400, { error: 'Invalid JSON payload' });
    }
  });
}

// Health check handler
function handleHealth(req, res) {
  enableCORS(res);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
}

// Create and configure server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/api/verify') {
    handleVerify(req, res);
  } else if (parsedUrl.pathname === '/healthz') {
    handleHealth(req, res);
  } else {
    enableCORS(res);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Email verifier backend listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  console.log(`API endpoint: http://localhost:${PORT}/api/verify`);
});