const fs = require('fs');
let code = fs.readFileSync('js/users.js', 'utf8');

const newOpenModal = `
  async openEmployeeModal(empId = null) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }
    const modal = document.getElementById("employeeModal");
    const title = document.getElementById("employeeModalTitle");
    const form = document.getElementById("employeeModalForm");
    
    if (form) form.reset();
    const idEl = document.getElementById("formEmpId");
    if (idEl) idEl.value = "";

    await this.populateLocationDropdown();
    const deptSelect = document.getElementById("formEmpDept");
    const officeSelect = document.getElementById("formEmpOffice");
    if (deptSelect) {
      deptSelect.innerHTML = \`<option value="">-- \${AppState.lang === 'ar' ? 'اختر الموقع أولاً' : 'Select location first'} --</option>\`;
      deptSelect.disabled = true;
    }
    if (officeSelect) {
      officeSelect.innerHTML = \`<option value="">-- \${AppState.lang === 'ar' ? 'اختر القسم أولاً' : 'Select department first'} --</option>\`;
      officeSelect.disabled = true;
    }

    if (empId) {
      if (title) title.textContent = AppState.lang === "ar" ? "تعديل بيانات الموظف" : "Edit Employee";
      const emp = await db.getById("employees", empId);
      if (emp) {
        if (idEl) idEl.value = emp.id;
        const idDisplay = document.getElementById("formEmpIdDisplay");
        if (idDisplay) idDisplay.value = emp.id || "";
        const orgNumEl = document.getElementById("formEmpOrgNumber") || document.getElementById("formEmpNumber");
        if (orgNumEl) orgNumEl.value = emp.employeeNumber || "";
        if (document.getElementById("formEmpNumber") && document.getElementById("formEmpOrgNumber")) {
          document.getElementById("formEmpNumber").value = emp.employeeNumber || "";
        }
        
        if (emp.departmentId) {
          const dept = await db.getById("departments", emp.departmentId);
          if (dept && dept.locationId) {
            const locSelect = document.getElementById("formEmpLoc");
            if (locSelect) locSelect.value = dept.locationId;
            await this.onEmployeeLocationChange(emp.departmentId);
            await this.onEmployeeDeptChange(emp.officeId);
          }
        }

        const nameArEl = document.getElementById("formEmpNameAr");
        if (nameArEl) nameArEl.value = emp.nameAr || "";
        const nameEnEl = document.getElementById("formEmpNameEn");
        if (nameEnEl) nameEnEl.value = emp.nameEn || "";
        const phoneEl = document.getElementById("formEmpPhone");
        if (phoneEl) phoneEl.value = emp.phone || "";
        const emailEl = document.getElementById("formEmpEmail");
        if (emailEl) emailEl.value = emp.email || "";
        const statusEl = document.getElementById("formEmpStatus");
        if (statusEl) statusEl.value = emp.status || "Active";
        const notesEl = document.getElementById("formEmpNotes");
        if (notesEl) notesEl.value = emp.notes || "";
      }
    } else {
      if (title) title.textContent = AppState.lang === "ar" ? "إضافة موظف جديد" : "Add Employee";
      const nextSeq = await db.getNextSequentialId("employees");
      if (idEl) idEl.value = nextSeq;
      const idDisplay = document.getElementById("formEmpIdDisplay");
      if (idDisplay) idDisplay.value = nextSeq;
      const orgNumEl = document.getElementById("formEmpOrgNumber");
      if (orgNumEl) orgNumEl.value = "";
      if (document.getElementById("formEmpNumber") && !orgNumEl) {
        document.getElementById("formEmpNumber").value = "";
      }
    }
    App.openModal("employeeModal");
  }
`;

const regex = /async openEmployeeModal[\s\S]*?App\.openModal\("employeeModal"\);\s*\}/;
code = code.replace(regex, newOpenModal.trim());

fs.writeFileSync('js/users.js', code);
