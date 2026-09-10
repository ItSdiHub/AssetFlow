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
    const lang = AppState.lang;

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
      const empName = lang === "ar" ? emp.nameAr : (emp.nameEn || emp.nameAr);
      const deptName = deptMap[emp.departmentId] || "-";
      const assetCount = assignedMap[emp.id] || 0;
      const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

      html += `
        <tr>
          <td><span class="emp-id-badge">${emp.id || "-"}</span></td>
          <td><span class="font-bold">${emp.employeeNumber || "-"}</span></td>
          <td>
            <div class="staff-profile-cell">
              <div class="staff-avatar-circle"><i class="fas fa-user-tie"></i></div>
              <div>
                <div class="font-bold">${empName}</div>
                ${emp.nameEn && lang === 'ar' ? `<div class="text-muted text-xs">${emp.nameEn}</div>` : ''}
              </div>
            </div>
          </td>
          <td><i class="fas fa-building text-primary"></i> ${deptName}</td>
          <td>${emp.phone ? `<a href="tel:${emp.phone}">${emp.phone}</a>` : '-'}</td>
          <td>${emp.email ? `<a href="mailto:${emp.email}">${emp.email}</a>` : '-'}</td>
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

  async openEmployeeModal(empId = null) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }

    const modal = document.getElementById("employeeModal");
    const title = document.getElementById("employeeModalTitle");
    const form = document.getElementById("employeeModalForm");
    const deptSelect = document.getElementById("formEmpDept");

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

  async handleSaveEmployee(event) {
    event.preventDefault();
    const nextSeq = await db.getNextSequentialId("employees");
    const id = document.getElementById("formEmpId").value || nextSeq;
    const orgNumVal = (document.getElementById("formEmpOrgNumber")?.value || "").trim();
    const empNumVal = (document.getElementById("formEmpNumber")?.value || "").trim();
    const empNumber = orgNumVal || empNumVal;
    const deptId = document.getElementById("formEmpDept").value;
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

    const empData = {
      id: id,
      employeeNumber: empNumber,
      departmentId: deptId,
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

  async deleteEmployee(empId) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
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
    form.reset();
    document.getElementById("formDeptId").value = "";

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

  async handleSaveDepartment(event) {
    event.preventDefault();
    const nextSeq = await db.getNextSequentialId("departments");
    const id = document.getElementById("formDeptId").value || nextSeq;
    const nameAr = document.getElementById("formDeptNameAr").value.trim();
    const nameEn = document.getElementById("formDeptNameEn").value.trim();
    const description = document.getElementById("formDeptDesc").value.trim();
    const active = document.getElementById("formDeptActive").value === "true";

    const deptData = {
      id: id,
      nameAr,
      nameEn: nameEn || nameAr,
      description,
      active
    };

    await db.put("departments", deptData);
    App.closeModal("departmentModal");
    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.renderDepartments();
    await AssetManager.populateDropdowns();
  }

  async deleteDepartment(deptId) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
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
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
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

    let html = "";
    users.forEach(u => {
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

      const linkedEmpText = u.employeeId && empMap[u.employeeId] ? `<br><small class="text-muted"><i class="fas fa-link"></i> ${empMap[u.employeeId]}</small>` : "";

      html += `
        <tr>
          <td><strong><i class="fas fa-user-circle"></i> ${u.username}</strong></td>
          <td>${getUserDisplayName(u, lang)}${linkedEmpText}</td>
          <td><span class="badge ${roleBadge}">${roleLabel}</span></td>
          <td>
            <span class="badge ${u.active !== false ? 'badge-success' : 'badge-danger'}">
              ${u.active !== false ? I18N[lang].statusActive : I18N[lang].statusInactive}
            </span>
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
        document.getElementById("formUserPass").value = u.password || "";
        document.getElementById("formUserFullName").value = u.fullName || "";
        document.getElementById("formUserRole").value = u.role || "IT User";
        document.getElementById("formUserActive").value = u.active !== false ? "true" : "false";
        if (empSelect) {
          empSelect.value = u.employeeId || "";
        }
      }
    } else {
      document.getElementById("userModalTitle").textContent = lang === "ar" ? "إضافة مستخدم جديد" : "Add New User";
      document.getElementById("formUserActive").value = "true";
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

  async handleSaveUser(event) {
    event.preventDefault();
    const id = document.getElementById("formUserId").value;
    const username = document.getElementById("formUsername").value.trim().toLowerCase();
    const password = document.getElementById("formUserPass").value.trim();
    const fullName = document.getElementById("formUserFullName").value.trim();
    const role = document.getElementById("formUserRole").value;
    const active = document.getElementById("formUserActive").value === "true";
    const empSelect = document.getElementById("formUserEmployeeId");
    const employeeId = empSelect ? empSelect.value : "";
    const lang = AppState.lang;

    if (role === "Employee" && !employeeId) {
      App.showToast(lang === "ar" ? "يجب ربط حساب الموظف بموظف مسجل في النظام" : "Employee account must be linked to a registered employee", "error");
      return;
    }

    const users = await db.getAll("users");
    const isDup = users.some(u => u.username.toLowerCase() === username && u.id !== id);
    if (isDup) {
      App.showToast(lang === "ar" ? "اسم المستخدم مسجل مسبقاً" : "Username already exists", "error");
      return;
    }

    const nextSeq = await db.getNextSequentialId("users");
    const userData = {
      id: id || nextSeq,
      username,
      password,
      fullName,
      role,
      employeeId: role === "Employee" ? employeeId : null,
      active
    };

    await db.put("users", userData);
    App.closeModal("userModal");
    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.renderUsers();
  }

  async deleteUser(userId) {
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
    const currentPass = document.getElementById("formCurrentPassword").value;
    const newPass = document.getElementById("formNewPassword").value;
    const confirmPass = document.getElementById("formConfirmPassword").value;
    const lang = AppState.lang;

    if (!AppState.currentUser) return;

    const user = await db.getById("users", AppState.currentUser.id);
    if (!user) {
      App.showToast(lang === "ar" ? "المستخدم غير موجود" : "User not found", "error");
      return;
    }

    if (user.password !== currentPass) {
      App.showToast(lang === "ar" ? "كلمة المرور الحالية غير صحيحة" : "Current password is incorrect", "error");
      return;
    }

    if (!newPass || newPass.length < 3) {
      App.showToast(lang === "ar" ? "يجب أن تكون كلمة المرور الجديدة 3 أحرف على الأقل" : "New password must be at least 3 characters", "error");
      return;
    }

    if (newPass !== confirmPass) {
      App.showToast(lang === "ar" ? "كلمات المرور الجديدة غير متطابقة" : "New passwords do not match", "error");
      return;
    }

    user.password = newPass;
    await db.put("users", user);
    AppState.currentUser.password = newPass;
    sessionStorage.setItem("sdi_user", JSON.stringify(AppState.currentUser));

    App.closeModal("changePasswordModal");
    App.showToast(lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully", "success");
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
window.UserManager = UserManager;
