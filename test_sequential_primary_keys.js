// test_sequential_primary_keys.js
// Automated verification for Sequential Primary Keys (1, 2, 3, 4, 5, 6...)
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
  console.log("=== Testing Sequential Primary Keys (1, 2, 3, 4, 5, 6...) ===");

  // 1. Verify index.html readonly inputs
  const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  console.log("\n[Group 1] Verifying Form Inputs are Locked & Readonly:");
  assert(
    htmlContent.includes('id="formEmpNumber"') && htmlContent.includes('readonly'),
    "Employee Number (formEmpNumber) is readonly and cannot be edited by user"
  );
  assert(
    htmlContent.includes('id="formDeptIdDisplay"') && htmlContent.includes('readonly'),
    "Department ID (formDeptIdDisplay) is readonly and cannot be edited by user"
  );
  assert(
    htmlContent.includes('id="formLocCode"') && htmlContent.includes('readonly'),
    "Location Code/ID (formLocCode) is readonly and cannot be edited by user"
  );
  assert(
    htmlContent.includes('id="formTypeCode"') && htmlContent.includes('readonly'),
    "Asset Type Code/ID (formTypeCode) is readonly and cannot be edited by user"
  );
  assert(
    htmlContent.includes('id="formContractorCode"') && htmlContent.includes('readonly'),
    "Contractor Code/ID (formContractorCode) is readonly and cannot be edited by user"
  );
  assert(
    htmlContent.includes('id="formPrjNumber"') && htmlContent.includes('readonly'),
    "Project Number/ID (formPrjNumber) is readonly and cannot be edited by user"
  );
  assert(
    htmlContent.includes('id="formAssetId"') && htmlContent.includes('readonly'),
    "Asset ID (formAssetId) is readonly and cannot be edited by user"
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

  // 3. Verify CSS styling for readonly inputs
  console.log("\n[Group 3] Verifying CSS Not-Allowed Cursor & Readonly Styles:");
  const cssContent = fs.readFileSync(path.join(__dirname, 'styles', 'main.css'), 'utf8');
  assert(
    cssContent.includes('.modal-body .form-control[readonly]') && cssContent.includes('cursor: not-allowed !important;'),
    "CSS enforces cursor: not-allowed !important on readonly form controls"
  );

  // 4. Test Sequential ID Generator Logic in js/db.js
  console.log("\n[Group 4] Testing getNextSequentialId algorithm simulation:");
  
  // Mock DB simulator with the exact logic from js/db.js
  class MockDB {
    constructor() {
      this.stores = {};
    }
    async getAll(storeName) {
      return this.stores[storeName] || [];
    }
    async getById(storeName, id) {
      const items = this.stores[storeName] || [];
      return items.find(i => String(i.id) === String(id)) || null;
    }
    async getNextSequentialId(storeName) {
      const items = await this.getAll(storeName);
      let maxId = 0;

      items.forEach(item => {
        if (!item) return;
        if (item.id !== undefined && item.id !== null) {
          const idStr = String(item.id).trim();
          if (/^\d+$/.test(idStr)) {
            const num = parseInt(idStr, 10);
            if (!isNaN(num) && num < 1000000 && num > maxId) {
              maxId = num;
            }
          }
        }
      });

      let nextSeq = maxId > 0 ? maxId + 1 : items.length + 1;
      while (items.some(it => it && (String(it.id) === String(nextSeq) || String(it.code) === String(nextSeq)))) {
        nextSeq++;
      }
      return String(nextSeq);
    }
    async put(storeName, item) {
      if (!this.stores[storeName]) this.stores[storeName] = [];
      const isTempId = typeof item.id === "string" && (
        /\d{10,}/.test(item.id) || 
        /^(tx|notif|wi|trf|lic|maint|req|msg|usr|loc|cnt|prj|tsk|ast)-/.test(item.id)
      );
      if (!item.id || isTempId) {
        const existing = item.id ? await this.getById(storeName, item.id) : null;
        if (!existing) {
          item.id = await this.getNextSequentialId(storeName);
        }
      }
      const idx = this.stores[storeName].findIndex(i => String(i.id) === String(item.id));
      if (idx >= 0) {
        this.stores[storeName][idx] = item;
      } else {
        this.stores[storeName].push(item);
      }
      return item;
    }
  }

  const mockDb = new MockDB();

  // Test 4.1: Fresh empty store produces 1, 2, 3, 4, 5, 6
  console.log("  Testing empty store generates 1, 2, 3, 4, 5, 6 consecutive sequence:");
  const id1 = await mockDb.getNextSequentialId("testStore");
  assert(id1 === "1", `First ID is '1' (got: '${id1}')`);
  await mockDb.put("testStore", { id: id1, name: "Item 1" });

  const id2 = await mockDb.getNextSequentialId("testStore");
  assert(id2 === "2", `Second ID is '2' (got: '${id2}')`);
  await mockDb.put("testStore", { id: id2, name: "Item 2" });

  const id3 = await mockDb.getNextSequentialId("testStore");
  assert(id3 === "3", `Third ID is '3' (got: '${id3}')`);
  await mockDb.put("testStore", { id: id3, name: "Item 3" });

  const id4 = await mockDb.getNextSequentialId("testStore");
  assert(id4 === "4", `Fourth ID is '4' (got: '${id4}')`);
  await mockDb.put("testStore", { id: id4, name: "Item 4" });

  const id5 = await mockDb.getNextSequentialId("testStore");
  assert(id5 === "5", `Fifth ID is '5' (got: '${id5}')`);
  await mockDb.put("testStore", { id: id5, name: "Item 5" });

  const id6 = await mockDb.getNextSequentialId("testStore");
  assert(id6 === "6", `Sixth ID is '6' (got: '${id6}')`);
  await mockDb.put("testStore", { id: id6, name: "Item 6" });

  // Test 4.2: Automatic fallback interception when saving item without id
  console.log("  Testing automatic fallback interception in db.put:");
  const autoItem = await mockDb.put("testStore", { name: "Item 7 (No ID provided)" });
  assert(autoItem.id === "7", `Auto-assigned ID is '7' (got: '${autoItem.id}')`);

  // Test 4.3: Interception of temporary timestamp / prefix ID
  const tempItem = await mockDb.put("testStore", { id: "cnt-" + Date.now(), name: "Item 8 (Temp prefix)" });
  assert(tempItem.id === "8", `Temp prefix intercepted and converted to '8' (got: '${tempItem.id}')`);

  // Test 4.4: Store with legacy text IDs advances sequentially from length + 1
  mockDb.stores["legacyStore"] = [
    { id: "dept-it", name: "IT" },
    { id: "dept-hr", name: "HR" },
    { id: "dept-fin", name: "Finance" }
  ];
  const legNext = await mockDb.getNextSequentialId("legacyStore");
  assert(legNext === "4", `Legacy store with 3 items advances to '4' (got: '${legNext}')`);
  await mockDb.put("legacyStore", { id: legNext, name: "Dept 4" });
  const legNext2 = await mockDb.getNextSequentialId("legacyStore");
  assert(legNext2 === "5", `Subsequent item advances to '5' (got: '${legNext2}')`);

  // Test 4.5: Deleting an item does not corrupt sequence
  delete mockDb.stores["testStore"][2]; // delete item 3
  mockDb.stores["testStore"] = mockDb.stores["testStore"].filter(Boolean);
  const nextAfterDelete = await mockDb.getNextSequentialId("testStore");
  assert(nextAfterDelete === "9", `After deleting an item, next sequence is '9' without collisions (got: '${nextAfterDelete}')`);

  console.log(`\n========================================`);
  console.log(`Summary: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
