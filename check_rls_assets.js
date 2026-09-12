const https = require('https');
const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

const data = JSON.stringify({ asset_id: 'TEST-RLS', brand: 'TEST' });

const req = https.request({
  hostname: SUPABASE_URL,
  path: `/rest/v1/assets`,
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  }
}, (res) => {
  console.log(`POST assets status: ${res.statusCode}`);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', body));
});
req.write(data);
req.end();
