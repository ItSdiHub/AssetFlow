const fs = require('fs');
const path = require('path');

const arabicRegex = /[\u0600-\u06FF]/;

console.log("=================================================================");
console.log("TEST: VERIFY ZERO ARABIC IN ENGLISH MODE (AND PROPER ARABIC MODE)");
console.log("=================================================================\n");

let errors = [];

// 1. Check I18N.en for any Arabic
const i18nCode = fs.readFileSync('js/i18n.js', 'utf8');
const i18nSandbox = {};
new Function('window', i18nCode)(i18nSandbox);
const I18N = i18nSandbox.I18N;
const en = I18N.en;
const ar = I18N.ar;

for (const [k, v] of Object.entries(en)) {
  if (typeof v === 'string' && arabicRegex.test(v)) {
    errors.push(`[I18N.en] Key '${k}' contains Arabic: "${v}"`);
  }
}
console.log(`[PASS 1] I18N.en checked: ${Object.keys(en).length} keys, 0 Arabic.`);

// 2. Check index.html data-i18n keys
const html = fs.readFileSync('index.html', 'utf8');
const i18nKeyMatches = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
const uniqueKeys = [...new Set(i18nKeyMatches)];

uniqueKeys.forEach(k => {
  if (!en[k]) {
    errors.push(`[index.html] Key '${k}' is missing in I18N.en`);
  } else if (arabicRegex.test(en[k])) {
    errors.push(`[index.html] Key '${k}' in I18N.en has Arabic: "${en[k]}"`);
  }
});
console.log(`[PASS 2] index.html data-i18n keys checked: ${uniqueKeys.length} keys match I18N.en.`);

// 3. Check formatters in English mode
const formatStatus = i18nSandbox.formatStatus;
const formatRole = i18nSandbox.formatRole;
const formatTxType = i18nSandbox.formatTxType;
const formatCondition = i18nSandbox.formatCondition;
const formatHandoverStatus = i18nSandbox.formatHandoverStatus;
const getEntityName = i18nSandbox.getEntityName;
const getUserDisplayName = i18nSandbox.getUserDisplayName;

const statuses = ["Available", "Assigned", "Under Maintenance", "In Store", "Damaged", "Lost", "Retired", "Disposed"];
statuses.forEach(s => {
  const res = formatStatus(s, "en");
  if (arabicRegex.test(res)) errors.push(`formatStatus('${s}', 'en') returned Arabic: "${res}"`);
});

const roles = ["Administrator", "IT User", "Employee", "Viewer"];
roles.forEach(r => {
  const res = formatRole(r, "en");
  if (arabicRegex.test(res)) errors.push(`formatRole('${r}', 'en') returned Arabic: "${res}"`);
});

const txTypes = ["Added", "Assigned", "Received", "Returned", "Transferred", "Sent to Maintenance", "Returned from Maintenance", "Retired", "Disposed"];
txTypes.forEach(t => {
  const res = formatTxType(t, "en");
  if (arabicRegex.test(res)) errors.push(`formatTxType('${t}', 'en') returned Arabic: "${res}"`);
});

const conditions = ["Good", "Minor Damage", "Damaged", "Not Working"];
conditions.forEach(c => {
  const res = formatCondition(c, "en");
  if (arabicRegex.test(res)) errors.push(`formatCondition('${c}', 'en') returned Arabic: "${res}"`);
});

const handovers = ["Received", "Pending"];
handovers.forEach(h => {
  const res = formatHandoverStatus(h, "en");
  if (arabicRegex.test(res)) errors.push(`formatHandoverStatus('${h}', 'en') returned Arabic: "${res}"`);
});

console.log("[PASS 3] All formatters verified: 0 Arabic in English mode.");

// 4. Test Database Seed and Entities in English
const dbCode = fs.readFileSync('js/db.js', 'utf8');
const dbSandbox = {
  window: {},
  console: console,
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; },
    removeItem(k) { delete this.data[k]; }
  }
};
new Function('window', 'console', 'localStorage', dbCode)(dbSandbox.window, console, dbSandbox.localStorage);
const db = dbSandbox.window.db;

db.init().then(async () => {
  const employees = await db.getAll('employees');
  const departments = await db.getAll('departments');
  const locations = await db.getAll('locations');
  const assetTypes = await db.getAll('assetTypes');
  const helpdeskRequests = await db.getAll('helpdeskRequests');
  const notifications = await db.getAll('notifications');
  const users = await db.getAll('users');
  const assets = await db.getAll('assets');

  employees.forEach(e => {
    const name = getEntityName(e, "en");
    if (arabicRegex.test(name)) errors.push(`Employee ${e.id} getEntityName returned Arabic: "${name}"`);
  });

  departments.forEach(d => {
    const name = getEntityName(d, "en");
    if (arabicRegex.test(name)) errors.push(`Department ${d.id} getEntityName returned Arabic: "${name}"`);
  });

  locations.forEach(l => {
    const name = getEntityName(l, "en");
    if (arabicRegex.test(name)) errors.push(`Location ${l.id} getEntityName returned Arabic: "${name}"`);
  });

  assetTypes.forEach(t => {
    const name = getEntityName(t, "en");
    if (arabicRegex.test(name)) errors.push(`AssetType ${t.id} getEntityName returned Arabic: "${name}"`);
  });

  users.forEach(u => {
    const name = getUserDisplayName(u, "en");
    if (arabicRegex.test(name)) errors.push(`User ${u.username} getUserDisplayName returned Arabic: "${name}"`);
  });

  helpdeskRequests.forEach(r => {
    const subject = r.subjectEn || r.subject;
    const desc = r.descriptionEn || r.description;
    if (arabicRegex.test(subject)) errors.push(`Request ${r.requestId} subjectEn returned Arabic: "${subject}"`);
    if (arabicRegex.test(desc)) errors.push(`Request ${r.requestId} descriptionEn returned Arabic: "${desc}"`);
  });

  notifications.forEach(n => {
    const title = n.titleEn || n.titleAr;
    const msg = n.messageEn || n.messageAr;
    if (arabicRegex.test(title)) errors.push(`Notification ${n.id} titleEn returned Arabic: "${title}"`);
    if (arabicRegex.test(msg)) errors.push(`Notification ${n.id} messageEn returned Arabic: "${msg}"`);
  });

  console.log(`[PASS 4] DB Entities verified in English mode (${employees.length} employees, ${departments.length} depts, ${locations.length} locs, ${users.length} users, ${assets.length} assets, ${helpdeskRequests.length} requests, ${notifications.length} notifs).`);

  // 5. Check Arabic Mode Parity
  employees.forEach(e => {
    const name = getEntityName(e, "ar");
    if (!name || name === "-") errors.push(`Employee ${e.id} missing Arabic name: "${name}"`);
  });

  departments.forEach(d => {
    const name = getEntityName(d, "ar");
    if (!name || name === "-") errors.push(`Department ${d.id} missing Arabic name: "${name}"`);
  });

  console.log("[PASS 5] Arabic Mode Parity verified.");

  console.log("\n=================================================================");
  if (errors.length === 0) {
    console.log("SUCCESS: 100% CLEAN! ZERO ARABIC CHARACTERS IN ENGLISH MODE.");
    console.log("=================================================================");
    process.exit(0);
  } else {
    console.error(`FAILED with ${errors.length} errors:`);
    errors.forEach(e => console.error(" - " + e));
    console.log("=================================================================");
    process.exit(1);
  }
});
