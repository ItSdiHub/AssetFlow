const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');

content = content.replace(
  /users = await db\.getAll\("users"\);/g,
  'let users2 = await db.getAll("users");'
);

content = content.replace(
  /const ahmedUser = users\.find/g,
  'const ahmedUser = users2.find'
);
content = content.replace(
  /const maryamUser = users\.find/g,
  'const maryamUser = users2.find'
);

fs.writeFileSync('test_phase4.js', content, 'utf8');
