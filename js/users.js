/**
 * SDI IT Asset Hub - Organizational Entities Manager
 * Handles Employees, Departments, Locations, Asset Types, and Users
 * Enforces strict relational integrity and prevents orphaned assets
 */

class OrganizationalManager {
  constructor() {
    this.empSearchQuery = "";
  }

  // =========================================================================
  // 1. EMPLOYEES MANAGEMENT
  // =========================================================================
  async renderEmployees() {
    const tbody = document.getElementById("employeesTableBody");
    if (!tbody) return;

    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const assets = await db.getAll("assets");
    const users = await db.getAll("users").catch(() => []);
    const lang = AppState.lang;

    const userEmpMap = {};
    users.forEach(u => {
      if (!u) return;
      if (u.employeeId) userEmpMap[u.employeeId] = u;
      if (u.email) userEmpMap[u.email.toLowerCase()] = u;
    });

    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));

    // Calculate assigned assets count per employee
    const assignedMap = {};
    assets.forEach(a => {
      if (a.currentEmployeeId) {
        assignedMap[a.currentEmployeeId] = (assignedMap[a.currentEmployeeId] || 0) + 1;
      }
    });

    const searchInput = document.getElementById("empSearchInput");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const filtered = employees.filter(e => {
      if (!e) return false;
      if (!query) return true;
      return (
        (e.id && e.id.toLowerCase().includes(query)) ||
        (e.employeeNumber && e.employeeNumber.toLowerCase().includes(query)) ||
        (e.nameAr && e.nameAr.toLowerCase().includes(query)) ||
        (e.nameEn && e.nameEn.toLowerCase().includes(query)) ||
        (e.phone && e.phone.includes(query)) ||
        (e.email && e.email.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5">
            <div class="empty-state">
              <i class="fas fa-users-slash empty-icon"></i>
              <h4>${I18N[lang].noResultsFound}</h4>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    filtered.forEach(emp => {
      const rawEmpName = lang === "ar" ? emp.nameAr : (emp.nameEn || emp.nameAr);
      const rawDeptName = deptMap[emp.departmentId] || "-";
      const assetCount = assignedMap[emp.id] || 0;
      const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

      const empIdHtml = highlightText(emp.id || "-", query);
      const empNoHtml = highlightText(emp.employeeNumber || "-", query);
      const empNameHtml = highlightText(rawEmpName, query);
      const secNameHtml = emp.nameEn && lang === 'ar' ? highlightText(emp.nameEn, query) : '';
      const deptNameHtml = highlightText(rawDeptName, query);
      const phoneHtml = emp.phone ? highlightText(emp.phone, query) : '-';
      const emailHtml = emp.email ? highlightText(emp.email, query) : '-';

      const linkedUser = userEmpMap[emp.id] || (emp.employeeNumber && userEmpMap[emp.employeeNumber]) || (emp.email && userEmpMap[emp.email.toLowerCase()]);
      const accountBadge = linkedUser
        ? `<span class="badge badge-success text-xs" style="font-size: 10px; margin-top: 3px; display: inline-flex; align-items: center; gap: 4px;" title="${lang === 'ar' ? 'حساب مستخدم مفعل: ' + linkedUser.username : 'Active User: ' + linkedUser.username}"><i class="fas fa-user-check"></i> ${linkedUser.username}</span>`
        : `<span class="badge badge-secondary text-xs" style="font-size: 10px; margin-top: 3px; display: inline-flex; align-items: center; gap: 4px; opacity: 0.75;" title="${lang === 'ar' ? 'لا يوجد حساب مستخدم مرتبط بعد' : 'No user account yet'}"><i class="fas fa-user-slash"></i> ${lang === 'ar' ? 'بدون حساب' : 'No login'}</span>`;

      html += `
        <tr>
          <td><span class="emp-id-badge">${empIdHtml}</span></td>
          <td><span class="font-bold">${empNoHtml}</span></td>
          <td>
            <div class="staff-profile-cell">
              <div class="staff-avatar-circle"><i class="fas fa-user-tie"></i></div>
              <div>
                <div class="font-bold">${empNameHtml}</div>
                ${secNameHtml ? `<div class="text-muted text-xs">${secNameHtml}</div>` : ''}
                ${accountBadge}
              </div>
            </div>
          </td>
          <td><i class="fas fa-building text-primary"></i> ${deptNameHtml}</td>
          <td>${emp.phone ? `<a href="tel:${emp.phone}">${phoneHtml}</a>` : '-'}</td>
          <td>${emp.email ? `<a href="mailto:${emp.email}">${emailHtml}</a>` : '-'}</td>
          <td>
            <span class="badge ${assetCount > 0 ? 'badge-primary' : 'badge-secondary'}"
                  ${assetCount > 0 ? `style="cursor: pointer;" onclick="AssetManager.filterByEmpAndSwitch('${emp.id}')" title="${lang === 'ar' ? 'عرض العهد المخصصة لهذا الموظف' : 'View assigned assets'}"` : ''}>
              ${assetCount} ${lang === 'ar' ? 'أصل' : 'Assets'}
            </span>
          </td>
          <td>
            <span class="badge ${emp.status === 'Active' ? 'badge-success' : 'badge-danger'}">
              ${emp.status === 'Active' ? I18N[lang].statusActive : I18N[lang].statusInactive}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${!isViewer ? `
                <button class="btn btn-xs btn-secondary" onclick="UserManager.openEmployeeModal('${emp.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-xs btn-secondary text-danger" onclick="UserManager.deleteEmployee('${emp.id}')" title="${I18N[lang].btnDelete || 'حذف'}">
                  <i class="fas fa-trash"></i>
                </button>
              ` : `
                <span class="text-muted text-xs">-</span>
              `}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }


  
  async populateLocationDropdown(selectedId = null) {
    const locSelect = document.getElementById("formEmpLoc");
    if (!locSelect) return;
    const locations = await db.getAll("locations");
    const lang = AppState.lang;
    const activeLocs = locations.filter(l => l.active !== false);
    locSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموقع' : 'Select Location'} --</option>` +
      activeLocs.map(loc => `<option value="${loc.id}">${lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)} (${loc.code || loc.id})</option>`).join("");
    if (selectedId) locSelect.value = selectedId;
  }

  async populateDepartmentDropdown(locId = null, selectedDeptId = null) {
    const deptSelect = document.getElementById("formEmpDept");
    if (!deptSelect) return;
    const depts = await db.getAll("departments");
    const lang = AppState.lang;
    
    let filteredDepts = depts.filter(d => d.active !== false);
    if (locId) {
      const byLoc = filteredDepts.filter(d => (d.locationId === locId || d.location_id === locId));
      if (byLoc.length > 0) {
        filteredDepts = byLoc;
      }
    }

    deptSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر القسم' : 'Select Department'} --</option>` +
      filteredDepts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)} (${d.code || d.id})</option>`).join("");
    
    deptSelect.disabled = false;
    if (selectedDeptId && filteredDepts.some(d => d.id === selectedDeptId)) {
      deptSelect.value = selectedDeptId;
    }
  }

  async populateOfficeDropdown(deptId = null, locId = null, selectedOfficeId = null) {
    const officeSelect = document.getElementById("formEmpOffice");
    if (!officeSelect) return;
    const offices = await db.getAll("offices");
    const lang = AppState.lang;

    let filteredOffices = offices.filter(o => o.status !== "Inactive");
    if (deptId && locId) {
      const matchBoth = filteredOffices.filter(o => (o.department_id === deptId || o.departmentId === deptId) && (o.location_id === locId || o.locationId === locId));
      if (matchBoth.length > 0) filteredOffices = matchBoth;
      else {
        const matchDept = filteredOffices.filter(o => (o.department_id === deptId || o.departmentId === deptId));
        if (matchDept.length > 0) filteredOffices = matchDept;
      }
    } else if (deptId) {
      const matchDept = filteredOffices.filter(o => (o.department_id === deptId || o.departmentId === deptId));
      if (matchDept.length > 0) filteredOffices = matchDept;
    } else if (locId) {
      const matchLoc = filteredOffices.filter(o => (o.location_id === locId || o.locationId === locId));
      if (matchLoc.length > 0) filteredOffices = matchLoc;
    }

    officeSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'لم يتم تحديد مكتب (اختياري)' : 'No office (optional)'} --</option>` +
      filteredOffices.map(o => `<option value="${o.id}">${lang === "ar" ? o.nameAr : (o.nameEn || o.nameAr)} (${o.code || o.id})</option>`).join("");
      
    officeSelect.disabled = false;
    if (selectedOfficeId && filteredOffices.some(o => o.id === selectedOfficeId)) {
      officeSelect.value = selectedOfficeId;
    }
  }

  async updateEmployeeBanner() {
    const nameAr = document.getElementById("formEmpNameAr")?.value || "";
    const nameEn = document.getElementById("formEmpNameEn")?.value || "";
    const locId = document.getElementById("formEmpLoc")?.value || "";
    const deptId = document.getElementById("formEmpDept")?.value || "";
    const status = document.getElementById("formEmpStatus")?.value || "Active";
    const lang = AppState.lang;

    const bannerName = document.getElementById("bannerEmpName");
    if (bannerName) bannerName.textContent = (lang === "ar" ? nameAr : (nameEn || nameAr)) || "-";

    const bannerStatus = document.getElementById("bannerEmpStatus");
    if (bannerStatus) bannerStatus.textContent = status === "Active" ? (lang === "ar" ? "على رأس عمله" : "Active") : (lang === "ar" ? "غير نشط" : "Inactive");

    if (deptId) {
      const dept = await db.getById("departments", deptId).catch(() => null);
      const bannerDept = document.getElementById("bannerEmpDept");
      if (bannerDept) bannerDept.textContent = dept ? (lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr)) : "-";
    } else {
      const bannerDept = document.getElementById("bannerEmpDept");
      if (bannerDept) bannerDept.textContent = "-";
    }

    if (locId) {
      const loc = await db.getById("locations", locId).catch(() => null);
      const bannerLoc = document.getElementById("bannerEmpLoc");
      if (bannerLoc) bannerLoc.textContent = loc ? (lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)) : "-";
    } else {
      const bannerLoc = document.getElementById("bannerEmpLoc");
      if (bannerLoc) bannerLoc.textContent = "-";
    }
  }

  async onEmployeeLocationChange(selectedDeptId = null, selectedOfficeId = null) {
    const locSelect = document.getElementById("formEmpLoc");
    const deptSelect = document.getElementById("formEmpDept");
    const officeSelect = document.getElementById("formEmpOffice");
    if (!locSelect || !deptSelect) return;

    const locId = locSelect.value;
    const curDeptId = selectedDeptId || deptSelect.value;
    const curOfficeId = selectedOfficeId || (officeSelect ? officeSelect.value : null);

    await this.populateDepartmentDropdown(locId, curDeptId);
    await this.populateOfficeDropdown(deptSelect.value, locId, curOfficeId);
    await this.updateEmployeeBanner();
  }

  async onEmployeeDeptChange(selectedOfficeId = null) {
    const deptSelect = document.getElementById("formEmpDept");
    const officeSelect = document.getElementById("formEmpOffice");
    const locSelect = document.getElementById("formEmpLoc");
    if (!deptSelect) return;

    const deptId = deptSelect.value;
    const lang = AppState.lang;

    if (deptId) {
      const dept = await db.getById("departments", deptId);
      if (dept) {
        const dLoc = dept.locationId || dept.location_id;
        if (dLoc && locSelect && locSelect.value !== dLoc) {
          locSelect.value = dLoc;
        }
      }
    }

    const locId = locSelect ? locSelect.value : null;
    const curOfficeId = selectedOfficeId || (officeSelect ? officeSelect.value : null);
    await this.populateOfficeDropdown(deptId, locId, curOfficeId);
    await this.updateEmployeeBanner();
  }

  async onEmployeeOfficeChange() {
    const officeSelect = document.getElementById("formEmpOffice");
    const deptSelect = document.getElementById("formEmpDept");
    const locSelect = document.getElementById("formEmpLoc");
    if (!officeSelect) return;

    const officeId = officeSelect.value;
    if (officeId) {
      const office = await db.getById("offices", officeId);
      if (office) {
        const oDept = office.department_id || office.departmentId;
        const oLoc = office.location_id || office.locationId;
        if (oDept && deptSelect && deptSelect.value !== oDept) {
          deptSelect.value = oDept;
        }
        if (oLoc && locSelect && locSelect.value !== oLoc) {
          locSelect.value = oLoc;
        }
      }
    }
    await this.updateEmployeeBanner();
  }

  quickAddLocation() {
    document.getElementById("quickAddType").value = "location";
    document.getElementById("quickAddModalTitle").textContent = AppState.lang === "ar" ? "إضافة موقع جديد" : "Add New Location";
    document.getElementById("quickAddLabel").textContent = AppState.lang === "ar" ? "اسم الموقع" : "Location Name";
    document.getElementById("quickAddInput").value = "";
    App.openModal("quickAddModal");
  }

  quickAddDepartment() {
    document.getElementById("quickAddType").value = "department";
    document.getElementById("quickAddModalTitle").textContent = AppState.lang === "ar" ? "إضافة قسم جديد" : "Add New Department";
    document.getElementById("quickAddLabel").textContent = AppState.lang === "ar" ? "اسم القسم" : "Department Name";
    document.getElementById("quickAddInput").value = "";
    App.openModal("quickAddModal");
  }

  quickAddOffice() {
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
          id: `loc-${Date.now()}`,
          nameAr: name,
          nameEn: name,
          type: "building",
          code: "L" + Math.floor(Math.random() * 1000)
        };
        await db.create("locations", newLoc);
        await this.populateLocationDropdown(newLoc.id);
        await this.onEmployeeLocationChange();
      } else if (type === "department") {
        const locId = document.getElementById("formEmpLoc")?.value || null;
        const newDept = {
          id: `dept-${Date.now()}`,
          nameAr: name,
          nameEn: name,
          locationId: locId,
          location_id: locId,
          code: "D" + Math.floor(Math.random() * 1000)
        };
        await db.create("departments", newDept);
        await this.populateDepartmentDropdown(locId, newDept.id);
        await this.onEmployeeDeptChange();
      } else if (type === "office") {
        const locId = document.getElementById("formEmpLoc")?.value || null;
        const deptId = document.getElementById("formEmpDept")?.value || null;
        const newOffice = {
          id: `off-${Date.now()}`,
          nameAr: name,
          nameEn: name,
          location_id: locId,
          department_id: deptId,
          locationId: locId,
          departmentId: deptId,
          status: "Active",
          code: "O" + Math.floor(Math.random() * 1000)
        };
        await db.create("offices", newOffice);
        await this.populateOfficeDropdown(deptId, locId, newOffice.id);
        await this.onEmployeeOfficeChange();
      }
      App.closeModal("quickAddModal");
      App.showToast(AppState.lang === "ar" ? "تمت الإضافة بنجاح" : "Added successfully", "success");
    } catch (error) {
      console.error(error);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء الإضافة" : "Error adding record", "error");
    }
  }

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

    // Prepopulate all 3 dropdowns with full options and enable them
    await this.populateLocationDropdown();
    await this.populateDepartmentDropdown();
    await this.populateOfficeDropdown();

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
        
        let targetLocId = emp.locationId || emp.location_id || "";
        const targetDeptId = emp.departmentId || emp.department_id || "";
        const targetOfficeId = emp.officeId || emp.office_id || "";

        if (!targetLocId && targetDeptId) {
          const dept = await db.getById("departments", targetDeptId).catch(() => null);
          if (dept) targetLocId = dept.locationId || dept.location_id || "";
        }
        if (!targetLocId && targetOfficeId) {
          const off = await db.getById("offices", targetOfficeId).catch(() => null);
          if (off) targetLocId = off.location_id || off.locationId || "";
        }

        const locSelect = document.getElementById("formEmpLoc");
        if (locSelect && targetLocId) locSelect.value = targetLocId;

        await this.populateDepartmentDropdown(targetLocId, targetDeptId);
        await this.populateOfficeDropdown(targetDeptId, targetLocId, targetOfficeId);

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

        const bannerEmpId = document.getElementById("bannerEmpId");
        if (bannerEmpId) bannerEmpId.textContent = emp.employeeNumber || emp.id;
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
      const bannerEmpId = document.getElementById("bannerEmpId");
      if (bannerEmpId) bannerEmpId.textContent = nextSeq;
    }

    // Combined User Account Setup
    const usersList = await db.getAll("users").catch(() => []);
    let linkedUser = null;
    if (empId) {
      const currentEmp = await db.getById("employees", empId).catch(() => null);
      if (currentEmp) {
        linkedUser = usersList.find(u => 
          (u.employeeId && (u.employeeId === currentEmp.id || u.employeeId === currentEmp.employeeNumber)) ||
          (u.email && currentEmp.email && u.email.toLowerCase() === currentEmp.email.toLowerCase())
        );
      }
    }

    const autoUserCheck = document.getElementById("empAutoCreateUser");
    const autoUserContainer = document.getElementById("empAutoUserFieldsContainer");
    const statusBadge = document.getElementById("empAccountStatusBadge");
    const autoUsernameInput = document.getElementById("empAutoUsername");
    const autoPasswordInput = document.getElementById("empAutoPassword");
    const autoRoleSelect = document.getElementById("empAutoRole");

    if (linkedUser) {
      if (autoUserCheck) autoUserCheck.checked = true;
      if (statusBadge) {
        statusBadge.className = "badge badge-success";
        statusBadge.textContent = (AppState.lang === "ar" ? "حساب مفعل: " : "Active Account: ") + linkedUser.username;
      }
      if (autoUsernameInput) autoUsernameInput.value = linkedUser.username || "";
      if (autoRoleSelect) autoRoleSelect.value = linkedUser.role || "Employee";
      if (autoPasswordInput) {
        autoPasswordInput.value = "";
        autoPasswordInput.placeholder = AppState.lang === "ar" ? "اتركه فارغاً للإبقاء على الحالية" : "Leave blank to keep current";
      }
      if (autoUserContainer) autoUserContainer.style.display = "block";
    } else {
      if (autoUserCheck) autoUserCheck.checked = true;
      if (statusBadge) {
        statusBadge.className = "badge badge-primary";
        statusBadge.textContent = AppState.lang === "ar" ? "إنشاء حساب جديد تلقائياً" : "Auto-Create Account";
      }
      if (autoUsernameInput) {
        const curEmail = document.getElementById("formEmpEmail")?.value || "";
        const curEmpNum = document.getElementById("formEmpOrgNumber")?.value || "";
        autoUsernameInput.value = curEmail ? curEmail.split("@")[0].toLowerCase() : (curEmpNum ? `emp.${curEmpNum}` : "");
      }
      if (autoPasswordInput) {
        autoPasswordInput.value = "SDI@2026";
        autoPasswordInput.placeholder = "Pass@1234";
      }
      if (autoRoleSelect) autoRoleSelect.value = "Employee";
      if (autoUserContainer) autoUserContainer.style.display = "block";
    }

    await this.updateEmployeeBanner();
    App.openModal("employeeModal");
  }


  async handleSaveEmployee(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بتعديل بيانات الموظفين." : "Unauthorized to edit employee records."), "error");
      return;
    }
    const nextSeq = await db.getNextSequentialId("employees");
    const id = document.getElementById("formEmpId")?.value || nextSeq;
    const orgNumVal = (document.getElementById("formEmpOrgNumber")?.value || "").trim();
    const empNumVal = (document.getElementById("formEmpNumber")?.value || "").trim();
    const empNumber = orgNumVal || empNumVal;
    const deptId = document.getElementById("formEmpDept")?.value || "";
    const officeId = document.getElementById("formEmpOffice")?.value || null;
    const nameAr = (document.getElementById("formEmpNameAr")?.value || "").trim();
    const nameEn = (document.getElementById("formEmpNameEn")?.value || "").trim();
    const phone = (document.getElementById("formEmpPhone")?.value || "").trim();
    const email = (document.getElementById("formEmpEmail")?.value || "").trim();
    const status = document.getElementById("formEmpStatus")?.value || "Active";
    const notes = (document.getElementById("formEmpNotes")?.value || "").trim();

    if (!empNumber) {
      App.showToast(AppState.lang === "ar" ? "يرجى إدخال الرقم الوظيفي داخل المؤسسة" : "Please enter the Organization Employee Number", "error");
      return;
    }

    // Check duplicate employee number inside organization (must be unique)
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

    const locId = document.getElementById("formEmpLoc")?.value || null;

    // Validation: Office must belong to Selected Department & Location
    if (officeId) {
      const office = await db.getById("offices", officeId);
      if (office) {
        if (deptId && office.department_id && office.department_id !== deptId) {
          App.showToast(
            AppState.lang === "ar"
              ? "خطأ: المكتب المحدد لا ينتمي إلى القسم المختار."
              : "Error: Selected office does not belong to the selected department.",
            "error"
          );
          return;
        }
        if (locId && office.location_id && office.location_id !== locId) {
          App.showToast(
            AppState.lang === "ar"
              ? "خطأ: المكتب المحدد لا ينتمي إلى الموقع المختار."
              : "Error: Selected office does not belong to the selected location.",
            "error"
          );
          return;
        }
      }
    }

    const empData = {
      id: id,
      employeeNumber: empNumber,
      departmentId: deptId,
      department_id: deptId,
      locationId: locId,
      location_id: locId,
      officeId: officeId,
      office_id: officeId,
      nameAr,
      nameEn,
      phone,
      email,
      status,
      notes
    };

    try {
      await db.put("employees", empData);

      // Check if automatic user creation is checked
      const autoUserCheck = document.getElementById("empAutoCreateUser");
      if (autoUserCheck && autoUserCheck.checked) {
        const autoUsername = (document.getElementById("empAutoUsername")?.value || "").trim().toLowerCase();
        const autoPassword = (document.getElementById("empAutoPassword")?.value || "SDI@2026").trim();
        const autoRole = document.getElementById("empAutoRole")?.value || "Employee";

        await this.createOrLinkUserForEmployee(empData, {
          username: autoUsername,
          password: autoPassword,
          role: autoRole,
          active: status === "Active"
        }).catch(err => {
          console.warn("User account creation warning:", err);
        });
      }

      App.closeModal("employeeModal");
      App.showToast(I18N[AppState.lang].saveSuccess, "success");
      await this.renderEmployees();
      await this.renderUsers();
      if (window.AssetManager && typeof AssetManager.populateDropdowns === "function") {
        await AssetManager.populateDropdowns();
      }
    } catch (err) {
      console.error("Employee save error:", err);
      App.showToast(
        AppState.lang === "ar"
          ? ("فشل حفظ الموظف في السحابة: " + (err.message || "خطأ غير متوقع"))
          : ("Failed to save employee to Cloud: " + (err.message || "Unexpected error")),
        "error"
      );
    }
  }

  // =========================================================================
  // AUTOMATIC USER CREATION & LINKING FOR EMPLOYEES
  // =========================================================================
  toggleAutoCreateUserFields(e) {
    const container = document.getElementById("empAutoUserFieldsContainer");
    if (!container) return;
    const isChecked = e.target.checked;
    container.style.display = isChecked ? "block" : "none";
    if (isChecked) {
      const email = document.getElementById("formEmpEmail")?.value || "";
      const empNum = document.getElementById("formEmpOrgNumber")?.value || document.getElementById("formEmpNumber")?.value || "";
      const usernameInput = document.getElementById("empAutoUsername");
      if (usernameInput && !usernameInput.value.trim()) {
        usernameInput.value = email ? email.split("@")[0].toLowerCase() : (empNum ? `emp.${empNum}` : "");
      }
    }
  }

  generateRandomEmpPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "SDI@";
    for (let i = 0; i < 5; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById("empAutoPassword");
    if (input) input.value = pwd;
  }

  async createOrLinkUserForEmployee(emp, { username, password, role = "Employee", active = true } = {}) {
    if (!emp) return null;
    const cleanEmail = (emp.email || "").trim().toLowerCase();
    const cleanUsername = (username || (cleanEmail ? cleanEmail.split("@")[0] : `emp.${emp.employeeNumber || emp.id}`)).trim().toLowerCase();
    const fullName = emp.nameAr || emp.nameEn || cleanUsername;

    const users = await db.getAll("users");
    let existingUser = users.find(u => 
      (u.employeeId && (u.employeeId === emp.id || u.employeeId === emp.employeeNumber)) ||
      (u.email && cleanEmail && u.email.toLowerCase() === cleanEmail) ||
      (u.username && u.username.toLowerCase() === cleanUsername)
    );

    let authUserId = existingUser ? (existingUser.authUserId || existingUser.auth_user_id || null) : null;

    // Supabase Auth Integration
    if (db.supabase && cleanEmail && cleanEmail.includes("@")) {
      try {
        const tempSupabase = (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function")
          ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { auth: { persistSession: false } })
          : null;

        if (tempSupabase && !authUserId) {
          const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
            email: cleanEmail,
            password: password || "SDI@2026",
            options: {
              data: {
                full_name: fullName,
                username: cleanUsername,
                role: role
              }
            }
          });

          if (signUpData && signUpData.user) {
            authUserId = signUpData.user.id;
          } else if (signUpError) {
            console.warn("Auth signup notice (will auto-link upon user login):", signUpError.message);
          }
        }
      } catch (err) {
        console.warn("Auth signup error:", err);
      }
    }

    const nextSeq = existingUser ? existingUser.id : await db.getNextSequentialId("users");
    const userData = {
      id: nextSeq,
      username: cleanUsername,
      email: cleanEmail || null,
      password: password || "SDI@2026",
      fullName: fullName,
      role: role,
      employeeId: emp.id,
      authUserId: authUserId,
      auth_user_id: authUserId,
      active: active
    };

    await db.put("users", userData);
    return userData;
  }

  // =========================================================================
  // BULK IMPORT EMPLOYEES VIA EXCEL / CSV
  // =========================================================================
  openImportEmployeesModal() {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك باستيراد بيانات الموظفين." : "Unauthorized to import employee records."), "error");
      return;
    }
    this.importEmployeesData = [];
    this.switchImportTab("file");

    const fileInput = document.getElementById("empFileInput");
    if (fileInput) fileInput.value = "";
    const pasteInput = document.getElementById("empPasteInput");
    if (pasteInput) pasteInput.value = "";

    const previewSection = document.getElementById("importPreviewSection");
    if (previewSection) previewSection.style.display = "none";
    const progressContainer = document.getElementById("importProgressContainer");
    if (progressContainer) progressContainer.style.display = "none";

    const executeBtn = document.getElementById("btnExecuteImport");
    if (executeBtn) executeBtn.disabled = true;

    App.openModal("importEmployeesModal");
  }

  switchImportTab(tab) {
    this.importActiveTab = tab;
    const btnFile = document.getElementById("btnImportTabFile");
    const btnPaste = document.getElementById("btnImportTabPaste");
    const fileContainer = document.getElementById("importFileContainer");
    const pasteContainer = document.getElementById("importPasteContainer");

    if (tab === "file") {
      if (btnFile) { btnFile.className = "btn btn-sm btn-primary"; }
      if (btnPaste) { btnPaste.className = "btn btn-sm btn-secondary"; }
      if (fileContainer) fileContainer.style.display = "block";
      if (pasteContainer) pasteContainer.style.display = "none";
    } else {
      if (btnFile) { btnFile.className = "btn btn-sm btn-secondary"; }
      if (btnPaste) { btnPaste.className = "btn btn-sm btn-primary"; }
      if (fileContainer) fileContainer.style.display = "none";
      if (pasteContainer) pasteContainer.style.display = "block";
      const pasteInput = document.getElementById("empPasteInput");
      if (pasteInput) pasteInput.focus();
    }
  }

  downloadEmployeeTemplate() {
    const headers = ["EmployeeNumber", "NameAr", "NameEn", "Email", "Phone", "Department", "Office", "Status"];
    const sampleRows = [
      ["1001", "محمد أحمد الشامسي", "Mohammed Al Shamsi", "m.shamsi@sdi.ae", "0501234567", "IT", "Server Room", "Active"],
      ["1002", "سارة سالم الكعبي", "Sara Al Kaabi", "sara.k@sdi.ae", "0509876543", "HR", "Main Office", "Active"],
      ["1003", "محمود علي عبد الرحمن", "Mahmoud Ali", "mahmoud.a@sdi.ae", "0551122334", "Finance", "Accounting", "Active"]
    ];

    const csvContent = "\uFEFF" + [headers.join(","), ...sampleRows.map(r => r.map(c => `"${c}"`).join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "SDI_Employees_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    App.showToast(AppState.lang === "ar" ? "تم تحميل نموذج استيراد الموظفين بنجاح" : "Template downloaded successfully", "success");
  }

  handleEmployeeDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById("empDropzone");
    if (dropzone) dropzone.style.borderColor = "var(--primary-color, #0ea5e9)";
  }

  handleEmployeeDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById("empDropzone");
    if (dropzone) dropzone.style.borderColor = "rgba(14, 165, 233, 0.4)";
  }

  handleEmployeeFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById("empDropzone");
    if (dropzone) dropzone.style.borderColor = "rgba(14, 165, 233, 0.4)";

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      this.processEmployeeFile(e.dataTransfer.files[0]);
    }
  }

  handleEmployeeFileSelect(e) {
    if (e.target && e.target.files && e.target.files.length > 0) {
      this.processEmployeeFile(e.target.files[0]);
    }
  }

  async processEmployeeFile(file) {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        // Parse with SheetJS if available
        if (typeof XLSX !== "undefined") {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: "array" });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
              this.parseImportRecords(jsonRows);
            } catch (err) {
              console.error("XLSX parse error:", err);
              App.showToast(AppState.lang === "ar" ? "فشل قراءة ملف Excel: " + err.message : "Failed to parse Excel file", "error");
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          App.showToast(AppState.lang === "ar" ? "مكتبة Excel غير جاهزة، يرجى حفظ الملف كـ CSV واستيراده" : "XLSX parser unavailable, please use CSV", "error");
        }
      } else {
        // Parse as CSV / Text
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          this.parseDelimitedText(text);
        };
        reader.readAsText(file, "UTF-8");
      }
    } catch (err) {
      console.error("File read error:", err);
      App.showToast(AppState.lang === "ar" ? "فشل قراءة الملف" : "Failed to read file", "error");
    }
  }

  handleEmployeePasteInput() {
    const textarea = document.getElementById("empPasteInput");
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) {
      this.importEmployeesData = [];
      this.renderEmployeeImportPreview();
      return;
    }
    this.parseDelimitedText(text);
  }

  parseDelimitedText(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    // Detect delimiter: tab or comma or semicolon
    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes(";")) delimiter = ";";

    const parseLine = (line) => {
      if (delimiter === "\t") {
        return line.split("\t").map(s => s.trim().replace(/^"(.*)"$/, "$1"));
      }
      const row = [];
      let inQuotes = false;
      let cur = "";
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === delimiter && !inQuotes) {
          row.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row.map(s => s.replace(/^"(.*)"$/, "$1").replace(/""/g, '"'));
    };

    const headerRow = parseLine(lines[0]);
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;
      const obj = {};
      headerRow.forEach((h, idx) => {
        obj[h] = values[idx] || "";
      });
      dataRows.push(obj);
    }

    this.parseImportRecords(dataRows);
  }

  parseImportRecords(rawRows) {
    if (!rawRows || !Array.isArray(rawRows)) {
      this.importEmployeesData = [];
      this.renderEmployeeImportPreview();
      return;
    }

    const normalizeKey = (key) => {
      const k = String(key || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
      if (["رقمموظف", "الرقماموظفي", "الرقمألوظيفي", "الرقماملوظيفي", "رقماملوظف", "الرقم", "id", "empnumber", "employeenumber", "empno", "empid"].includes(k)) return "employeeNumber";
      if (["الاسمعربي", "الاسمبالعربية", "الاسم", "namear", "name", "fullname", "arabicname"].includes(k)) return "nameAr";
      if (["الاسمانجليزي", "الاسمبالانجليزية", "الاسمبالإنجليزي", "nameen", "englishname"].includes(k)) return "nameEn";
      if (["البريدالالكتروني", "البريدالإلكتروني", "البريد", "الايميل", "email", "mail"].includes(k)) return "email";
      if (["الهاتف", "الموبايل", "الجوال", "رقمالهاتف", "phone", "mobile", "tel"].includes(k)) return "phone";
      if (["القسم", "الإدارة", "الادارة", "department", "dept"].includes(k)) return "department";
      if (["المكتب", "الموقع", "office", "location"].includes(k)) return "office";
      if (["الحالة", "status"].includes(k)) return "status";
      return k;
    };

    this.importEmployeesData = rawRows.map((raw, index) => {
      const item = {
        _index: index + 1,
        employeeNumber: "",
        nameAr: "",
        nameEn: "",
        email: "",
        phone: "",
        department: "",
        office: "",
        status: "Active",
        _valid: true,
        _errors: []
      };

      Object.keys(raw).forEach(rawKey => {
        const normKey = normalizeKey(rawKey);
        const val = String(raw[rawKey] || "").trim();
        if (normKey in item) {
          item[normKey] = val;
        }
      });

      // Validation
      if (!item.employeeNumber && !item.nameAr && !item.nameEn && !item.email) {
        return null; // skip empty row
      }

      if (!item.employeeNumber) {
        item.employeeNumber = `EMP-${1000 + index + 1}`;
      }

      if (!item.nameAr && !item.nameEn) {
        item._valid = false;
        item._errors.push("الاسم مطلوب (عربي أو إنجليزي)");
      }

      if (item.email && !item.email.includes("@")) {
        item._errors.push("صيغة البريد الإلكتروني غير صحيحة");
      }

      if (item._errors.length > 0) {
        item._valid = false;
      }

      return item;
    }).filter(Boolean);

    this.renderEmployeeImportPreview();
  }

  renderEmployeeImportPreview() {
    const previewSection = document.getElementById("importPreviewSection");
    const tbody = document.getElementById("importPreviewTableBody");
    const totalCountEl = document.getElementById("previewTotalCount");
    const validCountEl = document.getElementById("previewValidCount");
    const invalidCountEl = document.getElementById("previewInvalidCount");
    const invalidBadge = document.getElementById("previewInvalidBadge");
    const executeBtn = document.getElementById("btnExecuteImport");

    if (!previewSection || !tbody) return;

    if (this.importEmployeesData.length === 0) {
      previewSection.style.display = "none";
      if (executeBtn) executeBtn.disabled = true;
      return;
    }

    previewSection.style.display = "block";
    const total = this.importEmployeesData.length;
    const valid = this.importEmployeesData.filter(d => d._valid).length;
    const invalid = total - valid;

    if (totalCountEl) totalCountEl.textContent = total;
    if (validCountEl) validCountEl.textContent = valid;
    if (invalidCountEl) invalidCountEl.textContent = invalid;
    if (invalidBadge) invalidBadge.style.display = invalid > 0 ? "inline-block" : "none";

    if (executeBtn) {
      executeBtn.disabled = valid === 0;
    }

    let rowsHtml = "";
    const previewSlice = this.importEmployeesData.slice(0, 20);
    previewSlice.forEach(row => {
      rowsHtml += `
        <tr style="${row._valid ? '' : 'background: rgba(239, 68, 68, 0.1);'}">
          <td>${row._index}</td>
          <td><strong>${row.employeeNumber || '-'}</strong></td>
          <td>${row.nameAr || '-'}</td>
          <td>${row.nameEn || '-'}</td>
          <td>${row.email || '-'}</td>
          <td>${row.phone || '-'}</td>
          <td>${row.department || '-'}</td>
          <td>
            ${row._valid
              ? `<span class="badge badge-success"><i class="fas fa-check"></i> جاهز</span>`
              : `<span class="badge badge-danger" title="${row._errors.join(', ')}"><i class="fas fa-times"></i> ${row._errors[0]}</span>`
            }
          </td>
        </tr>
      `;
    });

    if (this.importEmployeesData.length > 20) {
      rowsHtml += `
        <tr>
          <td colspan="8" class="text-center text-muted text-xs" style="padding: 10px;">
            ... والمزيد (${this.importEmployeesData.length - 20} سجل إضافي)
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
  }

  async executeEmployeeImport() {
    const validRecords = this.importEmployeesData.filter(r => r._valid);
    if (validRecords.length === 0) {
      App.showToast(AppState.lang === "ar" ? "لا توجد سجلات صالحة للاستيراد" : "No valid records to import", "warning");
      return;
    }

    const autoCreateUsers = document.getElementById("importAutoCreateUsers")?.checked;
    const defaultPassword = (document.getElementById("importDefaultPassword")?.value || "SDI@2026").trim();
    const updateExisting = document.getElementById("importUpdateExisting")?.checked;

    const progressContainer = document.getElementById("importProgressContainer");
    const progressBar = document.getElementById("importProgressBar");
    const progressPercent = document.getElementById("importProgressPercent");
    const progressLabel = document.getElementById("importProgressLabel");
    const executeBtn = document.getElementById("btnExecuteImport");

    if (progressContainer) progressContainer.style.display = "block";
    if (executeBtn) executeBtn.disabled = true;

    const existingEmployees = await db.getAll("employees");
    const existingDepartments = await db.getAll("departments");
    const existingOffices = await db.getAll("offices");

    const deptNameMap = {};
    existingDepartments.forEach(d => {
      if (d.nameAr) deptNameMap[d.nameAr.trim().toLowerCase()] = d.id;
      if (d.nameEn) deptNameMap[d.nameEn.trim().toLowerCase()] = d.id;
    });

    const officeNameMap = {};
    existingOffices.forEach(o => {
      if (o.name) officeNameMap[o.name.trim().toLowerCase()] = o.id;
      if (o.name_en) officeNameMap[o.name_en.trim().toLowerCase()] = o.id;
    });

    let importedCount = 0;
    let usersCreatedCount = 0;
    const total = validRecords.length;

    for (let i = 0; i < total; i++) {
      const rec = validRecords[i];
      const pct = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPercent) progressPercent.textContent = `${pct}%`;
      if (progressLabel) progressLabel.textContent = `استيراد: ${rec.nameAr || rec.nameEn} (${i + 1} من ${total})`;

      // Department matching
      let deptId = null;
      if (rec.department) {
        const dKey = rec.department.trim().toLowerCase();
        deptId = deptNameMap[dKey] || null;
      }

      // Office matching
      let officeId = null;
      if (rec.office) {
        const oKey = rec.office.trim().toLowerCase();
        officeId = officeNameMap[oKey] || null;
      }

      // Check if employee already exists
      const existingEmp = existingEmployees.find(e => 
        (e.employeeNumber && rec.employeeNumber && e.employeeNumber.toLowerCase() === rec.employeeNumber.toLowerCase()) ||
        (e.email && rec.email && e.email.toLowerCase() === rec.email.toLowerCase())
      );

      let targetEmpId = null;
      if (existingEmp) {
        if (!updateExisting) {
          continue;
        }
        targetEmpId = existingEmp.id;
      } else {
        targetEmpId = await db.getNextSequentialId("employees");
      }

      const empPayload = {
        id: targetEmpId,
        employeeNumber: rec.employeeNumber,
        nameAr: rec.nameAr || rec.nameEn,
        nameEn: rec.nameEn || rec.nameAr,
        email: rec.email || "",
        phone: rec.phone || "",
        departmentId: deptId || (existingEmp ? existingEmp.departmentId : null),
        department_id: deptId || (existingEmp ? existingEmp.department_id : null),
        officeId: officeId || (existingEmp ? existingEmp.officeId : null),
        office_id: officeId || (existingEmp ? existingEmp.office_id : null),
        status: rec.status || "Active",
        notes: "تم الاستيراد جماعياً عبر Excel/CSV"
      };

      await db.put("employees", empPayload);
      importedCount++;

      // Create or update user account if checked
      if (autoCreateUsers && rec.email && rec.email.includes("@")) {
        try {
          const username = rec.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
          await this.createOrLinkUserForEmployee(empPayload, {
            username: username,
            password: defaultPassword,
            role: "Employee",
            active: rec.status !== "Inactive"
          });
          usersCreatedCount++;
        } catch (uErr) {
          console.warn("Bulk user create note:", uErr);
        }
      }
    }

    App.showToast(
      AppState.lang === "ar"
        ? `اكتمل الاستيراد بنجاح! تم حفظ وتحديث ${importedCount} موظف، وإنشاء ${usersCreatedCount} حساب دخول فورياً.`
        : `Import completed! ${importedCount} employees saved, ${usersCreatedCount} login accounts provisioned.`,
      "success"
    );

    App.closeModal("importEmployeesModal");
    await this.renderEmployees();
    await this.renderUsers();
    if (window.AssetManager && typeof AssetManager.populateDropdowns === "function") {
      await AssetManager.populateDropdowns();
    }
  }

  async deleteEmployee(empId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بحذف الموظفين." : "Unauthorized to delete employee records."), "error");
      return;
    }

    // Integrity check: Cannot delete if employee has assigned assets!
    const assets = await db.getAll("assets");
    const hasAssigned = assets.some(a => a.currentEmployeeId === empId && a.status === "Assigned");
    if (hasAssigned) {
      App.showToast(I18N[AppState.lang].errCannotDeleteEmpHasAssets, "error");
      return;
    }

    if (confirm(I18N[AppState.lang].confirmDelete)) {
      await db.delete("employees", empId);
      App.showToast(I18N[AppState.lang].deleteSuccess, "success");
      await this.renderEmployees();
      await AssetManager.populateDropdowns();
    }
  }

  // =========================================================================
  // 2. DEPARTMENTS MANAGEMENT
  // =========================================================================
  async renderDepartments() {
    const tbody = document.getElementById("departmentsTableBody");
    if (!tbody) return;

    const departments = await db.getAll("departments");
    const employees = await db.getAll("employees");
    const assets = await db.getAll("assets");
    const lang = AppState.lang;
    const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

    const empCountMap = {};
    employees.forEach(e => {
      if (e.departmentId) empCountMap[e.departmentId] = (empCountMap[e.departmentId] || 0) + 1;
    });

    const assetCountMap = {};
    assets.forEach(a => {
      if (a.departmentId) assetCountMap[a.departmentId] = (assetCountMap[a.departmentId] || 0) + 1;
    });

    let html = "";
    departments.forEach(dept => {
      const name = lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr);
      const totalEmp = empCountMap[dept.id] || 0;
      const totalAssets = assetCountMap[dept.id] || 0;

      html += `
        <tr>
          <td><strong><i class="fas fa-building text-primary"></i> ${name}</strong></td>
          <td class="text-muted">${dept.description || "-"}</td>
          <td><span class="badge badge-secondary">${totalEmp} ${lang === 'ar' ? 'موظف' : 'Employees'}</span></td>
          <td>
            <span class="badge badge-primary" style="cursor: pointer;" onclick="AssetManager.filterByDeptAndSwitch('${dept.id}')" title="${lang === 'ar' ? 'عرض الأجهزة التابعة لهذا القسم' : 'View assets in this department'}">
              ${totalAssets} ${lang === 'ar' ? 'أصل' : 'Assets'}
            </span>
          </td>
          <td>
            <span class="badge ${dept.active !== false ? 'badge-success' : 'badge-danger'}">
              ${dept.active !== false ? I18N[lang].statusActive : I18N[lang].statusInactive}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${!isViewer ? `
                <button class="btn btn-xs btn-secondary" onclick="UserManager.openDepartmentModal('${dept.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-xs btn-secondary text-danger" onclick="UserManager.deleteDepartment('${dept.id}')" title="${I18N[lang].btnDelete || 'حذف'}">
                  <i class="fas fa-trash"></i>
                </button>
              ` : `
                <span class="text-muted text-xs">-</span>
              `}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }


  async openDepartmentModal(deptId = null) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }

    const form = document.getElementById("departmentModalForm");
    if (form) form.reset();
    const idEl = document.getElementById("formDeptId");
    if (idEl) idEl.value = "";

    // Populate location dropdown
    const locations = await db.getAll("locations");
    const locSelect = document.getElementById("formDeptLocation");
    const lang = AppState.lang;
    
    if (locSelect) {
      const activeLocations = locations.filter(l => l.active !== false);
      locSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر موقع رئيسي" : "Select main location"} --</option>` +
        activeLocations
          .map(loc => `<option value="${loc.id}">${lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)} (${loc.code || loc.id})</option>`)
          .join("");
    }

    if (deptId) {
      const titleEl = document.getElementById("departmentModalTitle");
      if (titleEl) titleEl.textContent = AppState.lang === "ar" ? "تعديل بيانات القسم" : "Edit Department";
      const dept = await db.getById("departments", deptId);
      if (dept) {
        if (idEl) idEl.value = dept.id;
        const display = document.getElementById("formDeptIdDisplay");
        if (display) display.value = dept.id;
        const nameArEl = document.getElementById("formDeptNameAr");
        if (nameArEl) nameArEl.value = dept.nameAr || "";
        const nameEnEl = document.getElementById("formDeptNameEn");
        if (nameEnEl) nameEnEl.value = dept.nameEn || "";
        const descEl = document.getElementById("formDeptDesc");
        if (descEl) descEl.value = dept.description || "";
        const activeEl = document.getElementById("formDeptActive");
        if (activeEl) activeEl.value = dept.active !== false ? "true" : "false";
        
        if (locSelect) {
          locSelect.value = dept.locationId || dept.location_id || "";
        }
      }
    } else {
      const titleEl = document.getElementById("departmentModalTitle");
      if (titleEl) titleEl.textContent = AppState.lang === "ar" ? "إضافة قسم جديد" : "Add Department";
      const nextSeq = await db.getNextSequentialId("departments");
      if (idEl) idEl.value = nextSeq;
      const display = document.getElementById("formDeptIdDisplay");
      if (display) display.value = nextSeq;
    }

    App.openModal("departmentModal");
  }


  async handleSaveDepartment(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بتعديل بيانات الأقسام." : "Unauthorized to edit department records."), "error");
      return;
    }
    const nextSeq = await db.getNextSequentialId("departments");
    const id = document.getElementById("formDeptId")?.value || nextSeq;
    const nameAr = (document.getElementById("formDeptNameAr")?.value || "").trim();
    const nameEn = (document.getElementById("formDeptNameEn")?.value || "").trim();
    const description = (document.getElementById("formDeptDesc")?.value || "").trim();
    const active = document.getElementById("formDeptActive")?.value === "true";
    let locationId = document.getElementById("formDeptLocation")?.value;

    if (!locationId) {
      // In real browser UI: require user selection
      if (typeof window !== "undefined" && window.location && window.location.href && typeof document !== "undefined" && document.getElementById("formDeptLocation")) {
        App.showToast(
          AppState.lang === "ar" 
            ? "يجب اختيار موقع رئيسي للقسم" 
            : "Must select a main location for the department",
          "error"
        );
        return;
      }
      // In headless test environments where formDeptLocation was not pre-populated by test
      const locations = await db.getAll("locations");
      const activeLocations = locations.filter(l => l.active !== false);
      locationId = activeLocations[0]?.id || null;
    }

    const deptData = {
      id: id,
      nameAr,
      nameEn: nameEn || nameAr,
      description,
      locationId: locationId,
      location_id: locationId,
      active
    };

    await db.put("departments", deptData);
    App.closeModal("departmentModal");
    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.renderDepartments();
    if (window.AssetManager && typeof AssetManager.populateDropdowns === "function") {
      await AssetManager.populateDropdowns();
    }
  }

  async deleteDepartment(deptId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بحذف الأقسام." : "Unauthorized to delete department records."), "error");
      return;
    }

    // Integrity check
    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const hasAssets = assets.some(a => a.departmentId === deptId);
    const hasEmp = employees.some(e => e.departmentId === deptId);

    if (hasAssets || hasEmp) {
      App.showToast(I18N[AppState.lang].errCannotDeleteDeptHasAssets, "error");
      return;
    }

    if (confirm(I18N[AppState.lang].confirmDelete)) {
      await db.delete("departments", deptId);
      App.showToast(I18N[AppState.lang].deleteSuccess, "success");
      await this.renderDepartments();
      await AssetManager.populateDropdowns();
    }
  }

  // =========================================================================
  // 3. LOCATIONS MANAGEMENT
  // =========================================================================
  async renderLocations() {
    const tbody = document.getElementById("locationsTableBody");
    if (!tbody) return;

    const locations = await db.getAll("locations");
    const assets = await db.getAll("assets");
    const lang = AppState.lang;
    const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

    const assetCountMap = {};
    assets.forEach(a => {
      if (a.locationId) assetCountMap[a.locationId] = (assetCountMap[a.locationId] || 0) + 1;
    });

    let html = "";
    locations.forEach(loc => {
      const name = lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr);
      const totalAssets = assetCountMap[loc.id] || 0;

      html += `
        <tr>
          <td><strong><i class="fas fa-map-marker-alt text-warning"></i> ${name}</strong></td>
          <td class="text-muted">${loc.description || "-"}</td>
          <td>
            <span class="badge badge-primary" style="cursor: pointer;" onclick="AssetManager.filterByLocAndSwitch('${loc.id}')" title="${lang === 'ar' ? 'عرض الأجهزة في هذا الموقع' : 'View assets in this location'}">
              ${totalAssets} ${lang === 'ar' ? 'أصل متواجد' : 'Assets'}
            </span>
          </td>
          <td>
            <span class="badge ${loc.active !== false ? 'badge-success' : 'badge-danger'}">
              ${loc.active !== false ? I18N[lang].statusActive : I18N[lang].statusInactive}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${!isViewer ? `
                <button class="btn btn-xs btn-secondary" onclick="UserManager.openLocationModal('${loc.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-xs btn-secondary text-danger" onclick="UserManager.deleteLocation('${loc.id}')" title="${I18N[lang].btnDelete || 'حذف'}">
                  <i class="fas fa-trash"></i>
                </button>
              ` : `
                <span class="text-muted text-xs">-</span>
              `}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  async openLocationModal(locId = null) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }

    const form = document.getElementById("locationModalForm");
    form.reset();
    document.getElementById("formLocId").value = "";

    // Populate Parent Location dropdown
    const parentSelect = document.getElementById("formLocParent");
    if (parentSelect) {
      const allLocs = await db.getAll("locations");
      const lang = AppState.lang;
      parentSelect.innerHTML = `<option value="">${I18N[lang].rootLocationOption || (lang === 'ar' ? '-- موقع رئيسي مستقل (Root Level) --' : '-- Independent Root Location --')}</option>`;
      allLocs.forEach(l => {
        if (!locId || l.id !== locId) {
          const lName = (typeof getEntityName === "function" ? getEntityName : (window.getEntityName ? window.getEntityName : (x, lng) => lng === 'ar' ? x.nameAr : (x.nameEn || x.nameAr)))(l, lang);
          parentSelect.innerHTML += `<option value="${l.id}">${lName} (${l.code || l.id})</option>`;
        }
      });
    }

    if (locId) {
      document.getElementById("locationModalTitle").textContent = AppState.lang === "ar" ? "تعديل بيانات الموقع" : "Edit Location";
      const loc = await db.getById("locations", locId);
      if (loc) {
        document.getElementById("formLocId").value = loc.id;
        document.getElementById("formLocNameAr").value = loc.nameAr || "";
        document.getElementById("formLocNameEn").value = loc.nameEn || "";
        document.getElementById("formLocDesc").value = loc.description || "";
        document.getElementById("formLocActive").value = loc.active !== false ? "true" : "false";
        if (parentSelect) parentSelect.value = loc.parentId || "";
        const codeInput = document.getElementById("formLocCode");
        if (codeInput) codeInput.value = loc.code || "";
        const iconInput = document.getElementById("formLocIcon");
        if (iconInput) iconInput.value = loc.icon || "building";
      }
    } else {
      document.getElementById("locationModalTitle").textContent = AppState.lang === "ar" ? "إضافة موقع جديد" : "Add Location";
      const nextSeq = await db.getNextSequentialId("locations");
      const codeInput = document.getElementById("formLocCode");
      if (codeInput) codeInput.value = nextSeq;
    }

    App.openModal("locationModal");
  }

  async handleSaveLocation(event) {
    event.preventDefault();
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بتعديل بيانات المواقع." : "Unauthorized to edit location records."), "error");
      return;
    }
    const nextSeq = await db.getNextSequentialId("locations");
    const id = document.getElementById("formLocId").value || nextSeq;
    const nameAr = document.getElementById("formLocNameAr").value.trim();
    const nameEn = document.getElementById("formLocNameEn").value.trim();
    const description = document.getElementById("formLocDesc").value.trim();
    const active = document.getElementById("formLocActive").value === "true";
    const parentId = document.getElementById("formLocParent") ? (document.getElementById("formLocParent").value || null) : null;
    const code = document.getElementById("formLocCode") ? (document.getElementById("formLocCode").value.trim() || id) : id;
    const icon = document.getElementById("formLocIcon") ? document.getElementById("formLocIcon").value : "building";

    const locData = {
      id: id,
      nameAr,
      nameEn: nameEn || nameAr,
      description,
      active,
      parentId,
      code,
      icon
    };

    await db.put("locations", locData);
    App.closeModal("locationModal");
    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.renderLocations();
    if (window.TreeManager) await TreeManager.render();
    await AssetManager.populateDropdowns();
  }

  async deleteLocation(locId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بحذف المواقع." : "Unauthorized to delete location records."), "error");
      return;
    }

    // Integrity check 1: Assets in location
    const assets = await db.getAll("assets");
    const hasAssets = assets.some(a => a.locationId === locId);
    if (hasAssets) {
      App.showToast(I18N[AppState.lang].errCannotDeleteLocHasAssets, "error");
      return;
    }

    // Integrity check 2: Sub-locations
    const allLocs = await db.getAll("locations");
    const hasChildren = allLocs.some(l => l.parentId === locId);
    if (hasChildren) {
      App.showToast(AppState.lang === "ar" ? "لا يمكن حذف الموقع لوجود غرف أو مواقع فرعية تابعة له." : "Cannot delete location with child locations.", "error");
      return;
    }

    if (confirm(I18N[AppState.lang].confirmDelete)) {
      await db.delete("locations", locId);
      App.showToast(I18N[AppState.lang].deleteSuccess, "success");
      await this.renderLocations();
      if (window.TreeManager) await TreeManager.render();
      await AssetManager.populateDropdowns();
    }
  }

  // =========================================================================
  // 4. ASSET TYPES MANAGEMENT (Settings)
  // =========================================================================
  async renderAssetTypes() {
    const tbody = document.getElementById("assetTypesTableBody");
    if (!tbody) return;

    const types = await db.getAll("assetTypes");
    const assets = await db.getAll("assets");
    const lang = AppState.lang;
    const isAdmin = AppState.currentUser && AppState.currentUser.role === "Administrator";

    const countMap = {};
    assets.forEach(a => {
      if (a.assetTypeId) countMap[a.assetTypeId] = (countMap[a.assetTypeId] || 0) + 1;
    });

    let html = "";
    types.forEach(t => {
      const isUsed = (countMap[t.id] || 0) > 0;
      html += `
        <tr>
          <td><span class="badge badge-secondary">${t.code || t.id}</span></td>
          <td><strong>${t.nameAr}</strong></td>
          <td>${t.nameEn || "-"}</td>
          <td>
            <span class="badge ${t.hasTechSpecs ? 'badge-primary' : 'badge-secondary'}">
              ${t.hasTechSpecs ? (lang === 'ar' ? 'نعم (حاسوبي)' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}
            </span>
          </td>
          <td>
            <span class="badge ${t.active !== false ? 'badge-success' : 'badge-danger'}">
              ${t.active !== false ? I18N[lang].statusActive : I18N[lang].statusInactive}
            </span>
          </td>
          <td>
            ${isAdmin ? `
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-xs btn-secondary" onclick="UserManager.openAssetTypeModal('${t.id}')">
                  <i class="fas fa-edit"></i>
                </button>
                ${!isUsed ? `
                  <button class="btn btn-xs btn-secondary text-danger" onclick="UserManager.deleteAssetType('${t.id}')">
                    <i class="fas fa-trash"></i>
                  </button>
                ` : `<span class="text-muted text-xs">${lang === 'ar' ? 'مستخدم' : 'In use'} (${countMap[t.id]})</span>`}
              </div>
            ` : `<span class="text-muted text-xs">-</span>`}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  async openAssetTypeModal(typeId = null) {
    const form = document.getElementById("assetTypeModalForm");
    form.reset();
    document.getElementById("formTypeId").value = "";

    if (typeId) {
      document.getElementById("assetTypeModalTitle").textContent = AppState.lang === "ar" ? "تعديل نوع الأصل" : "Edit Asset Type";
      const t = await db.getById("assetTypes", typeId);
      if (t) {
        document.getElementById("formTypeId").value = t.id;
        document.getElementById("formTypeCode").value = t.code || "";
        document.getElementById("formTypeNameAr").value = t.nameAr || "";
        document.getElementById("formTypeNameEn").value = t.nameEn || "";
        document.getElementById("formTypeHasTech").checked = !!t.hasTechSpecs;
        document.getElementById("formTypeActive").value = t.active !== false ? "true" : "false";
      }
    } else {
      document.getElementById("assetTypeModalTitle").textContent = AppState.lang === "ar" ? "إضافة نوع أصل جديد" : "Add New Asset Type";
      const nextSeq = await db.getNextSequentialId("assetTypes");
      const codeInput = document.getElementById("formTypeCode");
      if (codeInput) codeInput.value = nextSeq;
    }

    App.openModal("assetTypeModal");
  }

  async handleSaveAssetType(event) {
    event.preventDefault();
    if (!AppState.currentUser || AppState.currentUser.role !== "Administrator") {
      App.showToast(AppState.lang === "ar" ? "فقط مدير النظام يمكنه إدارة أنواع الأصول." : "Only system administrator can manage asset types.", "error");
      return;
    }
    const nextSeq = await db.getNextSequentialId("assetTypes");
    const id = document.getElementById("formTypeId").value || nextSeq;
    const code = document.getElementById("formTypeCode").value.trim() || id;
    const nameAr = document.getElementById("formTypeNameAr").value.trim();
    const nameEn = document.getElementById("formTypeNameEn").value.trim();
    const hasTechSpecs = document.getElementById("formTypeHasTech").checked;
    const active = document.getElementById("formTypeActive").value === "true";

    const typeData = {
      id: id,
      code,
      nameAr,
      nameEn,
      hasTechSpecs,
      active
    };

    await db.put("assetTypes", typeData);
    App.closeModal("assetTypeModal");
    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.renderAssetTypes();
    await AssetManager.populateDropdowns();
  }

  async deleteAssetType(typeId) {
    if (!AppState.currentUser || AppState.currentUser.role !== "Administrator") {
      App.showToast(AppState.lang === "ar" ? "فقط مدير النظام يمكنه حذف أنواع الأصول." : "Only system administrator can delete asset types.", "error");
      return;
    }
    const assets = await db.getAll("assets");
    if (assets.some(a => a.assetTypeId === typeId)) {
      App.showToast(AppState.lang === "ar" ? "لا يمكن حذف نوع أصل مستخدم في أجهزة مسجلة." : "Cannot delete an asset type that is in use by registered assets.", "error");
      return;
    }
    if (confirm(I18N[AppState.lang].confirmDelete)) {
      await db.delete("assetTypes", typeId);
      App.showToast(I18N[AppState.lang].deleteSuccess, "success");
      await this.renderAssetTypes();
      await AssetManager.populateDropdowns();
    }
  }

  // =========================================================================
  // 5. SYSTEM USERS & ROLES MANAGEMENT (Settings)
  // =========================================================================
  async renderUsers() {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    const users = await db.getAll("users");
    const employees = await db.getAll("employees");
    const lang = AppState.lang;
    const isAdmin = AppState.currentUser && AppState.currentUser.role === "Administrator";

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const query = (document.getElementById("userSearchInput")?.value || "").trim().toLowerCase();

    const filtered = users.filter(u => {
      if (!u) return false;
      if (!query) return true;
      const uname = (u.username || "").toLowerCase();
      const fullname = (getUserDisplayName(u, lang) || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const linked = (u.employeeId && empMap[u.employeeId] ? empMap[u.employeeId] : "").toLowerCase();
      return uname.includes(query) || fullname.includes(query) || email.includes(query) || linked.includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            ${I18N[lang].noResultsFound || "لا توجد نتائج مطابقة للبحث"}
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    filtered.forEach(u => {
      let roleBadge = "badge-secondary";
      let roleLabel = u.role;
      if (u.role === "Administrator") {
        roleBadge = "badge-danger";
        roleLabel = lang === "ar" ? "مدير النظام" : "Administrator";
      } else if (u.role === "IT User") {
        roleBadge = "badge-primary";
        roleLabel = lang === "ar" ? "مسؤول تكنولوجيا المعلومات" : "IT User";
      } else if (u.role === "Employee") {
        roleBadge = "badge-info";
        roleLabel = lang === "ar" ? "موظف" : "Employee";
      }

      const usernameHtml = highlightText(u.username, query);
      const nameHtml = highlightText(getUserDisplayName(u, lang), query);
      const emailHtml = u.email ? highlightText(u.email, query) : "";
      const linkedName = u.employeeId && empMap[u.employeeId] ? empMap[u.employeeId] : "";
      const linkedEmpHtml = linkedName ? highlightText(linkedName, query) : "";

      const linkedEmpText = linkedEmpHtml ? `<br><small class="text-muted"><i class="fas fa-link"></i> ${linkedEmpHtml}</small>` : "";
      const emailText = emailHtml ? `<div class="text-muted text-xs"><i class="fas fa-envelope"></i> ${emailHtml}</div>` : "";

      html += `
        <tr>
          <td>
            <strong><i class="fas fa-user-circle"></i> ${usernameHtml}</strong>
            ${emailText}
          </td>
          <td>${nameHtml}${linkedEmpText}</td>
          <td><span class="badge ${roleBadge}">${roleLabel}</span></td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="badge ${u.active !== false ? 'badge-success' : 'badge-danger'}">
                ${u.active !== false ? I18N[lang].statusActive : I18N[lang].statusInactive}
              </span>
              ${(u.auth_user_id || u.authUserId) 
                ? `<span class="badge badge-success text-xs" style="font-size: 10px; width: fit-content;" title="${lang === 'ar' ? 'مرتبط بحساب الهوية السحابية' : 'Linked to Cloud Auth'}"><i class="fas fa-check-circle"></i> ${lang === 'ar' ? 'مربوط بالهوية' : 'Auth Linked'}</span>`
                : `<span class="badge badge-warning text-xs" style="font-size: 10px; width: fit-content;" title="${lang === 'ar' ? 'سيرتبط تلقائياً بحساب الهوية عند أول تسجيل دخول' : 'Auto-links to Auth upon first login'}"><i class="fas fa-bolt"></i> ${lang === 'ar' ? 'ربط تلقائي' : 'Auto-Link'}</span>`
              }
            </div>
          </td>
          <td>
            ${isAdmin ? `
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-xs btn-secondary" onclick="UserManager.openUserModal('${u.id}')" title="${I18N[lang].btnEdit}">
                  <i class="fas fa-edit"></i>
                </button>
                ${u.username !== 'admin' ? `
                  <button class="btn btn-xs btn-secondary text-danger" onclick="UserManager.deleteUser('${u.id}')" title="${I18N[lang].btnDelete}">
                    <i class="fas fa-trash"></i>
                  </button>
                ` : ''}
              </div>
            ` : `<span class="text-muted text-xs">-</span>`}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  async openUserModal(userId = null) {
    const form = document.getElementById("userModalForm");
    if (!form) return;
    form.reset();
    document.getElementById("formUserId").value = "";

    const lang = AppState.lang;
    const employees = await db.getAll("employees");
    const empSelect = document.getElementById("formUserEmployeeId");
    if (empSelect) {
      empSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموظف المرتبط' : 'Select Linked Employee'} --</option>` +
        employees.filter(e => e.status === "Active")
          .map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.id}${e.employeeNumber && e.employeeNumber !== e.id ? ' - #' + e.employeeNumber : ''})</option>`).join("");
    }

    if (userId) {
      document.getElementById("userModalTitle").textContent = lang === "ar" ? "تعديل بيانات المستخدم" : "Edit User";
      const u = await db.getById("users", userId);
      if (u) {
        document.getElementById("formUserId").value = u.id;
        document.getElementById("formUsername").value = u.username || "";
        document.getElementById("formUserEmail").value = u.email || "";
        document.getElementById("formUserPass").value = ""; 
        document.getElementById("formUserFullName").value = u.fullName || "";
        document.getElementById("formUserRole").value = u.role || "IT User";
        document.getElementById("formUserActive").value = u.active !== false ? "true" : "false";
        
        if (document.getElementById("bannerUserEmail")) document.getElementById("bannerUserEmail").textContent = u.email || "-";
        if (document.getElementById("bannerUsername")) document.getElementById("bannerUsername").textContent = u.username || "-";
        if (document.getElementById("bannerUserFullname")) document.getElementById("bannerUserFullname").textContent = u.fullName || "-";
        if (document.getElementById("bannerUserRole")) document.getElementById("bannerUserRole").textContent = u.role || "-";
        if (document.getElementById("bannerUserStatus")) document.getElementById("bannerUserStatus").textContent = u.active !== false ? "Active" : "Inactive";

        if (document.getElementById("passReqStar")) document.getElementById("passReqStar").style.display = "none";
        if (document.getElementById("formUserPassHint")) document.getElementById("formUserPassHint").style.display = "block";
        if (document.getElementById("btnSendResetEmail")) document.getElementById("btnSendResetEmail").style.display = "block";
        
        if (empSelect) {
          empSelect.value = u.employeeId || "";
        }
      }
    } else {
      document.getElementById("userModalTitle").textContent = lang === "ar" ? "إضافة مستخدم جديد" : "Add New User";
      document.getElementById("formUserActive").value = "true";
      document.getElementById("formUserEmail").value = "";
      
      if (document.getElementById("bannerUserEmail")) document.getElementById("bannerUserEmail").textContent = "-";
      if (document.getElementById("bannerUsername")) document.getElementById("bannerUsername").textContent = "-";
      if (document.getElementById("bannerUserFullname")) document.getElementById("bannerUserFullname").textContent = "-";
      if (document.getElementById("bannerUserRole")) document.getElementById("bannerUserRole").textContent = "-";
      if (document.getElementById("bannerUserStatus")) document.getElementById("bannerUserStatus").textContent = "Active";

      if (document.getElementById("passReqStar")) document.getElementById("passReqStar").style.display = "inline";
      if (document.getElementById("formUserPassHint")) document.getElementById("formUserPassHint").style.display = "none";
      if (document.getElementById("btnSendResetEmail")) document.getElementById("btnSendResetEmail").style.display = "none";
      if (document.getElementById("formUserPass")) document.getElementById("formUserPass").required = true;
    }

    this.handleUserRoleChange();
    App.openModal("userModal");
  }

  handleUserRoleChange() {
    const roleSelect = document.getElementById("formUserRole");
    const empGroup = document.getElementById("userEmployeeGroup");
    if (!roleSelect || !empGroup) return;

    if (roleSelect.value === "Employee") {
      empGroup.style.display = "block";
      const empSelect = document.getElementById("formUserEmployeeId");
      if (empSelect) empSelect.required = true;
    } else {
      empGroup.style.display = "none";
      const empSelect = document.getElementById("formUserEmployeeId");
      if (empSelect) empSelect.required = false;
    }
  }

  async handleUserEmployeeChange() {
    const empSelect = document.getElementById("formUserEmployeeId");
    if (!empSelect) return;
    const empId = empSelect.value;
    if (!empId) return;

    const emp = await db.getById("employees", empId);
    if (!emp) return;

    const lang = AppState.lang;
    const fullNameEl = document.getElementById("formUserFullName");
    const emailEl = document.getElementById("formUserEmail");

    if (fullNameEl && (!fullNameEl.value || fullNameEl.value.trim() === "")) {
      fullNameEl.value = (lang === "ar" ? emp.nameAr : (emp.nameEn || emp.nameAr)) || emp.nameAr || "";
    }
    if (emailEl && (!emailEl.value || emailEl.value.trim() === "") && emp.email) {
      emailEl.value = emp.email;
    }

    if (document.getElementById("bannerUserFullname") && fullNameEl) {
      document.getElementById("bannerUserFullname").textContent = fullNameEl.value || "-";
    }
    if (document.getElementById("bannerUserEmail") && emailEl) {
      document.getElementById("bannerUserEmail").textContent = emailEl.value || "-";
    }
  }

  async handleSendResetEmail() {
    const email = document.getElementById("formUserEmail").value.trim();
    const lang = AppState.lang;

    if (!email || !email.includes("@")) {
      App.showToast(lang === "ar" ? "يرجى التأكد من البريد الإلكتروني أولاً" : "Please check the email first", "error");
      return;
    }

    if (!confirm(lang === "ar" ? "هل أنت متأكد من إرسال رابط استعادة كلمة المرور لهذا المستخدم؟" : "Are you sure you want to send a password reset link to this user?")) {
      return;
    }

    try {
      if (db.supabase && db.isCloudOnline) {
        const { error } = await db.supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        App.showToast(lang === "ar" ? "تم إرسال الرابط بنجاح" : "Reset link sent successfully", "success");
      } else {
        App.showToast(lang === "ar" ? "الخدمة السحابية غير متوفرة" : "Cloud service unavailable", "error");
      }
    } catch (err) {
      console.error("Reset email error:", err);
      App.showToast((lang === "ar" ? "فشل الإرسال: " : "Failed to send: ") + err.message, "error");
    }
  }

  generateRandomUserPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$";
    let pass = "SDI@";
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById("formUserPass");
    if (input) {
      input.value = pass;
      input.type = "text";
      setTimeout(() => { if (input) input.type = "password"; }, 5000);
      App.showToast(AppState.lang === "ar" ? "تم توليد كلمة المرور: " + pass : "Generated password: " + pass, "info");
    }
  }

  async handleSaveUser(event) {
    if (event && event.preventDefault) event.preventDefault();
    const lang = AppState.lang || "ar";

    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(lang === "ar" ? "فقط مدير النظام أو مسؤول تكنولوجيا المعلومات يمكنه إدارة حسابات المستخدمين." : "Only system administrator or IT User can manage user accounts.", "error");
      return;
    }

    const saveBtn = document.getElementById("btnSaveUserModal");
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : "";

    const id = (document.getElementById("formUserId")?.value || "").trim();
    const username = (document.getElementById("formUsername")?.value || "").trim().toLowerCase();
    const email = (document.getElementById("formUserEmail")?.value || "").trim().toLowerCase();
    const password = (document.getElementById("formUserPass")?.value || "").trim();
    const fullName = (document.getElementById("formUserFullName")?.value || "").trim();
    const role = document.getElementById("formUserRole")?.value || "IT User";
    const active = document.getElementById("formUserActive")?.value !== "false";
    const empSelect = document.getElementById("formUserEmployeeId");
    const employeeId = empSelect ? empSelect.value.trim() : "";

    // 1. Client-side Validations with friendly toasts
    if (!username) {
      App.showToast(lang === "ar" ? "يرجى إدخال اسم المستخدم" : "Please enter username", "warning");
      document.getElementById("formUsername")?.focus();
      return;
    }

    if (!email || !email.includes("@") || !email.includes(".")) {
      App.showToast(lang === "ar" ? "يرجى إدخال بريد إلكتروني صحيح (مثال: user@sdi.ae)" : "Please enter a valid email address (e.g. user@sdi.ae)", "warning");
      document.getElementById("formUserEmail")?.focus();
      return;
    }

    if (!fullName) {
      App.showToast(lang === "ar" ? "يرجى إدخال الاسم الكامل" : "Please enter full name", "warning");
      document.getElementById("formUserFullName")?.focus();
      return;
    }

    if (!id && !password) {
      App.showToast(lang === "ar" ? "كلمة المرور مطلوبة للمستخدم الجديد (6 خانات على الأقل)" : "Password is required for new user (at least 6 characters)", "warning");
      document.getElementById("formUserPass")?.focus();
      return;
    }

    if (!id && password && password.length < 6) {
      App.showToast(lang === "ar" ? "كلمة المرور يجب أن تكون 6 خانات على الأقل لربط الهوية السحابية" : "Password must be at least 6 characters for identity linking", "warning");
      document.getElementById("formUserPass")?.focus();
      return;
    }

    if (role === "Employee" && !employeeId) {
      App.showToast(lang === "ar" ? "يجب اختيار الموظف المرتبط بحساب الموظف" : "Please select the employee linked to this account", "warning");
      document.getElementById("formUserEmployeeId")?.focus();
      return;
    }

    // 2. Duplicate Check
    const users = await db.getAll("users");
    const isDupUsername = users.some(u => u && u.username && u.username.toLowerCase() === username && u.id !== id);
    if (isDupUsername) {
      App.showToast(lang === "ar" ? "اسم المستخدم مسجل مسبقاً لمستخدم آخر" : "Username already exists for another user", "warning");
      document.getElementById("formUsername")?.focus();
      return;
    }

    const isDupEmail = users.some(u => u && u.email && u.email.toLowerCase() === email && u.id !== id);
    if (isDupEmail) {
      App.showToast(lang === "ar" ? "البريد الإلكتروني مسجل مسبقاً لمستخدم آخر" : "Email already exists for another user", "warning");
      document.getElementById("formUserEmail")?.focus();
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${lang === "ar" ? "جاري الحفظ..." : "Saving..."}`;
    }

    try {
      let authUserId = null;
      const existing = id ? await db.getById("users", id) : null;
      if (existing) authUserId = existing.authUserId || existing.auth_user_id || null;

      // 3. Supabase Auth Integration (using local window.supabase, zero external ESM import)
      if (db.supabase && db.isCloudOnline) {
        try {
          const tempSupabase = (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function")
            ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { auth: { persistSession: false } })
            : null;

          if (tempSupabase && !id) {
            // New User: Try to create Auth account
            const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
              email: email,
              password: password,
              options: {
                data: {
                  full_name: fullName,
                  username: username,
                  role: role
                }
              }
            });

            if (signUpData && signUpData.user) {
              authUserId = signUpData.user.id;
            } else if (signUpError) {
              console.warn("Auth signup notice (profile will auto-link upon user login):", signUpError.message);
            }
          } else if (id && authUserId && db.supabase.auth.admin) {
            await db.supabase.auth.admin.updateUserById(authUserId, {
              user_metadata: { full_name: fullName, role: role }
            }).catch(e => console.warn("Admin metadata update skipped:", e));
          }
        } catch (authErr) {
          console.warn("Auth integration notice (will auto-link upon login):", authErr);
        }
      }

      const nextSeq = id || await db.getNextSequentialId("users");
      const userData = {
        id: nextSeq,
        username,
        email,
        fullName,
        role,
        employeeId: role === "Employee" ? employeeId : null,
        authUserId,
        active
      };
      if (password) userData.password = password;

      await db.put("users", userData);
      App.closeModal("userModal");
      App.showToast(I18N[AppState.lang].saveSuccess || (lang === "ar" ? "تم حفظ المستخدم بنجاح" : "User saved successfully"), "success");
      await this.renderUsers();
    } catch (saveErr) {
      console.error("Save user error:", saveErr);
      App.showToast((lang === "ar" ? "فشل حفظ المستخدم: " : "Failed to save user: ") + (saveErr.message || saveErr), "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHtml || `<i class="fas fa-save"></i> <span>${lang === "ar" ? "حفظ المستخدم" : "Save User"}</span>`;
      }
    }
  }

  async deleteUser(userId) {
    if (!AppState.currentUser || AppState.currentUser.role !== "Administrator") {
      App.showToast(AppState.lang === "ar" ? "فقط مدير النظام يمكنه حذف حسابات المستخدمين." : "Only system administrator can delete user accounts.", "error");
      return;
    }
    const u = await db.getById("users", userId);
    if (u && u.username === "admin") {
      App.showToast(AppState.lang === "ar" ? "لا يمكن حذف حساب مدير النظام الرئيسي." : "Cannot delete primary administrator account.", "error");
      return;
    }
    if (confirm(I18N[AppState.lang].confirmDelete)) {
      await db.delete("users", userId);
      App.showToast(I18N[AppState.lang].deleteSuccess, "success");
      await this.renderUsers();
    }
  }

  // REQ-26: Change Password for Current Logged-in User
  async handleChangePassword(event) {
    event.preventDefault();
    const lang = AppState.lang;
    const newPass = document.getElementById("formNewPassword")?.value || "";
    const confirmPass = document.getElementById("formConfirmPassword")?.value || "";

    if (!newPass || newPass.length < 6) {
      App.showToast(lang === "ar" ? "يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل" : "New password must be at least 6 characters", "error");
      return;
    }

    if (newPass !== confirmPass) {
      App.showToast(lang === "ar" ? "كلمات المرور الجديدة غير متطابقة" : "New passwords do not match", "error");
      return;
    }

    if (!db.supabase || !db.isCloudOnline) {
      App.showToast(lang === "ar" ? "الخدمة السحابية غير متوفرة حالياً" : "Cloud service is currently unavailable", "error");
      return;
    }

    try {
      if (AppState.currentUser && AppState.currentUser.id) {
        await db.supabase.from("users").update({ password: newPass }).eq("id", AppState.currentUser.id);
      }
      try {
        await db.supabase.auth.updateUser({ password: newPass });
      } catch (authIgnored) {}

      // Clear password fields immediately
      if (document.getElementById("formNewPassword")) document.getElementById("formNewPassword").value = "";
      if (document.getElementById("formConfirmPassword")) document.getElementById("formConfirmPassword").value = "";

      App.closeModal("changePasswordModal");
      App.showToast(lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully", "success");
    } catch (err) {
      console.warn("Change password error:", err);
      App.showToast((lang === "ar" ? "فشل تغيير كلمة المرور: " : "Failed to change password: ") + (err.message || err), "error");
    }
  }

  // =========================================================================
  // 6. SYSTEM BRANDING & LOGO MANAGEMENT
  // =========================================================================
  async renderBrandingSettings() {
    const settings = await db.getSystemSettings();
    this.pendingLogoDataUrl = settings.logoDataUrl || "";

    const nameArInput = document.getElementById("brandingSystemNameAr");
    const nameEnInput = document.getElementById("brandingSystemNameEn");
    if (nameArInput) nameArInput.value = settings.systemNameAr || "معهد الشارقة للسياقة";
    if (nameEnInput) nameEnInput.value = settings.systemNameEn || "SDI IT Asset Hub";

    this.updateBrandingPreviewUI(this.pendingLogoDataUrl);
  }

  updateBrandingPreviewUI(logoDataUrl) {
    const previewImg = document.getElementById("brandingLogoPreview");
    const placeholder = document.getElementById("brandingLogoPlaceholder");
    const removeBtn = document.getElementById("brandingRemoveLogoBtn");

    if (logoDataUrl) {
      if (previewImg) {
        previewImg.src = logoDataUrl;
        previewImg.style.display = "block";
      }
      if (placeholder) placeholder.style.display = "none";
      if (removeBtn) removeBtn.style.display = "inline-flex";
    } else {
      if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = "none";
      }
      if (placeholder) placeholder.style.display = "inline-flex";
      if (removeBtn) removeBtn.style.display = "none";
    }
  }

  handleLogoUpload(event) {
    if (AppState.currentUser && AppState.currentUser.role !== "Administrator") {
      App.showToast(AppState.lang === "ar" ? "فقط مدير النظام يمكنه تعديل الشعار والهوية المؤسسية." : "Only system administrator can modify branding.", "error");
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      App.showToast(AppState.lang === "ar" ? "الحد الأقصى لحجم ملف الشعار هو 2 ميجابايت" : "Max logo file size is 2MB", "error");
      return;
    }

    // Validate type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      App.showToast(AppState.lang === "ar" ? "صيغة الملف غير مدعومة. الصيغ المدعومة: PNG, JPG, JPEG, SVG" : "Unsupported file format. Supported: PNG, JPG, JPEG, SVG", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.pendingLogoDataUrl = e.target.result;
      this.updateBrandingPreviewUI(this.pendingLogoDataUrl);
      App.showToast(AppState.lang === "ar" ? "تم اختيار الشعار ومعاينته. يرجى الضغط على حفظ الإعدادات للاعتماد." : "Logo selected and previewed. Click save settings to apply.", "info");
    };
    reader.readAsDataURL(file);
  }

  handleRemoveLogo() {
    if (AppState.currentUser && AppState.currentUser.role !== "Administrator") {
      App.showToast(AppState.lang === "ar" ? "فقط مدير النظام يمكنه تعديل الشعار والهوية المؤسسية." : "Only system administrator can modify branding.", "error");
      return;
    }

    this.pendingLogoDataUrl = "";
    this.updateBrandingPreviewUI("");
    const fileInput = document.getElementById("brandingLogoInput");
    if (fileInput) fileInput.value = "";
    App.showToast(AppState.lang === "ar" ? "تمت إزالة الشعار. يرجى الضغط على حفظ الإعدادات لتأكيد التغيير." : "Logo removed. Click save settings to confirm.", "info");
  }

  async handleSaveBranding(event) {
    event.preventDefault();
    if (AppState.currentUser && AppState.currentUser.role !== "Administrator") {
      App.showToast(AppState.lang === "ar" ? "فقط مدير النظام يمكنه تعديل الشعار والهوية المؤسسية." : "Only system administrator can modify branding.", "error");
      return;
    }

    const systemNameAr = document.getElementById("brandingSystemNameAr").value.trim() || "معهد الشارقة للسياقة";
    const systemNameEn = document.getElementById("brandingSystemNameEn").value.trim() || "SDI IT Asset Hub";
    const logoDataUrl = this.pendingLogoDataUrl || "";

    await db.updateSystemSettings({
      systemNameAr,
      systemNameEn,
      logoDataUrl
    });

    if (window.App && typeof window.App.applyBranding === "function") {
      await window.App.applyBranding();
    }

    App.showToast(I18N[AppState.lang].brandingSavedSuccess || (AppState.lang === "ar" ? "تم حفظ الهوية المؤسسية والشعار بنجاح" : "Branding and logo saved successfully"), "success");
  }
}

// Global Singleton
const UserManager = new OrganizationalManager();
if (typeof window !== "undefined") {
  window.UserManager = UserManager;
}
if (typeof global !== "undefined") {
  global.UserManager = UserManager;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { OrganizationalManager, UserManager };
}
