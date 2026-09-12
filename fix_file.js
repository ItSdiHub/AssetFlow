const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');

// I'll just change the const users = ... to let users = ...
content = content.replace(/const users = await db\.getAll\("users"\);/, 'let users = await db.getAll("users");');
content = content.replace(/const users2 = await db\.getAll\("users"\);/, 'let users2 = await db.getAll("users");');
content = content.replace(/let users2 = await db\.getAll\("users"\);/g, 'users = await db.getAll("users");');
content = content.replace(/users2/g, 'users');
fs.writeFileSync('test_phase4.js', content, 'utf8');
