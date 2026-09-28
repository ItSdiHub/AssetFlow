const fs = require("fs");
const vm = require("vm");

// Mock environment
global.AppState = { lang: "en" };
global.I18N = {
    en: { errAssetReserved: "This asset is currently reserved for a project and cannot be assigned to another branch or user until its project reservation is released." },
    ar: { errAssetReserved: "هذا الأصل محجوز حالياً لمشروع محدد ولا يمكن تخصيصه لفرع أو مستخدم آخر حتى يتم تحريره من المشروع." }
};
global.App = { showToast: (msg, type) => console.log(`Toast: ${msg} (${type})`) };
global.window = global;

// Load assetValidator
const code = fs.readFileSync("js/assetValidator.js", "utf8");
vm.runInThisContext(code);

// Test cases
function test() {
    // Test 1: Unassigned asset can be assigned to project
    const unassigned = { id: "A1", project_id: null };
    AssetValidator.assertReservation(unassigned, { project_id: "P1", location_id: "L1", employee_id: "E1", department_id: "D1" }, false);
    console.log("Test 1 passed");

    // Test 2: Reserved asset cannot change project
    const reserved = { id: "A1", project_id: "P1", location_id: "L1", employee_id: "E1", department_id: "D1" };
    try {
        AssetValidator.assertReservation(reserved, { project_id: "P2", location_id: "L1", employee_id: "E1", department_id: "D1" }, false);
        console.error("Test 2 failed");
    } catch(e) {
        console.log("Test 2 passed");
    }

    // Test 3: Reserved asset cannot change location
    try {
        AssetValidator.assertReservation(reserved, { project_id: "P1", location_id: "L2", employee_id: "E1", department_id: "D1" }, false);
        console.error("Test 3 failed");
    } catch(e) {
        console.log("Test 3 passed");
    }

    // Test 6: Project-compatible employee assignment remains possible
    AssetValidator.assertReservation(reserved, { project_id: "P1", location_id: "L1", employee_id: "E2", department_id: "D1" }, true);
    console.log("Test 6 passed");
    
    console.log("All tests passed");
}
test();
