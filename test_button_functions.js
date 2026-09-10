const fs = require('fs');
const path = require('path');

// Simulate basic browser environment to evaluate JS files
const window = {
  addEventListener: () => {},
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null
  },
  location: { reload: () => {} },
  __SDI_TEST_ENV__: true
};
const document = window.document;
global.window = window;
global.document = document;
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.navigator = { userAgent: 'node' };

// Load modules in exact order of index.html
require('./js/i18n.js');
global.I18N = window.I18N;
require('./js/db.js');
global.db = window.db;
require('./js/users.js');
global.UserManager = window.UserManager;
require('./js/assets.js');
global.AssetManager = window.AssetManager;
require('./js/maintenance.js');
global.MaintManager = window.MaintManager;
require('./js/helpdesk.js');
global.Helpdesk = window.Helpdesk;
global.HelpdeskController = window.HelpdeskController;
require('./js/treeView.js');
global.TreeManager = window.TreeManager;
require('./js/projects.js');
global.ContractorManager = window.ContractorManager;
global.ProjectManager = window.ProjectManager;
global.OpsManager = window.OpsManager;
require('./js/techTools.js');
global.TechTools = window.TechTools;
global.TechToolsManager = window.TechToolsManager;
global.TechToolsController = window.TechToolsController;
require('./js/app.js');
global.App = window.App;
global.AppState = window.AppState;

console.log("=== CHECKING ALL BUTTON & ACTION FUNCTION TARGETS ===");

const allTargets = [
  "App.closeModal",
  "App.closeScannerModal",
  "App.confirmLeaveUnsaved",
  "App.exportReportCSV",
  "App.exportReportPDF",
  "App.filterActiveMaintenanceAndSwitch",
  "App.generateSelectedReport",
  "App.handleLoginSubmit",
  "App.handleManualScanSubmit",
  "App.logout",
  "App.markAllNotificationsAsRead",
  "App.markNotificationAsRead",
  "App.navigateBack",
  "App.openChangePasswordModal",
  "App.openNotificationsModal",
  "App.openScannerModal",
  "App.openUserProfileModal",
  "App.printCurrentReport",
  "App.resetReportFilters",
  "App.selectSearchResult",
  "App.setColorTheme",
  "App.setThemeMode",
  "App.switchCamera",
  "App.switchSettingsSubTab",
  "App.switchTab",
  "App.testDatabaseConnection",
  "App.toggleLanguage",
  "App.toggleThemePaletteDropdown",
  "App.updateDashboard",
  "AssetManager.deleteAsset",
  "AssetManager.deleteAttachment",
  "AssetManager.downloadAssetQr",
  "AssetManager.filterAndSwitch",
  "AssetManager.filterByDeptAndSwitch",
  "AssetManager.filterByEmpAndSwitch",
  "AssetManager.filterByLocAndSwitch",
  "AssetManager.handleAssignSubmit",
  "AssetManager.handleReturnSubmit",
  "AssetManager.handleSaveAsset",
  "AssetManager.handleTransferSubmit",
  "AssetManager.openAddModal",
  "AssetManager.openAssignModal",
  "AssetManager.openDetailsModal",
  "AssetManager.openEditModal",
  "AssetManager.openReturnModal",
  "AssetManager.openTransferModal",
  "AssetManager.printAssetLabel",
  "AssetManager.printAssetQr",
  "AssetManager.resetFilters",
  "AssetManager.switchDetailTab",
  "AssetManager.updateAssetStatusPrompt",
  "ContractorManager.deleteContractor",
  "ContractorManager.handleContractorSubmit",
  "ContractorManager.openContractorModal",
  "Helpdesk.confirmHandover",
  "HelpdeskController.filterByStatus",
  "HelpdeskController.handleCompleteRequestFromModal",
  "HelpdeskController.handleCreateMaintenanceFromModal",
  "HelpdeskController.handleSendReply",
  "HelpdeskController.handleSubmitNewRequest",
  "HelpdeskController.handleUpdateStatus",
  "HelpdeskController.openLinkedMaintenance",
  "HelpdeskController.openNewSupportRequestModal",
  "HelpdeskController.render",
  "HelpdeskController.switchPortalSubTab",
  "MaintManager.handleSaveTicket",
  "MaintManager.openAddModal",
  "MaintManager.openAddModalForAsset",
  "MaintManager.openCompleteModal",
  "MaintManager.openCompleteModalForAsset",
  "MaintManager.openEditModal",
  "OpsManager.handleInstallationSubmit",
  "OpsManager.handleWarehouseIssueSubmit",
  "OpsManager.openInstallationModal",
  "OpsManager.openWarehouseIssueModal",
  "OpsManager.switchSubTab",
  "OpsManager.viewCurrentAsset",
  "OpsManager.viewCurrentAssetHistory",
  "OpsManager.viewCurrentIssue",
  "OpsManager.viewIssueDetails",
  "ProjectManager.deleteProject",
  "ProjectManager.deleteTask",
  "ProjectManager.handleProjectSubmit",
  "ProjectManager.handleTaskSubmit",
  "ProjectManager.openProjectModal",
  "ProjectManager.openTaskModal",
  "ProjectManager.viewProjectDetails",
  "TreeManager.collapseAll",
  "TreeManager.expandAll",
  "TreeManager.filterAssetsByLocation",
  "TreeManager.selectLocation",
  "TreeManager.switchView",
  "UserManager.deleteAssetType",
  "UserManager.deleteDepartment",
  "UserManager.deleteEmployee",
  "UserManager.deleteLocation",
  "UserManager.deleteUser",
  "UserManager.handleChangePassword",
  "UserManager.handleRemoveLogo",
  "UserManager.handleSaveAssetType",
  "UserManager.handleSaveBranding",
  "UserManager.handleSaveDepartment",
  "UserManager.handleSaveEmployee",
  "UserManager.handleSaveLocation",
  "UserManager.handleSaveUser",
  "UserManager.openAssetTypeModal",
  "UserManager.openDepartmentModal",
  "UserManager.openEmployeeModal",
  "UserManager.openLocationModal",
  "UserManager.openUserModal",
  "db.exportAssetsCSV",
  "db.exportBackup"
];

let passCount = 0;
let failCount = 0;
const failures = [];

allTargets.forEach(target => {
  const parts = target.split('.');
  let obj = global[parts[0]];
  if (!obj) {
    failures.push(`${target} -> Root object '${parts[0]}' not found!`);
    failCount++;
    return;
  }
  let fn = obj[parts[1]];
  if (typeof fn !== 'function') {
    failures.push(`${target} -> '${parts[1]}' is NOT a function (type: ${typeof fn})`);
    failCount++;
  } else {
    passCount++;
  }
});

console.log(`PASS: ${passCount} / ${allTargets.length}`);
if (failCount > 0) {
  console.error(`FAIL: ${failCount} targets failed:`);
  failures.forEach(f => console.error(" - " + f));
  process.exit(1);
} else {
  console.log("SUCCESS: 100% of all static and dynamic button handler targets are valid, callable functions!");
}
