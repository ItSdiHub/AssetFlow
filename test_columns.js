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
  const empCols = ['id', 'employee_id', 'employee_number', 'name_ar', 'name_en', 'email', 'phone', 'job_title', 'department_id', 'location_id', 'office_id', 'office', 'status', 'notes', 'created_at'];
  console.log("=== EMPLOYEES COLUMNS ===");
  const empResults = await Promise.all(empCols.map(col => apiGet(`/rest/v1/employees?select=${col}&limit=1`).then(r => ({ col, status: r.status, msg: r.body?.message || 'EXISTS' }))));
  empResults.forEach(r => console.log(`employees.${r.col.padEnd(20)} : ${r.status === 200 ? 'EXISTS' : 'MISSING (' + r.msg + ')'}`));

  const assetCols = ['id', 'asset_id', 'asset_type_id', 'type_id', 'brand', 'model', 'serial', 'status', 'department_id', 'location_id', 'office_id', 'office', 'room', 'current_employee_id', 'project_id', 'specs', 'created_at'];
  console.log("\n=== ASSETS COLUMNS ===");
  const assetResults = await Promise.all(assetCols.map(col => apiGet(`/rest/v1/assets?select=${col}&limit=1`).then(r => ({ col, status: r.status, msg: r.body?.message || 'EXISTS' }))));
  assetResults.forEach(r => console.log(`assets.${r.col.padEnd(23)} : ${r.status === 200 ? 'EXISTS' : 'MISSING (' + r.msg + ')'}`));
}

run();
