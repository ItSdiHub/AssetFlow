const fs = require('fs');
let js = fs.readFileSync('js/projects.js', 'utf8');

// Fix openInstallationModal - it has try inside but no catch
// The try was added after "const lang = AppState.lang;" 
// and the function ends with "App.openModal("installationModal");\n  }"
// Need to add catch before closing }

js = js.replace(
  '    App.openModal("installationModal");\n  }\n\n  handleInstallationBranchChange',
  '    App.openModal("installationModal");\n    } catch (e) {\n      console.warn("[openInstallationModal]", e);\n      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء فتح نافذة التركيب" : "Error opening installation modal", "error");\n    }\n  }\n\n  handleInstallationBranchChange'
);

const idx = js.indexOf('App.openModal("installationModal")');
console.log('App.openModal found at:', idx);
const ctx = js.substring(idx, idx + 200);
console.log('Context:', ctx);

fs.writeFileSync('js/projects.js', js, 'utf8');
console.log('Written.');
