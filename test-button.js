const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(html);
// We want to see if projectTaskModal is valid
const modal = dom.window.document.getElementById("projectTaskModal");
console.log("Modal exists:", !!modal);
