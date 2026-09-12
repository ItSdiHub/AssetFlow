const fs = require('fs');

let content = fs.readFileSync('test_maint_ticket_employee_linkage.js', 'utf8');

content = content.replace(
  /await db\.init\(\);/g,
  'await db.init();\n  await db.put("departments", { id: "dept-it", nameEn: "IT" });\n  await db.put("locations", { id: "loc-br-khk", nameEn: "Branch" });'
);

fs.writeFileSync('test_maint_ticket_employee_linkage.js', content, 'utf8');
