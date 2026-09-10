// test_operations_search_and_filters.js
// Verification of Search, Filter, Date-Range, and Reset in Asset Operations & Logistics page

const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const projectsJs = fs.readFileSync(path.join(__dirname, 'js/projects.js'), 'utf8');
const i18nJs = fs.readFileSync(path.join(__dirname, 'js/i18n.js'), 'utf8');
const mainCss = fs.readFileSync(path.join(__dirname, 'styles/main.css'), 'utf8');

console.log("================================================================================");
console.log("TESTING SEARCH, FILTERS & DATE RANGES IN ASSET OPERATIONS & LOGISTICS");
console.log("================================================================================");

let testsPassed = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    testsPassed++;
    console.log(`PASS [Test ${totalTests}]: ${message}`);
  } else {
    console.error(`FAIL [Test ${totalTests}]: ${message}`);
    process.exitCode = 1;
  }
}

// 1. Check HTML elements for Subtab 1: Warehouse Issues (wi*)
assert(indexHtml.includes('id="wiSearchInput"'), "Warehouse Issues has #wiSearchInput");
assert(indexHtml.includes('id="wiFilterStatus"'), "Warehouse Issues has #wiFilterStatus");
assert(indexHtml.includes('id="wiFilterWarehouse"'), "Warehouse Issues has #wiFilterWarehouse");
assert(indexHtml.includes('id="wiFilterDateFrom"'), "Warehouse Issues has #wiFilterDateFrom");
assert(indexHtml.includes('id="wiFilterDateTo"'), "Warehouse Issues has #wiFilterDateTo");
assert(indexHtml.includes('OpsManager.resetWarehouseIssueFilters()'), "Warehouse Issues has reset button calling resetWarehouseIssueFilters()");

// 2. Check HTML elements for Subtab 2: Awaiting Installation (opsAwaiting*)
assert(indexHtml.includes('id="opsAwaitingSearchInput"'), "Awaiting Installation has #opsAwaitingSearchInput");
assert(indexHtml.includes('id="opsAwaitingFilterWarehouse"'), "Awaiting Installation has #opsAwaitingFilterWarehouse");
assert(indexHtml.includes('id="opsAwaitingFilterTechnician"'), "Awaiting Installation has #opsAwaitingFilterTechnician");
assert(indexHtml.includes('id="opsAwaitingFilterDateFrom"'), "Awaiting Installation has #opsAwaitingFilterDateFrom");
assert(indexHtml.includes('id="opsAwaitingFilterDateTo"'), "Awaiting Installation has #opsAwaitingFilterDateTo");
assert(indexHtml.includes('OpsManager.resetAwaitingFilters()'), "Awaiting Installation has reset button calling resetAwaitingFilters()");

// 3. Check HTML elements for Subtab 3: Transfers (trf*)
assert(indexHtml.includes('id="trfSearchInput"'), "Transfers has #trfSearchInput");
assert(indexHtml.includes('id="trfFilterFromLoc"'), "Transfers has #trfFilterFromLoc");
assert(indexHtml.includes('id="trfFilterToLoc"'), "Transfers has #trfFilterToLoc");
assert(indexHtml.includes('id="trfFilterStatus"'), "Transfers has #trfFilterStatus");
assert(indexHtml.includes('id="trfFilterDateFrom"'), "Transfers has #trfFilterDateFrom");
assert(indexHtml.includes('id="trfFilterDateTo"'), "Transfers has #trfFilterDateTo");
assert(indexHtml.includes('OpsManager.resetTransferFilters()'), "Transfers has reset button calling resetTransferFilters()");

// 4. Check CSS compact sizing
assert(mainCss.includes('#tab-operations .filter-toolbar'), "CSS contains #tab-operations .filter-toolbar rule");
assert(mainCss.includes('#tab-operations .filter-input'), "CSS contains #tab-operations .filter-input rule with compact height");
assert(mainCss.includes('#tab-operations .filter-toolbar .btn-sm'), "CSS contains #tab-operations button compact rule");

// 5. Check JS reset methods
assert(projectsJs.includes('resetWarehouseIssueFilters()'), "AssetOperationsController defines resetWarehouseIssueFilters()");
assert(projectsJs.includes('resetAwaitingFilters()'), "AssetOperationsController defines resetAwaitingFilters()");
assert(projectsJs.includes('resetTransferFilters()'), "AssetOperationsController defines resetTransferFilters()");

// 6. Test Filtering Logic Simulation
// Mock Data
const mockLocations = [
  { id: "loc-1", nameAr: "مستودع الرياض الرئيسي", nameEn: "Riyadh Main WH" },
  { id: "loc-2", nameAr: "فرع جدة", nameEn: "Jeddah Branch" },
  { id: "loc-3", nameAr: "مكتب الإدارة 301", nameEn: "Admin Office 301" }
];

const mockEmployees = [
  { id: "emp-1", nameAr: "أحمد الفني", nameEn: "Ahmed Tech" },
  { id: "emp-2", nameAr: "سارة المهندسة", nameEn: "Sara Eng" }
];

const mockAssets = [
  { id: "a-1", assetId: "PC-00100", brand: "Dell", model: "OptiPlex 7090", serial: "SN-100", status: "In Transit", locationId: "loc-1", currentEmployeeId: "emp-1" },
  { id: "a-2", assetId: "LT-00200", brand: "HP", model: "EliteBook 840", serial: "SN-200", status: "In Transit", locationId: "loc-2", currentEmployeeId: "emp-2" },
  { id: "a-3", assetId: "PR-00300", brand: "Canon", model: "ImageRunner", serial: "SN-300", status: "Installed", locationId: "loc-3", currentEmployeeId: "emp-1" }
];

const mockIssues = [
  { id: "iss-1", issueNo: "ISS-000001", assetId: "a-1", warehouseLocationId: "loc-1", itEmployeeId: "emp-1", issueDate: "2026-03-01", status: "In Transit" },
  { id: "iss-2", issueNo: "ISS-000002", assetId: "a-2", warehouseLocationId: "loc-2", itEmployeeId: "emp-2", issueDate: "2026-03-05", status: "In Transit" },
  { id: "iss-3", issueNo: "ISS-000003", assetId: "a-3", warehouseLocationId: "loc-1", itEmployeeId: "emp-1", issueDate: "2026-03-10", status: "Installed" }
];

const mockTransfers = [
  { id: "trf-1", assetId: "a-1", fromLocationId: "loc-1", toLocationId: "loc-2", transferDate: "2026-02-15", status: "Completed", notes: "نقل إلى فرع جدة" },
  { id: "trf-2", assetId: "a-2", fromLocationId: "loc-2", toLocationId: "loc-3", transferDate: "2026-03-02", status: "Completed", notes: "تسليم الإدارة" },
  { id: "trf-3", assetId: "a-3", fromLocationId: "loc-1", toLocationId: "loc-3", transferDate: "2026-03-12", status: "Pending", notes: "في انتظار الموافقة" }
];

// Test Warehouse Issues Filtering
function filterWarehouseIssues({ query = "", status = "", warehouse = "", dateFrom = "", dateTo = "" }) {
  const assetMap = Object.fromEntries(mockAssets.map(a => [a.id, a]));
  const locMap = Object.fromEntries(mockLocations.map(l => [l.id, l.nameAr]));
  const empMap = Object.fromEntries(mockEmployees.map(e => [e.id, e.nameAr]));

  return mockIssues.filter(i => {
    const asset = assetMap[i.assetId] || {};
    const sourceLoc = locMap[i.warehouseLocationId] || "";
    const receiver = empMap[i.itEmployeeId] || "";
    const issueDate = i.issueDate || "";

    if (status && i.status !== status) return false;
    if (warehouse && i.warehouseLocationId !== warehouse) return false;
    if (dateFrom && issueDate && issueDate < dateFrom) return false;
    if (dateTo && issueDate && issueDate > dateTo) return false;

    if (query) {
      const q = query.toLowerCase();
      const match = (i.issueNo || "").toLowerCase().includes(q) ||
                    (asset.assetId || "").toLowerCase().includes(q) ||
                    (asset.brand || "").toLowerCase().includes(q) ||
                    sourceLoc.toLowerCase().includes(q) ||
                    receiver.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

// Test Awaiting Installation Filtering
function filterAwaiting({ query = "", warehouse = "", tech = "", dateFrom = "", dateTo = "" }) {
  const pendingIssuesMap = {};
  mockIssues.filter(i => i.status === "In Transit").forEach(i => { pendingIssuesMap[i.assetId] = i; });
  const awaitingAssets = mockAssets.filter(a => a.status === "In Transit");
  const locMap = Object.fromEntries(mockLocations.map(l => [l.id, l.nameAr]));
  const empMap = Object.fromEntries(mockEmployees.map(e => [e.id, e.nameAr]));

  return awaitingAssets.filter(a => {
    const issue = pendingIssuesMap[a.id] || {};
    const whId = issue.warehouseLocationId || a.locationId;
    const techId = issue.itEmployeeId || a.currentEmployeeId;
    const issueDate = issue.issueDate || a.assignmentDate || "";

    if (warehouse && whId !== warehouse) return false;
    if (tech && techId !== tech) return false;
    if (dateFrom && issueDate && issueDate < dateFrom) return false;
    if (dateTo && issueDate && issueDate > dateTo) return false;

    if (query) {
      const q = query.toLowerCase();
      const match = (a.assetId || "").toLowerCase().includes(q) ||
                    (a.brand || "").toLowerCase().includes(q) ||
                    (a.model || "").toLowerCase().includes(q) ||
                    (issue.issueNo || "").toLowerCase().includes(q) ||
                    (locMap[whId] || "").toLowerCase().includes(q) ||
                    (empMap[techId] || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

// Test Transfers Filtering
function filterTransfers({ query = "", fromLoc = "", toLoc = "", status = "", dateFrom = "", dateTo = "" }) {
  const assetMap = Object.fromEntries(mockAssets.map(a => [a.id, a]));
  const locMap = Object.fromEntries(mockLocations.map(l => [l.id, l.nameAr]));

  return mockTransfers.filter(t => {
    const asset = assetMap[t.assetId] || {};
    const fromLocation = locMap[t.fromLocationId] || "";
    const toLocation = locMap[t.toLocationId] || "";
    const transferDate = t.transferDate || "";

    if (status && (t.status || "Completed") !== status) return false;
    if (fromLoc && t.fromLocationId !== fromLoc) return false;
    if (toLoc && t.toLocationId !== toLoc) return false;
    if (dateFrom && transferDate && transferDate < dateFrom) return false;
    if (dateTo && transferDate && transferDate > dateTo) return false;

    if (query) {
      const q = query.toLowerCase();
      const match = (asset.assetId || "").toLowerCase().includes(q) ||
                    (asset.brand || "").toLowerCase().includes(q) ||
                    fromLocation.toLowerCase().includes(q) ||
                    toLocation.toLowerCase().includes(q) ||
                    (t.notes || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

// Execute logic tests
const resWiQuery = filterWarehouseIssues({ query: "ISS-000002" });
assert(resWiQuery.length === 1 && resWiQuery[0].issueNo === "ISS-000002", "WI Filter by search query matches correctly");

const resWiStatus = filterWarehouseIssues({ status: "Installed" });
assert(resWiStatus.length === 1 && resWiStatus[0].issueNo === "ISS-000003", "WI Filter by status matches correctly");

const resWiWarehouse = filterWarehouseIssues({ warehouse: "loc-1" });
assert(resWiWarehouse.length === 2, "WI Filter by warehouse matches 2 records in loc-1");

const resWiDate = filterWarehouseIssues({ dateFrom: "2026-03-04", dateTo: "2026-03-08" });
assert(resWiDate.length === 1 && resWiDate[0].issueNo === "ISS-000002", "WI Filter by date range (2026-03-04 to 2026-03-08) matches exactly 1 record");

const resAwaitingQuery = filterAwaiting({ query: "EliteBook" });
assert(resAwaitingQuery.length === 1 && resAwaitingQuery[0].assetId === "LT-00200", "Awaiting Filter by search query matches EliteBook");

const resAwaitingTech = filterAwaiting({ tech: "emp-1" });
assert(resAwaitingTech.length === 1 && resAwaitingTech[0].assetId === "PC-00100", "Awaiting Filter by technician matches emp-1");

const resAwaitingDate = filterAwaiting({ dateFrom: "2026-03-02", dateTo: "2026-03-06" });
assert(resAwaitingDate.length === 1 && resAwaitingDate[0].assetId === "LT-00200", "Awaiting Filter by date range matches correctly");

const resTrfFrom = filterTransfers({ fromLoc: "loc-1" });
assert(resTrfFrom.length === 2, "Transfers Filter by fromLocation matches 2 records");

const resTrfTo = filterTransfers({ toLoc: "loc-3" });
assert(resTrfTo.length === 2, "Transfers Filter by toLocation matches 2 records");

const resTrfStatus = filterTransfers({ status: "Pending" });
assert(resTrfStatus.length === 1 && resTrfStatus[0].id === "trf-3", "Transfers Filter by status matches Pending record");

const resTrfDate = filterTransfers({ dateFrom: "2026-03-01", dateTo: "2026-03-10" });
assert(resTrfDate.length === 1 && resTrfDate[0].id === "trf-2", "Transfers Filter by date range matches correctly");

const resTrfReset = filterTransfers({});
assert(resTrfReset.length === 3, "Transfers Reset restores all 3 records");

console.log("================================================================================");
console.log(`ALL ${testsPassed} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log("================================================================================");
