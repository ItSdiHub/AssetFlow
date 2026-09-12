const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');

content = content.replace(
  /await db\.init\(\);/g,
  'SUPABASE_CONFIG.allowDemoSeed = true;\n  await db.init();'
);

fs.writeFileSync('test_phase4.js', content, 'utf8');
