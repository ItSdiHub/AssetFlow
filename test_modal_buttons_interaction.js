/**
 * Test Suite: Modal Buttons Interaction & Form Execution Audit
 * Verifies that all buttons cited by the user (+ Add Asset, + Add Employee, + Add Location,
 * Warehouse Issue, Transfer Asset, etc.) properly open their corresponding modals,
 * make them visible (.active, .show, display: flex), and execute their form submissions.
 */

const fs = require('fs');
const assert = require('assert');

// In-memory DOM Element Mock
class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this._classes = new Set();
    this.style = { display: 'none' };
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.attributes = {};
    this.children = [];
    this.options = [];
    this.selectedIndex = 0;
  }

  get classList() {
    return {
      add: (cls) => this._classes.add(cls),
      remove: (cls) => this._classes.delete(cls),
      contains: (cls) => this._classes.has(cls),
      toggle: (cls, force) => {
        if (typeof force === 'boolean') {
          if (force) this._classes.add(cls);
          else this._classes.delete(cls);
        } else {
          if (this._classes.has(cls)) this._classes.delete(cls);
          else this._classes.add(cls);
        }
      }
    };
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  reset() { this.value = ''; }
  closest() { return null; }
  contains() { return false; }
  appendChild(child) { this.children.push(child); }
  insertBefore(newChild) { this.children.unshift(newChild); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener() {}
}

const elements = new Map();
function getOrCreateEl(id, tag = 'div') {
  if (!elements.has(id)) {
    elements.set(id, new MockElement(id, tag));
  }
  return elements.get(id);
}

// Global browser simulation
const docListeners = {};
global.window = {
  addEventListener: () => {},
  document: {
    _listeners: docListeners,
    addEventListener: (event, handler) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(handler);
    },
    getElementById: (id) => getOrCreateEl(id),
    querySelector: (sel) => {
      if (sel.startsWith('#')) return getOrCreateEl(sel.slice(1));
      return new MockElement('', 'div');
    },
    querySelectorAll: () => [],
    createElement: (tag) => new MockElement('', tag),
    body: new MockElement('body', 'body'),
    documentElement: new MockElement('html', 'html')
  },
  location: { reload: () => {} },
  __SDI_TEST_ENV__: true
};

global.document = window.document;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

// Load codebase in exact order
require('./js/i18n.js');
global.I18N = window.I18N;
global.AppState = window.AppState;
global.getEntityName = window.getEntityName;
global.getUserDisplayName = window.getUserDisplayName;
require('./js/db.js');
global.db = window.db;
require('./js/users.js');
global.UserManager = window.UserManager;
require('./js/treeView.js');
global.TreeManager = window.TreeManager;
require('./js/assets.js');
global.AssetManager = window.AssetManager;
require('./js/maintenance.js');
global.MaintManager = window.MaintManager;
require('./js/helpdesk.js');
global.Helpdesk = window.Helpdesk;
global.HelpdeskController = window.HelpdeskController;
require('./js/projects.js');
global.ContractorManager = window.ContractorManager;
global.ProjectManager = window.ProjectManager;
global.OpsManager = window.OpsManager;
require('./js/techTools.js');
global.TechTools = window.TechTools;
require('./js/app.js');
global.App = window.App;
global.AppState = window.AppState;

async function runTests() {
  console.log("================================================================================");
  console.log("RUNNING MODAL BUTTONS VISIBILITY & ACTION TESTS");
  console.log("================================================================================");

  await db.init();
  if (typeof App.setupEventListeners === 'function') {
    App.setupEventListeners();
  }

  // Seed sample asset if not present
  const assets = await db.getAll('assets');
  if (assets.length === 0) {
    await db.put('assets', {
      id: 'ast-001',
      assetId: 'AST-000001',
      assetTypeId: 'type-laptop',
      brand: 'Dell',
      model: 'Latitude 5420',
      serial: 'DELL-SN-001',
      status: 'Available',
      locationId: 'loc-wh1',
      departmentId: 'dept-it'
    });
  }

  // 1. TEST + Add Asset Button -> AssetManager.openAddModal()
  console.log("\n>>> Test 1: + Add Asset Button");
  await AssetManager.openAddModal();
  const assetModal = getOrCreateEl('assetModal');
  assert.strictEqual(assetModal.classList.contains('active'), true, "assetModal should have 'active' class");
  assert.strictEqual(assetModal.classList.contains('show'), true, "assetModal should have 'show' class");
  assert.strictEqual(assetModal.style.display, 'flex', "assetModal style.display should be 'flex'");
  console.log("  [PASS] assetModal opens with .active, .show, and display: flex");
  App.closeModal('assetModal');
  assert.strictEqual(assetModal.style.display, 'none', "assetModal closes properly");
  console.log("  [PASS] assetModal closes properly");

  // 2. TEST + Add Employee Button -> UserManager.openEmployeeModal()
  console.log("\n>>> Test 2: + Add Employee Button");
  await UserManager.openEmployeeModal();
  const empModal = getOrCreateEl('employeeModal');
  assert.strictEqual(empModal.classList.contains('active'), true, "employeeModal should have 'active' class");
  assert.strictEqual(empModal.classList.contains('show'), true, "employeeModal should have 'show' class");
  assert.strictEqual(empModal.style.display, 'flex', "employeeModal style.display should be 'flex'");
  console.log("  [PASS] employeeModal opens with .active, .show, and display: flex");
  App.closeModal('employeeModal');
  assert.strictEqual(empModal.style.display, 'none', "employeeModal closes properly");
  console.log("  [PASS] employeeModal closes properly");

  // 3. TEST + Add Location Button -> UserManager.openLocationModal()
  console.log("\n>>> Test 3: + Add Location Button");
  await UserManager.openLocationModal();
  const locModal = getOrCreateEl('locationModal');
  assert.strictEqual(locModal.classList.contains('active'), true, "locationModal should have 'active' class");
  assert.strictEqual(locModal.classList.contains('show'), true, "locationModal should have 'show' class");
  assert.strictEqual(locModal.style.display, 'flex', "locationModal style.display should be 'flex'");
  console.log("  [PASS] locationModal opens with .active, .show, and display: flex");
  App.closeModal('locationModal');
  assert.strictEqual(locModal.style.display, 'none', "locationModal closes properly");
  console.log("  [PASS] locationModal closes properly");

  // 4. TEST + Add Department Button -> UserManager.openDepartmentModal()
  console.log("\n>>> Test 4: + Add Department Button");
  await UserManager.openDepartmentModal();
  const deptModal = getOrCreateEl('departmentModal');
  assert.strictEqual(deptModal.classList.contains('active'), true, "departmentModal should have 'active' class");
  assert.strictEqual(deptModal.classList.contains('show'), true, "departmentModal should have 'show' class");
  assert.strictEqual(deptModal.style.display, 'flex', "departmentModal style.display should be 'flex'");
  console.log("  [PASS] departmentModal opens with .active, .show, and display: flex");
  App.closeModal('departmentModal');
  assert.strictEqual(deptModal.style.display, 'none', "departmentModal closes properly");
  console.log("  [PASS] departmentModal closes properly");

  // 5. TEST Warehouse Issue Button -> OpsManager.openWarehouseIssueModal()
  console.log("\n>>> Test 5: Warehouse Issue Button");
  await OpsManager.openWarehouseIssueModal();
  const wiModal = getOrCreateEl('warehouseIssueModal');
  assert.strictEqual(wiModal.classList.contains('active'), true, "warehouseIssueModal should have 'active' class");
  assert.strictEqual(wiModal.classList.contains('show'), true, "warehouseIssueModal should have 'show' class");
  assert.strictEqual(wiModal.style.display, 'flex', "warehouseIssueModal style.display should be 'flex'");
  console.log("  [PASS] warehouseIssueModal opens with .active, .show, and display: flex");
  App.closeModal('warehouseIssueModal');
  assert.strictEqual(wiModal.style.display, 'none', "warehouseIssueModal closes properly");
  console.log("  [PASS] warehouseIssueModal closes properly");

  // 6. TEST Transfer Asset Button (called with NO argument) -> AssetManager.openTransferModal()
  console.log("\n>>> Test 6: Transfer Asset Button (called without preselected asset ID)");
  await AssetManager.openTransferModal();
  const trModal = getOrCreateEl('transferModal');
  assert.strictEqual(trModal.classList.contains('active'), true, "transferModal should have 'active' class");
  assert.strictEqual(trModal.classList.contains('show'), true, "transferModal should have 'show' class");
  assert.strictEqual(trModal.style.display, 'flex', "transferModal style.display should be 'flex'");
  console.log("  [PASS] transferModal opens with .active, .show, and display: flex");
  App.closeModal('transferModal');
  assert.strictEqual(trModal.style.display, 'none', "transferModal closes properly");
  console.log("  [PASS] transferModal closes properly");

  // 7. TEST + Add Project Button -> ProjectManager.openProjectModal()
  console.log("\n>>> Test 7: + Add Project Button");
  await ProjectManager.openProjectModal();
  const prjModal = getOrCreateEl('projectModal');
  assert.strictEqual(prjModal.classList.contains('active'), true, "projectModal should have 'active' class");
  assert.strictEqual(prjModal.classList.contains('show'), true, "projectModal should have 'show' class");
  assert.strictEqual(prjModal.style.display, 'flex', "projectModal style.display should be 'flex'");
  console.log("  [PASS] projectModal opens with .active, .show, and display: flex");
  App.closeModal('projectModal');
  assert.strictEqual(prjModal.style.display, 'none', "projectModal closes properly");
  console.log("  [PASS] projectModal closes properly");

  // 8. TEST + Add Contractor Button -> ContractorManager.openContractorModal()
  console.log("\n>>> Test 8: + Add Contractor Button");
  await ContractorManager.openContractorModal();
  const cModal = getOrCreateEl('contractorModal');
  assert.strictEqual(cModal.classList.contains('active'), true, "contractorModal should have 'active' class");
  assert.strictEqual(cModal.classList.contains('show'), true, "contractorModal should have 'show' class");
  assert.strictEqual(cModal.style.display, 'flex', "contractorModal style.display should be 'flex'");
  console.log("  [PASS] contractorModal opens with .active, .show, and display: flex");
  App.closeModal('contractorModal');
  assert.strictEqual(cModal.style.display, 'none', "contractorModal closes properly");
  console.log("  [PASS] contractorModal closes properly");

  // 9. TEST + Add Maintenance Button -> MaintManager.openAddModal()
  console.log("\n>>> Test 9: + Add Maintenance Button");
  await MaintManager.openAddModal();
  const maintModal = getOrCreateEl('maintenanceModal');
  assert.strictEqual(maintModal.classList.contains('active'), true, "maintenanceModal should have 'active' class");
  assert.strictEqual(maintModal.classList.contains('show'), true, "maintenanceModal should have 'show' class");
  assert.strictEqual(maintModal.style.display, 'flex', "maintenanceModal style.display should be 'flex'");
  console.log("  [PASS] maintenanceModal opens with .active, .show, and display: flex");
  App.closeModal('maintenanceModal');
  assert.strictEqual(maintModal.style.display, 'none', "maintenanceModal closes properly");
  console.log("  [PASS] maintenanceModal closes properly");

  // 10. TEST + Add Asset Type Button -> UserManager.openAssetTypeModal()
  console.log("\n>>> Test 10: + Add Asset Type Button");
  await UserManager.openAssetTypeModal();
  const typeModal = getOrCreateEl('assetTypeModal');
  assert.strictEqual(typeModal.classList.contains('active'), true, "assetTypeModal should have 'active' class");
  assert.strictEqual(typeModal.classList.contains('show'), true, "assetTypeModal should have 'show' class");
  assert.strictEqual(typeModal.style.display, 'flex', "assetTypeModal style.display should be 'flex'");
  console.log("  [PASS] assetTypeModal opens with .active, .show, and display: flex");
  App.closeModal('assetTypeModal');
  assert.strictEqual(typeModal.style.display, 'none', "assetTypeModal closes properly");
  console.log("  [PASS] assetTypeModal closes properly");

  // 11. TEST + Add User Button -> UserManager.openUserModal()
  console.log("\n>>> Test 11: + Add User Button");
  await UserManager.openUserModal();
  const userModal = getOrCreateEl('userModal');
  assert.strictEqual(userModal.classList.contains('active'), true, "userModal should have 'active' class");
  assert.strictEqual(userModal.classList.contains('show'), true, "userModal should have 'show' class");
  assert.strictEqual(userModal.style.display, 'flex', "userModal style.display should be 'flex'");
  console.log("  [PASS] userModal opens with .active, .show, and display: flex");
  App.closeModal('userModal');
  assert.strictEqual(userModal.style.display, 'none', "userModal closes properly");
  console.log("  [PASS] userModal closes properly");

  // 12. TEST Scanner Modal Button -> App.openScannerModal()
  console.log("\n>>> Test 12: Scanner Modal Button");
  App.openScannerModal();
  const scannerModal = getOrCreateEl('scannerModal');
  assert.strictEqual(scannerModal.classList.contains('active'), true, "scannerModal should have 'active' class");
  assert.strictEqual(scannerModal.classList.contains('show'), true, "scannerModal should have 'show' class");
  assert.strictEqual(scannerModal.style.display, 'flex', "scannerModal style.display should be 'flex'");
  console.log("  [PASS] scannerModal opens with .active, .show, and display: flex");
  App.closeModal('scannerModal');
  assert.strictEqual(scannerModal.style.display, 'none', "scannerModal closes properly");
  console.log("  [PASS] scannerModal closes properly");

  // 13. TEST + Add License Button -> TechTools.openAddLicenseModal()
  console.log("\n>>> Test 13: + Add License Button");
  TechTools.openAddLicenseModal();
  const licModal = getOrCreateEl('licenseModal');
  assert.strictEqual(licModal.classList.contains('active'), true, "licenseModal should have 'active' class");
  assert.strictEqual(licModal.classList.contains('show'), true, "licenseModal should have 'show' class");
  assert.strictEqual(licModal.style.display, 'flex', "licenseModal style.display should be 'flex'");
  console.log("  [PASS] licenseModal opens with .active, .show, and display: flex");
  App.closeModal('licenseModal');
  assert.strictEqual(licModal.style.display, 'none', "licenseModal closes properly");
  console.log("  [PASS] licenseModal closes properly");

  // 14. TEST + Add Support Request Button -> HelpdeskController.openNewSupportRequestModal()
  console.log("\n>>> Test 14: + Add Support Request Button");
  await HelpdeskController.openNewSupportRequestModal();
  const suppModal = getOrCreateEl('newSupportRequestModal');
  assert.strictEqual(suppModal.classList.contains('active'), true, "newSupportRequestModal should have 'active' class");
  assert.strictEqual(suppModal.classList.contains('show'), true, "newSupportRequestModal should have 'show' class");
  assert.strictEqual(suppModal.style.display, 'flex', "newSupportRequestModal style.display should be 'flex'");
  console.log("  [PASS] newSupportRequestModal opens with .active, .show, and display: flex");
  App.closeModal('newSupportRequestModal');
  assert.strictEqual(suppModal.style.display, 'none', "newSupportRequestModal closes properly");
  console.log("  [PASS] newSupportRequestModal closes properly");

  // 15. TEST + Add Project Task Button -> ProjectManager.openTaskModal()
  console.log("\n>>> Test 15: + Add Project Task Button");
  await ProjectManager.openTaskModal('prj-001');
  const taskModal = getOrCreateEl('projectTaskModal');
  assert.strictEqual(taskModal.classList.contains('active'), true, "projectTaskModal should have 'active' class");
  assert.strictEqual(taskModal.classList.contains('show'), true, "projectTaskModal should have 'show' class");
  assert.strictEqual(taskModal.style.display, 'flex', "projectTaskModal style.display should be 'flex'");
  console.log("  [PASS] projectTaskModal opens with .active, .show, and display: flex");
  App.closeModal('projectTaskModal');
  assert.strictEqual(taskModal.style.display, 'none', "projectTaskModal closes properly");
  console.log("  [PASS] projectTaskModal closes properly");

  // 16. TEST Static Backdrop & Forefront Stacking Protection
  console.log("\n>>> Test 16: Static Backdrop & Forefront Stacking Protection");
  App.openModal('assetModal');
  const modalEl = getOrCreateEl('assetModal');
  assert.ok(parseInt(modalEl.style.zIndex || 0) >= 100000, "Modal z-index should be placed at the forefront (>= 100000)");
  console.log("  [PASS] modal placed at top z-index: " + modalEl.style.zIndex);

  // Simulate click on backdrop
  const backdropEl = {
    classList: {
      contains: (cls) => cls === "modal-backdrop"
    },
    closest: (selector) => selector === ".modal-container" ? modalEl : null
  };
  // Fire document click listener
  for (const listener of window.document._listeners.click || []) {
    listener({ target: backdropEl });
  }
  // Verify modal is STILL open and NOT closed or hidden behind
  assert.strictEqual(modalEl.style.display, 'flex', "Modal must remain open (display: flex) when clicking outside");
  assert.strictEqual(modalEl.classList.contains('active'), true, "Modal must retain active class");
  assert.strictEqual(modalEl.classList.contains('modal-static-shake'), true, "Modal should trigger static shake feedback");
  console.log("  [PASS] clicking outside does NOT hide or close modal; triggers shake pulse protection");
  App.closeModal('assetModal');
  assert.strictEqual(modalEl.style.display, 'none', "Modal closes properly when explicit close action taken");
  console.log("  [PASS] modal closes properly on explicit close");

  console.log("\n================================================================================");
  console.log("TESTING FORM SUBMISSIONS FOR ALL ACTION MODALS");
  console.log("================================================================================");

  const dummyEvent = { preventDefault: () => {} };

  // Form Test 1: Save Employee
  console.log("\n>>> Form Test 1: Save Employee");
  getOrCreateEl('formEmpId').value = '';
  getOrCreateEl('formEmpNumber').value = 'SDI-TEST-EMP99';
  getOrCreateEl('formEmpDept').value = 'dept-it';
  getOrCreateEl('formEmpNameAr').value = 'موظف تجريبي جديد';
  getOrCreateEl('formEmpNameEn').value = 'Test New Employee';
  getOrCreateEl('formEmpPhone').value = '0501234567';
  getOrCreateEl('formEmpEmail').value = 'test99@sdi.ae';
  getOrCreateEl('formEmpStatus').value = 'Active';
  getOrCreateEl('formEmpNotes').value = 'Test Note';
  await UserManager.handleSaveEmployee(dummyEvent);
  const savedEmp = (await db.getAll('employees')).find(e => e.employeeNumber === 'SDI-TEST-EMP99');
  assert.ok(savedEmp, "Employee should be saved to database");
  assert.strictEqual(savedEmp.nameAr, 'موظف تجريبي جديد');
  console.log("  [PASS] Employee saved successfully: " + savedEmp.nameAr);

  // Form Test 2: Save Location
  console.log("\n>>> Form Test 2: Save Location");
  getOrCreateEl('formLocId').value = '';
  getOrCreateEl('formLocNameAr').value = 'موقع تجريبي جديد';
  getOrCreateEl('formLocNameEn').value = 'Test New Location';
  getOrCreateEl('formLocDesc').value = 'Location Description';
  getOrCreateEl('formLocActive').value = 'true';
  getOrCreateEl('formLocParent').value = '';
  getOrCreateEl('formLocCode').value = 'TEST-LOC';
  getOrCreateEl('formLocIcon').value = 'building';
  await UserManager.handleSaveLocation(dummyEvent);
  const savedLoc = (await db.getAll('locations')).find(l => l.code === 'TEST-LOC');
  assert.ok(savedLoc, "Location should be saved to database");
  assert.strictEqual(savedLoc.nameAr, 'موقع تجريبي جديد');
  console.log("  [PASS] Location saved successfully: " + savedLoc.nameAr);

  // Form Test 3: Save Department
  console.log("\n>>> Form Test 3: Save Department");
  getOrCreateEl('formDeptId').value = '';
  getOrCreateEl('formDeptNameAr').value = 'قسم تجريبي جديد';
  getOrCreateEl('formDeptNameEn').value = 'Test New Department';
  getOrCreateEl('formDeptDesc').value = 'Dept Description';
  getOrCreateEl('formDeptActive').value = 'true';
  await UserManager.handleSaveDepartment(dummyEvent);
  const savedDept = (await db.getAll('departments')).find(d => d.nameAr === 'قسم تجريبي جديد');
  assert.ok(savedDept, "Department should be saved to database");
  console.log("  [PASS] Department saved successfully: " + savedDept.nameAr);

  // Form Test 4: Save Asset
  console.log("\n>>> Form Test 4: Save Asset");
  getOrCreateEl('formAssetInternalId').value = '';
  getOrCreateEl('formAssetId').value = 'AST-TEST-999';
  getOrCreateEl('formAssetType').value = 'type-laptop';
  getOrCreateEl('formAssetBrand').value = 'Lenovo';
  getOrCreateEl('formAssetModel').value = 'ThinkPad X1';
  getOrCreateEl('formAssetSerial').value = 'SN-LENOVO-999';
  getOrCreateEl('formAssetBarcode').value = 'AST-TEST-999';
  getOrCreateEl('formAssetQr').value = 'AST-TEST-999';
  getOrCreateEl('formAssetStatus').value = 'Available';
  getOrCreateEl('formAssetDept').value = 'dept-it';
  getOrCreateEl('formAssetLoc').value = 'loc-wh1';
  getOrCreateEl('formAssetEmp').value = '';
  getOrCreateEl('formAssetPurchaseDate').value = '2026-01-01';
  getOrCreateEl('formAssetWarrantyExpiry').value = '2029-01-01';
  getOrCreateEl('formAssetCost').value = '4500';
  getOrCreateEl('formAssetSupplier').value = 'Lenovo UAE';
  getOrCreateEl('formAssetNotes').value = 'Test Asset Notes';
  getOrCreateEl('formAssetCompName').value = 'SDI-LT-999';
  getOrCreateEl('formAssetOS').value = 'Windows 11 Pro';
  getOrCreateEl('formAssetCPU').value = 'Core i7';
  getOrCreateEl('formAssetRAM').value = '32GB';
  getOrCreateEl('formAssetStorage').value = '1TB NVMe';
  getOrCreateEl('formAssetIP').value = '192.168.1.99';
  getOrCreateEl('formAssetMAC').value = '00:11:22:33:44:55';
  getOrCreateEl('formAssetIMEI').value = '';
  getOrCreateEl('formAssetCamInfo').value = '';
  await AssetManager.handleSaveAsset(dummyEvent);
  const savedAsset = (await db.getAll('assets')).find(a => a.assetId === 'AST-TEST-999');
  assert.ok(savedAsset, "Asset should be saved to database");
  assert.strictEqual(savedAsset.brand, 'Lenovo');
  console.log("  [PASS] Asset saved successfully: " + savedAsset.assetId + " (" + savedAsset.brand + " " + savedAsset.model + ")");

  // Form Test 5: Save Project
  console.log("\n>>> Form Test 5: Save Project");
  getOrCreateEl('formProjectId').value = '';
  getOrCreateEl('formPrjNumber').value = 'PRJ-TEST-01';
  getOrCreateEl('formPrjNameAr').value = 'مشروع البنية التحتية التجريبي';
  getOrCreateEl('formPrjNameEn').value = 'Test Infra Project';
  getOrCreateEl('formPrjType').value = 'Infrastructure';
  getOrCreateEl('formPrjContractor').value = '';
  getOrCreateEl('formPrjLocation').value = '';
  getOrCreateEl('formPrjResponsibleEmp').value = 'emp-ahmed';
  getOrCreateEl('formPrjStartDate').value = '2026-09-01';
  getOrCreateEl('formPrjPlannedEndDate').value = '2026-12-31';
  getOrCreateEl('formPrjActualEndDate').value = '';
  getOrCreateEl('formPrjProgress').value = '10';
  getOrCreateEl('formPrjStatus').value = 'Planning';
  getOrCreateEl('formPrjRemarks').value = 'Project description';
  await ProjectManager.handleProjectSubmit(dummyEvent);
  const savedPrj = (await db.getAll('projects')).find(p => p.projectNo === 'PRJ-TEST-01');
  assert.ok(savedPrj, "Project should be saved to database");
  console.log("  [PASS] Project saved successfully: " + savedPrj.projectNo);

  // Form Test 6: Save Contractor
  console.log("\n>>> Form Test 6: Save Contractor");
  getOrCreateEl('formContractorId').value = '';
  getOrCreateEl('formContractorCode').value = 'CNT-TEST-01';
  getOrCreateEl('formContractorCompanyAr').value = 'شركة التقنية الحديثة';
  getOrCreateEl('formContractorCompanyEn').value = 'Modern Tech Co';
  getOrCreateEl('formContractorContact').value = 'عمر سالم';
  getOrCreateEl('formContractorPhone').value = '065551234';
  getOrCreateEl('formContractorEmail').value = 'omar@moderntech.ae';
  getOrCreateEl('formContractorActive').value = 'true';
  getOrCreateEl('formContractorRemarks').value = 'Contractor notes';
  await ContractorManager.handleContractorSubmit(dummyEvent);
  const savedContractor = (await db.getAll('contractors')).find(c => c.companyNameAr === 'شركة التقنية الحديثة');
  assert.ok(savedContractor, "Contractor should be saved to database");
  console.log("  [PASS] Contractor saved successfully: " + savedContractor.companyNameAr);

  // Form Test 7: Save Maintenance
  console.log("\n>>> Form Test 7: Save Maintenance");
  getOrCreateEl('formMaintId').value = '';
  getOrCreateEl('formMaintAssetId').value = savedAsset.id;
  getOrCreateEl('formMaintProblem').value = 'عطل في الشاشة';
  getOrCreateEl('formMaintProblemEn').value = 'Screen issue';
  getOrCreateEl('formMaintTechnician').value = 'أحمد الفني';
  getOrCreateEl('formMaintVendor').value = 'وكيل لينوفو';
  getOrCreateEl('formMaintDate').value = '2026-09-08';
  getOrCreateEl('formMaintCost').value = '350';
  getOrCreateEl('formMaintStatus').value = 'In Progress';
  getOrCreateEl('formMaintAction').value = 'فحص أولي';
  await MaintManager.handleSaveTicket(dummyEvent);
  const savedMaint = (await db.getAll('maintenance')).find(m => m.assetId === savedAsset.id);
  assert.ok(savedMaint, "Maintenance record should be saved to database");
  console.log("  [PASS] Maintenance saved successfully for asset: " + savedAsset.assetId);

  // Form Test 8: Transfer Asset
  console.log("\n>>> Form Test 8: Transfer Asset");
  getOrCreateEl('formTransferAssetId').value = savedAsset.id;
  getOrCreateEl('formTrToLoc').value = savedLoc.id;
  getOrCreateEl('formTrToEmp').value = savedEmp.id;
  getOrCreateEl('formTrToDept').value = savedDept.id;
  getOrCreateEl('formTrResponsibleEmp').value = 'emp-ahmed';
  getOrCreateEl('formTrDate').value = '2026-09-08';
  getOrCreateEl('formTrCondition').value = 'Working';
  getOrCreateEl('formTrNotes').value = 'Transfer to new test location';
  await AssetManager.handleTransferSubmit(dummyEvent);
  const transferredAsset = await db.getById('assets', savedAsset.id);
  assert.strictEqual(transferredAsset.locationId, savedLoc.id, "Asset location should be updated to new location");
  assert.strictEqual(transferredAsset.currentEmployeeId, savedEmp.id, "Asset employee should be updated");
  console.log("  [PASS] Asset transferred successfully! New Location: " + transferredAsset.locationId);

  // Form Test 9: Save License
  console.log("\n>>> Form Test 9: Save License");
  getOrCreateEl('formLicName').value = 'Microsoft Office 365 Enterprise';
  getOrCreateEl('formLicPub').value = 'Microsoft';
  getOrCreateEl('formLicType').value = 'Subscription';
  getOrCreateEl('formLicTotal').value = '50';
  getOrCreateEl('formLicUsed').value = '12';
  getOrCreateEl('formLicKey').value = 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE';
  getOrCreateEl('formLicExpiry').value = '2027-12-31';
  getOrCreateEl('formLicNotes').value = 'Official Enterprise volume license';
  await TechTools.saveLicense(dummyEvent);
  const licenses = await db.getAll('licenses');
  const savedLic = licenses.find(l => l.name === 'Microsoft Office 365 Enterprise');
  assert.ok(savedLic, "License should be saved in database");
  console.log("  [PASS] License saved successfully: " + savedLic.name + " (" + savedLic.totalSeats + " seats)");

  // Form Test 10: Save Support Request
  console.log("\n>>> Form Test 10: Save Support Request");
  getOrCreateEl('formReqAssetId').value = savedAsset.id;
  getOrCreateEl('formReqType').value = 'Hardware';
  getOrCreateEl('formReqSubject').value = 'مشكلة في كابل الشاحن';
  getOrCreateEl('formReqDesc').value = 'كابل الشاحن لا يوصل الكهرباء بشكل مستمر';
  await HelpdeskController.handleNewSupportRequestSubmit(dummyEvent);
  const allReqs = await db.getAll('helpdeskRequests');
  const savedReq = allReqs.find(r => r.subject === 'مشكلة في كابل الشاحن');
  assert.ok(savedReq, "Support request should be saved in database");
  console.log("  [PASS] Support request saved successfully: " + savedReq.requestId + " - " + savedReq.subject);

  // Form Test 11: Save Project Task
  console.log("\n>>> Form Test 11: Save Project Task");
  getOrCreateEl('formTaskProjectId').value = savedPrj.id;
  getOrCreateEl('formTaskId').value = '';
  getOrCreateEl('formTaskNameAr').value = 'تركيب أجهزة نقاط البيع';
  getOrCreateEl('formTaskNameEn').value = 'Install POS Terminals';
  getOrCreateEl('formTaskDesc').value = 'تركيب وتشغيل الأجهزة وربطها بالشبكة';
  getOrCreateEl('formTaskStartDate').value = '2026-09-08';
  getOrCreateEl('formTaskDueDate').value = '2026-09-20';
  getOrCreateEl('formTaskResponsible').value = savedEmp.id;
  getOrCreateEl('formTaskContractor').value = savedContractor.id;
  getOrCreateEl('formTaskProgress').value = '50';
  getOrCreateEl('formTaskStatus').value = 'In Progress';
  getOrCreateEl('formTaskRemarks').value = 'تم تركيب 5 أجهزة حتى الآن';
  await ProjectManager.handleTaskSubmit(dummyEvent);
  const allTasks = await db.getAll('projectTasks');
  const savedTask = allTasks.find(t => t.nameAr === 'تركيب أجهزة نقاط البيع');
  assert.ok(savedTask, "Project task should be saved in database");
  console.log("  [PASS] Project task saved successfully: " + savedTask.nameAr + " (" + savedTask.progress + "%)");

  console.log("\n================================================================================");
  console.log("ALL 15 MODAL OPENER BUTTONS & ALL 11 FORM SUBMISSIONS VERIFIED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
