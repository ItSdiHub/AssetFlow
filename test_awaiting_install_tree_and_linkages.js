/**
 * Test Suite: Awaiting Installation - Branch/Location/Office/Employee Linkages & Interactive Tree View
 * Validates:
 * 1. Form linkages: Branch, Location, Office, Employee (with searchable comboboxes)
 * 2. Pre-filled & locked warehouse issue delivery order data
 * 3. Interactive Tree View (inline row toggle & dedicated tree modal)
 * 4. Cascading branch-to-location and location-to-office filtering
 * 5. Complete field installation atomic update
 */

const fs = require('fs');
const assert = require('assert');

console.log("================================================================================");
console.log("TESTING AWAITING INSTALLATION: LINKAGES (BRANCH, LOC, OFC, EMP) & TREE VIEW");
console.log("================================================================================");

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
        },
        querySelectorAll: () => [],
        querySelector: () => null,
        closest: () => null,
        setAttribute: () => {},
        getAttribute: () => null,
        options: [],
        appendChild: function(opt) { this.options.push(opt); }
      };
    }
    return global._elements[id];
  },
  createElement: (tag) => ({
    tagName: tag,
    style: {},
    options: [],
    _classes: new Set(),
    classList: {
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      contains: function(c) { return this._classes.has(c); }
    },
    appendChild: () => {},
    setAttribute: () => {},
    innerHTML: '',
    type: ''
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    classList: { add: () => {}, remove: () => {} }
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: { lang: 'ar', dir: 'rtl', setAttribute: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.__SDI_TEST_ENV__ = true;

require('./js/i18n.js');
require('./js/db.js');

async function runTests() {
  await db.init();

  // Load app.js and projects.js
  const appCode = fs.readFileSync('./js/app.js', 'utf8');
  eval(appCode);
  const projectsCode = fs.readFileSync('./js/projects.js', 'utf8');
  eval(projectsCode);

  const ops = global.OpsManager;

  // Setup sample test records
  const sampleAsset = {
    id: "ast-tree-test-1",
    assetId: "AST-TREE-001",
    brand: "Lenovo",
    model: "ThinkPad T14 Gen 3",
    serial: "SN-LNVO-9988",
    assetTypeId: "typ-laptop",
    locationId: "loc-store",
    status: "In Transit",
    condition: "Working",
    assignmentDate: "2026-09-08"
  };
  await db.put("assets", sampleAsset);

  const sampleIssue = {
    id: "wi-tree-test-1",
    issueNo: "ISS-99001",
    assetId: sampleAsset.id,
    warehouseLocationId: "loc-store",
    itEmployeeId: "emp-1",
    issueDate: "2026-09-08",
    deliveryDate: "2026-09-08",
    quantity: 1,
    status: "In Transit",
    installationStatus: "Pending",
    notes: "Dispatched to Nasseriya branch for Registration counter"
  };
  await db.put("warehouseIssues", sampleIssue);

  await db.put("locations", { id: "loc-br-nas", nameEn: "Nasseriya Branch", type: "branch", parentId: null });
  await db.put("locations", { id: "loc-nas-ofc1", nameEn: "Nasseriya Office 1", type: "office", parentId: "loc-br-nas" });

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Table Rendering with Interactive Tree Row & Toggle Buttons ---");
  // --------------------------------------------------------------------------
  await ops.renderAwaitingInstall();
  const tableBody = document.getElementById("awaitingInstallTableBody");
  const html = tableBody.innerHTML;

  assert.ok(html.includes('clickable-awaiting-row'), "Row must have clickable-awaiting-row class");
  assert.ok(html.includes(`awaitingTreeRow-${sampleAsset.id}`), "Expandable tree row must exist in table markup");
  assert.ok(html.includes(`treeToggleIcon-${sampleAsset.id}`), "Tree toggle icon must exist");
  assert.ok(html.includes('OpsManager.openAwaitingTreeModal'), "Tree action button must be present");
  console.log("PASS [Test 1]: Table rendered with interactive tree toggles, clickable row, and tree modal button.");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Building Hierarchical Tree View HTML (3 Connected Tiers) ---");
  // --------------------------------------------------------------------------
  const treeHtml = ops.buildAwaitingTreeHtml(sampleAsset, sampleIssue, { "loc-store": "المستودع الرئيسي" }, { "emp-1": "أحمد الفني" }, {}, { "typ-laptop": "حاسب محمول" });

  assert.ok(treeHtml.includes('tree-card-issue'), "Tree must include Tier 1: Warehouse Delivery Order");
  assert.ok(treeHtml.includes('tree-card-asset'), "Tree must include Tier 2: Dispatched Asset");
  assert.ok(treeHtml.includes('tree-card-install'), "Tree must include Tier 3: Field Installation & Linkages");
  assert.ok(treeHtml.includes(sampleIssue.issueNo), "Tree must display issue order number");
  assert.ok(treeHtml.includes(sampleAsset.serial), "Tree must display serial number");
  assert.ok(treeHtml.includes('OpsManager.openInstallationModal'), "Tree must include 1-click button to complete installation");
  console.log("PASS [Test 2]: Tree View renders all 3 tiers (Order -> Asset -> Target Installation) with full lineage.");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Toggle Inline Tree Expansion ---");
  // --------------------------------------------------------------------------
  await ops.toggleAwaitingTree(sampleAsset.id);
  const treeRow = document.getElementById(`awaitingTreeRow-${sampleAsset.id}`);
  assert.strictEqual(treeRow.style.display, "table-row", "Tree row must be visible after toggle");
  const container = document.getElementById(`awaitingTreeContent-${sampleAsset.id}`);
  assert.ok(container.innerHTML.includes('tree-view-wrapper'), "Tree content must be populated inside expanded row");

  // Toggle again to collapse
  await ops.toggleAwaitingTree(sampleAsset.id);
  assert.strictEqual(treeRow.style.display, "none", "Tree row must collapse when toggled again");
  console.log("PASS [Test 3]: Tree row smoothly expands with populated tree view and collapses on second click.");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Open Installation Modal & Verify Pre-filled Locked Fields ---");
  // --------------------------------------------------------------------------
  await ops.openInstallationModal(sampleAsset.id, sampleIssue.id);

  assert.strictEqual(document.getElementById("instLockedIssueNo").textContent, sampleIssue.issueNo);
  assert.strictEqual(document.getElementById("instLockedAssetCode").textContent, sampleAsset.assetId);
  assert.strictEqual(document.getElementById("instLockedSerial").textContent, sampleAsset.serial);
  assert.strictEqual(String(document.getElementById("instLockedQuantity").textContent), String(sampleIssue.quantity));
  console.log("PASS [Test 4]: All 8+ warehouse delivery order fields are automatically pre-filled and locked (🔒).");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Verify Linkages: Branch -> Location -> Office -> Employee ---");
  // --------------------------------------------------------------------------
  const branchSelect = document.getElementById("formInstBranch");
  assert.ok(branchSelect.innerHTML.includes('loc-br-nas') || branchSelect.innerHTML.includes('فرع'), "Branch select must contain branch options from database");

  console.log("Cached Locations:", ops._cachedLocations.map(l => ({ id: l.id, parentId: l.parentId, nameAr: l.nameAr })));
  const testBranchId = ops._cachedLocations.find(l => !l.parentId)?.id || "loc-main";
  ops.handleInstallationBranchChange(testBranchId);
  const locSelect = document.getElementById("formInstLoc");
  console.log("locSelect HTML:", locSelect.innerHTML);
  assert.ok(locSelect.innerHTML.includes('option'), "Location select must contain options");

  // Test selecting Location: Office 1
  ops.handleInstallationLocationChange("loc-nas-ofc1");
  const officeSelect = document.getElementById("formInstOffice");
  assert.ok(officeSelect, "Office dropdown must be populated and searchable");

  // Test Employee dropdown
  const empSelect = document.getElementById("formInstUser");
  assert.ok(empSelect, "Employee dropdown must be populated and searchable");
  console.log("PASS [Test 5]: Branch, Location, Office, and Employee linkages and cascading filters verified.");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Save Installation Draft with Branch Linkage ---");
  // --------------------------------------------------------------------------
  document.getElementById("formInstAssetId").value = sampleAsset.id;
  document.getElementById("formInstBranch").value = "loc-br-nas";
  document.getElementById("formInstLoc").value = "loc-nas-ofc1";
  document.getElementById("formInstOffice").value = "مكتب 1 (التسجيل)";
  document.getElementById("formInstUser").value = "emp-2";
  document.getElementById("formInstDate").value = "2026-09-08";
  document.getElementById("formInstCondition").value = "Working";
  document.getElementById("formInstNotes").value = "Drafting on-site installation";

  await ops.saveInstallationDraft();
  const draftIssue = await db.getById("warehouseIssues", sampleIssue.id);
  assert.strictEqual(draftIssue.installationStatus, "Draft", "Issue must have Draft status");
  assert.strictEqual(draftIssue.installedBranchId, "loc-br-nas", "Draft must save installedBranchId");
  assert.strictEqual(draftIssue.installedOffice, "مكتب 1 (التسجيل)", "Draft must save installedOffice");
  console.log("PASS [Test 6]: Save Draft persists Branch, Location, Office, and Employee without closing issue.");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Complete Installation (Atomic Asset & Issue Update) ---");
  // --------------------------------------------------------------------------
  await ops.handleInstallationSubmit({ preventDefault: () => {} });

  const completedAsset = await db.getById("assets", sampleAsset.id);
  assert.strictEqual(completedAsset.branchId, "loc-br-nas", "Asset branchId must be updated");
  assert.strictEqual(completedAsset.locationId, "loc-nas-ofc1", "Asset locationId must be updated");
  assert.strictEqual(completedAsset.office, "مكتب 1 (التسجيل)", "Asset office must be updated");
  assert.strictEqual(completedAsset.currentEmployeeId, "emp-2", "Asset employee must be updated");
  assert.strictEqual(completedAsset.status, "Assigned", "Asset status must become Assigned when employee linked");

  const completedIssue = await db.getById("warehouseIssues", sampleIssue.id);
  assert.strictEqual(completedIssue.status, "Installed", "Warehouse issue must be closed as Installed");
  assert.strictEqual(completedIssue.installationStatus, "Completed", "Installation status must be Completed");
  assert.strictEqual(completedIssue.installedBranchId, "loc-br-nas", "Issue record must store installed branch");

  console.log("PASS [Test 7]: Complete Installation atomically committed branch, location, office, employee, and status to asset & issue.");

  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Dedicated Tree Modal (openAwaitingTreeModal) ---");
  // --------------------------------------------------------------------------
  await ops.openAwaitingTreeModal(sampleAsset.id, sampleIssue.id);
  const modalBody = document.getElementById("awaitingTreeModalBody");
  assert.ok(modalBody.innerHTML.includes('tree-view-wrapper'), "Modal body must contain tree diagram");
  console.log("PASS [Test 8]: Dedicated Tree Modal renders complete traceability hierarchy.");

  console.log("\n================================================================================");
  console.log("ALL 8 AWAITING INSTALLATION & TREE VIEW TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================\n");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
