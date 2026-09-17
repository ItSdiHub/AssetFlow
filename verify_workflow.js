const fs = require('fs');
console.log("Mocking DOM...");
global.window = { AppState: { lang: "ar" } };
global.document = {
  getElementById: (id) => {
    return {
      value: "mock_value",
      innerHTML: "",
      textContent: "",
      classList: { contains: () => false },
      style: {}
    };
  }
};
global.App = {
  showToast: (msg, type) => console.log("TOAST:", msg, type),
  openModal: (id) => console.log("OPEN MODAL:", id),
  closeModal: (id) => console.log("CLOSE MODAL:", id)
};
global.db = {
  getAll: async () => [],
  getById: async () => ({ id: "PROJ-123", status: "In Progress" }),
  put: async (store, data) => { console.log(`DB PUT [${store}]:`, data); return data; },
  getNextSequentialId: async () => "TSK-001"
};

// Evaluate the actual projects.js
const code = fs.readFileSync('js/projects.js', 'utf8');
// Strip out window.ProjectManager = new ProjectManagerClass();
const safeCode = code.replace(/const ProjectManager = new ProjectManagerClass\(\);|window\.ProjectManager = ProjectManager;/g, '');
eval(safeCode);

async function run() {
  console.log("=== T1: viewProjectDetails ===");
  const pm = new ProjectManagerClass();
  pm.render = async () => {};
  pm.calculateProjectProgress = () => 50;

  // Simulate viewProjectDetails
  let btnAddTaskClicked = false;
  global.document.getElementById = (id) => {
    if (id === "btnAddNewProjectTask") {
      return {
        onclick: null,
        type: "",
        click: function() { if (this.onclick) this.onclick({ preventDefault: ()=>{}, stopPropagation: ()=>{} }); }
      };
    }
    return { value: "test", innerHTML: "", textContent: "", classList: { contains: () => false }, style: {} };
  };

  const btnMock = { onclick: null, type: "", click: function() { if (this.onclick) this.onclick({ preventDefault: ()=>{}, stopPropagation: ()=>{} }); } };
  global.document.getElementById = (id) => {
    if (id === "btnAddNewProjectTask") return btnMock;
    if (id === "projectDetailsModal") return { classList: { contains: () => true }, style: {} };
    if (id === "formTaskProjectIdSelect") return { value: "PROJ-123", innerHTML: "" };
    if (id === "formTaskProgress") return { value: "50" };
    return { value: id + "_val", innerHTML: "", textContent: "", classList: { contains: () => false }, style: {} };
  };

  await pm.viewProjectDetails("PROJ-123");
  console.log("Button type after bind:", btnMock.type);
  console.log("Button has onclick:", typeof btnMock.onclick === 'function');
  
  console.log("=== T2: Click Add Task ===");
  btnMock.click();
  // Need to wait a tick for openTaskModal promises
  await new Promise(r => setTimeout(r, 100));
  
  console.log("=== T9: Submit Task ===");
  await pm.handleTaskSubmit({ preventDefault: ()=>{} });
}
run().catch(console.error);
