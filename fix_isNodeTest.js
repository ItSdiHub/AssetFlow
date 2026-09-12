const fs = require('fs');

let content = fs.readFileSync('js/db.js', 'utf8');

// Replace all instances of the broken isNodeTest logic
content = content.replace(
  /const isNodeTest = typeof window === "undefined" \|\| \(typeof global !== "undefined" && global\.window === global\);/g,
  'const isNodeTest = typeof process !== "undefined" && process.versions && process.versions.node || window.__SDI_TEST_ENV__;'
);

// We also need to define window.__SDI_TEST_ENV__ = true in test_system.js, test_e2e_simulation.js, etc, or just rely on process.versions.node being present in JSDOM (which it is, since it's running in Node).

fs.writeFileSync('js/db.js', content, 'utf8');
console.log("Patched js/db.js");
