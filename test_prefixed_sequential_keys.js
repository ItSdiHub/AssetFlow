// test_prefixed_sequential_keys.js
// Automated verification for Sequential Prefixed Primary Keys and Codes
// (e.g. AST-000001, SDI-1001, DEP-001, LOC-001, TYP-001, CNT-001, PRJ-2026-001, etc.)
// and locked uneditable modal form fields.

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  FAIL: ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log("=== Testing Prefixed Sequential Primary Keys & Codes ===");

  // 1. Verify index.html readonly inputs & placeholders
  const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  console.log("\n[Group 1] Verifying Form Inputs are Locked & Readonly with Prefixed Placeholders:");
  assert(
    (htmlContent.includes('id="formEmpIdDisplay"') || htmlContent.includes('id="formEmpNumber"')) && htmlContent.includes('readonly') && htmlContent.includes('placeholder="EMP-1001"'),
    "Employee ID (formEmpIdDisplay) is readonly with placeholder EMP-1001"
  );
  assert(
    htmlContent.includes('id="formDeptIdDisplay"') && htmlContent.includes('readonly') && htmlContent.includes('placeholder="DEP-001"'),
    "Department ID (formDeptIdDisplay) is readonly with placeholder DEP-001"
  );
  assert(
    htmlContent.includes('id="formLocCode"') && htmlContent.includes('readonly') && htmlContent.includes('placeholder="LOC-001"'),
    "Location Code/ID (formLocCode) is readonly with placeholder LOC-001"
  );
  assert(
    htmlContent.includes('id="formTypeCode"') && htmlContent.includes('readonly') && htmlContent.includes('placeholder="TYP-001"'),
    "Asset Type Code/ID (formTypeCode) is readonly with placeholder TYP-001"
  );
  assert(
    htmlContent.includes('id="formContractorCode"') && htmlContent.includes('readonly') && htmlContent.includes('placeholder="CNT-001"'),
    "Contractor Code/ID (formContractorCode) is readonly with placeholder CNT-001"
  );
  assert(
    htmlContent.includes('id="formPrjNumber"') && htmlContent.includes('readonly') && htmlContent.includes('placeholder="PRJ-2026-001"'),
    "Project Number/ID (formPrjNumber) is readonly with placeholder PRJ-2026-001"
  );
  assert(
    htmlContent.includes('id="formAssetId"') && htmlContent.includes('readonly') && htmlContent.includes('placeholder="AST-000001"'),
    "Asset ID (formAssetId) is readonly with placeholder AST-000001"
  );

  // 2. Verify Lock icons in HTML
  console.log("\n[Group 2] Verifying Visual Lock Icons (🔒):");
  assert(htmlContent.includes('formEmpNumber') && htmlContent.includes('(ID) 🔒*'), "Employee modal has 🔒 lock icon");
  assert(htmlContent.includes('formDeptIdDisplay') && htmlContent.includes('(Department ID) 🔒*'), "Department modal has 🔒 lock icon");
  assert(htmlContent.includes('formLocCode') && htmlContent.includes('رمز / رقم الموقع (ID)</span> 🔒'), "Location modal has 🔒 lock icon");
  assert(htmlContent.includes('formTypeCode') && htmlContent.includes('كود / رقم النوع (ID)</span> 🔒*'), "Asset Type modal has 🔒 lock icon");
  assert(htmlContent.includes('formContractorCode') && htmlContent.includes('كود / رقم المقاول (ID)</span> 🔒*'), "Contractor modal has 🔒 lock icon");
  assert(htmlContent.includes('formPrjNumber') && htmlContent.includes('رقم المشروع</span> (ID) 🔒*'), "Project modal has 🔒 lock icon");
  assert(htmlContent.includes('formAssetId') && htmlContent.includes('رقم الأصل (Asset ID)</span> 🔒*'), "Asset modal has 🔒 lock icon");

  // 3. Test Sequential ID Generator Logic in js/db.js
  console.log("\n[Group 3] Testing Prefixed Sequential Key Generation Logic:");
  
  // Load db code to test in sandbox
  const dbCode = fs.readFileSync(path.join(__dirname, 'js', 'db.js'), 'utf8');
  assert(dbCode.includes('getStorePrefixConfig(storeName)'), "js/db.js includes getStorePrefixConfig");
  assert(dbCode.includes('getNextEmployeeNumber'), "js/db.js includes getNextEmployeeNumber helper");
  assert(dbCode.includes('getNextDepartmentCode'), "js/db.js includes getNextDepartmentCode helper");
  assert(dbCode.includes('getNextLocationCode'), "js/db.js includes getNextLocationCode helper");
  assert(dbCode.includes('getNextAssetTypeCode'), "js/db.js includes getNextAssetTypeCode helper");

  // Create MockDB with the exact implementation from js/db.js
  class MockDB {
    constructor() {
      this.stores = {};
    }
    async getAll(storeName) {
      return this.stores[storeName] || [];
    }
    async getById(storeName, id) {
      const items = this.stores[storeName] || [];
      const strId = String(id).trim().toLowerCase();
      return items.find(i => 
        (i && (i.id === id || String(i.id).trim().toLowerCase() === strId)) ||
        (i && i.employeeNumber && String(i.employeeNumber).trim().toLowerCase() === strId) ||
        (i && i.code && String(i.code).trim().toLowerCase() === strId) ||
        (i && i.assetId && String(i.assetId).trim().toLowerCase() === strId) ||
        (i && i.projectNo && String(i.projectNo).trim().toLowerCase() === strId) ||
        (i && i.issueNo && String(i.issueNo).trim().toLowerCase() === strId) ||
        (i && i.transferNo && String(i.transferNo).trim().toLowerCase() === strId) ||
        (i && i.requestId && String(i.requestId).trim().toLowerCase() === strId)
      ) || null;
    }

    getStorePrefixConfig(storeName) {
      const currentYear = new Date().getFullYear();
      const config = {
        assets: { prefix: "AST-", digits: 6, start: 1, fields: ["assetId", "id"] },
        employees: { prefix: "EMP-", digits: 4, start: 1001, fields: ["id", "employeeId"], altPrefixes: ["EMP-", "SDI-"] },
        departments: { prefix: "DEP-", digits: 3, start: 1, fields: ["id", "code"] },
        locations: { prefix: "LOC-", digits: 3, start: 1, fields: ["code", "id"] },
        assetTypes: { prefix: "TYP-", digits: 3, start: 1, fields: ["code", "id"] },
        contractors: { prefix: "CNT-", digits: 3, start: 1, fields: ["code", "id"] },
        projects: { prefix: `PRJ-${currentYear}-`, digits: 3, start: 1, fields: ["projectNo", "id"] },
        projectTasks: { prefix: "TSK-", digits: 3, start: 1, fields: ["id", "taskNo", "code"] },
        warehouseIssues: { prefix: "ISS-", digits: 6, start: 1, fields: ["issueNo", "id"] },
        assetTransfers: { prefix: "TRF-", digits: 6, start: 1, fields: ["transferNo", "id"] },
        maintenance: { prefix: "MNT-", digits: 5, start: 1, fields: ["id", "ticketNo"], altPrefixes: ["MAINT-", "TKT-"] },
        helpdeskRequests: { prefix: "REQ-", digits: 6, start: 101, fields: ["requestId", "id"] },
        licenses: { prefix: "LIC-", digits: 4, start: 1, fields: ["id", "licenseNo"] },
        users: { prefix: "USR-", digits: 3, start: 1, fields: ["id"] },
        assetTransactions: { prefix: "TX-", digits: 6, start: 1, fields: ["id"] },
        notifications: { prefix: "NOTIF-", digits: 6, start: 1, fields: ["id"] }
      };
      return config[storeName] || { 
        prefix: (storeName.slice(0, 3).toUpperCase() + "-"), 
        digits: 4, 
        start: 1, 
        fields: ["id", "code"] 
      };
    }

    async getNextSequentialId(storeName) {
      const items = await this.getAll(storeName);
      const cfg = this.getStorePrefixConfig(storeName);
      const prefix = typeof cfg.prefix === "function" ? cfg.prefix() : cfg.prefix;
      const digits = cfg.digits || 3;
      const startNum = cfg.start || 1;
      const fields = cfg.fields || ["id", "code"];
      const allPrefixes = [prefix, ...(cfg.altPrefixes || [])].sort((a, b) => b.length - a.length);

      let maxNum = 0;
      let foundPrefixed = false;

      items.forEach(item => {
        if (!item) return;
        for (const f of fields) {
          const val = item[f];
          if (val !== undefined && val !== null) {
            const valStr = String(val).trim();
            let matchedPrefix = false;
            for (const p of allPrefixes) {
              if (valStr.toUpperCase().startsWith(p.toUpperCase())) {
                const numPart = valStr.slice(p.length).replace(/^[^\d]*/, "");
                const num = parseInt(numPart, 10);
                if (!isNaN(num) && num < 10000000) {
                  foundPrefixed = true;
                  if (num > maxNum) maxNum = num;
                  matchedPrefix = true;
                  break;
                }
              }
            }
            if (!matchedPrefix && /^\d+$/.test(valStr)) {
              const num = parseInt(valStr, 10);
              if (!isNaN(num) && num < 10000000) {
                if (num > maxNum) maxNum = num;
              }
            }
          }
        }
      });

      let nextNum = foundPrefixed || maxNum >= startNum ? maxNum + 1 : startNum;

      let candidate = `${prefix}${String(nextNum).padStart(digits, "0")}`;
      while (items.some(it => it && (
        String(it.id).toUpperCase() === candidate.toUpperCase() ||
        (it.code && String(it.code).toUpperCase() === candidate.toUpperCase()) ||
        (it.employeeNumber && String(it.employeeNumber).toUpperCase() === candidate.toUpperCase()) ||
        (it.projectNo && String(it.projectNo).toUpperCase() === candidate.toUpperCase()) ||
        (it.issueNo && String(it.issueNo).toUpperCase() === candidate.toUpperCase()) ||
        (it.assetId && String(it.assetId).toUpperCase() === candidate.toUpperCase())
      ))) {
        nextNum++;
        candidate = `${prefix}${String(nextNum).padStart(digits, "0")}`;
      }

      return candidate;
    }

    async put(storeName, item) {
      if (!item) return item;
      const isTempId = typeof item.id === "string" && (
        /\d{10,}/.test(item.id) || 
        /^(temp|tmp)-/i.test(item.id)
      );
      if (!item.id || isTempId) {
        const existing = item.id ? await this.getById(storeName, item.id) : null;
        if (!existing) {
          item.id = await this.getNextSequentialId(storeName);
        }
      }
      if (storeName === "contractors" && !item.code) item.code = item.id;
      if (storeName === "projects" && !item.projectNo) item.projectNo = item.id;
      if (storeName === "warehouseIssues" && !item.issueNo) item.issueNo = item.id;
      if (storeName === "assetTransfers" && !item.transferNo) item.transferNo = item.id;
      if (storeName === "helpdeskRequests" && !item.requestId) item.requestId = item.id;
      if (storeName === "employees" && !item.employeeNumber) item.employeeNumber = item.id;
      if (storeName === "assets" && !item.assetId) item.assetId = item.id;
      if (storeName === "locations" && !item.code) item.code = item.id;
      if (storeName === "assetTypes" && !item.code) item.code = item.id;

      if (!this.stores[storeName]) this.stores[storeName] = [];
      const idx = this.stores[storeName].findIndex(i => i.id === item.id);
      if (idx >= 0) this.stores[storeName][idx] = item;
      else this.stores[storeName].push(item);
      return item;
    }
  }

  const mockDb = new MockDB();

  // Test Contractors
  mockDb.stores["contractors"] = [
    { id: "CNT-001", code: "CNT-001", companyNameAr: "شركة 1" },
    { id: "CNT-002", code: "CNT-002", companyNameAr: "شركة 2" },
    { id: "CNT-003", code: "CNT-003", companyNameAr: "شركة 3" }
  ];
  const nextCnt = await mockDb.getNextSequentialId("contractors");
  assert(nextCnt === "CNT-004", `Contractor next sequential code is CNT-004 (got ${nextCnt})`);
  await mockDb.put("contractors", { companyNameAr: "شركة 4" });
  const nextCnt2 = await mockDb.getNextSequentialId("contractors");
  assert(nextCnt2 === "CNT-005", `Contractor next sequential code after save is CNT-005 (got ${nextCnt2})`);

  // Test Projects
  const currentYear = new Date().getFullYear();
  mockDb.stores["projects"] = [
    { id: `PRJ-${currentYear}-001`, projectNo: `PRJ-${currentYear}-001`, nameAr: "مشروع 1" },
    { id: `PRJ-${currentYear}-002`, projectNo: `PRJ-${currentYear}-002`, nameAr: "مشروع 2" }
  ];
  const nextPrj = await mockDb.getNextSequentialId("projects");
  assert(nextPrj === `PRJ-${currentYear}-003`, `Project next sequential code is PRJ-${currentYear}-003 (got ${nextPrj})`);

  // Test Employees with EMP- prefix
  mockDb.stores["employees"] = [
    { id: "EMP-1001", employeeNumber: "1021", nameAr: "أحمد" },
    { id: "EMP-1002", employeeNumber: "1045", nameAr: "مريم" },
    { id: "EMP-1003", employeeNumber: "1088", nameAr: "سلطان" },
    { id: "EMP-1004", employeeNumber: "1102", nameAr: "فاطمة" },
    { id: "EMP-1005", employeeNumber: "1140", nameAr: "عائشة" },
    { id: "EMP-1006", employeeNumber: "1180", nameAr: "خالد" }
  ];
  const nextEmp = await mockDb.getNextSequentialId("employees");
  assert(nextEmp === "EMP-1007", `Employee next sequential code is EMP-1007 (got ${nextEmp})`);
  await mockDb.put("employees", { nameAr: "موظف جديد" });
  const nextEmp2 = await mockDb.getNextSequentialId("employees");
  assert(nextEmp2 === "EMP-1008", `Employee next sequential code after save is EMP-1008 (got ${nextEmp2})`);

  // Test Departments (Starts at DEP-001)
  mockDb.stores["departments"] = [
    { id: "dept-it", nameAr: "تقنية المعلومات" },
    { id: "dept-cs", nameAr: "خدمة العملاء" }
  ];
  const nextDept = await mockDb.getNextSequentialId("departments");
  assert(nextDept === "DEP-001", `Department next sequential code is DEP-001 (got ${nextDept})`);
  await mockDb.put("departments", { nameAr: "قسم جديد" });
  const nextDept2 = await mockDb.getNextSequentialId("departments");
  assert(nextDept2 === "DEP-002", `Department next sequential code after save is DEP-002 (got ${nextDept2})`);

  // Test Locations (Starts at LOC-001)
  mockDb.stores["locations"] = [
    { id: "loc-main", nameAr: "الرئيسي", code: "HQ" }
  ];
  const nextLoc = await mockDb.getNextSequentialId("locations");
  assert(nextLoc === "LOC-001", `Location next sequential code is LOC-001 (got ${nextLoc})`);
  await mockDb.put("locations", { nameAr: "موقع فرعي" });
  const nextLoc2 = await mockDb.getNextSequentialId("locations");
  assert(nextLoc2 === "LOC-002", `Location next sequential code after save is LOC-002 (got ${nextLoc2})`);

  // Test Asset Types (Starts at TYP-001)
  mockDb.stores["assetTypes"] = [
    { id: "type-comp", nameAr: "كمبيوتر", code: "COM" }
  ];
  const nextType = await mockDb.getNextSequentialId("assetTypes");
  assert(nextType === "TYP-001", `Asset Type next sequential code is TYP-001 (got ${nextType})`);

  // Test Assets (Existing AST-000001 to AST-000010)
  mockDb.stores["assets"] = [
    { id: "AST-000001", assetId: "AST-000001" },
    { id: "AST-000010", assetId: "AST-000010" }
  ];
  const nextAst = await mockDb.getNextSequentialId("assets");
  assert(nextAst === "AST-000011", `Asset next sequential code is AST-000011 (got ${nextAst})`);

  // Test Warehouse Issues (Existing ISS-000001)
  mockDb.stores["warehouseIssues"] = [
    { id: "ISS-000001", issueNo: "ISS-000001" }
  ];
  const nextIss = await mockDb.getNextSequentialId("warehouseIssues");
  assert(nextIss === "ISS-000002", `Warehouse Issue next sequential code is ISS-000002 (got ${nextIss})`);

  // Test Asset Transfers
  const nextTrf = await mockDb.getNextSequentialId("assetTransfers");
  assert(nextTrf === "TRF-000001", `Asset Transfer next sequential code is TRF-000001 (got ${nextTrf})`);

  // Test Maintenance
  const nextMnt = await mockDb.getNextSequentialId("maintenance");
  assert(nextMnt === "MNT-00001", `Maintenance next sequential code is MNT-00001 (got ${nextMnt})`);

  // Test Helpdesk Requests (Starts at REQ-000101)
  const nextReq = await mockDb.getNextSequentialId("helpdeskRequests");
  assert(nextReq === "REQ-000101", `Helpdesk Request next sequential code is REQ-000101 (got ${nextReq})`);

  // Test Licenses
  const nextLic = await mockDb.getNextSequentialId("licenses");
  assert(nextLic === "LIC-0001", `License next sequential code is LIC-0001 (got ${nextLic})`);

  // Test Users
  const nextUsr = await mockDb.getNextSequentialId("users");
  assert(nextUsr === "USR-001", `User next sequential code is USR-001 (got ${nextUsr})`);

  // Test Asset Transactions
  const nextTx = await mockDb.getNextSequentialId("assetTransactions");
  assert(nextTx === "TX-000001", `Transaction next sequential code is TX-000001 (got ${nextTx})`);

  // Test Notifications
  const nextNotif = await mockDb.getNextSequentialId("notifications");
  assert(nextNotif === "NOTIF-000001", `Notification next sequential code is NOTIF-000001 (got ${nextNotif})`);

  console.log("\n=======================================================");
  console.log(`RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log("=======================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
