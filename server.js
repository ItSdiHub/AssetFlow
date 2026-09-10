const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

let PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, ip: iface.address });
      }
    }
  }
  return addresses;
}

function createServerInstance(port) {
  const server = http.createServer((req, res) => {
    // CORS Headers for Local Area Network (LAN) accessibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';

    const filePath = path.join(__dirname, reqUrl);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Warning] Port ${port} is currently in use. Retrying on port ${port + 1}...`);
      if (port - PORT < MAX_PORT_ATTEMPTS) {
        createServerInstance(port + 1);
      } else {
        console.error(`[Error] Could not find an open port between ${PORT} and ${port}.`);
        process.exit(1);
      }
    } else {
      console.error('[Error] Server error:', err);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const netAddrs = getNetworkAddresses();
    console.log('========================================================');
    console.log('  SDI IT Asset Hub - Network & Local Server Active');
    console.log('========================================================');
    console.log(`> Local:    http://localhost:${port}`);
    if (netAddrs.length > 0) {
      netAddrs.forEach(item => {
        console.log(`> Network (${item.name}): http://${item.ip}:${port}`);
      });
    } else {
      console.log(`> Network:  http://0.0.0.0:${port}`);
    }
    console.log('========================================================');
  });
}

createServerInstance(PORT);
