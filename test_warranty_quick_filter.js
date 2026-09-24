// Test Warranty Quick Filter Functionality & Tab Switching
const fs = require('fs');

// Mock browser environment
global.window = global;
global.document = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = {
        id,
        value: "",
        textContent: "",
        innerHTML: "",
        style: {},
        classList: {
          add: () => {},
          remove: () => {}
        },
        querySelectorAll: () => []
      };
    }
    return this.elements[id];
  },
  querySelectorAll: () => []
};

global.AppState = {
  lang: "ar",
  currentTab: "dashboard",
  currentUser: { role: "SuperAdmin" }
};

global.App = {
  switchTab(tabId) {
    global.AppState.currentTab = tabId;
  }
};

global.I18N = {
  ar: { noResultsFound: "لا توجد نتائج" },
  en: { noResultsFound: "No results found" }
};

// Mock DB with dynamic dates relative to current execution time
const now = Date.now();
const toDateStr = (msOffset) => new Date(now + msOffset).toISOString().split('T')[0];

const sampleAssets = [
  { id: "ast-1", assetId: "PC-001", brand: "Dell", model: "OptiPlex", status: "Available", warrantyExpiry: toDateStr(10 * 86400000) }, // within 10 days (matches 30d)
  { id: "ast-2", assetId: "PC-002", brand: "HP", model: "EliteBook", status: "Assigned", warrantyExpiry: toDateStr(3 * 86400000) }, // within 3 days (matches 7d)
  { id: "ast-3", assetId: "PC-003", brand: "Lenovo", model: "ThinkPad", status: "Assigned", warrantyExpiry: toDateStr(-60 * 86400000) }, // expired
  { id: "ast-4", assetId: "PC-004", brand: "Apple", model: "MacBook", status: "Assigned", warrantyExpiry: toDateStr(400 * 86400000) }, // valid
  { id: "ast-5", assetId: "PC-005", brand: "Cisco", model: "Switch", status: "Disposed", warrantyExpiry: toDateStr(5 * 86400000) } // disposed (excluded)
];

global.db = {
  async getAll(store) {
    if (store === "assets") return sampleAssets;
    return [];
  }
};

// Load assets.js
require('./js/assets.js');

async function runTests() {
  console.log("=== TESTING WARRANTY QUICK FILTER LOGIC ===");

  // 1. Test matchesWarrantyFilter
  // Mock today as 2026-09-11
  const originalDate = global.Date;
  // Use today relative to test
  const mgr = window.AssetManager;

  // Test expiring_30d
  mgr.filterByWarrantyAndSwitch('expiring_30d');
  if (global.AppState.currentTab !== 'assets') {
    throw new Error("Expected switchTab to switch to 'assets', got: " + global.AppState.currentTab);
  }
  console.log("[PASS] filterByWarrantyAndSwitch switches tab to 'assets'");

  const sel = document.getElementById("assetFilterWarranty");
  if (sel.value !== 'expiring_30d') {
    throw new Error("Expected assetFilterWarranty.value to be 'expiring_30d', got: " + sel.value);
  }
  console.log("[PASS] assetFilterWarranty element updated to 'expiring_30d'");

  // Test filter matching
  // ast-1 is 2026-09-20 (expiring in 9 days) -> matches expiring_30d: true
  const ast1Match30 = mgr.matchesWarrantyFilter(sampleAssets[0], 'expiring_30d');
  console.log("[PASS] ast-1 (expiring in 9d) matches expiring_30d:", ast1Match30);
  if (!ast1Match30) throw new Error("ast-1 should match expiring_30d");

  // ast-2 is 2026-09-14 (expiring in 3 days) -> matches expiring_7d: true
  const ast2Match7 = mgr.matchesWarrantyFilter(sampleAssets[1], 'expiring_7d');
  console.log("[PASS] ast-2 (expiring in 3d) matches expiring_7d:", ast2Match7);
  if (!ast2Match7) throw new Error("ast-2 should match expiring_7d");

  // ast-3 is 2025-01-01 (expired) -> matches expired: true
  const ast3MatchExp = mgr.matchesWarrantyFilter(sampleAssets[2], 'expired');
  console.log("[PASS] ast-3 (expired) matches expired:", ast3MatchExp);
  if (!ast3MatchExp) throw new Error("ast-3 should match expired");

  // ast-4 is 2027-12-31 (valid) -> matches valid: true
  const ast4MatchValid = mgr.matchesWarrantyFilter(sampleAssets[3], 'valid');
  console.log("[PASS] ast-4 (valid) matches valid:", ast4MatchValid);
  if (!ast4MatchValid) throw new Error("ast-4 should match valid");

  // ast-5 is Disposed -> should be excluded
  const ast5Match = mgr.matchesWarrantyFilter(sampleAssets[4], 'expiring_7d');
  console.log("[PASS] ast-5 (disposed) should return false:", !ast5Match);
  if (ast5Match) throw new Error("ast-5 (disposed) should not match any active warranty category");

  // Test resetFilters
  mgr.resetFilters();
  if (sel.value !== '') {
    throw new Error("Expected resetFilters to reset assetFilterWarranty, got: " + sel.value);
  }
  console.log("[PASS] resetFilters successfully clears warranty filter");

  console.log("=== ALL WARRANTY QUICK FILTER TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
