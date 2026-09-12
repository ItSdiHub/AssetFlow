const https = require('https');
const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

const tables = ["employees", "assets", "maintenance", "users", "helpdesk_requests", "notifications", "departments", "locations"];

async function getFirstRow(tbl) {
  return new Promise((resolve) => {
    https.get({
      hostname: SUPABASE_URL,
      path: `/rest/v1/${tbl}?select=*&limit=1`,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const data = JSON.parse(body);
                if (data.length > 0) resolve({ status: res.statusCode, keys: Object.keys(data[0]) });
                else resolve({ status: res.statusCode, keys: "Table empty, but exists" });
            } catch(e) {
                resolve({ status: res.statusCode, keys: "Parse error" });
            }
        } else {
            resolve({ status: res.statusCode, error: body });
        }
      });
    }).on('error', (e) => resolve({ status: 500, error: e.message }));
  });
}

async function run() {
    for (const tbl of tables) {
        const res = await getFirstRow(tbl);
        console.log(`\nTable: ${tbl} (Status: ${res.status})`);
        if (res.keys) console.log("Columns:", res.keys);
        if (res.error) console.log("Error:", res.error);
    }
}
run();
