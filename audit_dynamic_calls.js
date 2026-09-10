const fs = require('fs');
const path = require('path');

const jsFiles = ['app.js', 'assets.js', 'projects.js', 'maintenance.js', 'treeView.js', 'users.js'];
const dynamicCalls = new Set();

jsFiles.forEach(f => {
  const content = fs.readFileSync(path.join('js', f), 'utf8');
  const dynOnclickRegex = /onclick=["']([^"']+)["']/g;
  let m;
  while ((m = dynOnclickRegex.exec(content)) !== null) {
    const expr = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
    const fnMatch = expr.match(/([a-zA-Z0-9_$]+(\.[a-zA-Z0-9_$]+)?)\s*\(/);
    if (fnMatch) dynamicCalls.add(fnMatch[1]);
    else dynamicCalls.add(expr);
  }
});

console.log('Unique Dynamic Handler Targets in JS Files:', dynamicCalls.size);
Array.from(dynamicCalls).sort().forEach(c => console.log('  -', c));
