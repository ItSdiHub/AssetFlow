const fs = require('fs');
const https = require('https');

// Read url and key from db.js
const dbContent = fs.readFileSync('js/db.js', 'utf8');
const urlMatch = dbContent.match(/url:\s*["']([^"']+)["']/);
const keyMatch = dbContent.match(/anonKey:\s*["']([^"']+)["']/);

const url = urlMatch[1].replace('https://', '');
const key = keyMatch[1];

const tables = ["assets", "employees", "departments", "locations", "asset_types", "maintenance"];

async function check() {
    for (const t of tables) {
        await new Promise(res => {
            https.get({
                hostname: url,
                path: `/rest/v1/${t}?select=id&limit=1`,
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            }, (response) => {
                let body = '';
                response.on('data', d => body += d);
                response.on('end', () => {
                    console.log(`Table ${t}: status ${response.statusCode}, body: ${body.substring(0, 50)}`);
                    res();
                });
            });
        });
    }
}
check();
