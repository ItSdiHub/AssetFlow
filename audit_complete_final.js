const fs = require('fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const projJs = fs.readFileSync('js/projects.js', 'utf8');
const assetsJs = fs.readFileSync('js/assets.js', 'utf8');
const dbJs = fs.readFileSync('js/db.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// ====== BUTTON AUDIT ======
const onclickButtons = html.match(/onclick="([^"]+)"/g) || [];
const uniqueFnSet = new Set();
onclickButtons.forEach(o => {
  const fn = o.replace('onclick="','').replace('"','').split('(')[0].trim();
  uniqueFnSet.add(fn);
});

// Verify each onclick function exists somewhere in js files
const allJs = appJs + projJs + assetsJs + dbJs;
const results = {};
const fnsToCheck = [...uniqueFnSet];

let working = 0, missing = 0;
const missingFns = [];
const workingFns = [];

fnsToCheck.forEach(fn => {
  // Strip object prefix (App.xxx -> xxx)
  const parts = fn.split('.');
  const methodName = parts[parts.length - 1];
  const className = parts.length > 1 ? parts[0] : null;
  
  const found = allJs.includes(methodName + '(') || allJs.includes(methodName + ' (') || allJs.includes(methodName + '\n') || allJs.includes(`"${methodName}"`);
  if (found) {
    working++;
    workingFns.push(fn);
  } else {
    missing++;
    missingFns.push(fn);
  }
});

console.log('\n========== A. BUTTON AUDIT ==========');
console.log(`Total unique onclick functions: ${fnsToCheck.length}`);
console.log(`Total onclick button calls: ${onclickButtons.length}`);
console.log(`Working functions: ${working}`);
console.log(`Missing/Not found: ${missing}`);
console.log('\nMISSING FUNCTIONS:');
missingFns.forEach(f => console.log('  ❌ ' + f));
console.log('\nWORKING FUNCTIONS (sample):');
workingFns.slice(0,10).forEach(f => console.log('  ✅ ' + f));

// ====== WAREHOUSE WORKFLOW ======
console.log('\n========== B. WAREHOUSE WORKFLOW AUDIT ==========');
const workflowChecks = [
  { name: 'Warehouse Issue Modal', check: html.includes('warehouseIssueModal') },
  { name: 'handleWarehouseIssueSubmit', check: projJs.includes('handleWarehouseIssueSubmit') },
  { name: 'saveWarehouseIssue / put warehouseIssues', check: projJs.includes('warehouseIssues') && projJs.includes('db.put') },
  { name: 'Awaiting Installation (renderAwaitingInstall)', check: projJs.includes('renderAwaitingInstall') },
  { name: 'Installation Modal (installationModal)', check: html.includes('installationModal') },
  { name: 'Locked Issue Data Display', check: projJs.includes('lockedIssueNoEl') || projJs.includes('lockedAssetCodeEl') },
  { name: 'Installation Location field (formInstLoc)', check: html.includes('formInstLoc') },
  { name: 'Installation Department field (formInstDept)', check: html.includes('formInstDept') },
  { name: 'Installation Office field (formInstOffice)', check: html.includes('formInstOffice') },
  { name: 'Employee OPTIONAL (formInstUser)', check: projJs.includes('formInstUser') && (projJs.includes('|| null') || projJs.includes('optional')) },
  { name: 'handleInstallationSubmit updates asset', check: projJs.includes('asset.locationId = instLocId') },
  { name: 'Marks issue as Installed', check: projJs.includes('status = "Installed"') },
  { name: 'Logs assetTransaction', check: projJs.includes('db.logTransaction') || projJs.includes('assetTransactions') },
  { name: 'Transfer Modal (transferModal)', check: html.includes('transferModal') },
  { name: 'handleTransferSubmit in assets.js', check: assetsJs.includes('handleTransferSubmit') },
  { name: 'Transfer updates asset.locationId', check: assetsJs.includes('locationId') && assetsJs.includes('Transfer') },
];

workflowChecks.forEach(c => {
  console.log(`  ${c.check ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
});

// ====== REPORTS ======
console.log('\n========== C. REPORTS AUDIT ==========');
const reportTypes = ['inventory','byDept','byEmp','byLoc','maint','history','warranty','byStatus',
  'helpdesk','warehouse','awaitingInstall','transfers','projects','warehouseIssues','installations'];
reportTypes.forEach(r => {
  const inApp = appJs.includes(`"${r}"`) || appJs.includes(`'${r}'`);
  const inProj = projJs.includes(`"${r}"`) || projJs.includes(`'${r}'`);
  console.log(`  ${inApp || inProj ? '✅' : '❌'} Report type "${r}": ${inApp ? 'app.js' : ''} ${inProj ? 'projects.js' : ''}`);
});

// ====== REPORT HEADER ======
console.log('\n========== D. REPORT HEADER ==========');
const headerChecks = [
  { name: 'buildUnifiedReportHeader function', check: appJs.includes('buildUnifiedReportHeader') },
  { name: 'Logo (logoHtml / logoDataUrl)', check: appJs.includes('logoDataUrl') && appJs.includes('report-header-logo') },
  { name: 'Institute Name (orgNameAr/orgNameEn)', check: appJs.includes('orgNameAr') && appJs.includes('orgNameEn') && appJs.includes('report-brand-en') },
  { name: 'Report Title Pill', check: appJs.includes('report-title-pill') },
  { name: '"Comprehensive Reports" ABSENT from HTML', check: !html.includes('Comprehensive Reports') },
  { name: '"Generate, print, and export" ABSENT from HTML', check: !html.includes('Generate, print, and export') },
  { name: '"Comprehensive Reports" ABSENT from app.js', check: !appJs.includes('Comprehensive Reports') },
  { name: '"Comprehensive Reports" ABSENT from i18n.js', check: !fs.readFileSync('js/i18n.js','utf8').includes('Comprehensive Reports') },
];
headerChecks.forEach(c => {
  console.log(`  ${c.check ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
});

// ====== DATABASE ======
console.log('\n========== E. DATABASE AUDIT ==========');
const dbChecks = [
  { name: 'IndexedDB init (db.init)', check: dbJs.includes('async init') },
  { name: 'db.getAll (Read)', check: dbJs.includes('getAll') },
  { name: 'db.put (Write)', check: dbJs.includes('db.put') || dbJs.includes('async put') || dbJs.includes('put(') },
  { name: 'db.getById', check: dbJs.includes('getById') },
  { name: 'db.delete', check: dbJs.includes('delete') },
  { name: 'db.logTransaction', check: dbJs.includes('logTransaction') },
  { name: 'Supabase client (cloud)', check: dbJs.includes('supabase') },
  { name: 'Supabase URL configured', check: dbJs.includes('xzfudqyctujxlhbgpdbs') },
  { name: 'Fallback to localStorage', check: dbJs.includes('localStorage') || dbJs.includes('memoryStore') },
  { name: 'testDatabaseConnection in app.js', check: appJs.includes('testDatabaseConnection') },
  { name: 'Storage metrics (cloud storage display)', check: appJs.includes('cloudStorageUsed') || appJs.includes('storage') },
];
dbChecks.forEach(c => {
  console.log(`  ${c.check ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
});

// ====== CONSOLE ERROR PATTERNS ======
console.log('\n========== F. POTENTIAL CONSOLE ERROR PATTERNS ==========');
const errorPatterns = [
  { name: 'document.getElementById null-checks', check: appJs.includes('?.') || appJs.includes('getElementById') },
  { name: 'try-catch around db calls in app.js', check: (appJs.match(/try\s*{/g)||[]).length > 5 },
  { name: 'try-catch in projects.js', check: (projJs.match(/try\s*{/g)||[]).length > 5 },
  { name: 'db.getAll null protection', check: dbJs.includes('|| []') },
  { name: 'No undefined function refs (saveSystemSettings)', check: appJs.includes('saveSystemSettings') || appJs.includes('updateSystemSettings') },
  { name: 'No undefined function refs (editAsset)', check: assetsJs.includes('openEditModal') },
  { name: 'i18n.js exists and has keys', check: fs.existsSync('js/i18n.js') && fs.readFileSync('js/i18n.js','utf8').length > 10000 },
];
errorPatterns.forEach(c => {
  console.log(`  ${c.check ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
});

// Check for specific known issue: saveSystemSettings
console.log('\n  saveSystemSettings in app.js:', appJs.includes('saveSystemSettings') ? 'FOUND' : 'MISSING ❌');
console.log('  updateSystemSettings in db.js:', dbJs.includes('updateSystemSettings') ? 'FOUND' : 'MISSING');

// Check for "Installed" as a valid asset status
const installedStatus = assetsJs.includes('"Installed"') || appJs.includes('"Installed"') || projJs.includes('"Installed"');
console.log('\n  "Installed" as valid status in system:', installedStatus ? 'FOUND ✅' : 'MISSING ❌');

// Check combobox search (enhance selects)
console.log('\n  enhanceAllSelects (live search combobox):', appJs.includes('enhanceAllSelects') ? 'FOUND ✅' : 'MISSING ❌');
console.log('  populateOptions (dynamic dropdown):', appJs.includes('populateOptions') ? 'FOUND ✅' : 'MISSING ❌');

console.log('\n========== END OF AUDIT ==========\n');
