const fs = require('fs');
let js = fs.readFileSync('js/projects.js', 'utf8');

// Fix: The catch blocks need a closing } for the function
// Problem 1: renderTransfers - missing closing }
// Current: "    } catch (e) { ... }\n\n  resetWarehouseIssueFilters"
// Fixed: "    } catch (e) { ... }\n  }\n\n  resetWarehouseIssueFilters"
js = js.replace(
  '    } catch (e) { console.warn("[OpsManager.renderTransfers] warning:", e); }\n\n  resetWarehouseIssueFilters',
  '    } catch (e) { console.warn("[OpsManager.renderTransfers] warning:", e); }\n  }\n\n  resetWarehouseIssueFilters'
);
console.log('Fix 1:', js.includes('  }\n\n  resetWarehouseIssueFilters') ? 'OK' : 'FAIL');

// Problem 2: renderWarehouseIssues catch may also be missing closing }
// Check
const wrhEnd = js.indexOf('} catch (e) { console.warn("[OpsManager.renderWarehouseIssues]');
if (wrhEnd > 0) {
  const snippet = js.substring(wrhEnd, wrhEnd + 120);
  console.log('renderWarehouseIssues catch area:', JSON.stringify(snippet));
}

// Fix renderWarehouseIssues end too
js = js.replace(
  '    } catch (e) { console.warn("[OpsManager.renderWarehouseIssues] warning:", e); }\n\n  resetWarehouseIssueFilters',
  '    } catch (e) { console.warn("[OpsManager.renderWarehouseIssues] warning:", e); }\n  }\n\n  resetWarehouseIssueFilters'
);

// Fix renderAwaitingInstall catch (same pattern)  
js = js.replace(
  '    } catch (e) { console.warn("[OpsManager.renderAwaitingInstall] warning:", e); }\n  }\n\n  /**\n   * Universal Searchable ComboBox Helper',
  '    } catch (e) { console.warn("[OpsManager.renderAwaitingInstall] warning:", e); }\n  }\n\n  /**\n   * Universal Searchable ComboBox Helper'
);
// Also check if renderAwaitingInstall catch exists
const awaitEnd = js.indexOf('} catch (e) { console.warn("[OpsManager.renderAwaitingInstall]');
console.log('renderAwaitingInstall catch at index:', awaitEnd > 0 ? awaitEnd : 'NOT FOUND');
if (awaitEnd > 0) {
  console.log('Context:', JSON.stringify(js.substring(awaitEnd - 5, awaitEnd + 100)));
}

fs.writeFileSync('js/projects.js', js, 'utf8');
console.log('Written. Now checking syntax...');
