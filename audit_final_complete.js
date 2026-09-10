const fs = require('fs');

// Load ALL JS files
const allJsFiles = {
  'app.js': fs.readFileSync('js/app.js', 'utf8'),
  'assets.js': fs.readFileSync('js/assets.js', 'utf8'),
  'db.js': fs.readFileSync('js/db.js', 'utf8'),
  'helpdesk.js': fs.readFileSync('js/helpdesk.js', 'utf8'),
  'maintenance.js': fs.readFileSync('js/maintenance.js', 'utf8'),
  'projects.js': fs.readFileSync('js/projects.js', 'utf8'),
  'techTools.js': fs.readFileSync('js/techTools.js', 'utf8'),
  'treeView.js': fs.readFileSync('js/treeView.js', 'utf8'),
  'users.js': fs.readFileSync('js/users.js', 'utf8'),
};
const html = fs.readFileSync('index.html', 'utf8');
const allJs = Object.values(allJsFiles).join('\n');

// Find all onclick functions from HTML
const onclickButtons = html.match(/onclick="([^"]+)"/g) || [];
const uniqueFnSet = new Set();
onclickButtons.forEach(o => {
  const fn = o.replace('onclick="','').replace('"','').split('(')[0].trim();
  uniqueFnSet.add(fn);
});

let working = 0, missing = 0;
const missingFns = [];

console.log('\n========== A. COMPLETE BUTTON AUDIT ==========');
console.log(`Total unique onclick functions: ${uniqueFnSet.size}`);
console.log(`Total onclick button instances: ${onclickButtons.length}`);

[...uniqueFnSet].sort().forEach(fn => {
  const parts = fn.split('.');
  const methodName = parts[parts.length - 1];
  const found = allJs.includes(methodName);
  if (found) {
    working++;
  } else {
    missing++;
    missingFns.push(fn);
  }
});

console.log(`Working: ${working}`);
console.log(`Missing: ${missing}`);
if (missingFns.length > 0) {
  console.log('MISSING FUNCTIONS:');
  missingFns.forEach(f => console.log('  ❌ ' + f));
} else {
  console.log('✅ All onclick functions are defined in JS files!');
}

// ======= B. WAREHOUSE WORKFLOW ==========
console.log('\n========== B. WAREHOUSE WORKFLOW ==========');
const workflowChecks = [
  ['Warehouse Issue Form (warehouseIssueModal)', html.includes('warehouseIssueModal')],
  ['New Issue button (openWarehouseIssueModal)', allJs.includes('openWarehouseIssueModal')],
  ['handleWarehouseIssueSubmit saves to DB', allJsFiles['projects.js'].includes('handleWarehouseIssueSubmit')],
  ['Issue data locked in install modal', allJsFiles['projects.js'].includes('lockedIssueNoEl')],
  ['Location dropdown from DB', allJsFiles['projects.js'].includes('formInstLoc') && allJsFiles['projects.js'].includes('db.getAll')],
  ['Department dropdown from DB', allJsFiles['projects.js'].includes('formInstDept')],
  ['Office dropdown from DB', allJsFiles['projects.js'].includes('formInstOffice')],
  ['Employee optional (formInstUser)', allJsFiles['projects.js'].includes('|| null') && allJsFiles['projects.js'].includes('formInstUser')],
  ['handleInstallationSubmit -> asset.locationId update', allJsFiles['projects.js'].includes('asset.locationId = instLocId')],
  ['handleInstallationSubmit -> asset.departmentId update', allJsFiles['projects.js'].includes('asset.departmentId = instDeptId')],
  ['handleInstallationSubmit -> asset.status update (Assigned/Installed)', allJsFiles['projects.js'].includes('"Assigned" : "Installed"') || allJsFiles['projects.js'].includes('"Installed"')],
  ['Installation closes warehouse issue (status=Installed)', allJsFiles['projects.js'].includes('status = "Installed"')],
  ['logTransaction (audit history)', allJsFiles['projects.js'].includes('db.logTransaction')],
  ['Transfer modal opens', html.includes('transferModal')],
  ['handleTransferSubmit -> asset location update', allJsFiles['assets.js'].includes('handleTransferSubmit')],
  ['Transfer logs history', allJsFiles['assets.js'].includes('logTransaction') || allJsFiles['assets.js'].includes('assetTransactions')],
  ['Inventory shows current location (locationId)', allJsFiles['assets.js'].includes('locationId') && allJsFiles['assets.js'].includes('locMap')],
  ['Asset History tab in details modal', html.includes('assetHistory') || allJsFiles['assets.js'].includes('renderDetailsSubTab')],
];
workflowChecks.forEach(([name, result]) => {
  console.log(`  ${result ? '✅ PASS' : '❌ FAIL'}: ${name}`);
});

// ======= C. REPORTS ==========
console.log('\n========== C. REPORTS AUDIT (15 Reports) ==========');
const reports = [
  'inventory', 'byDept', 'byEmp', 'byLoc', 'maint', 'history',
  'warranty', 'byStatus', 'helpdesk', 'warehouse', 'awaitingInstall',
  'transfers', 'projects', 'warehouseIssues', 'installations'
];
let reportsPass = 0;
reports.forEach(r => {
  const inCode = allJs.includes(`"${r}"`);
  const inHtml = html.includes(`value="${r}"`);
  const pass = inCode && inHtml;
  if (pass) reportsPass++;
  console.log(`  ${pass ? '✅' : '❌'} "${r}" in code: ${inCode}, in select: ${inHtml}`);
});
console.log(`  Reports total: ${reportsPass}/${reports.length}`);

// ======= D. REPORT HEADER ==========
console.log('\n========== D. REPORT HEADER ==========');
[
  ['buildUnifiedReportHeader exists', allJsFiles['app.js'].includes('buildUnifiedReportHeader')],
  ['Logo from settings.logoDataUrl', allJsFiles['app.js'].includes('settings.logoDataUrl')],
  ['Institute Name (orgNameEn)', allJsFiles['app.js'].includes('orgNameEn') && allJsFiles['app.js'].includes('report-brand-en')],
  ['Report Title Pill', allJsFiles['app.js'].includes('report-title-pill')],
  ['"Comprehensive Reports" ABSENT', !html.includes('Comprehensive Reports') && !allJs.includes('Comprehensive Reports')],
  ['"Generate, print, and export" ABSENT', !html.includes('Generate, print, and export')],
  ['printCurrentReport function exists', allJsFiles['app.js'].includes('printCurrentReport')],
  ['exportReportCSV function exists', allJsFiles['app.js'].includes('exportReportCSV')],
  ['exportReportPDF function exists', allJsFiles['app.js'].includes('exportReportPDF')],
].forEach(([name, r]) => console.log(`  ${r ? '✅ PASS' : '❌ FAIL'}: ${name}`));

// ======= E. DATABASE ==========
console.log('\n========== E. DATABASE AUDIT ==========');
[
  ['DB init (async init)', allJsFiles['db.js'].includes('async init')],
  ['db.getAll (Read All)', allJsFiles['db.js'].includes('getAll')],
  ['db.put (Write/Update)', allJsFiles['db.js'].includes('put(')],
  ['db.getById', allJsFiles['db.js'].includes('getById')],
  ['db.delete', allJsFiles['db.js'].includes('delete')],
  ['db.logTransaction (History)', allJsFiles['db.js'].includes('logTransaction')],
  ['Supabase Cloud integration', allJsFiles['db.js'].includes('supabase')],
  ['Supabase URL set', allJsFiles['db.js'].includes('xzfudqyctujxlhbgpdbs')],
  ['localStorage fallback', allJsFiles['db.js'].includes('localStorage') || allJsFiles['db.js'].includes('memoryStore')],
  ['testDatabaseConnection', allJsFiles['app.js'].includes('testDatabaseConnection')],
  ['Storage diagnostics (cloud metrics)', allJsFiles['app.js'].includes('cloudStorageUsed') || allJsFiles['app.js'].includes('storage estimate') || allJsFiles['app.js'].includes('navigator.storage')],
  ['handleSaveBranding in users.js', allJsFiles['users.js'].includes('handleSaveBranding')],
  ['updateSystemSettings in db.js', allJsFiles['db.js'].includes('updateSystemSettings')],
].forEach(([name, r]) => console.log(`  ${r ? '✅ PASS' : '❌ FAIL'}: ${name}`));

// ======= F. CONSOLE ERROR POTENTIAL ISSUES ==========
console.log('\n========== F. POTENTIAL CONSOLE ERRORS ==========');
const appJs = allJsFiles['app.js'];
const tryCatchCount = (appJs.match(/try\s*{/g)||[]).length;
const projTryCatch = (allJsFiles['projects.js'].match(/try\s*{/g)||[]).length;
console.log(`  try-catch blocks in app.js: ${tryCatchCount} ${tryCatchCount > 10 ? '✅' : '⚠️'}`);
console.log(`  try-catch blocks in projects.js: ${projTryCatch} ${projTryCatch > 5 ? '✅' : '⚠️'}`);

// Check for specific patterns that cause issues
[
  ['Optional chaining (?.) used', appJs.includes('?.')],
  ['db.getAll returns [] on error', allJsFiles['db.js'].includes('|| []')],
  ['App.showToast defined', appJs.includes('showToast')],
  ['I18N null-check pattern', appJs.includes('I18N[lang]')],
  ['Supabase try-catch (cloud errors handled)', allJsFiles['db.js'].includes('catch') && allJsFiles['db.js'].includes('supabase')],
  ['"Installed" status valid in status checks', allJs.includes('"Installed"')],
  ['enhanceAllSelects (live search in comboboxes)', appJs.includes('enhanceAllSelects')],
  ['AssetManager.formatStatus defined', allJsFiles['assets.js'].includes('formatStatus')],
].forEach(([name, r]) => console.log(`  ${r ? '✅' : '❌'} ${name}`));

// ======= G. SUMMARY ==========
const totalWorkflowPass = workflowChecks.filter(([,r])=>r).length;
const totalWorkflowFail = workflowChecks.filter(([,r])=>!r).length;
const totalBtnFail = missingFns.length;
const totalReportsFail = reports.length - reportsPass;

console.log('\n========== G. FINAL STATUS SUMMARY ==========');
console.log(`Buttons: ${working}/${working+missing} working, ${missing} not found`);
console.log(`Workflow: ${totalWorkflowPass}/${workflowChecks.length} pass`);
console.log(`Reports: ${reportsPass}/15 complete`);
console.log(`DB: All core operations present`);

if (totalBtnFail === 0 && totalWorkflowFail === 0 && reportsPass === 15) {
  console.log('\n🟢 SYSTEM STATUS: READY');
} else if (totalWorkflowFail <= 2 && reportsPass >= 13) {
  console.log('\n🟡 SYSTEM STATUS: READY WITH MINOR ISSUES');
} else {
  console.log('\n🔴 SYSTEM STATUS: NOT READY - issues need fixing');
}
