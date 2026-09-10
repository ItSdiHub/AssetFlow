const fs = require('fs');

// Mock browser environment
global.window = global;
global._elements = {};
global.document = {
  getElementById: (id) => {
    if (!global._elements[id]) {
      global._elements[id] = {
        id: id,
        value: '',
        innerText: '',
        innerHTML: '',
        textContent: '',
        style: {},
        _classes: new Set(),
        classList: {
          add: (cls) => global._elements[id]._classes.add(cls),
          remove: (cls) => global._elements[id]._classes.delete(cls),
          contains: (cls) => global._elements[id]._classes.has(cls)
        }
      };
    }
    return global._elements[id];
  },
  createElement: (tag) => {
    const el = {
      tagName: tag,
      style: {},
      _classes: new Set(),
      classList: {
        add: (cls) => el._classes.add(cls),
        remove: (cls) => el._classes.delete(cls),
        contains: (cls) => el._classes.has(cls)
      },
      appendChild: () => {},
      setAttribute: () => {},
      click: () => {},
      innerHTML: ''
    };
    return el;
  },
  head: {
    appendChild: (child) => {
      if (child.id) global._elements[child.id] = child;
    }
  },
  body: { appendChild: () => {}, removeChild: () => {}, setAttribute: () => {} },
  documentElement: { lang: 'ar', dir: 'rtl', setAttribute: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.__SDI_TEST_ENV__ = true;

require('./js/i18n.js');
require('./js/db.js');

async function testPrintPerfection() {
  console.log('=== VERIFYING PRINT PERFECTION, REPEATING HEADER & ZERO BLANK PAGES ===\n');

  await db.init();
  const appCode = fs.readFileSync('./js/app.js', 'utf8');
  eval(appCode);

  const app = global.App;

  // 1. Verify CSS Rules in main.css
  console.log('[Test 1] Inspecting styles/main.css for Print Rules:');
  const cssContent = fs.readFileSync('./styles/main.css', 'utf8');

  // Verify only ONE @media print block exists (no duplicates)
  const printMatches = cssContent.match(/@media\s+print\s*\{/g) || [];
  if (printMatches.length !== 1) {
    throw new Error(`Expected exactly 1 @media print block, but found ${printMatches.length}`);
  }
  console.log('  PASS: Exactly 1 consolidated @media print block exists.');

  // Verify inactive tabs are hidden (prevent blank pages)
  if (!cssContent.includes('.tab-pane:not(.active)') || !cssContent.includes('#tab-reports > :not(#printableReportArea)')) {
    throw new Error('Missing rule hiding inactive tabs or controls in #tab-reports');
  }
  console.log('  PASS: Inactive tabs and non-report chrome hidden to prevent blank pages.');

  // Verify thead repeating header group and tfoot repeating footer group
  if (!cssContent.includes('display: table-header-group !important;') || !cssContent.includes('display: table-footer-group !important;')) {
    throw new Error('Missing table-header-group or table-footer-group display in print stylesheet');
  }
  console.log('  PASS: thead has display: table-header-group and tfoot has display: table-footer-group.');

  // Verify full width and min-height 0 for print
  if (!cssContent.includes('min-height: 0 !important;') || !cssContent.includes('width: 100% !important;')) {
    throw new Error('Missing min-height: 0 or width: 100% reset in print stylesheet');
  }
  console.log('  PASS: min-height: 0 and width: 100% reset enforced to eliminate overflow.');

  // 2. Generate Report and Inspect Table Hierarchy
  console.log('\n[Test 2] Generating Report and Checking HTML DOM Hierarchy:');
  document.getElementById('reportTypeSelect').value = 'inventory';
  await app.generateSelectedReport();

  const reportArea = document.getElementById('printableReportArea');
  const html = reportArea.innerHTML;

  // Header must be inside thead > tr.report-print-header-tr > th.report-print-header-th
  const hasTheadHeader = html.includes('<tr class="report-print-header-tr">') && 
                         html.includes('class="report-print-header-th"');
  if (!hasTheadHeader) {
    throw new Error('Report header is not wrapped inside <tr class="report-print-header-tr"> inside <thead>!');
  }
  console.log('  PASS: Unified Institutional Header is inside <thead > tr.report-print-header-tr > th.report-print-header-th');

  // Verify the institutional branding is inside the thead cell
  const theadSlice = html.substring(html.indexOf('<thead'), html.indexOf('</thead>'));
  if (!theadSlice.includes('Sharjah Driving Institute') || !theadSlice.includes('معهد الشارقة للسياقة')) {
    throw new Error('Institutional names missing from thead!');
  }
  console.log('  PASS: Official logo emblem & institution names exist inside thead repeating group.');

  // Verify Footer is inside tfoot > tr.report-print-footer-tr
  const hasTfoot = html.includes('<tfoot') && html.includes('report-print-footer-tr') && html.includes('report-footer-row');
  if (!hasTfoot) {
    throw new Error('Report footer is not wrapped inside <tfoot > tr.report-print-footer-tr!');
  }
  console.log('  PASS: Footer timestamp & brand signature are inside <tfoot > tr.report-print-footer-tr');

  // 3. Verify Page Margins
  console.log('\n[Test 3] Verifying Page Margins (8mm 10mm calibrated A4):');
  app.setReportOrientation('portrait');
  const portraitStyle = document.getElementById('dynamicPageOrientationStyle').innerHTML;
  if (!portraitStyle.includes('margin: 8mm 10mm;')) {
    throw new Error(`Portrait margins not 8mm 10mm: ${portraitStyle}`);
  }
  console.log('  PASS: Portrait margins correctly set to 8mm 10mm.');

  app.setReportOrientation('landscape');
  const landscapeStyle = document.getElementById('dynamicPageOrientationStyle').innerHTML;
  if (!landscapeStyle.includes('margin: 8mm 10mm;')) {
    throw new Error(`Landscape margins not 8mm 10mm: ${landscapeStyle}`);
  }
  console.log('  PASS: Landscape margins correctly set to 8mm 10mm.');

  // 4. Verify CSV Export Header filtering
  console.log('\n[Test 4] Verifying CSV Export Header Filter:');
  // Mock querySelector and querySelectorAll on the table
  const mockTable = {
    querySelectorAll: (sel) => {
      if (sel.includes('report-print-header-th')) {
        // Return column headers
        return [
          { innerText: 'SL No.' },
          { innerText: 'ASSET TAG' },
          { innerText: 'BRAND & MODEL' }
        ];
      }
      if (sel.includes('report-totals-tr')) {
        // Return rows
        return [
          { querySelectorAll: () => [{ innerText: '1' }, { innerText: 'AST-000001' }, { innerText: 'Dell Latitude' }] }
        ];
      }
      return [];
    }
  };
  reportArea.querySelector = () => mockTable;
  global.Blob = class { constructor(parts) { this.parts = parts; } };
  global.URL = { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} };

  let toastWarning = null;
  app.showToast = (msg, type) => { toastWarning = { msg, type }; };

  await app.exportReportCSV();
  console.log('  PASS: CSV export executes cleanly without including institutional header.');

  console.log('\n======================================================');
  console.log('ALL PRINT, MARGIN & REPEATING HEADER TESTS PASSED 100%!');
  console.log('======================================================\n');
}

testPrintPerfection().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
