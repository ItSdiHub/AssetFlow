const fs = require('fs');
const path = require('path');

console.log("================================================================================");
console.log("SDI IT ASSET HUB - COMPREHENSIVE DEEP SYSTEM AUDIT & VERIFICATION");
console.log("================================================================================");

const rootDir = __dirname;
const htmlPath = path.join(rootDir, 'index.html');
const jsDir = path.join(rootDir, 'js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1. Read all JS files
const jsFiles = ['i18n.js', 'db.js', 'app.js', 'assets.js', 'users.js', 'maintenance.js', 'helpdesk.js', 'projects.js', 'treeView.js', 'techTools.js'];
const jsContents = {};
let combinedJs = '';

jsFiles.forEach(file => {
  const p = path.join(jsDir, file);
  if (fs.existsSync(p)) {
    jsContents[file] = fs.readFileSync(p, 'utf8');
    combinedJs += '\n' + jsContents[file];
  } else {
    console.warn(`WARNING: File js/${file} not found.`);
  }
});

let issueCount = 0;
function logIssue(category, desc) {
  issueCount++;
  console.error(`❌ [${category}] ${desc}`);
}

function logSuccess(category, desc) {
  console.log(`✅ [${category}] ${desc}`);
}

// -----------------------------------------------------------------------------
// CHECK 1: HTML Element IDs referenced in JS but missing in index.html
// -----------------------------------------------------------------------------
console.log("\n--- 1. Checking document.getElementById references ---");
// Find all document.getElementById("A") || document.getElementById("B") expressions
const lines = combinedJs.split('\n');
const missingIds = new Set();
const verifiedIds = new Set();

lines.forEach(line => {
  if (line.includes('document.getElementById')) {
    const matches = Array.from(line.matchAll(/document\.getElementById\s*\(\s*["']([^"']+)["']\s*\)/g)).map(m => m[1]);
    if (matches.length > 0) {
      // If any of the IDs in the fallback chain exist in HTML, the call succeeds safely
      const hasAny = matches.some(id => new RegExp(`id=["']${id}["']`, 'i').test(htmlContent));
      if (!hasAny) {
        matches.forEach(id => missingIds.add(id));
      } else {
        matches.forEach(id => verifiedIds.add(id));
      }
    }
  }
});

if (missingIds.size > 0) {
  missingIds.forEach(id => logIssue('MISSING_HTML_ID', `Element ID #${id} is referenced in JS but missing in index.html`));
} else {
  logSuccess('HTML_IDS', `All ${verifiedIds.size} element IDs referenced in JS exist in index.html.`);
}

// -----------------------------------------------------------------------------
// CHECK 2: Onclick / Onsubmit Handlers in HTML defined in JS
// -----------------------------------------------------------------------------
console.log("\n--- 2. Checking HTML Inline Event Handlers (onclick/onsubmit/onchange) ---");
const eventMatches = htmlContent.matchAll(/(?:onclick|onsubmit|onchange|oninput)=["']([^"']+)["']/gi);
const handlers = new Set();
for (const match of eventMatches) {
  let expr = match[1].trim();
  let fnName = expr.split('(')[0].trim().replace(/^return\s+/, '');
  if (fnName && !fnName.startsWith('javascript:')) {
    handlers.add(fnName);
  }
}

// Global scope mock simulation to verify if functions exist
global.window = global;
global.document = {
  getElementById: () => ({ addEventListener: () => {}, querySelector: () => ({}), style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelector: () => ({ addEventListener: () => {}, style: {} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.localStorage = { getItem: () => null, setItem: () => {} };

try {
  eval(jsContents['i18n.js']);
  eval(jsContents['db.js']);
  global.db = window.db;
  eval(jsContents['app.js']);
  eval(jsContents['assets.js']);
  eval(jsContents['users.js']);
  eval(jsContents['maintenance.js']);
  eval(jsContents['helpdesk.js']);
  eval(jsContents['projects.js']);
  eval(jsContents['treeView.js']);
  eval(jsContents['techTools.js']);
} catch (e) {
  console.warn("Notice during eval:", e.message);
}

const missingHandlers = [];
handlers.forEach(fn => {
  const parts = fn.split('.');
  let curr = global;
  let found = true;
  for (const p of parts) {
    if (curr && curr[p] !== undefined) {
      curr = curr[p];
    } else {
      found = false;
      break;
    }
  }
  if (!found) {
    missingHandlers.push(fn);
  }
});

if (missingHandlers.length > 0) {
  missingHandlers.forEach(fn => logIssue('MISSING_EVENT_HANDLER', `HTML handler '${fn}' is not defined in global JS scope.`));
} else {
  logSuccess('EVENT_HANDLERS', `All ${handlers.size} inline event handlers in index.html are defined and executable.`);
}

// -----------------------------------------------------------------------------
// CHECK 3: i18n Translation Dictionary Parity (AR vs EN)
// -----------------------------------------------------------------------------
console.log("\n--- 3. Checking i18n Translation Keys Parity ---");
if (global.I18N && global.I18N.ar && global.I18N.en) {
  const arKeys = Object.keys(global.I18N.ar);
  const enKeys = Object.keys(global.I18N.en);
  
  const missingInEn = arKeys.filter(k => !(k in global.I18N.en));
  const missingInAr = enKeys.filter(k => !(k in global.I18N.ar));

  if (missingInEn.length > 0) {
    missingInEn.forEach(k => logIssue('I18N_PARITY', `Key '${k}' exists in Arabic dictionary but missing in English.`));
  }
  if (missingInAr.length > 0) {
    missingInAr.forEach(k => logIssue('I18N_PARITY', `Key '${k}' exists in English dictionary but missing in Arabic.`));
  }
  if (missingInEn.length === 0 && missingInAr.length === 0) {
    logSuccess('I18N_PARITY', `Translation dictionary has 100% parity (${arKeys.length} keys in AR and EN).`);
  }
} else {
  logIssue('I18N_PARITY', 'I18N dictionary global object missing or incomplete.');
}

// -----------------------------------------------------------------------------
// CHECK 4: HTML data-i18n, data-i18n-title, data-i18n-placeholder references
// -----------------------------------------------------------------------------
console.log("\n--- 4. Checking data-i18n tags in index.html ---");
const dataI18nMatches = htmlContent.matchAll(/data-i18n(?:-title|-placeholder)?=["']([^"']+)["']/g);
const missingI18nKeys = new Set();

for (const match of dataI18nMatches) {
  const key = match[1];
  if (global.I18N && global.I18N.ar && !(key in global.I18N.ar)) {
    missingI18nKeys.add(key);
  }
}

if (missingI18nKeys.size > 0) {
  missingI18nKeys.forEach(k => logIssue('MISSING_I18N_KEY', `HTML references data-i18n key '${k}' which is missing in dictionary.`));
} else {
  logSuccess('DATA_I18N_TAGS', `All data-i18n keys referenced in index.html exist in the dictionary.`);
}

// -----------------------------------------------------------------------------
// CHECK 5: Database Store Consistency
// -----------------------------------------------------------------------------
console.log("\n--- 5. Checking IndexedDB Store Schema & Primary Keys ---");
if (global.db && global.db.stores) {
  logSuccess('DB_STORES', `Database Engine initialized with stores: ${global.db.stores.join(', ')}`);
} else {
  logIssue('DB_STORES', 'DBEngine instance not found or missing stores property.');
}

console.log("\n================================================================================");
if (issueCount === 0) {
  console.log("✨ ALL SYSTEM INTEGRITY CHECKS PASSED WITH ZERO ISSUES FOUND!");
} else {
  console.log(`⚠️ AUDIT COMPLETED: Found ${issueCount} issues to address.`);
}
console.log("================================================================================");
