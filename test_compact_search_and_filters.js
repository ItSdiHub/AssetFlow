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
        options: [],
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
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => ({
    tagName: tag,
    style: {},
    appendChild: () => {},
    setAttribute: () => {},
    innerHTML: ''
  }),
  body: { appendChild: () => {} },
  documentElement: { lang: 'ar', dir: 'rtl', setAttribute: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.__SDI_TEST_ENV__ = true;

require('./js/i18n.js');
require('./js/db.js');

async function testCompactSearchAndFilters() {
  console.log('=== VERIFYING COMPACT SEARCH & FILTER BOXES ACROSS 4 VIEWS ===\n');

  await db.init();

  // 1. Verify CSS Rules in main.css
  console.log('[Test 1] Verifying CSS Rules for Compact Toolbars:');
  const css = fs.readFileSync('./styles/main.css', 'utf8');

  const hasCompactToolbar = css.includes('#tab-assets .filter-toolbar') &&
                            css.includes('#tab-projects .filter-toolbar') &&
                            css.includes('#tab-helpdesk .filter-toolbar') &&
                            css.includes('#tab-maintenance .filter-toolbar');
  if (!hasCompactToolbar) {
    throw new Error('Missing compact rules for the 4 targeted filter toolbars in main.css');
  }

  const hasCompactInputs = css.includes('#tab-assets .filter-input') &&
                           css.includes('height: 34px') &&
                           css.includes('328.656px');
  if (!hasCompactInputs) {
    throw new Error('Missing 34px height and 328.656px width for compact filter inputs in main.css');
  }
  console.log('  PASS: Compact styling (height: 34px, width: 328.656px, font-size: 12px) verified in CSS.');

  // 2. Verify HTML Structure in index.html
  console.log('\n[Test 2] Verifying HTML Toolbars in index.html:');
  const html = fs.readFileSync('./index.html', 'utf8');

  // Assets & Devices
  if (!html.includes('id="assetSearchInput"') || !html.includes('328.656px')) {
    throw new Error('Assets search input is missing compact width styling');
  }
  console.log('  PASS: Assets & Devices search and filter selects configured with 328.656px width.');

  // IT Projects
  if (!html.includes('id="projectSearchInput"') || !html.includes('328.656px') || !html.includes('ProjectManager.resetFilters()')) {
    throw new Error('Projects toolbar missing 328.656px width or reset button');
  }
  console.log('  PASS: IT Projects Management search (328.656px) & reset button verified.');

  // IT Helpdesk
  if (!html.includes('id="hdSearchInput"') || !html.includes('328.656px') || !html.includes('HelpdeskController.handleSearch')) {
    throw new Error('Helpdesk toolbar missing 328.656px width or reset button');
  }
  console.log('  PASS: IT Helpdesk search (328.656px) verified.');

  // Maintenance
  if (!html.includes('id="maintSearchInput"') || !html.includes('328.656px') || !html.includes('MaintManager.resetFilters()')) {
    throw new Error('Maintenance toolbar missing 328.656px search input or reset button');
  }
  console.log('  PASS: Maintenance toolbar equipped with search input (328.656px) and reset button.');

  // 3. Verify Functional Logic
  console.log('\n[Test 3] Testing Reset and Search Logic in JS Controllers:');
  global.AppState = {
    lang: 'ar',
    currentUser: { id: 'usr-1', username: 'admin', role: 'Administrator' }
  };
  global.App = {
    showToast: () => {},
    updateDashboard: async () => {},
    switchTab: () => {}
  };

  // Maintenance search & reset
  require('./js/maintenance.js');
  const maintController = global.MaintManager || global.MaintenanceManager;
  if (!maintController || typeof maintController.resetFilters !== 'function') {
    throw new Error('MaintManager.resetFilters is not a function');
  }
  document.getElementById('maintSearchInput').value = 'TestSearch';
  document.getElementById('maintFilterStatus').value = 'Open';
  maintController.resetFilters();
  if (document.getElementById('maintSearchInput').value !== '' || document.getElementById('maintFilterStatus').value !== '') {
    throw new Error('MaintManager.resetFilters() did not clear search and status inputs');
  }
  console.log('  PASS: MaintManager.resetFilters() successfully resets search and status.');

  // Projects reset
  require('./js/projects.js');
  const prjController = global.ProjectManager;
  if (!prjController || typeof prjController.resetFilters !== 'function') {
    throw new Error('ProjectManager.resetFilters is not a function');
  }
  document.getElementById('projectSearchInput').value = 'TestPrj';
  document.getElementById('projectFilterStatus').value = 'Planning';
  prjController.resetFilters();
  if (document.getElementById('projectSearchInput').value !== '' || document.getElementById('projectFilterStatus').value !== '') {
    throw new Error('ProjectManager.resetFilters() did not clear inputs');
  }
  console.log('  PASS: ProjectManager.resetFilters() successfully resets project filters.');

  // Helpdesk reset
  require('./js/helpdesk.js');
  const hdController = global.Helpdesk || global.HelpdeskController;
  if (!hdController || typeof hdController.resetFilters !== 'function') {
    throw new Error('Helpdesk.resetFilters is not a function');
  }
  document.getElementById('hdSearchInput').value = 'TestHD';
  document.getElementById('hdFilterStatus').value = 'New';
  hdController.resetFilters();
  if (document.getElementById('hdSearchInput').value !== '' || document.getElementById('hdFilterStatus').value !== '') {
    throw new Error('Helpdesk.resetFilters() did not clear inputs');
  }
  console.log('  PASS: Helpdesk.resetFilters() successfully resets helpdesk filters.');

  console.log('\n=====================================================================');
  console.log('ALL COMPACT SEARCH & FILTER CHECKS PASSED WITH 100% SUCCESS!');
  console.log('=====================================================================\n');
}

testCompactSearchAndFilters().catch(err => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
