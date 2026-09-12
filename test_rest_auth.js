const https = require('https');
const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

const payload = JSON.stringify({
  email: 'm_hamed@msn.com',
  password: 'Password123!' // I don't know the actual password, I am just showing I wrote a test script.
});

const req = https.request({
  hostname: SUPABASE_URL,
  path: `/auth/v1/token?grant_type=password`,
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', body));
});
req.write(payload);
req.end();
