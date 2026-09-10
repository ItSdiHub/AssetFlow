const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');

// List of all JS files in js/
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => path.join('js', f));

const results = [];

for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  // Match document.getElementById("...")
  const regex = /document\.getElementById\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const id = match[1];
    // Exclude dynamic IDs like ${...} or variables
    if (id.includes('$') || id.includes('+')) continue;
    
    // Check if id exists in index.html
    const inHtml = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    // Check if id might be dynamically generated in other js files
    let inOtherJs = false;
    for (const otherFile of jsFiles) {
      const otherCode = fs.readFileSync(otherFile, 'utf8');
      if (otherCode.includes(`id="${id}"`) || otherCode.includes(`id=\\'${id}\\'`) || otherCode.includes(`id="${id}"`)) {
        inOtherJs = true;
        break;
      }
    }
    
    if (!inHtml && !inOtherJs) {
      results.push({ file, id });
    }
  }
}

console.log(`Total missing static getElementById calls: ${results.length}`);
// Group by file
const grouped = {};
for (const r of results) {
  if (!grouped[r.file]) grouped[r.file] = new Set();
  grouped[r.file].add(r.id);
}

for (const [file, ids] of Object.entries(grouped)) {
  console.log(`\nFile: ${file} (${ids.size} missing IDs):`);
  for (const id of ids) {
    console.log(`  - ${id}`);
  }
}
