/**
 * SDI IT Asset Hub - Test Supabase Cloud Connection & Sync
 */
const https = require('https');

console.log("=== Testing SDI IT Asset Hub Cloud Integration (Supabase) ===");

const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

function queryEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    };
    https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    }).on('error', reject);
  });
}

async function verifyCloud() {
  const assetsRes = await queryEndpoint('/rest/v1/assets?select=asset_id,brand,model,status');
  if (assetsRes.status === 200 && Array.isArray(assetsRes.data) && assetsRes.data.length > 0) {
    console.log(`PASS: Cloud Assets verified! Found ${assetsRes.data.length} registered assets.`);
  } else {
    console.error('FAIL: Could not verify cloud assets:', assetsRes);
    process.exit(1);
  }

  const maintRes = await queryEndpoint('/rest/v1/maintenance?select=id,problem,status');
  if (maintRes.status === 200 && Array.isArray(maintRes.data) && maintRes.data.length > 0) {
    console.log(`PASS: Cloud Maintenance / Helpdesk Tickets verified! Found ${maintRes.data.length} tickets.`);
  } else {
    console.error('FAIL: Could not verify cloud maintenance tickets:', maintRes);
    process.exit(1);
  }

  const deptsRes = await queryEndpoint('/rest/v1/departments?select=code,name_ar');
  if (deptsRes.status === 200 && Array.isArray(deptsRes.data) && deptsRes.data.length > 0) {
    console.log(`PASS: Cloud Departments verified! Found ${deptsRes.data.length} departments.`);
  } else {
    console.error('FAIL: Could not verify cloud departments:', deptsRes);
    process.exit(1);
  }

  const locsRes = await queryEndpoint('/rest/v1/locations?select=code,name_ar');
  if (locsRes.status === 200 && Array.isArray(locsRes.data) && locsRes.data.length > 0) {
    console.log(`PASS: Cloud Locations Hierarchy verified! Found ${locsRes.data.length} locations.`);
  } else {
    console.error('FAIL: Could not verify cloud locations:', locsRes);
    process.exit(1);
  }

  console.log("=== ALL SUPABASE CLOUD DATABASE TESTS PASSED 100% SUCCESS ===");
}

verifyCloud();
