const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SYNC_FILE = path.join(DATA_DIR, 'sync_store.json');

function loadSyncStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SYNC_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading sync store:', e);
  }
  return {};
}

function saveSyncStore(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SYNC_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving sync store:', e);
  }
}

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

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 200; // 200 requests per minute per IP
const ipRequestCounts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      ipRequestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

function createServerInstance(port) {
  const server = http.createServer((req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = ipRequestCounts.get(clientIp);

    if (!record) {
      record = { count: 1, startTime: now };
      ipRequestCounts.set(clientIp, record);
    } else {
      if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
        record.count = 1;
        record.startTime = now;
      } else {
        record.count++;
      }
    }

    if (record.count > RATE_LIMIT_MAX_REQUESTS) {
      res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' });
      res.end('429 Too Many Requests - Rate limit exceeded.');
      return;
    }

    // CORS Headers for Local Area Network (LAN) accessibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let reqUrl = req.url.split('?')[0];

    if (reqUrl.startsWith('/api/sync/')) {
      const parts = reqUrl.replace('/api/sync/', '').split('/');
      const storeName = parts[0];
      const itemId = parts[1];

      if (req.method === 'GET' && storeName === 'next-id' && itemId) {
        const targetStore = itemId;
        const store = loadSyncStore();
        const items = store[targetStore] || [];
        let maxNum = 0;
        const currentYear = new Date().getFullYear();
        const prefixes = {
          employees: { prefix: "EMP-", digits: 4, start: 1001, alt: ["EMP-", "SDI-"] },
          departments: { prefix: "DEP-", digits: 3, start: 1 },
          locations: { prefix: "LOC-", digits: 3, start: 1 },
          assetTypes: { prefix: "TYP-", digits: 3, start: 1 },
          contractors: { prefix: "CNT-", digits: 3, start: 1 },
          projects: { prefix: `PRJ-${currentYear}-`, digits: 3, start: 1 },
          projectTasks: { prefix: "TSK-", digits: 3, start: 1 },
          warehouseIssues: { prefix: "ISS-", digits: 6, start: 1 },
          assetTransfers: { prefix: "TRF-", digits: 6, start: 1 },
          maintenance: { prefix: "MNT-", digits: 5, start: 1, alt: ["MAINT-", "TKT-"] },
          helpdeskRequests: { prefix: "REQ-", digits: 6, start: 101 },
          licenses: { prefix: "LIC-", digits: 4, start: 1 },
          users: { prefix: "USR-", digits: 3, start: 1 },
          assetTransactions: { prefix: "TX-", digits: 6, start: 1 },
          notifications: { prefix: "NOTIF-", digits: 6, start: 1 }
        };
        const cfg = prefixes[targetStore] || { prefix: targetStore.slice(0, 3).toUpperCase() + "-", digits: 4, start: 1 };
        const allPrefixes = [cfg.prefix, ...(cfg.alt || [])].sort((a, b) => b.length - a.length);
        items.forEach(it => {
          if (!it) return;
          const val = String(it.id || it.code || it.requestId || it.ticketNo || it.issueNo || it.transferNo || it.projectNo || "");
          for (const p of allPrefixes) {
            if (val.toUpperCase().startsWith(p.toUpperCase())) {
              const numPart = val.slice(p.length).replace(/^[^\d]*/, "");
              const num = parseInt(numPart, 10);
              if (!isNaN(num) && num > maxNum && num < 10000000) maxNum = num;
              break;
            }
          }
        });
        const nextNum = maxNum >= (cfg.start || 1) ? maxNum + 1 : (cfg.start || 1);
        const nextId = cfg.prefix + String(nextNum).padStart(cfg.digits || 3, "0");
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ nextId, nextNum, storeName: targetStore }));
        return;
      }

      if (req.method === 'GET') {
        const store = loadSyncStore();
        const items = store[storeName] || [];
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(items));
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const item = payload.item || payload;
            if (!item || !item.id) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing item or item.id' }));
              return;
            }
            const store = loadSyncStore();
            if (!store[storeName]) store[storeName] = [];
            const idx = store[storeName].findIndex(x => String(x.id) === String(item.id));
            if (idx >= 0) {
              store[storeName][idx] = { ...store[storeName][idx], ...item };
            } else {
              store[storeName].push(item);
            }
            saveSyncStore(store);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, item }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      if (req.method === 'DELETE' && itemId) {
        const store = loadSyncStore();
        if (store[storeName]) {
          store[storeName] = store[storeName].filter(x => String(x.id) !== String(itemId));
          saveSyncStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
    }

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
      console.error(`[Error] Port ${port} is already in use.`);
      process.exit(1);
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
