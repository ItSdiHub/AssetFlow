const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');
const assetsJs = fs.readFileSync('js/assets.js', 'utf8');
const dbJs = fs.readFileSync('js/db.js', 'utf8');

console.log('\n========== STRUCTURE AUDIT ==========\n');

// 1. Find all tab IDs
const tabMatches = html.match(/id="(tab-[^"]+)"/g) || [];
const tabs = tabMatches.map(m => m.replace(/id="|"/g, ''));
console.log('TABS FOUND:', tabs);

// 2. Find all buttons with onclick
const buttonOnclicks = html.match(/onclick="([^"]+)"/g) || [];
console.log('\nTOTAL ONCLICK BUTTONS:', buttonOnclicks.length);

// 3. Find Warehouse related content
const warehouseInHtml = html.match(/(warehouse|Warehouse|صرف|مستودع)/g) || [];
console.log('\nWAREHOUSE REFERENCES IN HTML:', warehouseInHtml.length);

// 4. Find installation-related
const installInHtml = html.match(/(install|Install|تركيب|awaiting)/gi) || [];
console.log('INSTALL REFERENCES IN HTML:', installInHtml.length);

// 5. Find report select options
const reportOpts = html.match(/<option[^>]*value="[^"]*"[^>]*>/g) || [];
const reportSelectSection = html.match(/id="reportSelect"[^>]*>[\s\S]*?<\/select>/);
if (reportSelectSection) {
  const opts = reportSelectSection[0].match(/value="([^"]+)"/g) || [];
  console.log('\nREPORT OPTIONS:', opts.map(o => o.replace(/value="|"/g, '')));
}

// 6. Check for "Comprehensive Reports" text
console.log('\nCOMPREHENSIVE REPORTS in HTML:', html.includes('Comprehensive Reports') ? 'FOUND (BAD)' : 'NOT FOUND (GOOD)');
console.log('OLD DESCRIPTION in HTML:', html.includes('Generate, print, and export') ? 'FOUND (BAD)' : 'NOT FOUND (GOOD)');

// 7. Check header elements
const headerEls = ['repOrgName', 'repSubName', 'repLogoImg', 'reportTitle'];
headerEls.forEach(id => {
  console.log(`Report header #${id}:`, html.includes(`id="${id}"`) ? 'FOUND' : 'MISSING');
});

// 8. Check key app.js functions
const appFunctions = [
  'testDatabaseConnection', 'updateDashboard', 'filterActiveMaintenanceAndSwitch',
  'onCloudDataChange', 'applyLanguage', 'saveSystemSettings'
];
console.log('\nAPP.JS KEY FUNCTIONS:');
appFunctions.forEach(fn => {
  console.log(`  ${fn}:`, appJs.includes(fn) ? 'FOUND' : 'MISSING');
});

// 9. Check assets.js functions
const assetFunctions = [
  'saveAsset', 'editAsset', 'deleteAsset', 'filterAndSwitch', 
  'filterByDeptAndSwitch', 'filterByEmpAndSwitch', 'filterByLocAndSwitch',
  'printAssetLabel', 'exportReportCSV', 'exportReportPDF', 'generateReport'
];
console.log('\nASSETS.JS KEY FUNCTIONS:');
assetFunctions.forEach(fn => {
  console.log(`  ${fn}:`, assetsJs.includes(fn) ? 'FOUND' : 'MISSING');
});

// 10. Check db.js cloud functions
const dbFunctions = [
  'getAssets', 'addAsset', 'updateAsset', 'deleteAsset',
  'getEmployees', 'getDepartments', 'getLocations',
  'getSystemSettings', 'updateSystemSettings',
  'supabase', 'supabaseUrl'
];
console.log('\nDB.JS KEY FUNCTIONS/PROPERTIES:');
dbFunctions.forEach(fn => {
  console.log(`  ${fn}:`, dbJs.includes(fn) ? 'FOUND' : 'MISSING');
});

// 11. Check maintenance and helpdesk
const maintJs = fs.readFileSync('js/maintenance.js', 'utf8');
const helpdeskJs = fs.readFileSync('js/helpdesk.js', 'utf8');
console.log('\nMAINTENANCE.JS size:', maintJs.length, 'bytes');
console.log('HELPDESK.JS size:', helpdeskJs.length, 'bytes');

// 12. Find all form IDs
const formIds = html.match(/id="([^"]*[Ff]orm[^""]*)"/g) || [];
console.log('\nFORM IDs:', formIds.map(m => m.replace(/id="|"/g, '')));

// 13. Find modal IDs
const modalIds = html.match(/id="([^"]*[Mm]odal[^""]*)"/g) || [];
console.log('\nMODAL IDs:', modalIds.slice(0, 20).map(m => m.replace(/id="|"/g, '')));

// 14. Check transfer function
const transferFns = ['transferAsset', 'completeTransfer', 'Transfer'];
console.log('\nTRANSFER FUNCTIONS:');
transferFns.forEach(fn => {
  console.log(`  ${fn} in app.js:`, appJs.includes(fn) ? 'FOUND' : 'MISSING');
  console.log(`  ${fn} in assets.js:`, assetsJs.includes(fn) ? 'FOUND' : 'MISSING');
});

// 15. Check history
const historyFns = ['getHistory', 'addToHistory', 'assetHistory', 'historyTableBody'];
console.log('\nHISTORY FUNCTIONS/IDs:');
historyFns.forEach(fn => {
  const inApp = appJs.includes(fn);
  const inAssets = assetsJs.includes(fn);
  const inDb = dbJs.includes(fn);
  const inHtml = html.includes(fn);
  console.log(`  ${fn}: app=${inApp}, assets=${inAssets}, db=${inDb}, html=${inHtml}`);
});

console.log('\n========== AUDIT COMPLETE ==========\n');
