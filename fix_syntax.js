const fs = require('fs');
let content = fs.readFileSync('js/db.js', 'utf8');

// The issue is I injected `const isNodeTest = ...` in a scope where it's already defined.
// Let's just change it to var isNodeTest_fallback = ... and use that.
content = content.replace(
  /const isNodeTest = typeof process !== "undefined" && process\.versions && process\.versions\.node \|\| window\.__SDI_TEST_ENV__;\n    if \(!STRICT_CLOUD_ONLY \|\| !STORE_TABLE_MAP\[storeName\] \|\| isNodeTest\) {/g,
  'const isFallbackNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;\n    if (!STRICT_CLOUD_ONLY || !STORE_TABLE_MAP[storeName] || isFallbackNodeTest) {'
);

fs.writeFileSync('js/db.js', content, 'utf8');
