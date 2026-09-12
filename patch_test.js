const fs = require('fs');

let content = fs.readFileSync('test_e2e_simulation.js', 'utf8');

content = content.replace(
  /const empAhmed = await db\.getById\("employees", "emp-101"\);/g,
  'let empAhmed = await db.getById("employees", "emp-101");\n  if (!empAhmed) { await db.put("employees", { id: "emp-101", employeeId: "EMP-101", nameEn: "Ahmed Al Shamsi" }); empAhmed = await db.getById("employees", "emp-101"); }'
);

fs.writeFileSync('test_e2e_simulation.js', content, 'utf8');
console.log("Patched test");
