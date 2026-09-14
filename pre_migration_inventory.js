const https = require('https');

const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

const tables = [
  "locations",
  "departments",
  "offices",
  "employees",
  "assets",
  "warehouse_issues",
  "asset_transfers",
  "asset_transactions",
  "maintenance"
];

function fetchTable(table) {
  return new Promise((resolve) => {
    https.get({
      hostname: SUPABASE_URL,
      path: `/rest/v1/${table}?select=*`,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            resolve({ table, status: 200, count: data.length, data });
          } catch (e) {
            resolve({ table, status: 200, count: 0, error: "Parse error", raw: body });
          }
        } else {
          resolve({ table, status: res.statusCode, count: 0, error: body });
        }
      });
    }).on('error', (err) => {
      resolve({ table, status: 500, count: 0, error: err.message });
    });
  });
}

async function runInventory() {
  console.log("=== PRE-MIGRATION DATABASE INVENTORY ===");
  for (const t of tables) {
    const res = await fetchTable(t);
    console.log(`\nTable: ${t}`);
    console.log(`Status: ${res.status}, Count: ${res.count}`);
    if (res.error) {
      console.log(`Error/Note: ${res.error}`);
    } else if (res.count > 0 && t === 'assets') {
      const withOffice = res.data.filter(a => a.office && a.office.trim() !== '');
      const uniqueOffices = [...new Set(withOffice.map(a => a.office))];
      console.log(`Assets with non-empty 'office': ${withOffice.length}`);
      console.log(`Unique legacy office values:`, uniqueOffices);
    } else if (res.count > 0 && t === 'employees') {
      const withOfficeId = res.data.filter(e => e.office_id);
      console.log(`Employees with office_id: ${withOfficeId.length}`);
    } else if (res.count > 0 && t === 'departments') {
      const nullLoc = res.data.filter(d => !d.location_id);
      console.log(`Departments with NULL location_id: ${nullLoc.length}`);
    }
  }
}

runInventory();
