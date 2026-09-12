const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');
content = content.replace(/const employees = await db\.getAll\("employees"\);/, 'await db.put("helpdeskRequests", { id: "req-1", requestNumber: "REQ-000101", status: "In Progress", messages: [{ sender: "Admin", text: "Working on it" }] });\n  const employees = await db.getAll("employees");');
content = content.replace(/users = await db\.getAll\("users"\); helpdesk = await db\.getAll\("helpdeskRequests"\);/, '');
fs.writeFileSync('test_phase4.js', content, 'utf8');
