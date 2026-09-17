// Mock DOM and dependencies
global.window = { AppState: { lang: "ar" } };
global.document = {
  getElementById: (id) => ({
    value: "",
    innerHTML: "",
    textContent: ""
  })
};
global.App = {
  showToast: (msg) => console.log("TOAST:", msg),
  openModal: (id) => console.log("OPEN MODAL:", id)
};
global.db = {
  getAll: async () => [],
  getById: async () => null
};

class ProjectManagerClass {
  async openTaskModal(projectId = null, taskId = null) {
    try {
      const lang = (window.AppState && window.AppState.lang) || "ar";
      let projects = [], employees = [], contractors = [];
      try {
        [projects, employees, contractors] = await Promise.all([
          db.getAll("projects").catch(() => []),
          db.getAll("employees").catch(() => []),
          db.getAll("contractors").catch(() => [])
        ]);
      } catch (e) {
        console.warn("Error loading task dependencies:", e);
      }

      projects = Array.isArray(projects) ? projects : [];
      employees = Array.isArray(employees) ? employees : [];
      contractors = Array.isArray(contractors) ? contractors : [];

      this._cachedTaskProjects = projects;
      this._cachedTaskEmployees = employees;
      this._cachedTaskContractors = contractors;

      let targetProjectId = (projectId && projectId !== "undefined" && projectId !== "null") ? projectId : (this.activeDetailProjectId || "");
      if (taskId) {
        const existingTask = await db.getById("projectTasks", taskId);
        if (existingTask && existingTask.projectId) {
          targetProjectId = existingTask.projectId;
        }
      }
        
      if (!targetProjectId) {
        App.showToast(lang === "ar" ? "يرجى تحديد المشروع المرتبط بالمهمة" : "Please select a project first", "error");
        return;
      }

      const prjSelect = document.getElementById("formTaskProjectIdSelect");
      if (prjSelect) {
        let optHtml = `<option value="">-- ${lang === "ar" ? "اختر المشروع المرتبط *" : "Select Linked Project *"} --</option>`;
        optHtml += projects.map(p => {
          const pName = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
          const isSel = p.id === targetProjectId ? "selected" : "";
          return `<option value="${p.id}" ${isSel}>${p.projectNo ? `[${p.projectNo}] ` : ""}${pName}</option>`;
        }).join("");
        prjSelect.innerHTML = optHtml;
        if (targetProjectId) prjSelect.value = targetProjectId;
        if (typeof this.enhanceSelectWithSearch === "function") {
          try {
            this.enhanceSelectWithSearch("formTaskProjectIdSelect", lang === "ar" ? "اختر المشروع *" : "Select Project *", lang === "ar" ? "ابحث عن المشروع..." : "Search project...");
          } catch (err) {}
        }
      }

      const hiddenProj = document.getElementById("formTaskProjectId");
      if (hiddenProj) hiddenProj.value = targetProjectId || "";

      const hiddenTask = document.getElementById("formTaskId");
      if (hiddenTask) hiddenTask.value = taskId || "";

      const respSelect = document.getElementById("formTaskResponsible");
      if (respSelect) {
        respSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "المسؤول (اختياري)" : "Responsible Person (Optional)"} --</option>` +
          employees.filter(e => e.status === "Active" || !e.status)
            .map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
        if (typeof this.enhanceSelectWithSearch === "function") {
          try {
            this.enhanceSelectWithSearch("formTaskResponsible", lang === "ar" ? "المسؤول" : "Responsible", lang === "ar" ? "ابحث عن الموظف..." : "Search employee...");
          } catch (err) {}
        }
      }

      const contractorSelect = document.getElementById("formTaskContractor");
      if (contractorSelect) {
        contractorSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "المقاول المنفذ (اختياري)" : "Contractor (Optional)"} --</option>` +
          contractors.filter(c => c.active !== false)
            .map(c => `<option value="${c.id}">${lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)}</option>`).join("");
        if (typeof this.enhanceSelectWithSearch === "function") {
          try {
            this.enhanceSelectWithSearch("formTaskContractor", lang === "ar" ? "المقاول المنفذ" : "Contractor", lang === "ar" ? "ابحث عن المقاول..." : "Search contractor...");
          } catch (err) {}
        }
      }

      if (taskId) {
      } else {
      }

      this.updateTaskBanner();
      App.openModal("projectTaskModal");
    } catch (error) {
      console.error("Error opening projectTaskModal, falling back to openModal:", error);
      App.openModal("projectTaskModal");
    }
  }

  updateTaskBanner() { console.log("updateTaskBanner called"); }
}

const pm = new ProjectManagerClass();
pm.openTaskModal("test-proj-id").then(() => console.log("Done"));
