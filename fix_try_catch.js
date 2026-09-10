const fs = require('fs');
let js = fs.readFileSync('js/projects.js', 'utf8');
const lines = js.split('\n');

// Close renderTransfers try-catch (line 1205 = index 1204, 0-based)
// Check current content
console.log('L1205 before:', JSON.stringify(lines[1204]));
console.log('L1206 before:', JSON.stringify(lines[1205]));

// The try was added at line 1102 (new renderTransfers start), 
// we need to close it at line 1205 (tableBody.innerHTML = html;)
lines[1204] = '    tableBody.innerHTML = html;';
lines[1205] = '    } catch (e) { console.warn("[OpsManager.renderTransfers] warning:", e); }';

// Also need to add catch for handleWarehouseIssueSubmit and handleInstallationSubmit
// Find their ending lines
const newJs = lines.join('\n');
fs.writeFileSync('js/projects.js', newJs, 'utf8');
console.log('DONE - Added catch block to renderTransfers');
console.log('New L1205:', lines[1204]);
console.log('New L1206:', lines[1205]);

// Verify
const verify = fs.readFileSync('js/projects.js', 'utf8');
const tryCatches = (verify.match(/catch\s*\(e\)/g)||[]).length;
console.log('Total try-catch blocks now:', tryCatches);
