/**
 * SDI IT Asset Hub - Location-Office Integration Module
 * Add these methods to the OrganizationalManager class in js/users.js
 */

// =========================================================================
// EMPLOYEE OFFICE MANAGEMENT (NEW)
// =========================================================================

/**
 * Called when department selection changes in employee form
 * Auto-populates office dropdown with offices belonging to selected department
 */
async onEmployeeOfficeChange() {
  const deptSelect = document.getElementById("formEmpDept");
  const officeSelect = document.getElementById("formEmpOffice");
  
  if (!deptSelect || !officeSelect) return;
  
  const deptId = deptSelect.value;
  
  if (!deptId) {
    // No department selected - disable office selection
    officeSelect.innerHTML = '<option value="">-- اختر قسم أولاً --</option>';
    officeSelect.disabled = true;
    return;
  }
  
  // Get selected department
  const dept = await db.getById("departments", deptId);
  if (!dept || !dept.locationId) {
    officeSelect.innerHTML = '<option value="">-- لا يوجد موقع مرتبط بهذا القسم --</option>';
    officeSelect.disabled = true;
    return;
  }
  
  // Get all locations
  const locations = await db.getAll("locations");
  const lang = AppState.lang;
  
  // Filter offices: show main location + all child locations
  const deptMainLocation = locations.find(l => l.id === dept.locationId);
  const childOffices = locations.filter(l => l.parentId === dept.locationId);
  
  let officeOptions = [];
  if (deptMainLocation) {
    officeOptions.push(deptMainLocation);
  }
  officeOptions = officeOptions.concat(childOffices);
  
  // Populate dropdown
  officeSelect.innerHTML = '<option value="">-- لم يتم تحديد مكتب --</option>' +
    officeOptions
      .map(loc => `<option value="${loc.id}">${lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)} (${loc.code || loc.id})</option>`)
      .join("");
  
  officeSelect.disabled = false;
}

/**
 * Enhanced: openEmployeeModal - now populates office dropdown
 * REPLACE the existing openEmployeeModal method OR add this logic to it
 */
async openEmployeeModal_Enhanced(empId = null) {
  if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
    App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
    return;
  }

  const modal = document.getElementById("employeeModal");
  const title = document.getElementById("employeeModalTitle");
  const form = document.getElementById("employeeModalForm");
  const deptSelect = document.getElementById("formEmpDept");
  const officeSelect = document.getElementById("formEmpOffice");

  form.reset();
  document.getElementById("formEmpId").value = "";

  // Populate departments dropdown
  const departments = await db.getAll("departments");
  deptSelect.innerHTML = departments
    .filter(d => d.active !== false)
    .map(d => `<option value="${d.id}">${AppState.lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`)
    .join("");

  if (empId) {
    title.textContent = AppState.lang === "ar" ? "تعديل بيانات الموظف" : "Edit Employee";
    const emp = await db.getById("employees", empId);
    if (emp) {
      document.getElementById("formEmpId").value = emp.id;
      const idDisplay = document.getElementById("formEmpIdDisplay");
      if (idDisplay) idDisplay.value = emp.id || "";
      const orgNumEl = document.getElementById("formEmpOrgNumber") || document.getElementById("formEmpNumber");
      if (orgNumEl) orgNumEl.value = emp.employeeNumber || "";
      if (document.getElementById("formEmpNumber") && document.getElementById("formEmpOrgNumber")) {
        document.getElementById("formEmpNumber").value = emp.employeeNumber || "";
      }
      document.getElementById("formEmpDept").value = emp.departmentId || "";
      
      // NEW: Load and set office
      if (officeSelect) {
        await this.onEmployeeOfficeChange();
        officeSelect.value = emp.officeId || "";
      }
      
      document.getElementById("formEmpNameAr").value = emp.nameAr || "";
      document.getElementById("formEmpNameEn").value = emp.nameEn || "";
      document.getElementById("formEmpPhone").value = emp.phone || "";
      document.getElementById("formEmpEmail").value = emp.email || "";
      document.getElementById("formEmpStatus").value = emp.status || "Active";
      document.getElementById("formEmpNotes").value = emp.notes || "";
    }
  } else {
    title.textContent = AppState.lang === "ar" ? "إضافة موظف جديد" : "Add Employee";
    const nextSeq = await db.getNextSequentialId("employees");
    document.getElementById("formEmpId").value = nextSeq;
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

/**
 * Enhanced: handleSaveEmployee - now captures office_id
 * REPLACE the existing handleSaveEmployee method OR modify to include officeId
 */
async handleSaveEmployee_Enhanced(event) {
  event.preventDefault();
  const nextSeq = await db.getNextSequentialId("employees");
  const id = document.getElementById("formEmpId").value || nextSeq;
  const orgNumVal = (document.getElementById("formEmpOrgNumber")?.value || "").trim();
  const empNumVal = (document.getElementById("formEmpNumber")?.value || "").trim();
  const empNumber = orgNumVal || empNumVal;
  const deptId = document.getElementById("formEmpDept").value;
  const officeId = document.getElementById("formEmpOffice")?.value || null; // NEW
  const nameAr = document.getElementById("formEmpNameAr").value.trim();
  const nameEn = document.getElementById("formEmpNameEn").value.trim();
  const phone = document.getElementById("formEmpPhone").value.trim();
  const email = document.getElementById("formEmpEmail").value.trim();
  const status = document.getElementById("formEmpStatus").value;
  const notes = document.getElementById("formEmpNotes").value.trim();

  if (!empNumber) {
    App.showToast(AppState.lang === "ar" ? "يرجى إدخال الرقم الوظيفي داخل المؤسسة" : "Please enter the Organization Employee Number", "error");
    return;
  }

  // Check duplicate employee number
  const employees = await db.getAll("employees");
  const isDup = employees.some(e => 
    e.employeeNumber && 
    String(e.employeeNumber).trim().toLowerCase() === empNumber.toLowerCase() && 
    e.id !== id
  );
  if (isDup) {
    App.showToast(
      AppState.lang === "ar" 
        ? `الرقم الوظيفي (${empNumber}) مسجل مسبقاً لموظف آخر، يجب أن يكون فريداً داخل المؤسسة` 
        : `Employee Number (${empNumber}) already exists for another employee, must be unique`, 
      "error"
    );
    return;
  }

  const empData = {
    id: id,
    employeeNumber: empNumber,
    departmentId: deptId,
    officeId: officeId,  // NEW: Office location binding
    nameAr,
    nameEn,
    phone,
    email,
    status,
    notes
  };

  await db.put("employees", empData);
  App.closeModal("employeeModal");
  App.showToast(I18N[AppState.lang].saveSuccess, "success");
  await this.renderEmployees();
  await AssetManager.populateDropdowns();
}

// =========================================================================
// DEPARTMENT LOCATION MANAGEMENT (NEW)
// =========================================================================

/**
 * Enhanced: openDepartmentModal - now populates location dropdown
 * REPLACE the existing openDepartmentModal method OR add this logic to it
 */
async openDepartmentModal_Enhanced(deptId = null) {
  if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
    App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
    return;
  }

  const form = document.getElementById("departmentModalForm");
  form.reset();
  document.getElementById("formDeptId").value = "";

  // NEW: Populate location dropdown
  const locations = await db.getAll("locations");
  const locSelect = document.getElementById("formDeptLocation");
  const lang = AppState.lang;
  
  if (locSelect) {
    // Show only root/main locations (no parent = main branch/site)
    const mainLocations = locations.filter(l => !l.parentId || l.type === 'site' || l.type === 'branch');
    
    locSelect.innerHTML = '<option value="">-- اختر موقع رئيسي --</option>' +
      mainLocations
        .map(loc => `<option value="${loc.id}">${lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)} (${loc.code || loc.id})</option>`)
        .join("");
  }

  if (deptId) {
    document.getElementById("departmentModalTitle").textContent = AppState.lang === "ar" ? "تعديل بيانات القسم" : "Edit Department";
    const dept = await db.getById("departments", deptId);
    if (dept) {
      document.getElementById("formDeptId").value = dept.id;
      const display = document.getElementById("formDeptIdDisplay");
      if (display) display.value = dept.id;
      document.getElementById("formDeptNameAr").value = dept.nameAr || "";
      document.getElementById("formDeptNameEn").value = dept.nameEn || "";
      document.getElementById("formDeptDesc").value = dept.description || "";
      document.getElementById("formDeptActive").value = dept.active !== false ? "true" : "false";
      
      // NEW: Set location
      if (locSelect) {
        locSelect.value = dept.locationId || "";
      }
    }
  } else {
    document.getElementById("departmentModalTitle").textContent = AppState.lang === "ar" ? "إضافة قسم جديد" : "Add Department";
    const nextSeq = await db.getNextSequentialId("departments");
    document.getElementById("formDeptId").value = nextSeq;
    const display = document.getElementById("formDeptIdDisplay");
    if (display) display.value = nextSeq;
  }

  App.openModal("departmentModal");
}

/**
 * Enhanced: handleSaveDepartment - now requires location_id
 * REPLACE the existing handleSaveDepartment method OR modify to include locationId
 */
async handleSaveDepartment_Enhanced(event) {
  event.preventDefault();
  const nextSeq = await db.getNextSequentialId("departments");
  const id = document.getElementById("formDeptId").value || nextSeq;
  const nameAr = document.getElementById("formDeptNameAr").value.trim();
  const nameEn = document.getElementById("formDeptNameEn").value.trim();
  const description = document.getElementById("formDeptDesc").value.trim();
  const active = document.getElementById("formDeptActive").value === "true";
  const locationId = document.getElementById("formDeptLocation")?.value; // NEW: Get location

  // NEW: Validate location selection (required)
  if (!locationId) {
    App.showToast(
      AppState.lang === "ar" 
        ? "يجب اختيار موقع رئيسي للقسم" 
        : "Must select a main location for the department",
      "error"
    );
    return;
  }

  const deptData = {
    id: id,
    nameAr,
    nameEn: nameEn || nameAr,
    description,
    locationId: locationId,  // NEW: Department bound to location
    active
  };

  await db.put("departments", deptData);
  App.closeModal("departmentModal");
  App.showToast(I18N[AppState.lang].saveSuccess, "success");
  await this.renderDepartments();
  await AssetManager.populateDropdowns();
}

// NOTE: In production, replace the existing methods in users.js with these enhanced versions.
// The key additions are:
// 1. formEmpOffice field for employees (optional office/location binding)
// 2. formDeptLocation field for departments (required location binding)
// 3. Dynamic office filtering when department changes
// 4. Validation that departments must have a location
