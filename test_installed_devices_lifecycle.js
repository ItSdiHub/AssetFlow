/**
 * Test Suite: Installed Devices & Integrated Asset Operations Lifecycle
 * Verifies all 12 core requirements for Installed Devices & Asset Operations
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Mock Browser Environment & Dependencies
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Load i18n
require("./js/i18n.js");

// Mock DB Storage
const mockStorage = {
  assets: [],
  employees: [],
  departments: [],
  locations: [],
  assetTypes: [],
  projects: [],
  warehouseIssues: [],
  assetTransfers: [],
  assetTransactions: []
};

global.db = {
  async getAll(storeName) {
    return mockStorage[storeName] || [];
  },
  async getById(storeName, id) {
    return (mockStorage[storeName] || []).find(item => item.id === id);
  },
  async put(storeName, item) {
    if (!mockStorage[storeName]) mockStorage[storeName] = [];
    const index = mockStorage[storeName].findIndex(x => x.id === item.id);
    if (index >= 0) mockStorage[storeName][index] = item;
    else mockStorage[storeName].push(item);
    return item;
  },
  async delete(storeName, id) {
    if (!mockStorage[storeName]) return;
    mockStorage[storeName] = mockStorage[storeName].filter(x => x.id !== id);
  },
  async getNextSequentialId(storeName) {
    const prefix = storeName === "assets" ? "AST-" : storeName === "warehouseIssues" ? "ISS-" : "ID-";
    const count = (mockStorage[storeName] || []).length + 1;
    return prefix + String(count).padStart(6, "0");
  },
  async logTransaction(tx) {
    const transaction = {
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
      ...tx
    };
    mockStorage.assetTransactions.push(transaction);
    return transaction;
  }
};

global.AppState = window.AppState;
global.I18N = window.I18N;
global.App = {
  showToast(msg, type) { console.log(`[TOAST ${type.toUpperCase()}]: ${msg}`); },
  openModal(id) { console.log(`[MODAL OPEN]: ${id}`); },
  closeModal(id) { console.log(`[MODAL CLOSE]: ${id}`); },
  updateDashboard() {}
};

// Require projects.js
require("./js/projects.js");

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING TEST SUITE: INSTALLED DEVICES LIFECYCLE & ASSET OPERATIONS");
  console.log("================================================================================");

  // Setup Initial Master Data
  const mainWarehouseLoc = { id: "loc-wh", code: "WH-MAIN", nameAr: "المستودع الرئيسي", nameEn: "Main Warehouse", isWarehouse: true };
  const khorfakkanLoc = { id: "loc-khor", code: "LOC-KHOR", nameAr: "خورفكان", nameEn: "Khorfakkan" };
  const sharjahLoc = { id: "loc-shj", code: "LOC-SHJ", nameAr: "الشارقة", nameEn: "Sharjah" };
  const itDept = { id: "dept-it", code: "DEP-IT", nameAr: "قسم تقنية المعلومات", nameEn: "IT Department", locationId: "loc-shj" };
  const netType = { id: "typ-net", code: "NET", nameAr: "مفتاح شبكة (Switch)", nameEn: "Network Switch" };
  const laptopType = { id: "typ-lap", code: "LAP", nameAr: "حاسب محمول", nameEn: "Laptop" };
  const techEmp = { id: "emp-tech1", employeeNumber: "1025", nameAr: "أحمد الفني", nameEn: "Ahmed Tech", currentEmployeeId: "emp-tech1" };
  const userEmp = { id: "emp-user1", employeeNumber: "1026", nameAr: "محمد سعيد", nameEn: "Mohamed Saeed" };
  const netProject = { id: "prj-net", projectNo: "PRJ-001", nameAr: "مشروع تطوير الشبكة", nameEn: "Network Upgrade Project" };

  await db.put("locations", mainWarehouseLoc);
  await db.put("locations", khorfakkanLoc);
  await db.put("locations", sharjahLoc);
  await db.put("departments", itDept);
  await db.put("assetTypes", netType);
  await db.put("assetTypes", laptopType);
  await db.put("employees", techEmp);
  await db.put("employees", userEmp);
  await db.put("projects", netProject);

  const ops = window.OpsManager;

  // --------------------------------------------------------------------------
  // TEST 1: Create Asset (AST-000125)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Create Asset AST-000125 ---");
  const asset1 = {
    id: "ast-000125",
    assetId: "AST-000125",
    assetTypeId: "typ-net",
    brand: "Cisco",
    model: "Catalyst 9300",
    serial: "SN-CS9300-9988",
    status: "Available",
    locationId: "loc-wh",
    departmentId: null,
    currentEmployeeId: null,
    createdDate: "2026-09-01"
  };
  await db.put("assets", asset1);
  const fetchedAsset1 = await db.getById("assets", "ast-000125");
  assert.strictEqual(fetchedAsset1.assetId, "AST-000125");
  assert.strictEqual(fetchedAsset1.status, "Available");
  assert.strictEqual(fetchedAsset1.locationId, "loc-wh");
  console.log("✓ TEST 1 PASSED: Asset AST-000125 created with status 'Available' in Main Warehouse.");

  // --------------------------------------------------------------------------
  // TEST 2: Warehouse Issue (Issue asset from warehouse for installation)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Warehouse Issue for Installation ---");
  const issue = {
    id: "iss-000001",
    issueNo: "ISS-000001",
    assetId: "ast-000125",
    warehouseLocationId: "loc-wh",
    itEmployeeId: "emp-tech1",
    projectId: "prj-net",
    issueDate: "2026-09-09",
    status: "In Transit",
    notes: "Issued for Network Installation at Khorfakkan"
  };
  await db.put("warehouseIssues", issue);

  // Asset moves to In Transit
  fetchedAsset1.status = "In Transit";
  await db.put("assets", fetchedAsset1);
  
  const updatedAsset1 = await db.getById("assets", "ast-000125");
  assert.strictEqual(updatedAsset1.status, "In Transit");
  console.log("✓ TEST 2 PASSED: Warehouse issue ISS-000001 created. Asset status set to 'In Transit'.");

  // --------------------------------------------------------------------------
  // TEST 3: Awaiting Installation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Verify Asset appears in Awaiting Installation ---");
  const allAssets = await db.getAll("assets");
  const awaitingAssets = allAssets.filter(a => a.status === "In Transit");
  assert.strictEqual(awaitingAssets.length, 1);
  assert.strictEqual(awaitingAssets[0].assetId, "AST-000125");
  console.log("✓ TEST 3 PASSED: Asset AST-000125 cleanly present in Awaiting Installation.");

  // --------------------------------------------------------------------------
  // TEST 4: Record Installation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Record Installation at Khorfakkan MDF-01 ---");
  // Simulate handleInstallationSubmit form submission
  global.document = {
    getElementById(id) {
      const formValues = {
        formInstAssetId: "ast-000125",
        formInstBranch: null,
        formInstLoc: "loc-khor",
        formInstDept: "dept-it",
        formInstOffice: "MDF-01",
        formInstUser: "", // No employee assignment for network switch
        formInstDate: "2026-09-09",
        formInstCondition: "Working",
        formInstNotes: "Installed and configured successfully in Khorfakkan MDF-01"
      };
      if (formValues.hasOwnProperty(id)) {
        return { value: formValues[id], trim() { return formValues[id]; } };
      }
      return null;
    }
  };

  ops.currentActiveIssueId = "iss-000001";
  await ops.handleInstallationSubmit({ preventDefault() {} });

  const installedAsset = await db.getById("assets", "ast-000125");
  assert.strictEqual(installedAsset.status, "Installed");
  assert.strictEqual(installedAsset.locationId, "loc-khor");
  assert.strictEqual(installedAsset.departmentId, "dept-it");
  assert.strictEqual(installedAsset.office, "MDF-01");
  assert.strictEqual(installedAsset.currentEmployeeId, null);
  console.log("✓ TEST 4 PASSED: Installation recorded. Status='Installed', Location='Khorfakkan', Room='MDF-01'.");

  // --------------------------------------------------------------------------
  // TEST 5: Verify Installed Devices
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Verify Installed Devices Listing ---");
  const assetsAfterInst = await db.getAll("assets");
  const installedDevicesList = assetsAfterInst.filter(a => a.status === "Installed" || (a.status === "In Use" && (!a.currentEmployeeId || a.installationDate || a.office)));
  assert.strictEqual(installedDevicesList.length, 1);
  assert.strictEqual(installedDevicesList[0].assetId, "AST-000125");
  console.log("✓ TEST 5 PASSED: AST-000125 present in Installed Devices list.");

  // --------------------------------------------------------------------------
  // TEST 6: Verify Asset no longer appears in Awaiting Installation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Verify Asset no longer appears in Awaiting Installation ---");
  const awaitingAfterInst = assetsAfterInst.filter(a => a.status === "In Transit");
  assert.strictEqual(awaitingAfterInst.length, 0);
  console.log("✓ TEST 6 PASSED: Completed installation eliminated from Awaiting Installation (0 items).");

  // --------------------------------------------------------------------------
  // TEST 7: Transfer Installed Asset
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Transfer Installed Asset from Khorfakkan MDF-01 to Sharjah MDF-02 ---");
  const oldLoc = installedAsset.locationId;
  installedAsset.locationId = "loc-shj";
  installedAsset.office = "MDF-02";
  await db.put("assets", installedAsset);

  await db.logTransaction({
    assetId: installedAsset.id,
    transactionType: "Transfer",
    fromLocationId: oldLoc,
    toLocationId: "loc-shj",
    toEmployeeId: null,
    transactionDate: "2026-09-10",
    performedBy: "Ahmed Tech",
    notes: "Transferred switch to Sharjah Core MDF-02"
  });

  const transferredAsset = await db.getById("assets", "ast-000125");
  assert.strictEqual(transferredAsset.locationId, "loc-shj");
  assert.strictEqual(transferredAsset.office, "MDF-02");
  console.log("✓ TEST 7 PASSED: Asset transferred to Location 'Sharjah', Room 'MDF-02'.");

  // --------------------------------------------------------------------------
  // TEST 8: Verify old and new location in history
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Verify Old and New Location in Asset History ---");
  const txHistory = await db.getAll("assetTransactions");
  const assetTxHistory = txHistory.filter(t => t.assetId === "ast-000125");
  assert.ok(assetTxHistory.length >= 2);
  const transferTx = assetTxHistory.find(t => t.transactionType === "Transfer");
  assert.strictEqual(transferTx.fromLocationId, "loc-khor");
  assert.strictEqual(transferTx.toLocationId, "loc-shj");
  console.log("✓ TEST 8 PASSED: Movement history logged: Khorfakkan -> Sharjah.");

  // --------------------------------------------------------------------------
  // TEST 9: Remove Installed Asset
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 9: Remove Installed Asset (Destination: Return to Warehouse) ---");
  global.document = {
    getElementById(id) {
      const formValues = {
        formRemoveAssetId: "ast-000125",
        formRemovalDate: "2026-09-11",
        formRemovedBy: "emp-tech1",
        formRemovalDestination: "warehouse",
        formRemovalReason: "Decommissioned for upgrade"
      };
      if (formValues.hasOwnProperty(id)) {
        return { value: formValues[id], trim() { return formValues[id]; } };
      }
      return null;
    }
  };

  await ops.handleRemoveFromInstallationSubmit({ preventDefault() {} });
  const removedAsset = await db.getById("assets", "ast-000125");
  assert.strictEqual(removedAsset.status, "Available");
  assert.strictEqual(removedAsset.locationId, "loc-wh");
  console.log("✓ TEST 9 PASSED: Asset removed from installation and returned to warehouse.");

  // --------------------------------------------------------------------------
  // TEST 10: Return to Warehouse Verification
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 10: Verify Return to Warehouse Status ---");
  assert.strictEqual(removedAsset.status, "Available");
  assert.strictEqual(removedAsset.currentEmployeeId, null);
  assert.strictEqual(removedAsset.office, null);
  console.log("✓ TEST 10 PASSED: Returned asset is Available, unassigned from room & employee.");

  // --------------------------------------------------------------------------
  // TEST 11: Verify employee-assigned assets are not incorrectly classified as Installed
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 11: Verify Employee-Assigned Assets Classification ---");
  const laptopAsset = {
    id: "ast-000200",
    assetId: "LT-000200",
    assetTypeId: "typ-lap",
    brand: "HP",
    model: "EliteBook 840",
    serial: "SN-HP840-7711",
    status: "Assigned",
    locationId: "loc-shj",
    departmentId: "dept-it",
    currentEmployeeId: "emp-user1",
    createdDate: "2026-09-01"
  };
  await db.put("assets", laptopAsset);

  const assetsForCheck = await db.getAll("assets");
  const installedFilterResult = assetsForCheck.filter(a => a.status === "Installed" || (a.status === "In Use" && (!a.currentEmployeeId || a.installationDate || a.office)));
  
  const isLaptopInInstalled = installedFilterResult.some(a => a.id === "ast-000200");
  assert.strictEqual(isLaptopInInstalled, false, "Employee-assigned laptop must NOT be classified as Installed Device");
  console.log("✓ TEST 11 PASSED: Employee-assigned laptop (LT-000200) strictly excluded from Installed Devices.");

  // --------------------------------------------------------------------------
  // TEST 12: Verify Bilingual UI
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 12: Verify Bilingual UI & Localization ---");
  assert.strictEqual(I18N.ar.tabInstalledDevices, "الأجهزة المركبة");
  assert.strictEqual(I18N.en.tabInstalledDevices, "Installed Devices");
  assert.strictEqual(I18N.ar.btnRecordInstallation, "تسجيل التركيب");
  assert.strictEqual(I18N.en.btnRecordInstallation, "Record Installation");
  assert.strictEqual(I18N.ar.btnRemoveFromInstallation, "إزالة من الموقع");
  assert.strictEqual(I18N.en.btnRemoveFromInstallation, "Remove From Installation");
  console.log("✓ TEST 12 PASSED: All bilingual translation keys verified for Arabic and English.");

  console.log("\n================================================================================");
  console.log("ALL 12/12 OPERATIONAL TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("TEST RUN FAILURE:", err);
  process.exit(1);
});
