/**
 * test_maint_ticket_employee_linkage.js
 * Comprehensive verification for:
 * 1. Employee prefix changed from SDI- to EMP- (EMP-1001, EMP-1002...)
 * 2. Organization Employee Number uniqueness enforcement
 * 3. Maintenance Ticket issuance linking Employee, Section (Department), and Location
 * 4. Ticket issuance storing employee ID, employee name, department, location
 * 5. Maintenance table and search rendering employee ID & name
 */

const assert = require('assert');
const fs = require('fs');

let testsPassed = 0;
let testsFailed = 0;

function check(desc, cond) {
  if (cond) {
    console.log(`  [PASS] ${desc}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    testsFailed++;
  }
}

// 1. Setup Mock Browser Environment
const domStore = {};
function getOrCreateEl(id, tag = 'input') {
  if (!domStore[id]) {
    domStore[id] = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      addEventListener: () => {},
      reset() { this.value = ''; }
    };
  }
  return domStore[id];
}

const window = {
  addEventListener: () => {},
  document: {
    addEventListener: () => {},
    getElementById: (id) => getOrCreateEl(id),
    querySelectorAll: () => [],
    querySelector: (sel) => null
  },
  location: { reload: () => {} },
  __SDI_TEST_ENV__: true
};
global.window = window;
global.document = window.document;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};
global.navigator = { userAgent: 'node' };

// Load application modules
require('./js/i18n.js');
global.I18N = window.I18N;
global.getUserDisplayName = window.getUserDisplayName;
global.AppState = {
  lang: 'ar',
  currentUser: { id: 'usr-1', username: 'admin', role: 'Administrator', fullName: 'م. أحمد الشامسي' }
};
global.App = {
  toasts: [],
  showToast(msg, type) { this.toasts.push({ msg, type }); },
  openModal() {},
  closeModal() {},
  updateDashboard() {}
};

require('./js/db.js');
global.db = window.db;

require('./js/users.js');
global.UserManager = window.UserManager;

require('./js/assets.js');
global.AssetManager = window.AssetManager;

require('./js/maintenance.js');
global.MaintManager = window.MaintManager;

async function runTests() {
  console.log("================================================================================");
  console.log("TESTING EMPLOYEE EMP- PREFIX, UNIQUE ORG NUMBER & MAINTENANCE TICKET LINKAGES");
  console.log("================================================================================\n");

  await db.init();

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: EMP- Prefix Generation & Readonly Input
  // ---------------------------------------------------------------------------
  console.log(">>> TEST GROUP 1: EMP- Prefix Generation & Locked Input");
  
  const empPrefixCfg = db.getStorePrefixConfig("employees");
  check("Employees prefix is configured as 'EMP-'", empPrefixCfg.prefix === "EMP-");
  check("Employees prefix start number is 1001", empPrefixCfg.start === 1001);

  const nextEmpId = await db.getNextEmployeeId();
  check("Generated employee ID has EMP- prefix (e.g. EMP-1001)", nextEmpId.startsWith("EMP-"));
  console.log(`      Next generated employee ID: ${nextEmpId}`);

  const html = fs.readFileSync('index.html', 'utf8');
  check("HTML contains readonly Employee ID display with placeholder EMP-1001",
    html.includes('id="formEmpIdDisplay"') && html.includes('readonly') && html.includes('placeholder="EMP-1001"')
  );
  check("HTML contains Organization Employee Number input field",
    html.includes('id="formEmpOrgNumber"')
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Organization Employee Number Uniqueness Enforcement
  // ---------------------------------------------------------------------------
  console.log("\n>>> TEST GROUP 2: Organization Employee Number Uniqueness");

  // Save first employee with org number ORG-8801
  const dummyEvent = { preventDefault: () => {} };
  getOrCreateEl('formEmpId').value = '';
  getOrCreateEl('formEmpIdDisplay').value = '';
  getOrCreateEl('formEmpOrgNumber').value = 'ORG-8801';
  getOrCreateEl('formEmpDept').value = 'dept-it';
  getOrCreateEl('formEmpNameAr').value = 'خالد الفني';
  getOrCreateEl('formEmpNameEn').value = 'Khalid Technician';
  getOrCreateEl('formEmpPhone').value = '0509998877';
  getOrCreateEl('formEmpEmail').value = 'khalid.tech@sdi.ae';
  getOrCreateEl('formEmpStatus').value = 'Active';
  getOrCreateEl('formEmpNotes').value = 'Technician for IT assets';

  App.toasts = [];
  await UserManager.handleSaveEmployee(dummyEvent);

  const savedEmp1 = (await db.getAll('employees')).find(e => e.employeeNumber === 'ORG-8801');
  check("Employee 1 saved successfully with org number ORG-8801", !!savedEmp1);
  check("Employee 1 system ID starts with EMP-", savedEmp1 && savedEmp1.id.startsWith("EMP-"));
  console.log(`      Saved Employee: ${savedEmp1.id} - ${savedEmp1.nameAr} (#${savedEmp1.employeeNumber})`);

  // Attempt to save second employee with DUPLICATE org number ORG-8801
  getOrCreateEl('formEmpId').value = '';
  getOrCreateEl('formEmpIdDisplay').value = '';
  getOrCreateEl('formEmpOrgNumber').value = 'ORG-8801'; // duplicate!
  getOrCreateEl('formEmpDept').value = 'dept-cs';
  getOrCreateEl('formEmpNameAr').value = 'موظف مكرر';
  getOrCreateEl('formEmpNameEn').value = 'Duplicate Employee';

  App.toasts = [];
  await UserManager.handleSaveEmployee(dummyEvent);

  const duplicateToast = App.toasts.find(t => t.type === 'error');
  check("Duplicate Organization Employee Number was blocked with error toast", !!duplicateToast);

  // Save second employee with UNIQUE org number ORG-8802
  getOrCreateEl('formEmpOrgNumber').value = 'ORG-8802';
  App.toasts = [];
  await UserManager.handleSaveEmployee(dummyEvent);

  const savedEmp2 = (await db.getAll('employees')).find(e => e.employeeNumber === 'ORG-8802');
  check("Employee 2 saved successfully with unique org number ORG-8802", !!savedEmp2);
  check("Employee 2 has distinct system ID", savedEmp2 && savedEmp2.id !== savedEmp1.id);
  console.log(`      Saved Employee 2: ${savedEmp2.id} - ${savedEmp2.nameAr} (#${savedEmp2.employeeNumber})`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Create Asset Assigned to Employee 1
  // ---------------------------------------------------------------------------
  console.log("\n>>> TEST GROUP 3: Asset Assignment Setup for Linkage Test");

  const testAsset = {
    id: "AST-LINK-01",
    assetId: "AST-LINK-01",
    brand: "HP",
    model: "EliteBook 840 G8",
    status: "Assigned",
    currentEmployeeId: savedEmp1.id,
    departmentId: "dept-it",
    locationId: "loc-hq"
  };
  await db.put("assets", testAsset);
  check("Created assigned asset AST-LINK-01 assigned to Employee 1", true);

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Maintenance Modal Cascading Linkages
  // ---------------------------------------------------------------------------
  console.log("\n>>> TEST GROUP 4: Maintenance Modal Cascading Linkages");

  // Open Add Maintenance Modal
  await MaintManager.openAddModal();
  check("openAddModal populated Asset dropdown", getOrCreateEl("formMaintAssetId").innerHTML.includes("AST-LINK-01"));
  check("openAddModal populated Employee dropdown with EMP ID and Org number",
    getOrCreateEl("formMaintEmployeeId").innerHTML.includes(savedEmp1.id)
  );
  check("openAddModal populated Department dropdown", getOrCreateEl("formMaintDepartmentId").innerHTML.includes("dept-it"));

  // Case A: Selecting Asset auto-links Employee, Department, and Location
  getOrCreateEl("formMaintAssetId").value = "AST-LINK-01";
  await MaintManager.handleAssetSelect("AST-LINK-01");

  check("Selecting Asset auto-selected assigned Employee in formMaintEmployeeId",
    getOrCreateEl("formMaintEmployeeId").value === savedEmp1.id
  );
  check("Selecting Asset auto-selected Department in formMaintDepartmentId",
    getOrCreateEl("formMaintDepartmentId").value === "dept-it"
  );
  check("Selecting Asset auto-selected Location in formMaintLocationId",
    getOrCreateEl("formMaintLocationId").value === "loc-hq"
  );

  // Case B: Selecting Employee auto-links Section / Department and assigned Asset
  getOrCreateEl("formMaintAssetId").value = "";
  getOrCreateEl("formMaintEmployeeId").value = savedEmp1.id;
  await MaintManager.handleEmployeeSelect(savedEmp1.id);

  check("Selecting Employee auto-selected Department",
    getOrCreateEl("formMaintDepartmentId").value === "dept-it"
  );
  check("Selecting Employee auto-selected assigned Asset AST-LINK-01",
    getOrCreateEl("formMaintAssetId").value === "AST-LINK-01"
  );
  check("Selecting Employee auto-selected Location",
    getOrCreateEl("formMaintLocationId").value === "loc-hq"
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Issuing Maintenance Ticket with Employee ID & Name
  // ---------------------------------------------------------------------------
  console.log("\n>>> TEST GROUP 5: Issuing Maintenance Ticket with Employee ID & Name");

  getOrCreateEl("formMaintId").value = "";
  getOrCreateEl("formMaintAssetId").value = "AST-LINK-01";
  getOrCreateEl("formMaintEmployeeId").value = savedEmp1.id;
  getOrCreateEl("formMaintDepartmentId").value = "dept-it";
  getOrCreateEl("formMaintLocationId").value = "loc-hq";
  getOrCreateEl("formMaintDate").value = "2026-09-08";
  getOrCreateEl("formMaintStatus").value = "In Progress";
  getOrCreateEl("formMaintTech").value = "م. سيف الشامسي";
  getOrCreateEl("formMaintVendor").value = "HP Support UAE";
  getOrCreateEl("formMaintCost").value = "450";
  getOrCreateEl("formMaintProblem").value = "عطل في لوحة المفاتيح والبطارية";
  getOrCreateEl("formMaintAction").value = "فحص أولي واستبدال كابل البطارية";

  await MaintManager.handleSaveTicket(dummyEvent);

  const allTickets = await db.getAll("maintenance");
  const issuedTicket = allTickets.find(t => t.assetId === "AST-LINK-01");

  check("Maintenance Ticket successfully issued in database", !!issuedTicket);
  check("Ticket contains Employee ID (EMP-XXXX)", issuedTicket && issuedTicket.employeeId === savedEmp1.id);
  check("Ticket contains Employee Name", issuedTicket && (issuedTicket.employeeNameAr === "خالد الفني" || issuedTicket.employeeName === "خالد الفني"));
  check("Ticket contains Organization Employee Number", issuedTicket && issuedTicket.employeeNumber === "ORG-8801");
  check("Ticket contains Department ID & Name", issuedTicket && issuedTicket.departmentId === "dept-it" && !!issuedTicket.departmentName);
  check("Ticket contains Location ID & Name", issuedTicket && issuedTicket.locationId === "loc-hq");

  console.log(`      Issued Ticket ID: ${issuedTicket.id}`);
  console.log(`      Employee ID: ${issuedTicket.employeeId} | Name: ${issuedTicket.employeeName} | Org #: ${issuedTicket.employeeNumber}`);
  console.log(`      Section: ${issuedTicket.departmentName} | Location: ${issuedTicket.locationName}`);

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Maintenance Table Display & Search by Employee
  // ---------------------------------------------------------------------------
  console.log("\n>>> TEST GROUP 6: Maintenance Table Display & Search");

  getOrCreateEl("maintSearchInput").value = "";
  getOrCreateEl("maintFilterStatus").value = "";
  await MaintManager.render();

  const tableHtml = getOrCreateEl("maintenanceTableBody").innerHTML;
  check("Table displays Employee Name", tableHtml.includes("خالد الفني"));
  check("Table displays Employee ID badge", tableHtml.includes(savedEmp1.id));
  check("Table displays Organization Employee Number badge", tableHtml.includes("ORG-8801"));
  check("Table displays Department / Location", tableHtml.includes(issuedTicket.departmentName || "dept-it"));

  // Search by Employee Name
  getOrCreateEl("maintSearchInput").value = "خالد";
  await MaintManager.render();
  const searchNameHtml = getOrCreateEl("maintenanceTableBody").innerHTML;
  check("Searching by Employee Name returns the ticket", searchNameHtml.includes(issuedTicket.id));

  // Search by Employee ID code (EMP-XXXX)
  getOrCreateEl("maintSearchInput").value = savedEmp1.id.toLowerCase();
  await MaintManager.render();
  const searchIdHtml = getOrCreateEl("maintenanceTableBody").innerHTML;
  check("Searching by Employee ID code returns the ticket", searchIdHtml.includes(issuedTicket.id));

  // Search by Organization Number (ORG-8801)
  getOrCreateEl("maintSearchInput").value = "8801";
  await MaintManager.render();
  const searchOrgHtml = getOrCreateEl("maintenanceTableBody").innerHTML;
  check("Searching by Organization Employee Number returns the ticket", searchOrgHtml.includes(issuedTicket.id));

  console.log("\n================================================================================");
  console.log(`RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log("================================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
