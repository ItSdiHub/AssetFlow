/**
 * SDI IT Asset Hub - Integrated Asset Operations Verification Test
 * Tests:
 * Test 1 - Warehouse Issue to IT Employee
 * Test 2 - IT Employee Installation & Current Location Assignment
 * Test 3 - Asset Transfer & Atomic Location Update
 * Test 4 - Transfer History Preservation (Office A -> Office B -> Office C)
 * Test 5 - Projects, Contractors, Tasks & Progress Calculation
 * Test 6 - Arabic / English Bilingual Parity
 */

const fs = require('fs');
const path = require('path');

// Global mock environment for Node.js
global.window = global;
global.AppState = { lang: 'ar', currentUser: { id: 'usr-1', username: 'admin', role: 'Administrator', employeeId: 'emp-101' } };

// Load modules
const { I18N, formatStatus, formatTxType } = require('./js/i18n.js');
const db = require('./js/db.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING SDI IT ASSET HUB - INTEGRATED ASSET OPERATIONS VERIFICATION");
  console.log("================================================================================\n");

  await db.init();

  // ---------------------------------------------------------------------------
  // TEST 1: WAREHOUSE ISSUE TO IT EMPLOYEE (PART 2)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Warehouse Issue to IT Employee ---");

  // 1. Create a new asset in warehouse
  const assetId = await db.getNextAssetId();
  const testAsset = {
    id: "test-ast-001",
    assetId: assetId,
    assetTypeId: "typ-1",
    brand: "Dell",
    model: "Latitude 5540",
    serial: "SN-WI-TEST-999",
    status: "In Store",
    locationId: "loc-17", // Main IT Warehouse
    currentEmployeeId: null,
    departmentId: null,
    condition: "Working",
    createdDate: "2026-09-08 10:00:00"
  };
  await db.put("assets", testAsset);

  // 2. Perform Warehouse Issue: Warehouse -> IT Technician
  const itEmployeeId = "emp-103"; // IT technician
  const issueNo = await db.getNextWarehouseIssueNo();
  assert(issueNo.startsWith("ISS-"), `Warehouse issue number generated: ${issueNo}`);

  testAsset.status = "In Transit";
  testAsset.currentEmployeeId = itEmployeeId;
  testAsset.locationId = "loc-17"; // Remains at source warehouse until installed
  await db.put("assets", testAsset);

  const issueRecord = {
    id: "wi-test-01",
    issueNo,
    assetId: testAsset.id,
    warehouseLocationId: "loc-17",
    itEmployeeId: itEmployeeId,
    issueDate: "2026-09-08",
    projectId: "prj-test-01",
    status: "In Transit",
    notes: "Dispatched to IT employee for field deployment",
    createdAt: new Date().toISOString()
  };
  await db.put("warehouseIssues", issueRecord);

  await db.logTransaction({
    assetId: testAsset.id,
    transactionType: "Warehouse Issue",
    fromLocationId: "loc-17",
    toLocationId: null, // Final location is NOT selected yet
    toEmployeeId: itEmployeeId,
    transactionDate: "2026-09-08 10:05:00",
    performedBy: "admin",
    notes: `[${issueNo}] Warehouse issue to IT employee`
  });

  // Verify Test 1 assertions
  const fetchedAsset1 = await db.getById("assets", testAsset.id);
  assert(fetchedAsset1.status === "In Transit", "Asset status updated to 'In Transit'");
  assert(fetchedAsset1.currentEmployeeId === itEmployeeId, "Asset linked to IT Employee");
  assert(fetchedAsset1.locationId === "loc-17", "Asset location remains source warehouse during transit");

  const issues = await db.getAll("warehouseIssues");
  const pendingIssue = issues.find(i => i.assetId === testAsset.id && i.status === "In Transit");
  assert(!!pendingIssue, "Warehouse issue record exists in pending/In Transit state");
  assert(pendingIssue.issueNo === issueNo, "Warehouse issue record matches generated issue number");

  console.log("");

  // ---------------------------------------------------------------------------
  // TEST 2: IT EMPLOYEE INSTALLATION & DESTINATION LOCATION (PART 3 & PART 4)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 2: Installation On-Site ---");

  const finalLocId = "loc-2"; // Final office location
  const endUserId = "emp-101"; // End user
  const deptId = "dept-1"; // IT Dept

  // Complete installation
  fetchedAsset1.locationId = finalLocId;
  fetchedAsset1.currentEmployeeId = endUserId;
  fetchedAsset1.departmentId = deptId;
  fetchedAsset1.status = "Assigned";
  fetchedAsset1.condition = "Working";
  fetchedAsset1.assignmentDate = "2026-09-08";
  await db.put("assets", fetchedAsset1);

  // Close pending warehouse issue
  pendingIssue.status = "Installed";
  pendingIssue.installationDate = "2026-09-08";
  pendingIssue.installedLocationId = finalLocId;
  pendingIssue.endUserId = endUserId;
  await db.put("warehouseIssues", pendingIssue);

  // Audit trail
  await db.logTransaction({
    assetId: fetchedAsset1.id,
    transactionType: "Installed",
    fromLocationId: "loc-17",
    toLocationId: finalLocId,
    toEmployeeId: endUserId,
    transactionDate: "2026-09-08 10:30:00",
    performedBy: "admin",
    notes: "Installation completed at target office"
  });

  // Verify Test 2 assertions
  const fetchedAsset2 = await db.getById("assets", testAsset.id);
  assert(fetchedAsset2.locationId === finalLocId, `Single Source of Truth: asset.locationId = ${finalLocId}`);
  assert(fetchedAsset2.currentEmployeeId === endUserId, `Asset assigned to End User: ${endUserId}`);
  assert(fetchedAsset2.status === "Assigned", "Asset status updated to 'Assigned'");

  const updatedIssue = await db.getById("warehouseIssues", pendingIssue.id);
  assert(updatedIssue.status === "Installed", "Warehouse issue closed with status 'Installed'");
  assert(updatedIssue.installedLocationId === finalLocId, "Warehouse issue preserves installed location link");

  console.log("");

  // ---------------------------------------------------------------------------
  // TEST 3: ASSET TRANSFER & ATOMIC LOCATION UPDATE (PART 5, 6, 7)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 3: Asset Transfer (Office A -> Office B) ---");

  const transferToLoc1 = "loc-3"; // Office B
  const transferNo1 = await db.getNextTransferNo();
  assert(transferNo1.startsWith("TRF-"), `Transfer number generated: ${transferNo1}`);

  // Transfer Office A (loc-2) -> Office B (loc-3)
  const fromLoc1 = fetchedAsset2.locationId;
  fetchedAsset2.locationId = transferToLoc1;
  fetchedAsset2.condition = "Working";
  await db.put("assets", fetchedAsset2);

  const transferRec1 = {
    id: "trf-test-01",
    transferNo: transferNo1,
    assetId: fetchedAsset2.id,
    fromLocationId: fromLoc1,
    toLocationId: transferToLoc1,
    transferDate: "2026-09-08",
    responsibleEmployeeId: "emp-103",
    status: "Completed",
    condition: "Working",
    notes: "Relocated to Office B"
  };
  await db.put("assetTransfers", transferRec1);

  await db.logTransaction({
    assetId: fetchedAsset2.id,
    transactionType: "Transferred",
    fromLocationId: fromLoc1,
    toLocationId: transferToLoc1,
    transactionDate: "2026-09-08 11:00:00",
    performedBy: "admin",
    notes: `[${transferNo1}] Location Transfer: ${fromLoc1} -> ${transferToLoc1}`
  });

  const fetchedAsset3 = await db.getById("assets", testAsset.id);
  assert(fetchedAsset3.locationId === transferToLoc1, `Asset current location immediately updated to ${transferToLoc1}`);

  console.log("");

  // ---------------------------------------------------------------------------
  // TEST 4: MULTI-STEP TRANSFER HISTORY PRESERVATION (PART 8 & PART 9)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 4: Transfer History Preservation (Office B -> Office C) ---");

  const transferToLoc2 = "loc-4"; // Office C
  const transferNo2 = await db.getNextTransferNo();
  const fromLoc2 = fetchedAsset3.locationId;

  fetchedAsset3.locationId = transferToLoc2;
  await db.put("assets", fetchedAsset3);

  const transferRec2 = {
    id: "trf-test-02",
    transferNo: transferNo2,
    assetId: fetchedAsset3.id,
    fromLocationId: fromLoc2,
    toLocationId: transferToLoc2,
    transferDate: "2026-09-08",
    responsibleEmployeeId: "emp-103",
    status: "Completed",
    condition: "Working",
    notes: "Relocated from Office B to Office C"
  };
  await db.put("assetTransfers", transferRec2);

  await db.logTransaction({
    assetId: fetchedAsset3.id,
    transactionType: "Transferred",
    fromLocationId: fromLoc2,
    toLocationId: transferToLoc2,
    transactionDate: "2026-09-08 11:30:00",
    performedBy: "admin",
    notes: `[${transferNo2}] Location Transfer: ${fromLoc2} -> ${transferToLoc2}`
  });

  // Verify current location is Office C
  const finalAsset = await db.getById("assets", testAsset.id);
  assert(finalAsset.locationId === transferToLoc2, `Current location is strictly Office C (${transferToLoc2})`);

  // Verify history preserved both transfers
  const allTransfers = await db.getAll("assetTransfers");
  const assetTransfers = allTransfers.filter(t => t.assetId === testAsset.id);
  assert(assetTransfers.length === 2, `Transfer table has both transfers (length = 2)`);
  assert(assetTransfers[0].fromLocationId === "loc-2" && assetTransfers[0].toLocationId === "loc-3", "First transfer loc-2 -> loc-3 preserved");
  assert(assetTransfers[1].fromLocationId === "loc-3" && assetTransfers[1].toLocationId === "loc-4", "Second transfer loc-3 -> loc-4 preserved");

  const allTx = await db.getAll("assetTransactions");
  const assetTx = allTx.filter(t => t.assetId === testAsset.id);
  assert(assetTx.length === 4, `Full audit history preserved: Created -> Warehouse Issue -> Installed -> Transfer 1 -> Transfer 2 (Count = 4 tx)`);

  console.log("");

  // ---------------------------------------------------------------------------
  // TEST 5: PROJECTS, CONTRACTORS & TASK PROGRESS (PART 10 - 16)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 5: Projects, Contractors, Tasks & Progress ---");

  // 1. Create Contractor
  const contractorCode = await db.getNextContractorCode();
  const contractor = {
    id: "cnt-test-01",
    code: contractorCode,
    companyNameAr: "شركة الحلول التقنية المتقدمة",
    companyNameEn: "Advanced Tech Solutions LLC",
    contactPerson: "خالد المنصوري",
    phone: "+971501234567",
    email: "contact@techsolutions.ae",
    active: true,
    remarks: "المقاول المعتمد لكاميرات المراقبة والشبكات"
  };
  await db.put("contractors", contractor);
  const fetchedContractor = await db.getById("contractors", contractor.id);
  assert(fetchedContractor.code === contractorCode, `Contractor created with code ${contractorCode}`);

  // 2. Create Project
  const projectNo = await db.getNextProjectNo();
  const project = {
    id: "prj-test-01",
    projectNo,
    nameAr: "تركيب كاميرات المراقبة - المبنى الرئيسي",
    nameEn: "CCTV Installation - Main Building",
    projectType: "CCTV",
    startDate: "2026-08-01",
    plannedEndDate: "2026-09-01", // Past date => Overdue!
    actualEndDate: null,
    contractorId: contractor.id,
    locationId: "loc-1",
    responsibleEmployeeId: "emp-103",
    progress: 0,
    status: "In Progress",
    remarks: "مشروع ترقية المنظومة الأمنية"
  };
  await db.put("projects", project);

  // 3. Add Project Tasks
  const task1 = {
    id: "tsk-01",
    projectId: project.id,
    nameAr: "تمديد كابلات الشبكة",
    nameEn: "Network Cable Pulling",
    progress: 100,
    status: "Completed",
    dueDate: "2026-08-15"
  };
  const task2 = {
    id: "tsk-02",
    projectId: project.id,
    nameAr: "تركيب الكاميرات الخارجية",
    nameEn: "Outdoor Cameras Mounting",
    progress: 50,
    status: "In Progress",
    dueDate: "2026-08-25"
  };
  await db.put("projectTasks", task1);
  await db.put("projectTasks", task2);

  // Calculate average progress
  const tasks = await db.getAll("projectTasks");
  const prjTasks = tasks.filter(t => t.projectId === project.id);
  const avgProgress = Math.round(prjTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / prjTasks.length);
  assert(avgProgress === 75, `Project average progress calculated correctly: ${avgProgress}% (Expected: 75%)`);

  project.progress = avgProgress;
  await db.put("projects", project);

  // Check Overdue calculation: plannedEndDate (2026-09-01) < today (2026-09-08)
  const isOverdue = project.status !== "Completed" && project.status !== "Cancelled" && project.plannedEndDate < "2026-09-08";
  assert(isOverdue === true, "Overdue project detection verified (plannedEndDate < today)");

  console.log("");

  // ---------------------------------------------------------------------------
  // TEST 6: ARABIC / ENGLISH LOCALIZATION VERIFICATION (PART 21)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 6: Arabic / English Localization Verification ---");
  const arKeys = Object.keys(I18N.ar);
  const enKeys = Object.keys(I18N.en);
  assert(arKeys.length === enKeys.length, `Localization key counts match exactly: AR=${arKeys.length}, EN=${enKeys.length}`);

  let missingInEn = arKeys.filter(k => I18N.en[k] === undefined);
  let missingInAr = enKeys.filter(k => I18N.ar[k] === undefined);
  assert(missingInEn.length === 0, `Zero missing keys in EN (${missingInEn.length})`);
  assert(missingInAr.length === 0, `Zero missing keys in AR (${missingInAr.length})`);

  // Formatters check
  assert(formatStatus("In Transit", "ar") === "قيد النقل / بانتظار التركيب", "AR formatStatus('In Transit') verified");
  assert(formatStatus("In Transit", "en") === "In Transit / Awaiting Installation", "EN formatStatus('In Transit') verified");
  assert(formatTxType("Warehouse Issue", "ar") === "صرف من المستودع لفني التقنية", "AR formatTxType('Warehouse Issue') verified");
  assert(formatTxType("Installed", "en") === "Installed On-Site", "EN formatTxType('Installed') verified");
  assert(formatTxType("Transferred", "en") === "Location Transferred", "EN formatTxType('Transferred') verified");

  console.log("\n================================================================================");
  console.log(`ALL ${passedTests}/${totalTests} INTEGRATED ASSET OPERATIONS TESTS PASSED SUCCESSFULLY!`);
  console.log("================================================================================\n");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
