const https = require('https');
const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

async function fetchRows(tbl) {
  return new Promise((resolve) => {
    https.get({
      hostname: SUPABASE_URL,
      path: `/rest/v1/${tbl}?select=*&limit=3`,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
  });
}

async function run() {
    const users = await fetchRows('users');
    const emps = await fetchRows('employees');
    console.log("Users:", users.map(u => ({ id: u.id, username: u.username, employee_id: u.employee_id })));
    console.log("Employees:", emps.map(e => ({ id: e.id, employee_id: e.employee_id, name: e.name_en })));
}
run();
