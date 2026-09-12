const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');

content = content.replace(/FAIL in DB tests:/, 'let users = await db.getAll("users"); FAIL in DB tests:'); // just kidding

content = content.replace(
  /const employees = await db\.getAll\("employees"\);/,
  'let users = await db.getAll("users");\n  const employees = await db.getAll("employees");'
);

fs.writeFileSync('test_phase4.js', content, 'utf8');
