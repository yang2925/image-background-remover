const http = require('http');
const fs = require('fs');
const path = require('path');

// 1x1 透明 PNG (base64)
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    console.log(`[${new Date().toISOString()}] Received remove-bg request`);
    
    // 收集请求体（不解析，直接忽略）
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      // 模拟处理延迟 800ms
      setTimeout(() => {
        console.log(`[${new Date().toISOString()}] Returning mock transparent PNG`);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': TRANSPARENT_PNG.length,
        });
        res.end(TRANSPARENT_PNG);
      }, 800);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 8787;
server.listen(PORT, () => {
  console.log(`✅ Mock Worker running at http://localhost:${PORT}`);
  console.log(`   Simulates remove.bg API — returns a transparent PNG for any upload`);
});
