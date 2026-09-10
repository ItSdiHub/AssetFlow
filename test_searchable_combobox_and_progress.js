/**
 * Verification Test Suite for:
 * 1. System-Wide Searchable Comboboxes (Live Search in All Dropdowns)
 * 2. Automatic Project Progress Calculation (Based on Stage & Tasks)
 */
const fs = require('fs');
const assert = require('assert');

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this._classes = new Set();
    this.style = { display: 'none' };
    this.value = '';
    this._textContent = '';
    this._innerHTML = '';
    this.attributes = {};
    this.children = [];
    this.options = [];
    this.selectedIndex = 0;
    this.parentNode = null;
    this.dataset = {};
    this.eventListeners = {};
  }

  get textContent() {
    if (this._textContent !== undefined && this._textContent !== '') return this._textContent;
    if (this._innerHTML) return this._innerHTML.replace(/<[^>]*>/g, '');
    return '';
  }
  set textContent(val) { this._textContent = val; }

  get innerHTML() { return this._innerHTML || ''; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    if (typeof val === 'string') {
      const matches = val.matchAll(/<([a-z0-9]+)\s+([^>]*)\/?>/gi);
      for (const m of matches) {
        const tag = m[1];
        const attrs = m[2];
        const idMatch = attrs.match(/id=["']([^"']+)["']/i);
        const classMatch = attrs.match(/class=["']([^"']+)["']/i);
        const child = new MockElement(idMatch ? idMatch[1] : '', tag);
        if (classMatch) {
          classMatch[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
        }
        child.parentNode = this;
        this.children.push(child);
      }
    }
  }

  get className() { return Array.from(this._classes).join(' '); }
  set className(val) {
    this._classes.clear();
    if (typeof val === 'string') {
      val.split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
    }
  }

  get classList() {
    return {
      add: (cls) => this._classes.add(cls),
      remove: (cls) => this._classes.delete(cls),
      contains: (cls) => this._classes.has(cls),
      toggle: (cls, force) => {
        if (typeof force === 'boolean') {
          if (force) this._classes.add(cls);
          else this._classes.delete(cls);
        } else {
          if (this._classes.has(cls)) this._classes.delete(cls);
          else this._classes.add(cls);
        }
      }
    };
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  reset() { this.value = ''; }
  closest(selector) {
    if (selector === '.combobox-wrapper') {
      let p = this.parentNode;
      while (p) {
        if (p.classList && p.classList.contains('combobox-wrapper')) return p;
        p = p.parentNode;
      }
    }
    return null;
  }
  contains(node) {
    if (this === node) return true;
    return this.children.some(c => c.contains && c.contains(node));
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }
  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    const idx = this.children.indexOf(refChild);
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
    } else {
      this.children.unshift(newChild);
    }
  }
  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx >= 0) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }
  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      for (const child of this.children) {
        if (child.classList && child.classList.contains(cls)) return child;
        if (child.querySelector) {
          const res = child.querySelector(sel);
          if (res) return res;
        }
      }
    }
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      for (const child of this.children) {
        if (child.id === id) return child;
        if (child.querySelector) {
          const res = child.querySelector(sel);
          if (res) return res;
        }
      }
    }
    return null;
  }
  querySelectorAll(sel) {
    const list = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (sel.startsWith('.') && child.classList && child.classList.contains(sel.slice(1))) {
          list.push(child);
        } else if (sel.toLowerCase() === child.tagName.toLowerCase()) {
          list.push(child);
        }
        if (child.children) walk(child);
      }
    };
    walk(this);
    return list;
  }
  addEventListener(evt, handler) {
    if (!this.eventListeners[evt]) this.eventListeners[evt] = [];
    this.eventListeners[evt].push(handler);
  }
  dispatchEvent(evt) {
    const type = typeof evt === 'string' ? evt : evt.type;
    const eventObj = typeof evt === 'object' && evt !== null ? evt : { type, stopPropagation: () => {}, preventDefault: () => {} };
    if (!eventObj.stopPropagation) eventObj.stopPropagation = () => {};
    if (!eventObj.preventDefault) eventObj.preventDefault = () => {};
    const handlers = this.eventListeners[type] || [];
    handlers.forEach(h => h.call(this, eventObj));
  }
  focus() {}
}

const elements = new Map();
function getOrCreateEl(id, tag = 'div') {
  if (!elements.has(id)) {
    elements.set(id, new MockElement(id, tag));
  }
  return elements.get(id);
}

const docListeners = {};
global.window = {
  _comboboxGlobalListenersAdded: false,
  addEventListener: () => {},
  document: {
    _listeners: docListeners,
    addEventListener: (event, handler) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(handler);
    },
    getElementById: (id) => getOrCreateEl(id),
    querySelector: (sel) => {
      if (sel.startsWith('#')) return getOrCreateEl(sel.slice(1));
      return new MockElement('', 'div');
    },
    querySelectorAll: (sel) => {
      const list = [];
      elements.forEach(el => {
        if (sel === 'select' && el.tagName === 'SELECT') list.push(el);
        if (sel.startsWith('.') && el.classList.contains(sel.slice(1))) list.push(el);
      });
      return list;
    },
    createElement: (tag) => new MockElement('', tag),
    body: new MockElement('body', 'body')
  },
  localStorage: {
    _data: {},
    getItem: (k) => global.window.localStorage._data[k] || null,
    setItem: (k, v) => { global.window.localStorage._data[k] = String(v); }
  },
  Event: class {
    constructor(type, opts = {}) {
      this.type = type;
      this.bubbles = !!opts.bubbles;
    }
  }
};
global.document = global.window.document;
global.Event = global.window.Event;
global.localStorage = global.window.localStorage;
global.HTMLSelectElement = MockElement;
global.window.HTMLSelectElement = MockElement;
global.Element = MockElement;
global.window.Element = MockElement;
global.AppState = { lang: 'ar', theme: 'light' };

// Load code files
eval(fs.readFileSync('js/i18n.js', 'utf8'));
eval(fs.readFileSync('js/db.js', 'utf8'));
global.db = window.db;
eval(fs.readFileSync('js/app.js', 'utf8'));
global.App = window.App || App;
eval(fs.readFileSync('js/projects.js', 'utf8'));
global.ProjectController = window.ProjectManagementController;
global.ProjectManagementController = window.ProjectManagementController;
global.ProjectManager = window.ProjectManager;

async function runTests() {
  console.log("=".repeat(80));
  console.log("STARTING TEST: SYSTEM-WIDE SEARCHABLE COMBOBOXES & AUTO PROJECT PROGRESS");
  console.log("=".repeat(80));

  // Test 1: Arabic search normalization
  console.log("\n>>> Test 1: Arabic Normalization Logic");
  const norm1 = App.normalizeComboboxText("إدارة تقنية المعلومات والاتصالات");
  const norm2 = App.normalizeComboboxText("اداره تقنيه المعلومات");
  console.log("  Input 1: 'إدارة تقنية المعلومات والاتصالات' -> Normal: '" + norm1 + "'");
  console.log("  Input 2: 'اداره تقنيه المعلومات' -> Normal: '" + norm2 + "'");
  assert(norm1.includes("اداره تقنيه"), "Normalized text should match search variation");
  console.log("  [PASS] Arabic normalization matches variant spellings!");

  // Test 2: Combobox wrapping and instant search filtering
  console.log("\n>>> Test 2: Combobox DOM Creation & Live Instant Search Filtering");
  const parentForm = new MockElement('sampleForm', 'form');
  const sampleSelect = new MockElement('testSelectDept', 'select');
  parentForm.appendChild(sampleSelect);

  sampleSelect.options = [
    { value: '', textContent: 'اختر القسم...', selected: true },
    { value: 'dept-it', textContent: 'إدارة تقنية المعلومات والاتصالات', selected: false },
    { value: 'dept-hr', textContent: 'الموارد البشرية والشؤون الإدارية', selected: false },
    { value: 'dept-fin', textContent: 'الشؤون المالية والمحاسبة', selected: false }
  ];

  App.enhanceSelectWithSearch(sampleSelect);

  const wrapper = sampleSelect.closest('.combobox-wrapper');
  assert(wrapper, "Combobox wrapper must be created");
  const trigger = wrapper.querySelector('.combobox-trigger');
  const dropdown = wrapper.querySelector('.combobox-dropdown');
  const searchInput = wrapper.querySelector('.combobox-search-input');
  const optionsList = wrapper.querySelector('.combobox-options-list');

  assert(trigger, "Trigger must exist");
  assert(dropdown, "Dropdown must exist");
  assert(searchInput, "SearchInput must exist");
  assert(optionsList, "OptionsList must exist");

  console.log("  [PASS] Combobox elements created properly.");

  // Test click trigger
  trigger.dispatchEvent('click');
  assert.strictEqual(dropdown.style.display, 'flex', "Clicking trigger must open dropdown");
  console.log("  [PASS] Trigger toggle opens dropdown.");

  // Test searching "ماليه"
  searchInput.value = "ماليه";
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  let filteredLi = optionsList.querySelectorAll('.combobox-option');
  console.log(`  Filtered count for 'ماليه': ${filteredLi.length}`);
  assert.strictEqual(filteredLi.length, 1, "Should filter down to 1 match");
  assert(filteredLi[0].textContent.includes('المالية'), "Match must be Financial");
  console.log("  [PASS] Live instant search filtered results with 0ms delay!");

  // Test clicking option
  filteredLi[0].dispatchEvent('click');
  assert.strictEqual(sampleSelect.value, 'dept-fin', "Clicking option must update native select.value");
  const triggerText = trigger.querySelector('.combobox-trigger-text').textContent;
  assert(triggerText.includes('المالية'), "Trigger text must reflect selected option");
  assert.strictEqual(dropdown.style.display, 'none', "Dropdown must close upon option selection");
  console.log("  [PASS] Option selection correctly synchronizes with native select and updates trigger text!");

  // Test 3: Project Progress Automatic Calculations
  console.log("\n>>> Test 3: Automated Project Progress Calculation (Phases & Tasks)");
  const projManager = window.ProjectManager;

  // Stage checks (no tasks)
  assert.strictEqual(projManager.calculateProjectProgress({ status: "Planning" }, []), 15);
  assert.strictEqual(projManager.calculateProjectProgress({ status: "Approved" }, []), 30);
  assert.strictEqual(projManager.calculateProjectProgress({ status: "In Progress" }, []), 50);
  assert.strictEqual(projManager.calculateProjectProgress({ status: "Completed" }, []), 100);
  assert.strictEqual(projManager.calculateProjectProgress({ status: "Cancelled" }, []), 0);
  console.log("  [PASS] Project progress according to stage verified: Planning=15%, Approved=30%, In Progress=50%, Completed=100%, Cancelled=0%");

  // Task checks (mathematical average)
  const mockTasks = [
    { progress: 100, status: "Completed" },
    { progress: 50, status: "In Progress" },
    { progress: 30, status: "In Progress" }
  ];
  // (100 + 50 + 30) / 3 = 60%
  const avgProg = projManager.calculateProjectProgress({ status: "In Progress" }, mockTasks);
  console.log(`  Average progress for tasks [100%, 50%, 30%]: ${avgProg}%`);
  assert.strictEqual(avgProg, 60, "Must be average of tasks");
  console.log("  [PASS] Task average progress calculation verified with 100% precision!");

  console.log("\n" + "=".repeat(80));
  console.log("ALL TESTS COMPLETED SUCCESSFULLY WITH 100% PASS!");
  console.log("=".repeat(80));
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
