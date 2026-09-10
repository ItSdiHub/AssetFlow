const fs = require('fs');

function extractFunctions(filename) {
  const js = fs.readFileSync(filename, 'utf8');
  const lines = js.split('\n');
  const results = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (
      (trimmed.match(/^\s*(async\s+)?[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/) ||
       trimmed.match(/\s*(async\s+)?function\s+[a-zA-Z_$]/) ||
       trimmed.match(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[:=]\s*(async\s+)?(function|\()/)
      ) && !trimmed.startsWith('//')
    ) {
      results.push(`L${i+1}: ${trimmed.substring(0,100)}`);
    }
  });
  return results;
}

console.log('\n=== ASSETS.JS FUNCTIONS ===');
const assFns = extractFunctions('js/assets.js');
console.log(assFns.join('\n'));

console.log('\n=== APP.JS KEY AREAS ===');
const appJs = fs.readFileSync('js/app.js', 'utf8');

// Find report-related code
const reportLines = appJs.split('\n').map((l,i)=>({l,i}))
  .filter(x => x.l.includes('report') || x.l.includes('Report') || x.l.includes('repOrg') || x.l.includes('printReport') || x.l.includes('exportReport'))
  .slice(0,40);
console.log('\nREPORT REFERENCES IN APP.JS:');
reportLines.forEach(x => console.log(`  L${x.i+1}: ${x.l.trim().substring(0,120)}`));

// Find warehouse/installation related
const warehouseLines = appJs.split('\n').map((l,i)=>({l,i}))
  .filter(x => x.l.match(/warehouse|Warehouse|install|Install|صرف|مستودع/i))
  .slice(0,40);
console.log('\nWAREHOUSE/INSTALL REFERENCES IN APP.JS:');
warehouseLines.forEach(x => console.log(`  L${x.i+1}: ${x.l.trim().substring(0,120)}`));

// Find history references
const histLines = appJs.split('\n').map((l,i)=>({l,i}))
  .filter(x => x.l.match(/history|History|transaction|Transaction/i))
  .slice(0,20);
console.log('\nHISTORY REFERENCES IN APP.JS:');
histLines.forEach(x => console.log(`  L${x.i+1}: ${x.l.trim().substring(0,120)}`));

console.log('\n=== DB.JS KEY STORE NAMES ===');
const dbJs = fs.readFileSync('js/db.js', 'utf8');
const storeMatches = dbJs.match(/['"]([a-zA-Z_]+)['"]\s*,\s*{.*keyPath/g) || 
                     dbJs.match(/objectStoreNames|createObjectStore\(['"]([^'"]+)['"]/g) || [];
console.log(storeMatches.slice(0,20));

// find all methods in db.js
const dbLines = dbJs.split('\n');
const dbMethods = dbLines.filter((l,i) => 
  l.match(/async\s+[a-zA-Z]/) || l.match(/^\s{2,}[a-zA-Z]+\s*\(/) 
).slice(0,50);
console.log('\nDB.JS METHODS:');
dbMethods.forEach(l => console.log(`  ${l.trim().substring(0,100)}`));

console.log('\n=== BUTTON ONCLICK FUNCTIONS IN HTML ===');
const html = fs.readFileSync('index.html', 'utf8');
const onclicks = html.match(/onclick="([^"]+)"/g) || [];
const uniqueFns = new Set();
onclicks.forEach(o => {
  const fn = o.replace('onclick="', '').replace('"', '').split('(')[0].trim();
  uniqueFns.add(fn);
});
console.log('Unique onclick functions:', [...uniqueFns].sort().join('\n  '));

console.log('\n=== CHECK: completeInstall in projects.js ===');
const projJs = fs.readFileSync('js/projects.js', 'utf8');
const installFns = projJs.split('\n').filter(l => l.match(/install|Install|complete|Complete/i)).slice(0,30);
installFns.forEach(l => console.log(`  ${l.trim().substring(0,120)}`));
