const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');

// Find all buttons, links with onclick/actions, form submissions
const onclickRegex = /onclick=["']([^"']+)["']/g;
const onsubmitRegex = /onsubmit=["']([^"']+)["']/g;
const buttonRegex = /<button[\s\S]*?<\/button>/gi;
const aRegex = /<a[\s\S]*?<\/a>/gi;

const onclickList = [];
let m;
while ((m = onclickRegex.exec(html)) !== null) {
  onclickList.push(m[1].trim());
}

const onsubmitList = [];
while ((m = onsubmitRegex.exec(html)) !== null) {
  onsubmitList.push(m[1].trim());
}

const buttons = html.match(buttonRegex) || [];
const links = html.match(aRegex) || [];

console.log('--- HTML STATIC AUDIT ---');
console.log('Total <button> elements:', buttons.length);
console.log('Total <a> elements:', links.length);
console.log('Total onclick handlers:', onclickList.length);
console.log('Total onsubmit handlers:', onsubmitList.length);

// Extract function calls from onclicks
const handlers = new Set();
onclickList.forEach(c => {
  // e.g. App.switchTab('assets') -> App.switchTab
  const fnMatch = c.match(/([a-zA-Z0-9_$]+(\.[a-zA-Z0-9_$]+)?)\s*\(/);
  if (fnMatch) handlers.add(fnMatch[1]);
  else handlers.add(c);
});

onsubmitList.forEach(c => {
  const fnMatch = c.match(/([a-zA-Z0-9_$]+(\.[a-zA-Z0-9_$]+)?)\s*\(/);
  if (fnMatch) handlers.add(fnMatch[1]);
  else handlers.add(c);
});

console.log('\nUnique Functions / Handler Targets:', handlers.size);
Array.from(handlers).sort().forEach(h => console.log('  -', h));

// Also check buttons generated dynamically inside JS files
const jsFiles = ['app.js', 'assets.js', 'projects.js', 'maintenance.js', 'treeView.js', 'users.js'];
console.log('\n--- DYNAMIC BUTTONS AUDIT IN JS FILES ---');
jsFiles.forEach(f => {
  const content = fs.readFileSync(path.join('js', f), 'utf8');
  const dynButtons = content.match(/<button[\s\S]*?<\/button>/gi) || [];
  const dynOnclicks = [];
  let dm;
  const dynOnclickRegex = /onclick=["']([^"']+)["']/g;
  while ((dm = dynOnclickRegex.exec(content)) !== null) {
    dynOnclicks.push(dm[1].trim());
  }
  console.log(`File: js/${f} -> ${dynButtons.length} dynamic buttons, ${dynOnclicks.length} dynamic onclicks`);
});
