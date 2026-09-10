const fs = require('fs');

// Mock browser environment for App.generateSelectedReport()
global.window = global;
global.document = {
  getElementById: (id) => {
    if (!global._elements) global._elements = {};
    if (!global._elements[id]) {
      global._elements[id] = {
        value: '',
        innerText: '',
        innerHTML: '',
        textContent: '',
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }
    return global._elements[id];
  },
  createElement: (tag) => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    appendChild: () => {},
    setAttribute: () => {}
  }),
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { appendChild: () => {}, removeChild: () => {}, setAttribute: () => {} },
  documentElement: { lang: 'ar', dir: 'rtl', setAttribute: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.__SDI_TEST_ENV__ = true;

// Load i18n
require('./js/i18n.js');
// Load db
require('./js/db.js');

async function testReports() {
  await db.init();
  console.log('Database initialized.');

  // Check all 15 report types
  const reportTypes = [
    'inventory',
    'byDept',
    'byEmp',
    'byLoc',
    'maint',
    'history',
    'warranty',
    'byStatus',
    'helpdesk',
    'warehouse',
    'awaitingInstall',
    'transfers',
    'projects',
    'warehouseIssues',
    'installations'
  ];

  // Load dependencies
  require('./js/assets.js');
  require('./js/projects.js');
  require('./js/maintenance.js');

  const appCode = fs.readFileSync('js/app.js', 'utf8');
  eval(appCode);

  global.AppState = {
    lang: 'ar',
    currentUser: { id: 'usr-1', username: 'admin', role: 'Administrator', fullName: 'System Admin' }
  };

  const app = global.App || new Application();
  global.App = app;

  console.log('\n--- TESTING ALL 15 REPORTS WITH UNIFIED HEADER AND ZERO MARKETING PHRASES ---');
  for (const rep of reportTypes) {
    global.document.getElementById('reportSelect').value = rep;
    global.document.getElementById('reportSearchInput').value = '';
    global.document.getElementById('reportFilterType').value = '';
    global.document.getElementById('reportFilterStatus').value = '';
    global.document.getElementById('reportFilterDept').value = '';
    global.document.getElementById('reportFilterLoc').value = '';
    global.document.getElementById('reportFilterEmp').value = '';
    global.document.getElementById('reportFilterDateFrom').value = '';
    global.document.getElementById('reportFilterDateTo').value = '';

    const reportArea = global.document.getElementById('printableReportArea');
    reportArea.innerHTML = '';

    try {
      await app.generateSelectedReport();
      const html = reportArea.innerHTML;
      const hasTable = html.includes('<table');
      const hasUnifiedHeader = html.includes('unified-report-header');
      const hasInstitute = html.includes('معهد الشارقة للسياقة') || html.includes('Sharjah Driving Institute');
      const hasLogo = html.includes('report-header-logo') || html.includes('fa-car');
      
      const containsComprehensive = html.includes('Comprehensive Reports') || html.includes('Comprehensive Asset Inventory Report');
      const containsMarketingSubtitle = html.includes('Generate, print, and export official asset inventory reports') || html.includes('استخراج وطباعة وتصدير كشوفات الجرد');

      if (containsComprehensive) {
        throw new Error(`Report '${rep}' still contains 'Comprehensive' in header/title!`);
      }
      if (containsMarketingSubtitle) {
        throw new Error(`Report '${rep}' still contains marketing subtitle!`);
      }
      if (!hasUnifiedHeader) {
        throw new Error(`Report '${rep}' missing unified-report-header!`);
      }
      if (!hasInstitute) {
        throw new Error(`Report '${rep}' missing Institute Name!`);
      }
      if (!hasLogo) {
        throw new Error(`Report '${rep}' missing Logo / Emblem!`);
      }

      const rowCount = (html.match(/<tr>/g) || []).length - 1; // subtract header

      console.log(`[PASS] Report '${rep}': Validated! Unified Header: OK | Logo: OK | Institute: OK | Clean Title: OK | Rows: ${rowCount > 0 ? rowCount : 'Notice displayed'}`);
    } catch (err) {
      console.error(`[FAIL] Report '${rep}' ERROR:`, err.message || err);
      process.exit(1);
    }
  }

  console.log('\n[ALL 15 REPORTS PASSED WITH FLYING COLORS]');
}

testReports().catch(err => {
  console.error(err);
  process.exit(1);
});
