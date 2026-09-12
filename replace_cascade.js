const fs = require('fs');
let code = fs.readFileSync('js/users.js', 'utf8');

const cascadeBlock = `
  async populateLocationDropdown(selectedId = null) {
    const locSelect = document.getElementById("formEmpLoc");
    if (!locSelect) return;
    const locations = await db.getAll("locations");
    const lang = AppState.lang;
    const mainLocs = locations.filter(l => l.type === 'building' || !l.parentId);
    locSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'اختر الموقع' : 'Select Location'} --</option>\` +
      mainLocs.map(loc => \`<option value="\${loc.id}">\${lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)} (\${loc.code || loc.id})</option>\`).join("");
    if (selectedId) locSelect.value = selectedId;
  }

  async onEmployeeLocationChange(selectedDeptId = null) {
    const locSelect = document.getElementById("formEmpLoc");
    const deptSelect = document.getElementById("formEmpDept");
    const officeSelect = document.getElementById("formEmpOffice");
    if (!locSelect || !deptSelect) return;

    const locId = locSelect.value;
    const lang = AppState.lang;
    
    if (!locId) {
      deptSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'اختر الموقع أولاً' : 'Select location first'} --</option>\`;
      deptSelect.disabled = true;
      if (officeSelect) {
        officeSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'اختر القسم أولاً' : 'Select department first'} --</option>\`;
        officeSelect.disabled = true;
      }
      return;
    }

    const depts = await db.getAll("departments");
    const locDepts = depts.filter(d => d.locationId === locId);

    deptSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'اختر القسم' : 'Select Department'} --</option>\` +
      locDepts.map(d => \`<option value="\${d.id}">\${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)} (\${d.code || d.id})</option>\`).join("");
    
    deptSelect.disabled = false;
    if (selectedDeptId) deptSelect.value = selectedDeptId;
    
    if (officeSelect) {
      if (!selectedDeptId) {
        officeSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'اختر القسم أولاً' : 'Select department first'} --</option>\`;
        officeSelect.disabled = true;
      }
    }
  }

  async onEmployeeDeptChange(selectedOfficeId = null) {
    const deptSelect = document.getElementById("formEmpDept");
    const officeSelect = document.getElementById("formEmpOffice");
    if (!deptSelect || !officeSelect) return;

    const deptId = deptSelect.value;
    const lang = AppState.lang;

    if (!deptId) {
      officeSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'اختر القسم أولاً' : 'Select department first'} --</option>\`;
      officeSelect.disabled = true;
      return;
    }

    const locations = await db.getAll("locations");
    const dept = await db.getById("departments", deptId);
    if (!dept) return;
    
    const deptOffices = locations.filter(l => l.department_id === deptId || (l.parentId === dept.locationId && l.type === 'room'));

    officeSelect.innerHTML = \`<option value="">-- \${lang === 'ar' ? 'لم يتم تحديد مكتب (اختياري)' : 'No office (optional)'} --</option>\` +
      deptOffices.map(l => \`<option value="\${l.id}">\${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)} (\${l.code || l.id})</option>\`).join("");
      
    officeSelect.disabled = false;
    if (selectedOfficeId) officeSelect.value = selectedOfficeId;
  }

  quickAddLocation() {
    document.getElementById("quickAddType").value = "location";
    document.getElementById("quickAddModalTitle").textContent = AppState.lang === "ar" ? "إضافة موقع جديد" : "Add New Location";
    document.getElementById("quickAddLabel").textContent = AppState.lang === "ar" ? "اسم الموقع" : "Location Name";
    document.getElementById("quickAddInput").value = "";
    App.openModal("quickAddModal");
  }

  quickAddDepartment() {
    const locId = document.getElementById("formEmpLoc").value;
    if (!locId) {
      App.showToast(AppState.lang === "ar" ? "يرجى اختيار الموقع أولاً" : "Please select a location first", "warning");
      return;
    }
    document.getElementById("quickAddType").value = "department";
    document.getElementById("quickAddModalTitle").textContent = AppState.lang === "ar" ? "إضافة قسم جديد" : "Add New Department";
    document.getElementById("quickAddLabel").textContent = AppState.lang === "ar" ? "اسم القسم" : "Department Name";
    document.getElementById("quickAddInput").value = "";
    App.openModal("quickAddModal");
  }

  quickAddOffice() {
    const deptId = document.getElementById("formEmpDept").value;
    if (!deptId) {
      App.showToast(AppState.lang === "ar" ? "يرجى اختيار القسم أولاً" : "Please select a department first", "warning");
      return;
    }
    document.getElementById("quickAddType").value = "office";
    document.getElementById("quickAddModalTitle").textContent = AppState.lang === "ar" ? "إضافة مكتب جديد" : "Add New Office";
    document.getElementById("quickAddLabel").textContent = AppState.lang === "ar" ? "اسم المكتب" : "Office Name";
    document.getElementById("quickAddInput").value = "";
    App.openModal("quickAddModal");
  }

  async handleQuickAddSubmit(e) {
    e.preventDefault();
    const type = document.getElementById("quickAddType").value;
    const name = document.getElementById("quickAddInput").value.trim();
    if (!name) return;

    try {
      if (type === "location") {
        const newLoc = {
          id: \`loc-\${Date.now()}\`,
          nameAr: name,
          nameEn: name,
          type: "building",
          code: "L" + Math.floor(Math.random() * 1000)
        };
        await db.create("locations", newLoc);
        await this.populateLocationDropdown(newLoc.id);
        await this.onEmployeeLocationChange();
      } else if (type === "department") {
        const locId = document.getElementById("formEmpLoc").value;
        const newDept = {
          id: \`dept-\${Date.now()}\`,
          nameAr: name,
          nameEn: name,
          locationId: locId,
          code: "D" + Math.floor(Math.random() * 1000)
        };
        await db.create("departments", newDept);
        await this.onEmployeeLocationChange(newDept.id);
        await this.onEmployeeDeptChange();
      } else if (type === "office") {
        const locId = document.getElementById("formEmpLoc").value;
        const deptId = document.getElementById("formEmpDept").value;
        const newOffice = {
          id: \`off-\${Date.now()}\`,
          nameAr: name,
          nameEn: name,
          parentId: locId,
          department_id: deptId,
          type: "room",
          code: "O" + Math.floor(Math.random() * 1000)
        };
        await db.create("locations", newOffice);
        await this.onEmployeeDeptChange(newOffice.id);
      }
      App.closeModal("quickAddModal");
      App.showToast(AppState.lang === "ar" ? "تمت الإضافة بنجاح" : "Added successfully", "success");
    } catch (error) {
      console.error(error);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء الإضافة" : "Error adding record", "error");
    }
  }
`;

code = code.replace(/async onEmployeeOfficeChange\(\) \{[\s\S]*?officeSelect\.disabled = false;\s*\}/, cascadeBlock);

fs.writeFileSync('js/users.js', code);
