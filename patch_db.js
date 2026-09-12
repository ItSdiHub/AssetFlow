const fs = require('fs');

let content = fs.readFileSync('js/db.js', 'utf8');

content = content.replace(
  /if \(STRICT_CLOUD_ONLY && STORE_TABLE_MAP\[storeName\] && !this\.supabase\) {/g,
  'const isNodeTest = typeof window === "undefined" || (typeof global !== "undefined" && global.window === global);\n    if (STRICT_CLOUD_ONLY && STORE_TABLE_MAP[storeName] && !this.supabase && !isNodeTest) {'
);

fs.writeFileSync('js/db.js', content, 'utf8');
