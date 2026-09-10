const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Match all buttons and their onclicks
const buttonRegex = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
let match;
const buttons = [];

while ((match = buttonRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const innerText = match[1].replace(/<[^>]+>/g, '').trim();
  const onclickMatch = fullTag.match(/onclick=["']([^"']+)["']/i);
  const typeMatch = fullTag.match(/type=["']([^"']+)["']/i);
  const idMatch = fullTag.match(/id=["']([^"']+)["']/i);
  
  buttons.push({
    fullTag: fullTag.substring(0, 150),
    text: innerText,
    id: idMatch ? idMatch[1] : null,
    type: typeMatch ? typeMatch[1] : 'button',
    onclick: onclickMatch ? onclickMatch[1] : null
  });
}

console.log(`Total <button> elements in index.html: ${buttons.length}`);

// Find all form submission buttons without explicit onclick
const submitButtons = buttons.filter(b => b.type === 'submit');
console.log(`Submit buttons: ${submitButtons.length}`);

// Check all onclick calls
const onclickCalls = buttons.filter(b => b.onclick);
console.log(`Buttons with onclick: ${onclickCalls.length}`);

// Categorize onclick calls
const modalOpeners = [];
const otherCalls = [];

onclickCalls.forEach(b => {
  const openModalMatch = b.onclick.match(/openModal\s*\(\s*['"]([^'"]+)['"]/);
  if (openModalMatch) {
    modalOpeners.push({ ...b, modalTarget: openModalMatch[1] });
  } else {
    otherCalls.push(b);
  }
});

console.log(`Modal opener buttons: ${modalOpeners.length}`);
console.log(`Other action buttons: ${otherCalls.length}`);

// Check modal openers
console.log('\n--- VERIFYING MODAL OPENERS ---');
modalOpeners.forEach(b => {
  const exists = html.includes(`id="${b.modalTarget}"`) || html.includes(`id='${b.modalTarget}'`);
  if (!exists) {
    console.log(`[MISSING MODAL] Button "${b.text}" calls openModal('${b.modalTarget}')`);
  }
});

// Check other onclick handlers
console.log('\n--- UNIQUE ONCLICK EXPRESSIONS ---');
const uniqueExpressions = [...new Set(otherCalls.map(b => b.onclick))];
console.log(`Total unique onclick expressions: ${uniqueExpressions.length}`);
uniqueExpressions.forEach(expr => console.log('  ' + expr));
