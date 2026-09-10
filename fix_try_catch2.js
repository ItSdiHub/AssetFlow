const fs = require('fs');
let js = fs.readFileSync('js/projects.js', 'utf8');

// Add try-catch to handleWarehouseIssueSubmit
// Function starts at L1286, ends at L1377
// Insert try after L1287 (event.preventDefault()) and catch before closing }

// Strategy: wrap body of critical functions
const wrappedFunctions = [
  {
    name: 'handleWarehouseIssueSubmit',
    // The function signature line
    sig: 'async handleWarehouseIssueSubmit(event) {\n    event.preventDefault();',
    replacement: 'async handleWarehouseIssueSubmit(event) {\n    event.preventDefault();\n    try {'
  },
  {
    name: 'openInstallationModal',
    sig: 'async openInstallationModal(assetId, issueId = null) {\n    const lang = AppState.lang;',
    replacement: 'async openInstallationModal(assetId, issueId = null) {\n    const lang = AppState.lang;\n    try {'
  },
  {
    name: 'handleInstallationSubmit', 
    sig: 'async handleInstallationSubmit(event) {\n    if (event && event.preventDefault) event.preventDefault();',
    replacement: 'async handleInstallationSubmit(event) {\n    if (event && event.preventDefault) event.preventDefault();\n    try {'
  }
];

for (const fn of wrappedFunctions) {
  if (js.includes(fn.sig)) {
    js = js.replace(fn.sig, fn.replacement);
    console.log(`✅ Added try to ${fn.name}`);
  } else {
    console.log(`⚠️ Could not find signature for ${fn.name}`);
    // Try partial match
    const sigStart = fn.sig.split('\n')[0];
    console.log('   Searching for:', sigStart);
    const idx = js.indexOf(sigStart);
    console.log('   Found at:', idx);
  }
}

// Add catch before the final closing of each function
// handleWarehouseIssueSubmit ends before openInstallationModal
// Find: App.closeModal("warehouseIssueModal"); ... }  async openInstallationModal
const wIssueEnd = `    App.closeModal("warehouseIssueModal");
    App.showToast(AppState.lang === "ar" ? "تم صرف الأصل إلى فني التقنية بنجاح" : "Asset issued to IT technician successfully", "success");
    await this.render();
    await AssetManager.render();
    await App.updateDashboard();
  }`;
const wIssueEndReplacement = `    App.closeModal("warehouseIssueModal");
    App.showToast(AppState.lang === "ar" ? "تم صرف الأصل إلى فني التقنية بنجاح" : "Asset issued to IT technician successfully", "success");
    await this.render();
    await AssetManager.render();
    await App.updateDashboard();
    } catch (e) {
      console.error("[handleWarehouseIssueSubmit]", e);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء صرف الأصل" : "An error occurred while issuing the asset", "error");
    }
  }`;

if (js.includes(wIssueEnd)) {
  js = js.replace(wIssueEnd, wIssueEndReplacement);
  console.log('✅ Added catch to handleWarehouseIssueSubmit');
} else {
  console.log('⚠️ handleWarehouseIssueSubmit end not found');
}

// handleInstallationSubmit ends before }  and has specific toast
const installEnd = `    App.closeModal("installationModal");
    App.showToast(AppState.lang === "ar" ? "تم استكمال تركيب وتثبيت الأصل في الموقع بنجاح" : "Asset installed on-site successfully", "success");
    await this.render();
    if (typeof AssetManager !== "undefined" && AssetManager.render) await AssetManager.render();
    if (typeof App !== "undefined" && App.updateDashboard) await App.updateDashboard();
  }`;
const installEndReplacement = `    App.closeModal("installationModal");
    App.showToast(AppState.lang === "ar" ? "تم استكمال تركيب وتثبيت الأصل في الموقع بنجاح" : "Asset installed on-site successfully", "success");
    await this.render();
    if (typeof AssetManager !== "undefined" && AssetManager.render) await AssetManager.render();
    if (typeof App !== "undefined" && App.updateDashboard) await App.updateDashboard();
    } catch (e) {
      console.error("[handleInstallationSubmit]", e);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء استكمال التركيب" : "An error occurred during installation", "error");
    }
  }`;

if (js.includes(installEnd)) {
  js = js.replace(installEnd, installEndReplacement);
  console.log('✅ Added catch to handleInstallationSubmit');
} else {
  console.log('⚠️ handleInstallationSubmit end not found - searching...');
  const idx = js.indexOf('App.closeModal("installationModal")');
  if (idx > 0) {
    console.log('  Found closeModal at index:', idx);
    console.log('  Context:', js.substring(idx, idx+300));
  }
}

fs.writeFileSync('js/projects.js', js, 'utf8');
console.log('\nFinal try-catch count:', (js.match(/catch\s*\(e\)/g)||[]).length);
console.log('DONE');
