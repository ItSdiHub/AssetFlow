const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');

content = content.replace(/console.error\("let users = await db.getAll\("users"\); FAIL in DB tests:", err\);/g, 'console.error("FAIL in DB tests:", err);');

fs.writeFileSync('test_phase4.js', content, 'utf8');
