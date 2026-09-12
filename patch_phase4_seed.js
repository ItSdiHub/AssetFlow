const fs = require('fs');
let content = fs.readFileSync('test_phase4.js', 'utf8');

const injection = `
  await db.put("users", { id: "usr-ahmed", username: "ahmed", role: "Employee", employeeId: "emp-101" });
  await db.put("users", { id: "usr-maryam", username: "maryam", role: "Employee", employeeId: "emp-102" });
  await db.put("helpdeskRequests", { id: "req-1", requestNumber: "REQ-000101", status: "In Progress", messages: [{ sender: "Admin", text: "Working on it" }] });
  
  users = await db.getAll("users");
`;

content = content.replace(
  /const ahmedUser = users\.find/g,
  injection + '\n  const ahmedUser = users.find'
);

fs.writeFileSync('test_phase4.js', content, 'utf8');
