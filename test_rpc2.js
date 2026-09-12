const https = require('https');

const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

const options = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/?apikey=' + SUPABASE_KEY,
  method: 'GET'
};
const req = https.get(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
        const spec = JSON.parse(body);
        if (spec.paths) {
            const rpcPaths = Object.keys(spec.paths).filter(p => p.startsWith('/rpc/'));
            console.log("Available RPC endpoints:");
            rpcPaths.forEach(p => console.log(p));
        } else {
            console.log("No paths in spec");
        }
    } catch(e) {
        console.log("Could not parse OpenAPI spec:", e.message);
    }
  });
});
