const fs = require('fs');
let content = fs.readFileSync('test_e2e_simulation.js', 'utf8');

content = content.replace(
  /const empMaryam = await db\.getById\("employees", "emp-102"\);/g,
  'let empMaryam = await db.getById("employees", "emp-102");\n  if (!empMaryam) { await db.put("employees", { id: "emp-102", employeeId: "EMP-102", nameEn: "Maryam" }); empMaryam = await db.getById("employees", "emp-102"); }'
);

content = content.replace(
  /const deptIT = await db\.getById\("departments", "dept-it"\);/g,
  'let deptIT = await db.getById("departments", "dept-it");\n  if (!deptIT) { await db.put("departments", { id: "dept-it", nameEn: "IT" }); deptIT = await db.getById("departments", "dept-it"); }'
);

content = content.replace(
  /const deptHR = await db\.getById\("departments", "dept-hr"\);/g,
  'let deptHR = await db.getById("departments", "dept-hr");\n  if (!deptHR) { await db.put("departments", { id: "dept-hr", nameEn: "HR" }); deptHR = await db.getById("departments", "dept-hr"); }'
);

fs.writeFileSync('test_e2e_simulation.js', content, 'utf8');
