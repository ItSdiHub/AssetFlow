const fs = require('fs');
let content = fs.readFileSync('test_maint_ticket_employee_linkage.js', 'utf8');

content = content.replace(
  /nameEn: "IT"/g,
  'nameAr: "IT", nameEn: "IT"'
);
content = content.replace(
  /nameEn: "Branch"/g,
  'nameAr: "Branch", nameEn: "Branch"'
);

fs.writeFileSync('test_maint_ticket_employee_linkage.js', content, 'utf8');
