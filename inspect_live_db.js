const https = require('https');
const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

function apiGet(path) {
  return new Promise((resolve) => {
    https.get({
      hostname: SUPABASE_URL,
      path: path,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on('error', (e) => resolve({ status: 500, error: e.message }));
  });
}

async function run() {
  console.log("=== INSPECTING EMPLOYEES & ASSETS LIVE COLUMNS ===");

  const empRes = await apiGet('/rest/v1/employees?select=*&limit=1');
  if (Array.isArray(empRes.body) && empRes.body.length > 0) {
    console.log("EMPLOYEES LIVE KEYS:", Object.keys(empRes.body[0]));
  } else {
    console.log("EMPLOYEES RES:", empRes);
  }

  const assetsRes = await apiGet('/rest/v1/assets?select=*&limit=1');
  if (Array.isArray(assetsRes.body) && assetsRes.body.length > 0) {
    console.log("ASSETS LIVE KEYS:", Object.keys(assetsRes.body[0]));
  } else {
    console.log("ASSETS RES:", assetsRes);
  }

  // Check locations table all records/types
  const locRes = await apiGet('/rest/v1/locations?select=id,name_ar,name_en,type,parent_id&limit=20');
  if (Array.isArray(locRes.body)) {
    console.log("\nLOCATIONS RECORDS SAMPLE (types):", locRes.body.map(l => ({ id: l.id, type: l.type, parent: l.parent_id, name: l.name_ar || l.name_en })));
  }
}

run();
