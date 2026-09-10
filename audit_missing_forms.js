const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');

// Find all buttons in index.html and their onclick or data attributes
const buttonMatches = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/gi)];
console.log(`Found ${buttonMatches.length} <button> elements in index.html`);

const onclicks = [];
for (const btn of buttonMatches) {
  const match = btn[0].match(/onclick=["']([^"']+)["']/i);
  if (match) {
    onclicks.push({
      buttonHtml: btn[0].replace(/\s+/g, ' ').substring(0, 100),
      onclick: match[1]
    });
  }
}

console.log(`Found ${onclicks.length} buttons with onclick attributes.`);

// Scan all js files for openModal calls
const jsFiles = ['index.html', 'js/app.js', 'js/assets.js', 'js/operations.js', 'js/maintenance.js', 'js/projects.js', 'js/helpdesk.js', 'js/users.js', 'js/reports.js', 'js/techTools.js'];
const openedModals = new Set();

for (const file of jsFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const regex = /openModal\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      openedModals.add(match[1]);
    }
  }
}

console.log(`\nTotal unique openModal targets found: ${openedModals.size}`);
const missingModals = [];
for (const m of openedModals) {
  const exists = html.includes(`id="${m}"`) || html.includes(`id='${m}'`);
  if (!exists) {
    missingModals.push(m);
    console.log(`[MISSING MODAL] ${m}`);
  } else {
    console.log(`[OK MODAL] ${m}`);
  }
}

// Also check all navigation tabs/views
console.log('\nChecking all tab / view links:');
const navLinks = [...html.matchAll(/data-tab=["']([^"']+)["']/gi)].map(m => m[1]);
const navViews = [...html.matchAll(/id=["']tab-([^"']+)["']/gi)].map(m => m[1]);
const viewContainers = [...html.matchAll(/class=["'][^"']*tab-content[^"']*["'][^>]*id=["']([^"']+)["']/gi)].map(m => m[1]);

console.log(`Found ${navLinks.length} data-tab links.`);
const missingViews = [];
for (const tab of navLinks) {
  const hasView = html.includes(`id="tab-${tab}"`) || html.includes(`id="${tab}"`) || html.includes(`id="view-${tab}"`);
  if (!hasView) {
    missingViews.push(tab);
    console.log(`[MISSING VIEW FOR TAB] ${tab}`);
  }
}

// Check all form tags and their IDs in index.html
const formMatches = [...html.matchAll(/<form[^>]*id=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
console.log(`\nFound ${formMatches.length} <form> tags in index.html:`);
console.log(formMatches.join(', '));

// Check any document.getElementById in js that refers to a form or input
const missingElementRefs = new Set();
for (const file of jsFiles) {
  if (file === 'index.html' || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const getElRegex = /getElementById\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = getElRegex.exec(content)) !== null) {
    const id = match[1];
    if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
      missingElementRefs.add({ file, id });
    }
  }
}

console.log(`\nTotal missing getElementById references in JS files: ${missingElementRefs.size}`);
for (const item of missingElementRefs) {
  console.log(`[MISSING ELEMENT] in ${item.file}: id="${item.id}"`);
}
