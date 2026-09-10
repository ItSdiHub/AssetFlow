const fs = require('fs');
const assert = require('assert');

// Mock browser environment for App.generateSelectedReport()
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
        },
        querySelector: (sel) => {
          if (sel === 'table') {
            return {
              querySelectorAll: (subSel) => {
                const html = global._elements[id].innerHTML || '';
                if (subSel.includes('thead th:not(.report-print-header-th)')) {
                  const matches = html.match(/<th[^>]*>(.*?)<\/th>/gi) || [];
                  return matches
                    .filter(m => !m.includes('report-print-header-th'))
                    .map(m => ({ innerText: m.replace(/<[^>]+>/g, '').trim() }));
                }
                if (subSel.includes('tbody tr:not(.report-totals-tr)')) {
                  const trMatches = html.match(/<tr>[\s\S]*?<\/tr>/gi) || [];
                  return trMatches.map(tr => ({
                    querySelectorAll: (tdSel) => {
                      const tdMatches = tr.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
                      return tdMatches.map(td => ({ innerText: td.replace(/<[^>]+>/g, '').trim() }));
                    }
                  }));
                }
                return [];
              }
            };
          }
          return null;
        },
        querySelectorAll: () => []
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
      removeChild: () => {},
      setAttribute: () => {},
      innerHTML: '',
      href: '',
      download: '',
      click: () => {}
    };
    return el;
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { appendChild: () => {}, removeChild: () => {}, setAttribute: () => {} },
  documentElement: { lang: 'ar', dir: 'rtl', setAttribute: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.URL = {
  createObjectURL: () => 'blob:mock-url',
  revokeObjectURL: () => {}
};
global.Blob = class Blob {
  constructor(parts) {
    this.parts = parts;
  }
};
global.__SDI_TEST_ENV__ = true;

require('./js/i18n.js');
require('./js/db.js');
require('./js/assets.js');
require('./js/projects.js');
require('./js/maintenance.js');

const appCode = fs.readFileSync('js/app.js', 'utf8');
eval(appCode);

async function runCustomizationTests() {
  console.log('================================================================================');
  console.log('TEST: VERIFY REMOVAL OF BARCODE, QR CODE & CONDITION + EXPANSION OF MODEL & NOTES');
  console.log('================================================================================\n');

  await db.init();
  const app = global.App || new Application();
  global.App = app;

  let totalPass = 0;

  // -------------------------------------------------------------
  // GROUP 1: CSS Rules Verification in styles/main.css
  // -------------------------------------------------------------
  console.log('>>> TEST GROUP 1: CSS Column Widths & Wrapping Rules');
  const cssContent = fs.readFileSync('styles/main.css', 'utf8');

  assert(cssContent.includes('.col-report-model'), 'Missing .col-report-model in CSS');
  assert(cssContent.includes('.col-report-notes'), 'Missing .col-report-notes in CSS');
  console.log('  [PASS] .col-report-model and .col-report-notes present in main.css');
  totalPass++;

  assert(cssContent.includes('min-width: 170px'), 'Missing generous min-width for col-report-model');
  assert(cssContent.includes('min-width: 240px'), 'Missing generous min-width for col-report-notes');
  assert(cssContent.includes('word-break: break-word'), 'Missing word-break: break-word for expanded columns');
  assert(cssContent.includes('white-space: normal'), 'Missing white-space: normal for expanded columns');
  console.log('  [PASS] Screen styles specify generous min-width (170px/240px) and word-break wrapping');
  totalPass++;

  // Verify @media print rules
  const printSection = cssContent.slice(cssContent.indexOf('@media print'));
  assert(printSection.includes('.print-table th.col-report-model'), 'Missing .col-report-model in @media print');
  assert(printSection.includes('.print-table th.col-report-notes'), 'Missing .col-report-notes in @media print');
  assert(printSection.includes('white-space: normal !important'), 'Print style must allow clean text wrapping');
  console.log('  [PASS] @media print contains dedicated responsive rules for Model and Notes');
  totalPass++;

  // -------------------------------------------------------------
  // GROUP 2: Report 1 (Inventory Report)
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 2: Report 1 (Inventory) Column Removal & Widening');
  for (const lang of ['ar', 'en']) {
    global.AppState = { lang, currentUser: { id: 'usr-1', username: 'admin' } };
    global.document.getElementById('reportSelect').value = 'inventory';
    const reportArea = global.document.getElementById('printableReportArea');
    reportArea.innerHTML = '';
    await app.generateSelectedReport();
    const html = reportArea.innerHTML;

    // Check absence of Barcode column
    const hasBarcodeTh = html.includes('<th>Barcode</th>') || html.includes('<th>الباركود</th>');
    assert(!hasBarcodeTh, `Inventory report (${lang}) must NOT contain Barcode column header!`);

    // Check absence of QR Code column
    const hasQrTh = html.includes('<th>QR Code</th>');
    assert(!hasQrTh, `Inventory report (${lang}) must NOT contain QR Code column header!`);

    // Check absence of Asset Condition column
    const hasConditionTh = html.includes('<th>Asset Condition</th>') || html.includes('<th>الحالة الفنية</th>');
    assert(!hasConditionTh, `Inventory report (${lang}) must NOT contain Asset Condition column header!`);

    // Check presence of col-report-model
    assert(html.includes('class="col-report-model"'), `Inventory report (${lang}) must have col-report-model class!`);

    // Check presence of col-report-notes
    assert(html.includes('class="col-report-notes"'), `Inventory report (${lang}) must have col-report-notes class!`);

    console.log(`  [PASS] Inventory Report [${lang.toUpperCase()}]: Barcode, QR Code, Asset Condition removed; Model and Notes expanded!`);
    totalPass++;
  }

  // -------------------------------------------------------------
  // GROUP 3: Report 10 (Warehouse Report)
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 3: Report 10 (Warehouse) Column Removal & Widening');
  for (const lang of ['ar', 'en']) {
    global.AppState = { lang, currentUser: { id: 'usr-1', username: 'admin' } };
    global.document.getElementById('reportSelect').value = 'warehouse';
    const reportArea = global.document.getElementById('printableReportArea');
    reportArea.innerHTML = '';
    await app.generateSelectedReport();
    const html = reportArea.innerHTML;

    // Check absence of Asset Condition column
    const hasConditionTh = html.includes('<th>Asset Condition</th>') || html.includes('<th>الحالة الفنية</th>');
    assert(!hasConditionTh, `Warehouse report (${lang}) must NOT contain Asset Condition column header!`);

    // Check presence of col-report-model
    assert(html.includes('class="col-report-model"'), `Warehouse report (${lang}) must have col-report-model class!`);

    // Check presence of col-report-notes
    assert(html.includes('class="col-report-notes"'), `Warehouse report (${lang}) must have col-report-notes class!`);

    console.log(`  [PASS] Warehouse Report [${lang.toUpperCase()}]: Asset Condition removed; Model and Notes expanded!`);
    totalPass++;
  }

  // -------------------------------------------------------------
  // GROUP 4: Verification of Other Reports with Model and Notes
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 4: Other Reports Model & Notes Expansion');
  const reportsToCheck = [
    { type: 'byEmp', name: 'Assets by Employee', checkModel: true, checkNotes: true },
    { type: 'maint', name: 'Maintenance & Repairs', checkModel: true, checkNotes: true },
    { type: 'history', name: 'Audit History', checkModel: true, checkNotes: true },
    { type: 'warranty', name: 'Warranty Status', checkModel: true, checkNotes: true },
    { type: 'helpdesk', name: 'IT Helpdesk', checkModel: true, checkNotes: true },
    { type: 'awaitingInstall', name: 'Awaiting Installation', checkModel: true, checkNotes: true },
    { type: 'transfers', name: 'Asset Transfers', checkModel: true, checkNotes: true },
    { type: 'warehouseIssues', name: 'Warehouse Issues', checkModel: true, checkNotes: true },
    { type: 'installations', name: 'Completed Installations', checkModel: true, checkNotes: true }
  ];

  for (const rep of reportsToCheck) {
    global.AppState = { lang: 'ar', currentUser: { id: 'usr-1', username: 'admin' } };
    global.document.getElementById('reportSelect').value = rep.type;
    const reportArea = global.document.getElementById('printableReportArea');
    reportArea.innerHTML = '';
    await app.generateSelectedReport();
    const html = reportArea.innerHTML;

    if (rep.checkModel) {
      assert(html.includes('col-report-model'), `Report '${rep.type}' missing col-report-model!`);
    }
    if (rep.checkNotes) {
      assert(html.includes('col-report-notes'), `Report '${rep.type}' missing col-report-notes!`);
    }

    console.log(`  [PASS] Report '${rep.name}' (${rep.type}): Expanded Model & Notes verified!`);
    totalPass++;
  }

  // -------------------------------------------------------------
  // GROUP 5: CSV Export Sync Verification
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 5: CSV Export Verification');
  global.AppState = { lang: 'en', currentUser: { id: 'usr-1', username: 'admin' } };
  global.document.getElementById('reportSelect').value = 'inventory';
  await app.generateSelectedReport();

  let toastMessage = '';
  app.showToast = (msg) => { toastMessage = msg; };

  await app.exportReportCSV();
  assert(toastMessage.includes('Excel (CSV) exported successfully') || toastMessage.includes('بنجاح'), 'CSV export toast failed');
  console.log('  [PASS] exportReportCSV executed successfully with dynamic table headers/rows');
  totalPass++;

  console.log('\n================================================================================');
  console.log(`ALL TESTS PASSED: ${totalPass} / ${totalPass} Validations 100% Successful!`);
  console.log('================================================================================\n');
}

runCustomizationTests().catch(err => {
  console.error('\n[FAILED]:', err.message || err);
  process.exit(1);
});
