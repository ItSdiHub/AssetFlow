const fs = require('fs');

const projJs = fs.readFileSync('js/projects.js', 'utf8');

// Find all methods defined in OpsManager
const lines = projJs.split('\n');
const opsMethods = [];
let inOpsManager = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('OpsManager') && line.includes('{') && !line.includes('window.OpsManager')) {
    inOpsManager = true;
  }
  if (inOpsManager) {
    // Look for method definitions
    const methodMatch = line.match(/^\s*(async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (methodMatch && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      opsMethods.push(`L${i+1}: ${line.trim().substring(0,120)}`);
    }
  }
}

console.log('OpsManager METHODS:');
console.log(opsMethods.join('\n'));

// Check key installation functions
const keyFunctions = [
  'openInstallationModal', 'saveInstallation', 'completeInstall',
  'saveInstallationDraft', 'openWarehouseIssueModal', 'saveWarehouseIssue',
  'renderAwaitingInstall', 'handleAwaitingRowClick', 'toggleAwaitingTree',
  'openAwaitingTreeModal', 'viewCurrentAsset', 'viewCurrentIssue',
  'viewCurrentAssetHistory', 'switchSubTab', 'resetWarehouseIssueFilters',
  'resetAwaitingFilters', 'resetTransferFilters', 'render'
];

console.log('\n\nKEY FUNCTION CHECK:');
keyFunctions.forEach(fn => {
  const found = projJs.includes(fn);
  console.log(`  ${fn}: ${found ? 'FOUND' : 'MISSING'}`);
});

// Check installation form fields
const installFormFields = [
  'formInstAssetId', 'formInstIssueId', 'formInstBranch',
  'formInstLoc', 'formInstDept', 'formInstOffice',
  'formInstUser', 'formInstDate', 'formInstCondition', 'formInstNotes'
];

console.log('\nINSTALLATION FORM FIELDS IN PROJECTS.JS:');
installFormFields.forEach(f => {
  const found = projJs.includes(f);
  console.log(`  ${f}: ${found ? 'FOUND' : 'MISSING'}`);
});

// Check if installation actually updates asset location/dept/status
const assetUpdatePatterns = [
  'locationId', 'departmentId', 'status.*Assigned\|Assigned.*status',
  'updateAsset\|db.put.*asset', 'assetTransactions',
  'formInstLoc.*value\|value.*formInstLoc'
];

console.log('\nASSET UPDATE PATTERNS IN PROJECTS.JS:');
assetUpdatePatterns.forEach(p => {
  const regex = new RegExp(p, 'i');
  const found = regex.test(projJs);
  console.log(`  "${p}": ${found ? 'FOUND' : 'MISSING'}`);
});

// Find the saveInstallation or completeInstall function body
const saveInstIdx = projJs.indexOf('saveInstallation');
const completeInstIdx = projJs.indexOf('completeInstall');
console.log('\nsaveInstallation index:', saveInstIdx);
console.log('completeInstall index:', completeInstIdx);

if (saveInstIdx > 0) {
  console.log('\nsaveInstallation CONTEXT:');
  console.log(projJs.substring(saveInstIdx - 50, saveInstIdx + 800));
}

if (completeInstIdx > 0) {
  console.log('\ncompleteInstall CONTEXT:');
  console.log(projJs.substring(completeInstIdx - 50, completeInstIdx + 800));
}

// Check report header generation
const appJs = fs.readFileSync('js/app.js', 'utf8');
const reportHeaderIdx = appJs.indexOf('generateSelectedReport');
if (reportHeaderIdx > 0) {
  console.log('\n\ngenerateSelectedReport CONTEXT (first 1000 chars):');
  console.log(appJs.substring(reportHeaderIdx, reportHeaderIdx + 1000));
}

// Check if report has header with logo/org name
const reportSection = appJs.indexOf('repOrgName\|repSubName\|report-header\|reportOrgName');
console.log('\nReport org name element in app.js:', appJs.includes('repOrgName') ? 'FOUND' : 'MISSING');
console.log('Report logo element in app.js:', appJs.includes('repLogoImg') ? 'FOUND' : 'MISSING');

// Find where report HTML is built
const reportHtmlIdx = appJs.indexOf('function generateReport\|generateReport\|buildReportHeader');
const reportBuildIdx = appJs.indexOf('buildReportHeader');
console.log('buildReportHeader in app.js:', reportBuildIdx > 0 ? `FOUND at ${reportBuildIdx}` : 'MISSING');

// What does the report header look like?
const headerSearchIdx = appJs.indexOf('<div class="report-header"') || appJs.indexOf('report-header');
console.log('\nReport header HTML pattern at index:', headerSearchIdx);
if (headerSearchIdx > 0) {
  console.log(appJs.substring(headerSearchIdx - 100, headerSearchIdx + 500));
}
