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

async function testReportLayoutDetails() {
  console.log('=== VERIFYING EXACT REPORT LAYOUT & DUAL ORIENTATION ===\n');

  await db.init();
  const appCode = fs.readFileSync('./js/app.js', 'utf8');
  eval(appCode);

  const app = global.App;

  // Test 1: Generate Inventory Report
  document.getElementById('reportTypeSelect').value = 'inventory';
  await app.generateSelectedReport();

  const reportArea = document.getElementById('printableReportArea');
  const reportHtml = reportArea.innerHTML;

  console.log('[Test 1] Checking Top-Right Metadata Bar:');
  const hasMetaRow = reportHtml.includes('class="report-header-meta-row"');
  const hasDate = reportHtml.includes('Report Date') || reportHtml.includes('تاريخ التقرير');
  const hasTime = reportHtml.includes('Generated Time') || reportHtml.includes('وقت الاستخراج');
  const hasDot = reportHtml.includes('class="report-meta-dot"');
  const hasOrangeCalendar = reportHtml.includes('fa-calendar-alt') && reportHtml.includes('#f97316');
  const hasOrangeClock = reportHtml.includes('fa-clock') && reportHtml.includes('#f97316');

  if (!hasMetaRow || !hasDate || !hasTime || !hasDot || !hasOrangeCalendar || !hasOrangeClock) {
    throw new Error('Top-right metadata row does not match reference specifications');
  }
  console.log('  PASS: Top-right metadata contains Date, Time, Middle dot, and Orange Icons');

  console.log('\n[Test 2] Checking Institutional Branding & Official Logo Emblem:');
  const hasBrandRow = reportHtml.includes('class="report-header-brand"');
  const hasEnName = reportHtml.includes('Sharjah Driving Institute');
  const hasArName = reportHtml.includes('معهد الشارقة للسياقة');
  const hasEmblem = reportHtml.includes('report-header-logo report-header-logo-svg') || reportHtml.includes('report-header-logo-img');

  if (!hasBrandRow || !hasEnName || !hasArName || !hasEmblem) {
    throw new Error('Institutional branding row does not match official specifications');
  }
  console.log('  PASS: Left branding contains Official SDI Emblem, English & Arabic Institute names');

  console.log('\n[Test 3] Checking Centered Boxed Title Badge:');
  const hasTitlePill = reportHtml.includes('class="report-title-pill"');
  const hasSpacer = reportHtml.includes('class="report-header-spacer"');
  if (!hasTitlePill || !hasSpacer) throw new Error('Missing .report-title-pill or .report-header-spacer');
  console.log('  PASS: Centered boxed title badge and grid spacer present');

  console.log('\n[Test 4] Checking Bottom Footer Row:');
  const hasFooterRow = reportHtml.includes('class="report-footer-row"');
  const hasFooterTs = reportHtml.includes('class="report-footer-timestamp"');
  const hasFooterBrand = reportHtml.includes('class="report-footer-brand"');

  if (!hasFooterRow || !hasFooterTs || !hasFooterBrand) throw new Error('Missing footer layout elements');
  console.log('  PASS: Footer row contains left timestamp and right institute signature');

  console.log('\n[Test 5] Testing Orientation Switcher (Portrait vs Landscape):');
  app.setReportOrientation('portrait');
  if (!reportArea._classes.has('report-portrait')) {
    throw new Error('Failed to apply report-portrait class');
  }
  const portraitStyle = document.getElementById('dynamicPageOrientationStyle');
  if (!portraitStyle || !portraitStyle.innerHTML.includes('size: A4 portrait')) {
    throw new Error('Dynamic print CSS not updated for portrait');
  }
  console.log('  PASS: Switched to Portrait (report-portrait class, @page A4 portrait)');

  app.setReportOrientation('landscape');
  if (!reportArea._classes.has('report-landscape')) {
    throw new Error('Failed to apply report-landscape class');
  }
  const landscapeStyle = document.getElementById('dynamicPageOrientationStyle');
  if (!landscapeStyle || !landscapeStyle.innerHTML.includes('size: A4 landscape')) {
    throw new Error('Dynamic print CSS not updated for landscape');
  }
  console.log('  PASS: Switched to Landscape (report-landscape class, @page A4 landscape)');

  console.log('\n========================================');
  console.log('ALL REPORT LAYOUT & ORIENTATION CHECKS PASSED 100%!');
  console.log('========================================\n');
}

testReportLayoutDetails().catch(err => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
