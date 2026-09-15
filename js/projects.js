/**
 * SDI IT Asset Hub - Projects, Contractors & Integrated Asset Operations Controller
 * Pure Vanilla JavaScript ES6+ Controller
 */

// ============================================================================
// 1. CONTRACTOR MANAGEMENT CONTROLLER
// ============================================================================
class ContractorManagementController {
  constructor() {
    this.currentSearchText = "";
  }

  async render() {
    const tableBody = document.getElementById("contractorsTableBody");
    if (!tableBody) return;
    const lang = AppState.lang;
    const contractors = await db.getAll("contractors");
    const searchVal = (document.getElementById("contractorSearchInput")?.value || "").trim().toLowerCase();

    let filtered = contractors;
    if (searchVal) {
      filtered = filtered.filter(c => 
        (c.code || "").toLowerCase().includes(searchVal) ||
        (c.companyNameAr || "").toLowerCase().includes(searchVal) ||
        (c.companyNameEn || "").toLowerCase().includes(searchVal) ||
        (c.contactPerson || "").toLowerCase().includes(searchVal) ||
        (c.phone || "").toLowerCase().includes(searchVal) ||
        (c.email || "").toLowerCase().includes(searchVal)
      );
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج"}</td></tr>`;
      return;
    }

    const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

    let html = "";
    filtered.forEach(c => {
      const name = lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr);
      const statusBadge = c.active !== false
        ? `<span class="badge badge-success">${lang === "ar" ? "نشط" : "Active"}</span>`
        : `<span class="badge badge-secondary">${lang === "ar" ? "غير نشط" : "Inactive"}</span>`;

      html += `
        <tr>
          <td><code class="serial-tag">${c.code || "-"}</code></td>
          <td><strong>${name}</strong></td>
          <td>${c.contactPerson || "-"}</td>
          <td>${c.phone || "-"}</td>
          <td>${c.email || "-"}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              ${!isViewer ? `
                <button class="btn btn-xs btn-secondary" onclick="ContractorManager.openContractorModal('${c.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-xs btn-secondary text-danger" onclick="ContractorManager.deleteContractor('${c.id}')" title="${I18N[lang].btnDelete || 'حذف'}">
                  <i class="fas fa-trash"></i>
                </button>
              ` : '-'}
            </div>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
  }

  async openContractorModal(contractorId = null) {
    document.getElementById("formContractorId").value = contractorId || "";
    if (contractorId) {
      const c = await db.getById("contractors", contractorId);
      if (!c) return;
      document.getElementById("formContractorCode").value = c.code || "";
      document.getElementById("formContractorCompanyAr").value = c.companyNameAr || "";
      document.getElementById("formContractorCompanyEn").value = c.companyNameEn || "";
      document.getElementById("formContractorContact").value = c.contactPerson || "";
      document.getElementById("formContractorPhone").value = c.phone || "";
      document.getElementById("formContractorEmail").value = c.email || "";
      document.getElementById("formContractorActive").value = c.active !== false ? "true" : "false";
      document.getElementById("formContractorRemarks").value = c.remarks || "";
    } else {
      const nextCode = await db.getNextSequentialId("contractors");
      document.getElementById("formContractorCode").value = nextCode;
      document.getElementById("formContractorCompanyAr").value = "";
      document.getElementById("formContractorCompanyEn").value = "";
      document.getElementById("formContractorContact").value = "";
      document.getElementById("formContractorPhone").value = "";
      document.getElementById("formContractorEmail").value = "";
      document.getElementById("formContractorActive").value = "true";
      document.getElementById("formContractorRemarks").value = "";
    }
    App.openModal("contractorModal");
  }

  async handleContractorSubmit(event) {
    event.preventDefault();
    const nextSeq = await db.getNextSequentialId("contractors");
    const id = document.getElementById("formContractorId").value || nextSeq;
    const code = document.getElementById("formContractorCode").value.trim() || id;
    const companyNameAr = document.getElementById("formContractorCompanyAr").value.trim();
    const companyNameEn = document.getElementById("formContractorCompanyEn").value.trim();
    const contactPerson = document.getElementById("formContractorContact").value.trim();
    const phone = document.getElementById("formContractorPhone").value.trim();
    const email = document.getElementById("formContractorEmail").value.trim();
    const active = document.getElementById("formContractorActive").value === "true";
    const remarks = document.getElementById("formContractorRemarks").value.trim();

    if (!companyNameAr && !companyNameEn) {
      App.showToast(AppState.lang === "ar" ? "يرجى إدخال اسم الشركة" : "Please enter company name", "error");
      return;
    }

    const contractor = {
      id: id,
      code: code,
      companyNameAr: companyNameAr || companyNameEn,
      companyNameEn: companyNameEn || companyNameAr,
      contactPerson,
      phone,
      email,
      active,
      remarks,
      updatedAt: new Date().toISOString()
    };
    if (!id) contractor.createdAt = new Date().toISOString();

    await db.put("contractors", contractor);
    App.closeModal("contractorModal");
    App.showToast(AppState.lang === "ar" ? "تم حفظ بيانات المقاول بنجاح" : "Contractor saved successfully", "success");
    await this.render();
  }

  async deleteContractor(contractorId) {
    const projects = await db.getAll("projects");
    const used = projects.some(p => p.contractorId === contractorId);
    if (used) {
      App.showToast(AppState.lang === "ar" ? "لا يمكن حذف المقاول لأنه مرتبط بمشاريع حالية" : "Cannot delete contractor associated with existing projects", "error");
      return;
    }
    if (!confirm(AppState.lang === "ar" ? "هل أنت متأكد من حذف هذا المقاول؟" : "Are you sure you want to delete this contractor?")) return;
    await db.delete("contractors", contractorId);
    App.showToast(AppState.lang === "ar" ? "تم حذف المقاول" : "Contractor deleted", "success");
    await this.render();
  }
}

// ============================================================================
// 2. PROJECT MANAGEMENT CONTROLLER
// ============================================================================
class ProjectManagementController {
  constructor() {
    this.currentSearchText = "";
    this.currentFilterStatus = "";
    this.currentFilterContractor = "";
    this.activeDetailProjectId = null;
  }

  isOverdue(project) {
    if (!project.plannedEndDate) return false;
    if (project.status === "Completed" || project.status === "Cancelled") return false;
    const today = new Date().toISOString().slice(0, 10);
    return project.plannedEndDate < today;
  }

  async render() {
    const tableBody = document.getElementById("projectsTableBody");
    if (!tableBody) return;
    const lang = AppState.lang;

    const [projects, contractors, locations, departments, employees] = await Promise.all([
      db.getAll("projects"),
      db.getAll("contractors"),
      db.getAll("locations"),
      db.getAll("departments"),
      db.getAll("employees")
    ]);

    const contractorMap = Object.fromEntries(contractors.map(c => [c.id, lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));

    // Populate Filters
    const contractorFilter = document.getElementById("projectFilterContractor");
    if (contractorFilter && contractorFilter.options.length <= 1) {
      contractorFilter.innerHTML = `<option value="">${lang === "ar" ? "جميع المقاولين" : "All Contractors"}</option>` +
        contractors.map(c => `<option value="${c.id}">${lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)}</option>`).join("");
    }

    const locFilter = document.getElementById("projectFilterLoc");
    if (locFilter && locFilter.options.length <= 1) {
      locFilter.innerHTML = `<option value="">${lang === "ar" ? "جميع المواقع" : "All Locations"}</option>` +
        locations.filter(l => l.active !== false).map(l => `<option value="${l.id}">${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)}</option>`).join("");
    }

    const deptFilter = document.getElementById("projectFilterDept");
    if (deptFilter && deptFilter.options.length <= 1) {
      deptFilter.innerHTML = `<option value="">${lang === "ar" ? "جميع الأقسام" : "All Departments"}</option>` +
        departments.filter(d => d.active !== false).map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
    }

    const empFilter = document.getElementById("projectFilterEmp");
    if (empFilter && empFilter.options.length <= 1) {
      empFilter.innerHTML = `<option value="">${lang === "ar" ? "جميع المسؤولين" : "All Employees"}</option>` +
        employees.filter(e => e.status === "Active").map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)}</option>`).join("");
    }

    const searchVal = (document.getElementById("projectSearchInput")?.value || "").trim().toLowerCase();
    const filterStatus = document.getElementById("projectFilterStatus")?.value || "";
    const filterContractor = document.getElementById("projectFilterContractor")?.value || "";
    const filterLoc = document.getElementById("projectFilterLoc")?.value || "";
    const filterDept = document.getElementById("projectFilterDept")?.value || "";
    const filterEmp = document.getElementById("projectFilterEmp")?.value || "";
    const filterDateFrom = document.getElementById("projectFilterDateFrom")?.value || "";
    const filterDateTo = document.getElementById("projectFilterDateTo")?.value || "";

    let filtered = projects.filter(p => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterContractor && p.contractorId !== filterContractor) return false;
      if (filterLoc && p.locationId !== filterLoc) return false;
      if (filterDept && p.departmentId !== filterDept) return false;
      if (filterEmp && p.responsibleEmployeeId !== filterEmp) return false;
      if (filterDateFrom && p.startDate && p.startDate < filterDateFrom) return false;
      if (filterDateTo && p.plannedEndDate && p.plannedEndDate > filterDateTo) return false;

      if (searchVal) {
        const match = (p.projectNo || "").toLowerCase().includes(searchVal) ||
          (p.nameAr || "").toLowerCase().includes(searchVal) ||
          (p.nameEn || "").toLowerCase().includes(searchVal) ||
          (p.projectType || "").toLowerCase().includes(searchVal) ||
          (contractorMap[p.contractorId] || "").toLowerCase().includes(searchVal) ||
          (locMap[p.locationId] || "").toLowerCase().includes(searchVal) ||
          (deptMap[p.departmentId] || "").toLowerCase().includes(searchVal) ||
          (empMap[p.responsibleEmployeeId] || "").toLowerCase().includes(searchVal);
        if (!match) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج"}</td></tr>`;
      return;
    }

    const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

    let html = "";
    filtered.forEach(p => {
      const name = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
      const contractorName = contractorMap[p.contractorId] || "-";
      const locName = locMap[p.locationId] || "-";
      const overdue = this.isOverdue(p);
      const statusBadge = this.getStatusBadge(p.status, overdue);

      const progress = p.progress !== undefined ? p.progress : 0;
      const progressBar = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; min-width: 60px;">
            <div style="width: ${progress}%; height: 100%; background: ${progress >= 100 ? '#10b981' : '#f59e0b'};"></div>
          </div>
          <span style="font-size: 11px; font-weight: bold;">${progress}%</span>
        </div>
      `;

      html += `
        <tr>
          <td><code class="serial-tag">${p.projectNo || "-"}</code></td>
          <td><strong>${name}</strong><br><small class="text-muted">${p.projectType || ""}</small></td>
          <td>${contractorName}</td>
          <td><i class="fas fa-map-marker-alt text-warning"></i> ${locName}</td>
          <td>${p.startDate || "-"}</td>
          <td>${p.plannedEndDate || "-"}</td>
          <td>${progressBar}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-xs btn-primary" onclick="ProjectManager.viewProjectDetails('${p.id}')" title="${I18N[lang].viewDetails || 'عرض التفاصيل'}">
                <i class="fas fa-eye"></i>
              </button>
              ${!isViewer ? `
                <button class="btn btn-xs btn-secondary" onclick="ProjectManager.openProjectModal('${p.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-xs btn-secondary text-danger" onclick="ProjectManager.deleteProject('${p.id}')" title="${I18N[lang].btnDelete || 'حذف'}">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
  }

  getStatusBadge(status, isOverdue) {
    const lang = AppState.lang;
    let badgeClass = "badge-secondary";
    let text = status;
    switch (status) {
      case "Planning":
        badgeClass = "badge-secondary";
        text = lang === "ar" ? "تخطيط" : "Planning";
        break;
      case "Approved":
        badgeClass = "badge-primary";
        text = lang === "ar" ? "معتمد" : "Approved";
        break;
      case "In Progress":
        badgeClass = "badge-warning";
        text = lang === "ar" ? "قيد التنفيذ" : "In Progress";
        break;
      case "On Hold":
        badgeClass = "badge-danger";
        text = lang === "ar" ? "معلق" : "On Hold";
        break;
      case "Completed":
        badgeClass = "badge-success";
        text = lang === "ar" ? "مكتمل" : "Completed";
        break;
      case "Cancelled":
        badgeClass = "badge-secondary";
        text = lang === "ar" ? "ملغي" : "Cancelled";
        break;
    }

    let html = `<span class="badge ${badgeClass}">${text}</span>`;
    if (isOverdue) {
      html += ` <span class="badge badge-danger" title="${lang === 'ar' ? 'تجاوز تاريخ الانتهاء المخطط' : 'Exceeded planned end date'}">${I18N[lang].badgeOverdue || 'متأخر'}</span>`;
    }
    return html;
  }

  refreshSelectCombobox(selectEl) {
    if (!selectEl) return;
    if (typeof selectEl._syncComboboxTrigger === "function") {
      selectEl._syncComboboxTrigger();
    }
    if (typeof selectEl._populateComboboxOptions === "function") {
      selectEl._populateComboboxOptions("");
    }
    const wrapper = selectEl.closest(".combobox-wrapper");
    if (wrapper) {
      const searchInput = wrapper.querySelector(".combobox-search-input");
      if (searchInput) searchInput.value = "";
      const clearBtn = wrapper.querySelector(".combobox-search-clear");
      if (clearBtn) clearBtn.style.display = "none";
    }
  }

  async handleLocationChange(locId) {
    const lang = AppState.lang;
    const deptSelect = document.getElementById("formPrjDepartment");
    const officeSelect = document.getElementById("formPrjOffice");
    const empSelect = document.getElementById("formPrjResponsibleEmp");

    // 1. Bidirectional Safety: Clear child selections immediately
    if (deptSelect) deptSelect.value = "";
    if (officeSelect) officeSelect.value = "";
    if (empSelect) empSelect.value = "";

    // 2. Reload Department options strictly filtered by Location (Location -> Department)
    if (deptSelect) {
      if (locId) {
        const departments = await db.getAll("departments");
        const filteredDepts = departments.filter(d => 
          (d.locationId === locId || d.location_id === locId) && d.active !== false
        );

        if (filteredDepts.length > 0) {
          deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر القسم (اختياري)" : "Select Department (Optional)"} --</option>` +
            filteredDepts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)} ${d.code ? `(${d.code})` : ""}</option>`).join("");
        } else {
          deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "لا توجد أقسام مسجلة لهذا الموقع" : "No departments for this location"} --</option>`;
        }
      } else {
        deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الموقع أولاً" : "Select Location First"} --</option>`;
      }
      this.refreshSelectCombobox(deptSelect);
    }

    // 3. Clear and reset Office options
    if (officeSelect) {
      officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر القسم أولاً" : "Select Department First"} --</option>`;
      this.refreshSelectCombobox(officeSelect);
    }

    // 4. Clear and reset Employee options
    if (empSelect) {
      empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب أولاً" : "Select Office First"} --</option>`;
      this.refreshSelectCombobox(empSelect);
    }
  }

  async handleDeptChange(deptId) {
    const lang = AppState.lang;
    const locSelect = document.getElementById("formPrjLocation");
    const deptSelect = document.getElementById("formPrjDepartment");
    const officeSelect = document.getElementById("formPrjOffice");
    const empSelect = document.getElementById("formPrjResponsibleEmp");

    const locId = locSelect ? locSelect.value : "";

    // 1. Bidirectional Safety: Clear child selections immediately
    if (officeSelect) officeSelect.value = "";
    if (empSelect) empSelect.value = "";

    // 2. Reload Office options strictly where:
    // office.department_id = selectedDepartmentId AND office.location_id = selectedLocationId
    if (officeSelect) {
      if (deptId && locId) {
        const offices = await db.getAll("offices");
        const filteredOffices = offices.filter(o => {
          const matchDept = (o.department_id === deptId || o.departmentId === deptId);
          const matchLoc = (o.location_id === locId || o.locationId === locId);
          const active = o.status !== "Inactive";
          return matchDept && matchLoc && active;
        });

        if (filteredOffices.length > 0) {
          officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب (اختياري)" : "Select Office (Optional)"} --</option>` +
            filteredOffices.map(o => `<option value="${o.id}">${lang === "ar" ? o.nameAr : (o.nameEn || o.nameAr)} ${o.code ? `(${o.code})` : ""}</option>`).join("");
        } else {
          officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "لا توجد مكاتب مسجلة لهذا القسم والموقع" : "No offices for this department & location"} --</option>`;
        }
      } else {
        officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? (locId ? "اختر القسم أولاً" : "اختر الموقع أولاً") : (locId ? "Select Department First" : "Select Location First")} --</option>`;
      }
      this.refreshSelectCombobox(officeSelect);
    }

    // 3. Clear and reset Employee options
    if (empSelect) {
      empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب أولاً" : "Select Office First"} --</option>`;
      this.refreshSelectCombobox(empSelect);
    }
  }

  async handleOfficeChange(officeId) {
    const lang = AppState.lang;
    const locSelect = document.getElementById("formPrjLocation");
    const deptSelect = document.getElementById("formPrjDepartment");
    const empSelect = document.getElementById("formPrjResponsibleEmp");

    const locId = locSelect ? locSelect.value : "";
    const deptId = deptSelect ? deptSelect.value : "";

    // 1. Bidirectional Safety: Clear child selection immediately
    if (empSelect) empSelect.value = "";

    // 2. Reload Employee options strictly where:
    // employees.office_id = selectedOfficeId AND compatible with location & department
    if (empSelect) {
      if (officeId) {
        const employees = await db.getAll("employees");
        const filteredEmps = employees.filter(e => {
          if (e.status && e.status !== "Active") return false;
          // Must belong to selected office
          const empOffice = e.office_id || e.officeId;
          if (empOffice !== officeId) return false;
          // Must be compatible with department if set
          const empDept = e.department_id || e.departmentId;
          if (deptId && empDept && empDept !== deptId) return false;
          // Must be compatible with location if set
          const empLoc = e.location_id || e.locationId;
          if (locId && empLoc && empLoc !== locId) return false;
          return true;
        });

        if (filteredEmps.length > 0) {
          empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر مسؤول المشروع (IT)" : "Select Responsible IT Employee"} --</option>` +
            filteredEmps.map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} ${e.jobTitle ? `(${e.jobTitle})` : ""}</option>`).join("");
        } else {
          empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "لا يوجد موظفون مسجلون في هذا المكتب" : "No employees registered in this office"} --</option>`;
        }
      } else {
        empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب أولاً" : "Select Office First"} --</option>`;
      }
      this.refreshSelectCombobox(empSelect);
    }
  }

  async openProjectModal(projectId = null) {
    const lang = AppState.lang;
    const [contractors, locations, departments, offices, employees] = await Promise.all([
      db.getAll("contractors"),
      db.getAll("locations"),
      db.getAll("departments"),
      db.getAll("offices"),
      db.getAll("employees")
    ]);

    const contractorSelect = document.getElementById("formPrjContractor");
    if (contractorSelect) {
      contractorSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المقاول (اختياري)" : "Select Contractor (Optional)"} --</option>` +
        contractors.filter(c => c.active !== false)
          .map(c => `<option value="${c.id}">${lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)}</option>`).join("");
    }

    const locSelect = document.getElementById("formPrjLocation");
    const deptSelect = document.getElementById("formPrjDepartment");
    const officeSelect = document.getElementById("formPrjOffice");
    const empSelect = document.getElementById("formPrjResponsibleEmp");

    // Populate Locations (Root of hierarchy)
    const activeLocs = locations.filter(l => l.active !== false);
    if (locSelect) {
      locSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الموقع (إلزامي)" : "Select Location (Mandatory)"} --</option>` +
        activeLocs.map(l => `<option value="${l.id}">${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)} ${l.code ? `(${l.code})` : ""}</option>`).join("");
    }

    document.getElementById("formProjectId").value = projectId || "";

    if (projectId) {
      // EDIT MODE
      const p = await db.getById("projects", projectId);
      if (!p) return;

      document.getElementById("formPrjNumber").value = p.projectNo || "";
      document.getElementById("formPrjNameAr").value = p.nameAr || "";
      document.getElementById("formPrjNameEn").value = p.nameEn || "";
      document.getElementById("formPrjType").value = p.projectType || "";
      document.getElementById("formPrjStartDate").value = p.startDate || "";
      document.getElementById("formPrjPlannedEndDate").value = p.plannedEndDate || "";
      document.getElementById("formPrjActualEndDate").value = p.actualEndDate || "";
      if (contractorSelect) contractorSelect.value = p.contractorId || "";
      document.getElementById("formPrjStatus").value = p.status || "In Progress";
      document.getElementById("formPrjRemarks").value = p.remarks || "";

      // Dependency order: Location -> Department -> Office -> Employee
      const pLocId = p.locationId || "";
      const pDeptId = p.departmentId || "";
      const pOfficeId = p.office || p.officeId || "";
      const pEmpId = p.responsibleEmployeeId || "";

      // 1. Location
      if (locSelect) {
        if (pLocId && !activeLocs.some(l => l.id === pLocId)) {
          const oldLoc = locations.find(l => l.id === pLocId);
          const locName = oldLoc ? (lang === "ar" ? oldLoc.nameAr : (oldLoc.nameEn || oldLoc.nameAr)) : pLocId;
          locSelect.insertAdjacentHTML("beforeend", `<option value="${pLocId}">${locName}</option>`);
        }
        locSelect.value = pLocId;
      }

      // 2. Department
      let validDepts = [];
      if (pLocId) {
        validDepts = departments.filter(d => (d.locationId === pLocId || d.location_id === pLocId) && d.active !== false);
      }

      if (deptSelect) {
        if (pLocId) {
          let deptOptionsHtml = `<option value="">-- ${lang === "ar" ? "اختر القسم (اختياري)" : "Select Department (Optional)"} --</option>` +
            validDepts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)} ${d.code ? `(${d.code})` : ""}</option>`).join("");
          
          const isDeptConsistent = pDeptId && validDepts.some(d => d.id === pDeptId);
          if (pDeptId && !isDeptConsistent) {
            // Legacy / invalid relationship: show unresolved/invalid in UI without inventing correction
            const dObj = departments.find(d => d.id === pDeptId);
            const dName = dObj ? (lang === "ar" ? dObj.nameAr : (dObj.nameEn || dObj.nameAr)) : pDeptId;
            deptOptionsHtml += `<option value="${pDeptId}" class="text-danger" style="color: #ef4444;" selected>⚠️ [${lang === 'ar' ? 'غير مطابق للموقع' : 'Inconsistent with Location'}] ${dName}</option>`;
          }
          deptSelect.innerHTML = deptOptionsHtml;
          deptSelect.value = pDeptId;
        } else {
          if (pDeptId) {
            const dObj = departments.find(d => d.id === pDeptId);
            const dName = dObj ? (lang === "ar" ? dObj.nameAr : (dObj.nameEn || dObj.nameAr)) : pDeptId;
            deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الموقع أولاً" : "Select Location First"} --</option>` +
              `<option value="${pDeptId}" class="text-danger" style="color: #ef4444;" selected>⚠️ [${lang === 'ar' ? 'قسم بدون موقع' : 'Department without Location'}] ${dName}</option>`;
            deptSelect.value = pDeptId;
          } else {
            deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الموقع أولاً" : "Select Location First"} --</option>`;
            deptSelect.value = "";
          }
        }
      }

      // 3. Office
      const curDeptId = deptSelect ? deptSelect.value : "";
      let validOffices = [];
      if (pLocId && curDeptId) {
        validOffices = offices.filter(o => 
          (o.department_id === curDeptId || o.departmentId === curDeptId) &&
          (o.location_id === pLocId || o.locationId === pLocId) &&
          o.status !== "Inactive"
        );
      }

      if (officeSelect) {
        if (pLocId && curDeptId) {
          let offOptionsHtml = `<option value="">-- ${lang === "ar" ? "اختر المكتب (اختياري)" : "Select Office (Optional)"} --</option>` +
            validOffices.map(o => `<option value="${o.id}">${lang === "ar" ? o.nameAr : (o.nameEn || o.nameAr)} ${o.code ? `(${o.code})` : ""}</option>`).join("");
          
          const isOffConsistent = pOfficeId && validOffices.some(o => o.id === pOfficeId);
          if (pOfficeId && !isOffConsistent) {
            const oObj = offices.find(o => o.id === pOfficeId);
            const oName = oObj ? (lang === "ar" ? oObj.nameAr : (oObj.nameEn || oObj.nameAr)) : pOfficeId;
            offOptionsHtml += `<option value="${pOfficeId}" class="text-danger" style="color: #ef4444;" selected>⚠️ [${lang === 'ar' ? 'مكتب غير مطابق' : 'Inconsistent Office'}] ${oName}</option>`;
          }
          officeSelect.innerHTML = offOptionsHtml;
          officeSelect.value = pOfficeId;
        } else {
          if (pOfficeId) {
            const oObj = offices.find(o => o.id === pOfficeId);
            const oName = oObj ? (lang === "ar" ? oObj.nameAr : (oObj.nameEn || oObj.nameAr)) : pOfficeId;
            officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر القسم أولاً" : "Select Department First"} --</option>` +
              `<option value="${pOfficeId}" class="text-danger" style="color: #ef4444;" selected>⚠️ [${lang === 'ar' ? 'مكتب غير مطابق' : 'Inconsistent Office'}] ${oName}</option>`;
            officeSelect.value = pOfficeId;
          } else {
            officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر القسم أولاً" : "Select Department First"} --</option>`;
            officeSelect.value = "";
          }
        }
      }

      // 4. Employee
      const curOfficeId = officeSelect ? officeSelect.value : "";
      let validEmps = [];
      if (curOfficeId) {
        validEmps = employees.filter(e => {
          if (e.status && e.status !== "Active") return false;
          const empOffice = e.office_id || e.officeId;
          if (empOffice !== curOfficeId) return false;
          const empDept = e.department_id || e.departmentId;
          if (curDeptId && empDept && empDept !== curDeptId) return false;
          const empLoc = e.location_id || e.locationId;
          if (pLocId && empLoc && empLoc !== pLocId) return false;
          return true;
        });
      }

      if (empSelect) {
        if (curOfficeId) {
          let empOptionsHtml = `<option value="">-- ${lang === "ar" ? "اختر مسؤول المشروع (IT)" : "Select Responsible IT Employee"} --</option>` +
            validEmps.map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} ${e.jobTitle ? `(${e.jobTitle})` : ""}</option>`).join("");
          
          const isEmpConsistent = pEmpId && validEmps.some(e => e.id === pEmpId);
          if (pEmpId && !isEmpConsistent) {
            const eObj = employees.find(e => e.id === pEmpId);
            const eName = eObj ? (lang === "ar" ? eObj.nameAr : (eObj.nameEn || eObj.nameAr)) : pEmpId;
            empOptionsHtml += `<option value="${pEmpId}" class="text-danger" style="color: #ef4444;" selected>⚠️ [${lang === 'ar' ? 'موظف غير مطابق للمكتب' : 'Inconsistent Employee'}] ${eName}</option>`;
          }
          empSelect.innerHTML = empOptionsHtml;
          empSelect.value = pEmpId;
        } else {
          if (pEmpId) {
            const eObj = employees.find(e => e.id === pEmpId);
            const eName = eObj ? (lang === "ar" ? eObj.nameAr : (eObj.nameEn || eObj.nameAr)) : pEmpId;
            empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب أولاً" : "Select Office First"} --</option>` +
              `<option value="${pEmpId}" class="text-danger" style="color: #ef4444;" selected>⚠️ [${lang === 'ar' ? 'موظف بدون مكتب مطابق' : 'Employee without Office'}] ${eName}</option>`;
            empSelect.value = pEmpId;
          } else {
            empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب أولاً" : "Select Office First"} --</option>`;
            empSelect.value = "";
          }
        }
      }

      const allTasks = await db.getAll("projectTasks");
      const projectTasks = allTasks.filter(t => t.projectId === projectId);
      const computedProg = this.calculateProjectProgress(p, projectTasks);
      this.updateProjectModalProgressUI(computedProg, p.status || "In Progress", projectTasks.length);

    } else {
      // NEW PROJECT MODE
      const nextNo = await db.getNextSequentialId("projects");
      document.getElementById("formPrjNumber").value = nextNo;
      document.getElementById("formPrjNameAr").value = "";
      document.getElementById("formPrjNameEn").value = "";
      document.getElementById("formPrjType").value = "";
      document.getElementById("formPrjStartDate").value = new Date().toISOString().slice(0, 10);
      document.getElementById("formPrjPlannedEndDate").value = "";
      document.getElementById("formPrjActualEndDate").value = "";
      if (contractorSelect) contractorSelect.value = "";
      document.getElementById("formPrjLocation").value = "";
      
      if (deptSelect) {
        deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الموقع أولاً" : "Select Location First"} --</option>`;
        deptSelect.value = "";
      }
      if (officeSelect) {
        officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر القسم أولاً" : "Select Department First"} --</option>`;
        officeSelect.value = "";
      }
      if (empSelect) {
        empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب أولاً" : "Select Office First"} --</option>`;
        empSelect.value = "";
      }
      document.getElementById("formPrjStatus").value = "Planning";
      document.getElementById("formPrjRemarks").value = "";

      const initialProg = this.calculateProjectProgress({ status: "Planning" }, []);
      this.updateProjectModalProgressUI(initialProg, "Planning", 0);
    }

    // Refresh searchable combobox UI for all cascading elements
    this.refreshSelectCombobox(contractorSelect);
    this.refreshSelectCombobox(locSelect);
    this.refreshSelectCombobox(deptSelect);
    this.refreshSelectCombobox(officeSelect);
    this.refreshSelectCombobox(empSelect);

    // Attach real-time status change listener to auto-calculate progress immediately
    const statusSelect = document.getElementById("formPrjStatus");
    if (statusSelect && !statusSelect._autoProgressListenerAttached) {
      statusSelect._autoProgressListenerAttached = true;
      statusSelect.addEventListener("change", async () => {
        const curStatus = statusSelect.value;
        const curId = document.getElementById("formProjectId").value;
        let pTasks = [];
        if (curId) {
          const allTasks = await db.getAll("projectTasks");
          pTasks = allTasks.filter(t => t.projectId === curId);
        }
        const prog = this.calculateProjectProgress({ status: curStatus }, pTasks);
        this.updateProjectModalProgressUI(prog, curStatus, pTasks.length);
      });
    }

    App.openModal("projectModal");
  }

  /**
   * Automatic Project Progress Calculator
   * Determines progress percentage automatically from:
   * 1. Average progress of active tasks (if project has tasks)
   * 2. Institutional project stage/phase defaults (if no granular tasks exist)
   */
  calculateProjectProgress(project, tasks = []) {
    const status = (project && project.status) || "Planning";
    if (status === "Completed") return 100;
    if (status === "Cancelled") return 0;

    if (tasks && tasks.length > 0) {
      const sum = tasks.reduce((acc, t) => {
        let p = t.progress !== undefined ? parseInt(t.progress, 10) : 0;
        if (t.status === "Completed") p = 100;
        else if (t.status === "In Progress" && (!p || p === 0)) p = 50;
        return acc + (isNaN(p) ? 0 : p);
      }, 0);
      return Math.min(100, Math.max(0, Math.round(sum / tasks.length)));
    }

    // Default stage/phase-based calculation when no individual tasks exist
    switch (status) {
      case "Planning": return 15;
      case "Approved": return 30;
      case "In Progress": return 50;
      case "On Hold": return (project && project.progress) ? project.progress : 50;
      default: return 20;
    }
  }

  updateProjectModalProgressUI(progress, status, tasksCount = 0) {
    const progInput = document.getElementById("formPrjProgress");
    if (progInput) progInput.value = progress;

    const fill = document.getElementById("formPrjProgressBarFill");
    if (fill) {
      fill.style.width = `${progress}%`;
      fill.style.background = progress >= 100 ? "#10b981" : (progress <= 20 ? "#3b82f6" : "#f59e0b");
    }

    const badge = document.getElementById("formPrjProgressBadge");
    if (badge) {
      const isAr = AppState.lang === "ar";
      if (tasksCount > 0) {
        badge.textContent = isAr ? `محسوب تلقائياً من ${tasksCount} مهام` : `Auto calculated from ${tasksCount} tasks`;
      } else {
        const stageNamesAr = {
          Planning: "التخطيط 15%",
          Approved: "الاعتماد 30%",
          "In Progress": "التنفيذ 50%",
          "On Hold": "المعلق",
          Completed: "المكتمل 100%",
          Cancelled: "الملغي 0%"
        };
        const stageStr = isAr ? (stageNamesAr[status] || status) : status;
        badge.textContent = isAr ? `محسوب تلقائياً: مرحلة ${stageStr}` : `Auto calculated: ${stageStr}`;
      }
    }
  }

  async recalculateProjectProgress(projectId) {
    if (!projectId) return 0;
    const proj = await db.getById("projects", projectId);
    if (!proj) return 0;

    const allTasks = await db.getAll("projectTasks");
    const projectTasks = allTasks.filter(t => t.projectId === projectId);
    const newProgress = this.calculateProjectProgress(proj, projectTasks);

    proj.progress = newProgress;
    if (newProgress >= 100 && proj.status === "In Progress") {
      proj.status = "Completed";
    }
    await db.put("projects", proj);
    return newProgress;
  }

  async handleProjectSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("formProjectId").value;
    const projectNo = document.getElementById("formPrjNumber").value.trim();
    const nameAr = document.getElementById("formPrjNameAr").value.trim();
    const nameEn = document.getElementById("formPrjNameEn").value.trim();
    const projectType = document.getElementById("formPrjType").value.trim();
    const startDate = document.getElementById("formPrjStartDate").value;
    const plannedEndDate = document.getElementById("formPrjPlannedEndDate").value;
    const actualEndDate = document.getElementById("formPrjActualEndDate").value || null;
    const contractorId = document.getElementById("formPrjContractor").value || null;
    const locationId = document.getElementById("formPrjLocation").value || null;
    const departmentId = document.getElementById("formPrjDepartment")?.value || null;
    const office = document.getElementById("formPrjOffice")?.value || null;
    const responsibleEmployeeId = document.getElementById("formPrjResponsibleEmp").value || null;
    let status = document.getElementById("formPrjStatus").value;
    const remarks = document.getElementById("formPrjRemarks").value.trim();

    if (!nameAr && !nameEn) {
      App.showToast(I18N[AppState.lang].errProjectNameReq || "يرجى إدخال اسم المشروع", "error");
      return;
    }

    // 1. Mandatory Location Validation (Location is root of hierarchy)
    if (!locationId) {
      App.showToast(AppState.lang === "ar" ? "يرجى اختيار موقع المشروع (إلزامي)" : "Please select project location (mandatory)", "error");
      return;
    }

    // 2. Authoritative Relationship Validation: Location -> Department
    if (departmentId) {
      const deptObj = await db.getById("departments", departmentId);
      const deptLoc = deptObj ? (deptObj.location_id || deptObj.locationId) : null;
      if (!deptObj || (deptLoc && deptLoc !== locationId)) {
        App.showToast(AppState.lang === "ar" ? "خطأ: القسم المحدد غير تابع للموقع المختار للمشروع." : "Error: Selected department does not belong to the selected location.", "error");
        return;
      }
    }

    // 3. Authoritative Relationship Validation: Department -> Office
    if (office) {
      if (!departmentId) {
        App.showToast(AppState.lang === "ar" ? "خطأ: لا يمكن اختيار مكتب دون تحديد القسم والموقع." : "Error: Cannot select an office without specifying department and location.", "error");
        return;
      }
      const offObj = await db.getById("offices", office);
      if (!offObj) {
        App.showToast(AppState.lang === "ar" ? "خطأ: المكتب المحدد غير مسجل في قاعدة البيانات." : "Error: Selected office is not registered in the database.", "error");
        return;
      }
      const offLoc = offObj.location_id || offObj.locationId;
      const offDept = offObj.department_id || offObj.departmentId;
      if ((offLoc && offLoc !== locationId) || (offDept && offDept !== departmentId)) {
        App.showToast(AppState.lang === "ar" ? "خطأ: المكتب المحدد غير تابع للقسم والموقع المختارين." : "Error: Selected office does not belong to the selected department and location.", "error");
        return;
      }
    }

    // 4. Authoritative Relationship Validation: Office -> Employee
    if (responsibleEmployeeId) {
      if (!office) {
        App.showToast(AppState.lang === "ar" ? "خطأ: لا يمكن تعيين مسؤول المشروع دون اختيار المكتب التابع له." : "Error: Cannot assign responsible employee without selecting their office.", "error");
        return;
      }
      const empObj = await db.getById("employees", responsibleEmployeeId);
      if (!empObj) {
        App.showToast(AppState.lang === "ar" ? "خطأ: الموظف المحدد غير موجود في قاعدة البيانات." : "Error: Selected employee is not in the database.", "error");
        return;
      }
      const empOff = empObj.office_id || empObj.officeId;
      if (!empOff || empOff !== office) {
        App.showToast(AppState.lang === "ar" ? "خطأ: الموظف المحدد غير تابع للمكتب المختار." : "Error: Selected employee does not belong to the selected office.", "error");
        return;
      }
      const empDept = empObj.department_id || empObj.departmentId;
      if (empDept && departmentId && empDept !== departmentId) {
        App.showToast(AppState.lang === "ar" ? "خطأ: قسم الموظف غير متطابق مع قسم المشروع." : "Error: Employee department does not match project department.", "error");
        return;
      }
      const empLoc = empObj.location_id || empObj.locationId;
      if (empLoc && locationId && empLoc !== locationId) {
        App.showToast(AppState.lang === "ar" ? "خطأ: موقع الموظف غير متطابق مع موقع المشروع." : "Error: Employee location does not match project location.", "error");
        return;
      }
    }

    if (startDate && plannedEndDate && plannedEndDate < startDate) {
      App.showToast(I18N[AppState.lang].errDateOrder || "تاريخ الانتهاء لا يمكن أن يسبق تاريخ البدء", "error");
      return;
    }

    // Auto-calculate progress based on stage and tasks
    let projectTasks = [];
    if (id) {
      const allTasks = await db.getAll("projectTasks");
      projectTasks = allTasks.filter(t => t.projectId === id);
    }
    let progress = this.calculateProjectProgress({ status }, projectTasks);

    // Synchronize status and progress
    if (status === "Completed") {
      progress = 100;
    } else if (progress >= 100 && status === "In Progress") {
      status = "Completed";
    }

    const nextSeq = await db.getNextSequentialId("projects");
    const project = {
      id: id || nextSeq,
      projectNo: projectNo || id || nextSeq,
      nameAr: nameAr || nameEn,
      nameEn: nameEn || nameAr,
      projectType,
      startDate,
      plannedEndDate,
      actualEndDate,
      contractorId,
      locationId,
      departmentId,
      office,
      responsibleEmployeeId,
      progress,
      status,
      remarks,
      updatedAt: new Date().toISOString()
    };
    if (!id) project.createdAt = new Date().toISOString();

    await db.put("projects", project);
    App.closeModal("projectModal");
    App.showToast(AppState.lang === "ar" ? "تم حفظ المشروع وتحديث نسبة الإنجاز تلقائياً" : "Project saved and progress updated automatically", "success");
    await this.render();
  }

  async deleteProject(projectId) {
    if (!confirm(AppState.lang === "ar" ? "هل أنت متأكد من حذف هذا المشروع وكافة مهامه؟" : "Are you sure you want to delete this project and its tasks?")) return;
    // Delete project tasks
    const tasks = await db.getAll("projectTasks");
    for (const t of tasks.filter(x => x.projectId === projectId)) {
      await db.delete("projectTasks", t.id);
    }
    await db.delete("projects", projectId);
    App.showToast(AppState.lang === "ar" ? "تم حذف المشروع" : "Project deleted", "success");
    await this.render();
  }

  async viewProjectDetails(projectId) {
    this.activeDetailProjectId = projectId;
    const project = await db.getById("projects", projectId);
    if (!project) return;
    const lang = AppState.lang;

    const [contractors, locations, departments, employees, tasks, issues, assets] = await Promise.all([
      db.getAll("contractors"),
      db.getAll("locations"),
      db.getAll("departments"),
      db.getAll("employees"),
      db.getAll("projectTasks"),
      db.getAll("warehouseIssues"),
      db.getAll("assets")
    ]);

    const contractor = contractors.find(c => c.id === project.contractorId);
    const loc = locations.find(l => l.id === project.locationId);
    const dept = departments.find(d => d.id === project.departmentId);
    const emp = employees.find(e => e.id === project.responsibleEmployeeId);
    const prjTasks = tasks.filter(t => t.projectId === projectId);
    const prjIssues = issues.filter(i => i.projectId === projectId);
    const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));

    const name = lang === "ar" ? project.nameAr : (project.nameEn || project.nameAr);
    const contractorName = contractor ? (lang === "ar" ? contractor.companyNameAr : (contractor.companyNameEn || contractor.companyNameAr)) : "-";
    const locName = loc ? (lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)) : "-";
    const deptName = dept ? (lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr)) : "";
    const officeStr = project.office ? `${lang === 'ar' ? 'مكتب' : 'Office'} ${project.office}` : "";
    
    const lineage = [locName, deptName, officeStr].filter(Boolean).join(" &bull; ");
    const empName = emp ? (lang === "ar" ? emp.nameAr : (emp.nameEn || emp.nameAr)) : "-";
    const overdue = this.isOverdue(project);

    document.getElementById("projectDetailsTitle").textContent = `${project.projectNo} - ${name}`;

    // 1. Info Card
    document.getElementById("pdName").textContent = name;
    document.getElementById("pdType").textContent = project.projectType || "-";
    document.getElementById("pdContractor").textContent = contractorName;
    document.getElementById("pdLocation").innerHTML = lineage || "-";
    document.getElementById("pdStartDate").textContent = project.startDate || "-";
    document.getElementById("pdEndDate").textContent = project.plannedEndDate || "-";
    document.getElementById("pdResponsible").textContent = empName;
    document.getElementById("pdStatus").innerHTML = this.getStatusBadge(project.status, overdue);
    document.getElementById("pdProgressBar").style.width = (project.progress || 0) + "%";
    document.getElementById("pdProgressText").textContent = (project.progress || 0) + "%";
    document.getElementById("pdRemarks").textContent = project.remarks || "-";

    // 2. Tasks Table
    const tasksTableBody = document.getElementById("pdTasksTableBody");
    if (prjTasks.length === 0) {
      tasksTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">${lang === 'ar' ? 'لا توجد مهام مسجلة لهذا المشروع بعد' : 'No tasks recorded for this project yet'}</td></tr>`;
    } else {
      let tasksHtml = "";
      prjTasks.forEach(t => {
        const taskName = lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr);
        const taskResp = employees.find(e => e.id === t.responsibleEmployeeId);
        const respName = taskResp ? (lang === "ar" ? taskResp.nameAr : (taskResp.nameEn || taskResp.nameAr)) : "-";
        const taskContractor = contractors.find(c => c.id === t.contractorId);
        const tContractorName = taskContractor ? (lang === "ar" ? taskContractor.companyNameAr : taskContractor.nameEn) : "-";

        tasksHtml += `
          <tr>
            <td><strong>${taskName}</strong><br><small class="text-muted">${t.description || ""}</small></td>
            <td>${t.dueDate || "-"}</td>
            <td>${respName}</td>
            <td>${tContractorName}</td>
            <td>${t.progress || 0}%</td>
            <td><span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${t.status}</span></td>
            <td>
              <button class="btn btn-xs btn-secondary" onclick="ProjectManager.openTaskModal('${projectId}', '${t.id}')"><i class="fas fa-edit"></i></button>
              <button class="btn btn-xs btn-secondary text-danger" onclick="ProjectManager.deleteTask('${t.id}', '${projectId}')"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `;
      });
      tasksTableBody.innerHTML = tasksHtml;
    }

    // 3. Associated Assets Table
    const assetsTableBody = document.getElementById("pdAssetsTableBody");
    if (prjIssues.length === 0) {
      assetsTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">${lang === 'ar' ? 'لا توجد أصول مرتبطة بهذا المشروع حتى الآن' : 'No assets linked to this project yet'}</td></tr>`;
    } else {
      let assetsHtml = "";
      prjIssues.forEach(i => {
        const a = assetMap[i.assetId] || {};
        const curLoc = locMap[a.locationId] || "-";
        assetsHtml += `
          <tr>
            <td><code class="serial-tag">${a.assetId || "-"}</code></td>
            <td><strong>${a.brand || ""} ${a.model || ""}</strong> (SN: ${a.serial || "-"})</td>
            <td>${i.issueDate || "-"}</td>
            <td><i class="fas fa-map-marker-alt text-warning"></i> ${curLoc}</td>
            <td><span class="badge ${a.status === 'Assigned' ? 'badge-success' : 'badge-warning'}">${a.status || "-"}</span></td>
          </tr>
        `;
      });
      assetsTableBody.innerHTML = assetsHtml;
    }

    App.openModal("projectDetailsModal");
  }

  async openTaskModal(projectId, taskId = null) {
    const lang = AppState.lang;
    const [employees, contractors] = await Promise.all([
      db.getAll("employees"),
      db.getAll("contractors")
    ]);

    document.getElementById("formTaskProjectId").value = projectId;
    document.getElementById("formTaskId").value = taskId || "";

    const respSelect = document.getElementById("formTaskResponsible");
    if (respSelect) {
      respSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "المسؤول (اختياري)" : "Responsible Person"} --</option>` +
        employees.filter(e => e.status === "Active")
          .map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)}</option>`).join("");
    }

    const contractorSelect = document.getElementById("formTaskContractor");
    if (contractorSelect) {
      contractorSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "المقاول المنفذ (اختياري)" : "Contractor (Optional)"} --</option>` +
        contractors.filter(c => c.active !== false)
          .map(c => `<option value="${c.id}">${lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)}</option>`).join("");
    }

    if (taskId) {
      const t = await db.getById("projectTasks", taskId);
      if (!t) return;
      document.getElementById("formTaskNameAr").value = t.nameAr || "";
      document.getElementById("formTaskNameEn").value = t.nameEn || "";
      document.getElementById("formTaskDesc").value = t.description || "";
      document.getElementById("formTaskStartDate").value = t.startDate || "";
      document.getElementById("formTaskDueDate").value = t.dueDate || "";
      document.getElementById("formTaskResponsible").value = t.responsibleEmployeeId || "";
      document.getElementById("formTaskContractor").value = t.contractorId || "";
      document.getElementById("formTaskProgress").value = t.progress !== undefined ? t.progress : 0;
      const remarksEl = document.getElementById("formTaskRemarks") || document.getElementById("formTaskDesc");
      if (remarksEl) remarksEl.value = t.remarks || "";
    } else {
      const nameArEl = document.getElementById("formTaskNameAr"); if (nameArEl) nameArEl.value = "";
      const nameEnEl = document.getElementById("formTaskNameEn"); if (nameEnEl) nameEnEl.value = "";
      const descEl = document.getElementById("formTaskDesc"); if (descEl) descEl.value = "";
      const startEl = document.getElementById("formTaskStartDate"); if (startEl) startEl.value = new Date().toISOString().slice(0, 10);
      const dueEl = document.getElementById("formTaskDueDate"); if (dueEl) dueEl.value = "";
      const respEl = document.getElementById("formTaskResponsible"); if (respEl) respEl.value = "";
      const contEl = document.getElementById("formTaskContractor"); if (contEl) contEl.value = "";
      const progEl = document.getElementById("formTaskProgress"); if (progEl) progEl.value = 0;
      const statEl = document.getElementById("formTaskStatus"); if (statEl) statEl.value = "Pending";
      const remarksEl = document.getElementById("formTaskRemarks"); if (remarksEl) remarksEl.value = "";
    }

    App.openModal("projectTaskModal");
  }

  async handleTaskSubmit(event) {
    event.preventDefault();
    const projectId = document.getElementById("formTaskProjectId").value;
    const taskId = document.getElementById("formTaskId").value;
    const nameAr = document.getElementById("formTaskNameAr")?.value.trim() || "";
    const nameEn = document.getElementById("formTaskNameEn")?.value.trim() || "";
    const description = document.getElementById("formTaskDesc")?.value.trim() || "";
    const startDate = document.getElementById("formTaskStartDate")?.value || "";
    const dueDate = document.getElementById("formTaskDueDate")?.value || "";
    const responsibleEmployeeId = document.getElementById("formTaskResponsible")?.value || null;
    const contractorId = document.getElementById("formTaskContractor")?.value || null;
    let progress = parseInt(document.getElementById("formTaskProgress")?.value, 10) || 0;
    let status = document.getElementById("formTaskStatus")?.value || "Pending";
    const remarksEl = document.getElementById("formTaskRemarks") || document.getElementById("formTaskDesc");
    const remarks = remarksEl ? remarksEl.value.trim() : "";

    if (!nameAr && !nameEn) {
      App.showToast(AppState.lang === "ar" ? "يرجى إدخال اسم المهمة" : "Please enter task name", "error");
      return;
    }

    if (status === "Completed") progress = 100;

    const nextSeq = await db.getNextSequentialId("projectTasks");
    const task = {
      id: taskId || nextSeq,
      projectId,
      nameAr: nameAr || nameEn,
      nameEn: nameEn || nameAr,
      description,
      startDate,
      dueDate,
      responsibleEmployeeId,
      contractorId,
      progress,
      status,
      remarks,
      updatedAt: new Date().toISOString()
    };
    if (!taskId) task.createdAt = new Date().toISOString();

    await db.put("projectTasks", task);

    // Auto-update project progress based on active tasks and recalculate in DB
    await this.recalculateProjectProgress(projectId);

    App.closeModal("projectTaskModal");
    App.showToast(AppState.lang === "ar" ? "تم حفظ المهمة وتحديث نسبة الإنجاز تلقائياً" : "Task saved and project progress updated", "success");
    await this.viewProjectDetails(projectId);
    await this.render();
  }

  async deleteTask(taskId, projectId) {
    if (!confirm(AppState.lang === "ar" ? "هل تريد حذف هذه المهمة؟" : "Are you sure you want to delete this task?")) return;
    await db.delete("projectTasks", taskId);
    await this.recalculateProjectProgress(projectId);
    App.showToast(AppState.lang === "ar" ? "تم حذف المهمة وتحديث نسبة الإنجاز تلقائياً" : "Task deleted and project progress updated", "success");
    await this.viewProjectDetails(projectId);
    await this.render();
  }

  resetFilters() {
    const s = document.getElementById("projectSearchInput"); if (s) s.value = "";
    const st = document.getElementById("projectFilterStatus"); if (st) st.value = "";
    const c = document.getElementById("projectFilterContractor"); if (c) c.value = "";
    const loc = document.getElementById("projectFilterLoc"); if (loc) loc.value = "";
    const dept = document.getElementById("projectFilterDept"); if (dept) dept.value = "";
    const emp = document.getElementById("projectFilterEmp"); if (emp) emp.value = "";
    const df = document.getElementById("projectFilterDateFrom"); if (df) df.value = "";
    const dt = document.getElementById("projectFilterDateTo"); if (dt) dt.value = "";
    this.render();
  }

  printProjectList() {
    window.print();
  }

  async printProjectDetails(projectId = null) {
    window.print();
  }

  async printProjectAssets(projectId = null) {
    window.print();
  }

  async printProjectTasks(projectId = null) {
    window.print();
  }
}

// ============================================================================
// 3. INTEGRATED ASSET OPERATIONS CONTROLLER (WAREHOUSE & INSTALLATION)
// ============================================================================
class AssetOperationsController {
  constructor() {
    this.currentSubTab = "awaitingInstall";
    this.currentActiveAssetId = null;
    this.currentActiveIssueId = null;
  }

  switchSubTab(tabName) {
    this.currentSubTab = tabName;
    document.querySelectorAll(".ops-subtab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-opstab") === tabName);
    });
    document.querySelectorAll(".ops-subtab-pane").forEach(pane => {
      pane.style.display = (pane.id === `ops-pane-${tabName}`) ? "block" : "none";
    });
    this.render();
  }

  async render() {
    try {
      if (this.currentSubTab === "awaitingInstall") await this.renderAwaitingInstall();
      else if (this.currentSubTab === "warehouseIssues") await this.renderWarehouseIssues();
      else if (this.currentSubTab === "installedDevices") await this.renderInstalledDevices();
      else if (this.currentSubTab === "transfers") await this.renderTransfers();
    } catch (e) {
      console.warn("[OpsManager.render] warning:", e);
    }
  }

  /**
   * Universal Searchable ComboBox Helper (Delegated to System Engine)
   */
  enhanceSelectWithSearch(selectId, defaultPlaceholder, searchPlaceholder) {
    if (window.App && typeof App.enhanceSelectWithSearch === "function") {
      return App.enhanceSelectWithSearch(selectId, defaultPlaceholder, searchPlaceholder);
    }
  }

  async renderAwaitingInstall() {
    const tableBody = document.getElementById("awaitingInstallTableBody");
    if (!tableBody) return;
    const lang = AppState.lang;
    try {

    const [assets, locations, employees, types, projects, issues] = await Promise.all([
      db.getAll("assets"),
      db.getAll("locations"),
      db.getAll("employees"),
      db.getAll("assetTypes"),
      db.getAll("projects"),
      db.getAll("warehouseIssues")
    ]);

    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));
    const prjMap = Object.fromEntries(projects.map(p => [p.id, lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));

    // Map each asset to its active "In Transit" warehouse issue
    const pendingIssuesMap = {};
    issues.filter(i => i.status === "In Transit").forEach(i => {
      pendingIssuesMap[i.assetId] = i;
    });

    const awaitingAssets = assets.filter(a => a.status === "In Transit");

    // Dynamic population of filter dropdowns if present
    const whFilter = document.getElementById("opsAwaitingFilterWarehouse");
    if (whFilter && whFilter.options.length <= 1) {
      const activeWhIds = new Set(awaitingAssets.map(a => {
        const issue = pendingIssuesMap[a.id];
        return issue ? issue.warehouseLocationId : a.locationId;
      }).filter(Boolean));
      locations.filter(l => activeWhIds.has(l.id)).forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
        whFilter.appendChild(opt);
      });
    }

    const techFilter = document.getElementById("opsAwaitingFilterTechnician");
    if (techFilter && techFilter.options.length <= 1) {
      const activeTechIds = new Set(awaitingAssets.map(a => {
        const issue = pendingIssuesMap[a.id];
        return issue ? issue.itEmployeeId : a.currentEmployeeId;
      }).filter(Boolean));
      employees.filter(e => activeTechIds.has(e.id)).forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.textContent = lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr);
        techFilter.appendChild(opt);
      });
    }

    // Filter by search text, dropdowns, and date range
    const query = (document.getElementById("opsAwaitingSearchInput")?.value || "").trim().toLowerCase();
    const selWh = whFilter?.value || "";
    const selTech = techFilter?.value || "";
    const dateFrom = document.getElementById("opsAwaitingFilterDateFrom")?.value || "";
    const dateTo = document.getElementById("opsAwaitingFilterDateTo")?.value || "";

    const filteredAssets = awaitingAssets.filter(a => {
      const issue = pendingIssuesMap[a.id] || {};
      const whId = issue.warehouseLocationId || a.locationId;
      const techId = issue.itEmployeeId || a.currentEmployeeId;
      const issueDate = issue.issueDate || a.assignmentDate || "";

      if (selWh && whId !== selWh) return false;
      if (selTech && techId !== selTech) return false;
      if (dateFrom && issueDate && issueDate < dateFrom) return false;
      if (dateTo && issueDate && issueDate > dateTo) return false;

      if (query) {
        const assetCode = (a.assetId || "").toLowerCase();
        const brand = (a.brand || "").toLowerCase();
        const model = (a.model || "").toLowerCase();
        const serial = (a.serial || "").toLowerCase();
        const issueNo = (issue.issueNo || "").toLowerCase();
        const whName = (locMap[whId] || "").toLowerCase();
        const techName = (empMap[techId] || "").toLowerCase();
        const prjName = (prjMap[issue.projectId] || "").toLowerCase();
        const typeName = (typeMap[a.assetTypeId] || "").toLowerCase();

        const match = assetCode.includes(query) || brand.includes(query) || model.includes(query) ||
                      serial.includes(query) || issueNo.includes(query) || whName.includes(query) ||
                      techName.includes(query) || prjName.includes(query) || typeName.includes(query);
        if (!match) return false;
      }
      return true;
    });

    if (filteredAssets.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">${I18N[lang].noPendingInstallations || "لا توجد أصول بانتظار التركيب حالياً"}</td></tr>`;
      return;
    }

    const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

    let html = "";
    filteredAssets.forEach(a => {
      const issue = pendingIssuesMap[a.id] || {};
      const sourceLoc = locMap[issue.warehouseLocationId || a.locationId] || "-";
      const receiver = empMap[issue.itEmployeeId || a.currentEmployeeId] || "-";
      const issueDate = issue.issueDate || a.assignmentDate || "-";
      const typeName = typeMap[a.assetTypeId] || "-";
      const issueNo = issue.issueNo || "-";

      html += `
        <tr class="clickable-awaiting-row" onclick="OpsManager.handleAwaitingRowClick(event, '${a.id}')" title="${lang === 'ar' ? 'اضغط لعرض الشجرة التفاعلية للسجل وأمر الصرف' : 'Click to toggle lineage tree'}">
          <td>
            <span class="tree-toggle-icon" id="treeToggleIcon-${a.id}" onclick="event.stopPropagation(); OpsManager.toggleAwaitingTree('${a.id}')" title="${lang === 'ar' ? 'فتح / إغلاق الشجرة' : 'Toggle Tree'}">
              <i class="fas fa-chevron-down"></i>
            </span>
            <code class="serial-tag font-bold">${a.assetId}</code>
          </td>
          <td><strong>${a.brand || ""} ${a.model || ""}</strong><br><small class="text-muted">${typeName}</small></td>
          <td><code>${a.serial || "-"}</code></td>
          <td><span class="badge badge-secondary">${issueNo}</span></td>
          <td>${issueDate}</td>
          <td><i class="fas fa-warehouse text-warning"></i> ${sourceLoc}</td>
          <td><i class="fas fa-user-cog text-primary"></i> ${receiver}</td>
          <td>
            <span class="badge badge-warning">${I18N[lang].statusInTransit || "قيد النقل / بانتظار التركيب"}</span>
            ${issue.installationStatus === 'Draft' ? `<br><small class="badge badge-info mt-1" style="font-size:10px;"><i class="fas fa-pencil-alt"></i> ${lang === 'ar' ? 'مسودة محفوظة' : 'Draft'}</small>` : ''}
          </td>
          <td>
            <div class="table-actions" style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn btn-xs btn-outline-info" onclick="event.stopPropagation(); OpsManager.openAwaitingTreeModal('${a.id}', '${issue.id || ''}')" title="${lang === 'ar' ? 'عرض شجرة السجل والارتباطات' : 'View Lineage Tree'}">
                <i class="fas fa-sitemap"></i> ${lang === 'ar' ? 'شجرة السجل' : 'Tree'}
              </button>
              ${!isViewer ? `
                <button class="btn btn-xs ${issue.installationStatus === 'Draft' ? 'btn-warning' : 'btn-success'}" onclick="event.stopPropagation(); OpsManager.openInstallationModal('${a.id}', '${issue.id || ''}')" title="${issue.installationStatus === 'Draft' ? (lang === 'ar' ? 'تعديل مسودة التركيب' : 'Edit Installation') : (I18N[lang].btnCompleteInstall || 'استكمال التركيب')}">
                  <i class="fas ${issue.installationStatus === 'Draft' ? 'fa-edit' : 'fa-wrench'}"></i> ${issue.installationStatus === 'Draft' ? (lang === 'ar' ? 'تعديل التركيب' : 'Edit') : (I18N[lang].btnCompleteInstall || 'تركيب')}
                </button>
              ` : ''}
              ${issue.id ? `
                <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); OpsManager.viewIssueDetails('${issue.id}')" title="${I18N[lang].btnViewIssue || "عرض سجل الصرف"}">
                  <i class="fas fa-file-invoice"></i>
                </button>
              ` : ''}
              <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); AssetManager.openDetailsModal('${a.id}')" title="${I18N[lang].btnViewAsset || "عرض بطاقة الأصل"}">
                <i class="fas fa-desktop"></i>
              </button>
              <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); AssetManager.openDetailsModal('${a.id}'); AssetManager.switchDetailsTab('history');" title="${I18N[lang].btnHistory || "سجل حركة الأصل"}">
                <i class="fas fa-history"></i>
              </button>
            </div>
          </td>
        </tr>
        <tr id="awaitingTreeRow-${a.id}" class="awaiting-tree-row" style="display: none;">
          <td colspan="9">
            <div id="awaitingTreeContent-${a.id}" class="awaiting-tree-container">
              <!-- Dynamically populated tree -->
            </div>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
    } catch (e) { console.warn("[OpsManager.renderAwaitingInstall] warning:", e); }
  }

  async renderWarehouseIssues() {
    const tableBody = document.getElementById("warehouseIssuesTableBody");
    if (!tableBody) return;
    const lang = AppState.lang;
    try {

    const [issues, assets, locations, employees, projects] = await Promise.all([
      db.getAll("warehouseIssues"),
      db.getAll("assets"),
      db.getAll("locations"),
      db.getAll("employees"),
      db.getAll("projects")
    ]);

    const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const prjMap = Object.fromEntries(projects.map(p => [p.id, lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));

    // Dynamic population of warehouse filter dropdown (only for active in-transit issues)
    const inTransitIssues = issues.filter(i => i.status === "In Transit");
    const whFilter = document.getElementById("wiFilterWarehouse");
    if (whFilter && whFilter.options.length <= 1) {
      const activeWhIds = new Set(inTransitIssues.map(i => i.warehouseLocationId).filter(Boolean));
      locations.filter(l => activeWhIds.has(l.id)).forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
        whFilter.appendChild(opt);
      });
    }

    const query = (document.getElementById("wiSearchInput")?.value || "").trim().toLowerCase();
    const selStatus = document.getElementById("wiFilterStatus")?.value || "";
    const selWh = whFilter?.value || "";
    const dateFrom = document.getElementById("wiFilterDateFrom")?.value || "";
    const dateTo = document.getElementById("wiFilterDateTo")?.value || "";

    const filteredIssues = issues.filter(i => {
      // Warehouse Issues Log strictly displays In Transit devices only.
      // Installed devices are displayed exclusively in Installed Devices window.
      if (i.status !== "In Transit") return false;

      const asset = assetMap[i.assetId] || {};
      const sourceLoc = locMap[i.warehouseLocationId] || "";
      const receiver = empMap[i.itEmployeeId] || "";
      const prjName = prjMap[i.projectId] || "";
      const issueDate = i.issueDate || (i.createdAt ? i.createdAt.slice(0, 10) : "");

      if (selStatus && i.status !== selStatus) return false;
      if (selWh && i.warehouseLocationId !== selWh) return false;
      if (dateFrom && issueDate && issueDate < dateFrom) return false;
      if (dateTo && issueDate && issueDate > dateTo) return false;

      if (query) {
        const issueNo = (i.issueNo || "").toLowerCase();
        const assetCode = (asset.assetId || "").toLowerCase();
        const brand = (asset.brand || "").toLowerCase();
        const model = (asset.model || "").toLowerCase();
        const serial = (asset.serial || "").toLowerCase();
        const whName = sourceLoc.toLowerCase();
        const techName = receiver.toLowerCase();
        const pName = prjName.toLowerCase();
        const notes = (i.notes || "").toLowerCase();
        const site = (i.deliverySiteName || "").toLowerCase();
        const destEmp = (i.receivingEmployeeName || "").toLowerCase();

        const match = issueNo.includes(query) || assetCode.includes(query) ||
                      brand.includes(query) || model.includes(query) || serial.includes(query) ||
                      whName.includes(query) || techName.includes(query) || pName.includes(query) ||
                      notes.includes(query) || site.includes(query) || destEmp.includes(query);
        if (!match) return false;
      }
      return true;
    });

    if (filteredIssues.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج مطابقة للبحث"}</td></tr>`;
      return;
    }

    filteredIssues.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    let html = "";
    filteredIssues.forEach(i => {
      const asset = assetMap[i.assetId] || {};
      const sourceLoc = locMap[i.warehouseLocationId] || "-";
      const receiver = empMap[i.itEmployeeId] || "-";
      const prjName = prjMap[i.projectId] || "-";
      const isInstalled = i.status === "Installed";
      const statusText = isInstalled ? (lang === "ar" ? "تم التركيب" : "Installed") : (lang === "ar" ? "قيد النقل" : "In Transit");
      const statusBadge = isInstalled ? "badge-success" : "badge-warning";

      html += `
        <tr>
          <td><code class="serial-tag font-bold">${i.issueNo || "-"}</code></td>
          <td>${i.issueDate || "-"}</td>
          <td><strong>${asset.assetId || "-"}</strong></td>
          <td>${asset.brand || ""} ${asset.model || ""}</td>
          <td>${sourceLoc}</td>
          <td>${receiver}</td>
          <td>${prjName}</td>
          <td><span class="badge ${statusBadge}">${statusText}</span></td>
          <td>
            <div class="table-actions" style="display: flex; gap: 4px;">
              <button class="btn btn-xs btn-secondary" onclick="OpsManager.viewIssueDetails('${i.id}')" title="${I18N[lang].btnView || "عرض تفاصيل الصرف"}">
                <i class="fas fa-eye"></i>
              </button>
              ${!isInstalled ? `
                <button class="btn btn-xs btn-success" onclick="OpsManager.openInstallationModal('${i.assetId}', '${i.id}')" title="${I18N[lang].btnCompleteInstall || "استكمال التركيب"}">
                  <i class="fas fa-wrench"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
    } catch (e) { console.warn("[OpsManager.renderWarehouseIssues] warning:", e); }
  }

  async renderTransfers() {
    const tableBody = document.getElementById("assetTransfersTableBody");
    if (!tableBody) return;
    const lang = AppState.lang;
    try {

    const [transfers, assets, locations, employees] = await Promise.all([
      db.getAll("assetTransfers"),
      db.getAll("assets"),
      db.getAll("locations"),
      db.getAll("employees")
    ]);

    const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));

    // Dynamic population of location dropdowns if present
    const fromLocFilter = document.getElementById("trfFilterFromLoc");
    if (fromLocFilter && fromLocFilter.options.length <= 1) {
      const activeFromIds = new Set(transfers.map(t => t.fromLocationId).filter(Boolean));
      locations.filter(l => activeFromIds.has(l.id)).forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
        fromLocFilter.appendChild(opt);
      });
    }

    const toLocFilter = document.getElementById("trfFilterToLoc");
    if (toLocFilter && toLocFilter.options.length <= 1) {
      const activeToIds = new Set(transfers.map(t => t.toLocationId).filter(Boolean));
      locations.filter(l => activeToIds.has(l.id)).forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
        toLocFilter.appendChild(opt);
      });
    }

    const query = (document.getElementById("trfSearchInput")?.value || "").trim().toLowerCase();
    const selFromLoc = fromLocFilter?.value || "";
    const selToLoc = toLocFilter?.value || "";
    const selStatus = document.getElementById("trfFilterStatus")?.value || "";
    const dateFrom = document.getElementById("trfFilterDateFrom")?.value || "";
    const dateTo = document.getElementById("trfFilterDateTo")?.value || "";

    const filteredTransfers = transfers.filter(t => {
      const asset = assetMap[t.assetId] || {};
      const fromLoc = locMap[t.fromLocationId] || "";
      const toLoc = locMap[t.toLocationId] || "";
      const transferDate = t.transferDate || (t.createdAt ? t.createdAt.slice(0, 10) : "");

      if (selStatus && (t.status || "Completed") !== selStatus) return false;
      if (selFromLoc && t.fromLocationId !== selFromLoc) return false;
      if (selToLoc && t.toLocationId !== selToLoc) return false;
      if (dateFrom && transferDate && transferDate < dateFrom) return false;
      if (dateTo && transferDate && transferDate > dateTo) return false;

      if (query) {
        const assetCode = (asset.assetId || "").toLowerCase();
        const brand = (asset.brand || "").toLowerCase();
        const model = (asset.model || "").toLowerCase();
        const serial = (asset.serial || "").toLowerCase();
        const fLoc = fromLoc.toLowerCase();
        const tLoc = toLoc.toLowerCase();
        const notes = (t.notes || "").toLowerCase();

        const match = assetCode.includes(query) || brand.includes(query) ||
                      model.includes(query) || serial.includes(query) ||
                      fLoc.includes(query) || tLoc.includes(query) || notes.includes(query);
        if (!match) return false;
      }
      return true;
    });

    if (filteredTransfers.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج مطابقة للبحث"}</td></tr>`;
      return;
    }

    filteredTransfers.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    let html = "";
    filteredTransfers.forEach((t, idx) => {
      const asset = assetMap[t.assetId] || {};
      const fromLoc = locMap[t.fromLocationId] || "-";
      const toLoc = locMap[t.toLocationId] || "-";
      const cond = t.condition === "Working" ? (lang === "ar" ? "سليم" : "Working") : (lang === "ar" ? "معطل" : "Not Working");
      const statusClass = t.status === "Completed" ? "badge-success" : "badge-warning";

      html += `
        <tr>
          <td>${idx + 1}</td>
          <td>${t.transferDate || "-"}</td>
          <td><code>${asset.assetId || "-"}</code></td>
          <td>${asset.brand || ""} ${asset.model || ""}</td>
          <td>1</td>
          <td>${fromLoc}</td>
          <td><strong class="text-primary">${toLoc}</strong></td>
          <td><small>${t.notes || "-"}</small></td>
          <td><span class="badge ${statusClass}">${t.status || "Completed"}</span> <small>(${cond})</small></td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
    } catch (e) { console.warn("[OpsManager.renderTransfers] warning:", e); }
  }

  resetWarehouseIssueFilters() {
    const ids = ["wiSearchInput", "wiFilterStatus", "wiFilterWarehouse", "wiFilterDateFrom", "wiFilterDateTo"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    this.renderWarehouseIssues();
  }

  resetAwaitingFilters() {
    const ids = ["opsAwaitingSearchInput", "opsAwaitingFilterWarehouse", "opsAwaitingFilterTechnician", "opsAwaitingFilterDateFrom", "opsAwaitingFilterDateTo"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    this.renderAwaitingInstall();
  }

  resetTransferFilters() {
    const ids = ["trfSearchInput", "trfFilterFromLoc", "trfFilterToLoc", "trfFilterStatus", "trfFilterDateFrom", "trfFilterDateTo"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    this.renderTransfers();
  }

  async openWarehouseIssueModal(assetId = null) {
    const lang = AppState.lang;
    const [assets, locations, employees, projects] = await Promise.all([
      db.getAll("assets"),
      db.getAll("locations"),
      db.getAll("employees"),
      db.getAll("projects")
    ]);

    const assetSelect = document.getElementById("formWiAssetId");
    if (assetSelect) {
      const eligible = assets.filter(a => a.status === "Available" || a.status === "In Store" || a.id === assetId);
      assetSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الأصل المراد صرفه" : "Select Asset"} --</option>` +
        eligible.map(a => `<option value="${a.id}" ${a.id === assetId ? "selected" : ""}>${a.assetId} - ${a.brand || ""} ${a.model || ""} (${a.serial || ""})</option>`).join("");
      this.enhanceSelectWithSearch("formWiAssetId", lang === "ar" ? "اختر الأصل *" : "Select Asset *", lang === "ar" ? "ابحث عن الأصل بالكود أو الموديل..." : "Search asset...");
    }

    const locSelect = document.getElementById("formWiWarehouseLoc");
    if (locSelect) {
      locSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المستودع المصدر" : "Select Source Warehouse"} --</option>` +
        locations.filter(l => l.active !== false).map(l => `<option value="${l.id}">${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)} (${l.code || ""})</option>`).join("");
      if (assetId) {
        const a = assets.find(x => x.id === assetId);
        if (a && a.locationId) locSelect.value = a.locationId;
      }
      this.enhanceSelectWithSearch("formWiWarehouseLoc", lang === "ar" ? "اختر المستودع *" : "Select Warehouse *", lang === "ar" ? "ابحث عن المستودع..." : "Search warehouse...");
    }

    await db.populateFilteredDropdown(
      "employees",
      "departmentId",
      "dept-it",
      "formWiItEmp",
      "اختر فني تقنية المعلومات المستلم *",
      "Select IT Technician *"
    );

    const prjSelect = document.getElementById("formWiProject");
    if (prjSelect) {
      prjSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "بدون مشروع (اختياري)" : "No Project (Optional)"} --</option>` +
        projects.filter(p => p.status !== "Completed" && p.status !== "Cancelled")
          .map(p => `<option value="${p.id}">${p.projectNo} - ${lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)}</option>`).join("");
      this.enhanceSelectWithSearch("formWiProject", lang === "ar" ? "بدون مشروع (اختياري)" : "No Project (Optional)", lang === "ar" ? "ابحث عن المشروع..." : "Search project...");
    }

    document.getElementById("formWiDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("formWiNotes").value = "";
    // Reset delivery destination fields
    const resetIds = ["formWiSiteName", "formWiAdministration", "formWiOfficeName", "formWiDeliveryDate", "formWiReceivingEmployee"];
    resetIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    App.openModal("warehouseIssueModal");
  }

  async handleWarehouseIssueSubmit(event) {
    event.preventDefault();
    let assetBeforeIssue = null;
    let issueCreated = false;
    try {
    const assetId = document.getElementById("formWiAssetId").value;
    const warehouseLocId = document.getElementById("formWiWarehouseLoc").value;
    const itEmpId = document.getElementById("formWiItEmp").value;
    const projectId = document.getElementById("formWiProject").value || null;
    const date = document.getElementById("formWiDate").value;
    const notes = document.getElementById("formWiNotes").value.trim();
    const siteName = (document.getElementById("formWiSiteName")?.value || "").trim();
    const administration = (document.getElementById("formWiAdministration")?.value || "").trim();
    const officeName = (document.getElementById("formWiOfficeName")?.value || "").trim();
    const deliveryDate = (document.getElementById("formWiDeliveryDate")?.value || "").trim();
    const receivingEmployee = (document.getElementById("formWiReceivingEmployee")?.value || "").trim();

    if (!assetId) {
      App.showToast(AppState.lang === "ar" ? "يرجى اختيار الأصل" : "Please select asset", "error");
      return;
    }
    if (!warehouseLocId) {
      App.showToast(I18N[AppState.lang].errWarehouseReq || "يرجى اختيار المستودع المصدر", "error");
      return;
    }
    if (!itEmpId) {
      App.showToast(I18N[AppState.lang].errITReceiverReq || "يرجى تحديد موظف تقنية المعلومات المستلم", "error");
      return;
    }

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    if (!["Available", "In Store"].includes(asset.status)) {
      App.showToast(
        AppState.lang === "ar"
          ? "لا يمكن صرف هذا الأصل: حالته الحالية لا تسمح بالصرف."
          : "This asset cannot be issued because its current status does not allow warehouse issue.",
        "error"
      );
      return;
    }

    assetBeforeIssue = { ...asset };
    const existingIssues = await db.getAll("warehouseIssues");
    const openIssue = existingIssues.find(issue =>
      issue.assetId === asset.id &&
      ["Issued", "In Transit", "Awaiting Installation"].includes(issue.status)
    );
    if (openIssue) {
      App.showToast(
        AppState.lang === "ar"
          ? "هذا الأصل مصروف بالفعل ويوجد له سجل تركيب مفتوح."
          : "This asset already has an open warehouse issue and installation record.",
        "error"
      );
      return;
    }

    const currentUserName = AppState.currentUser
      ? (AppState.currentUser.fullName || AppState.currentUser.username)
      : "System";

    // 1. UPDATE ASSET: In Transit, assigned to IT employee, source warehouse recorded
    asset.status = "In Transit";
    asset.currentEmployeeId = itEmpId;
    asset.locationId = warehouseLocId;
    asset.departmentId = null;
    asset.handoverStatus = "Pending";
    asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.put("assets", asset);

    // 2. CREATE WAREHOUSE ISSUE RECORD (Linked seamlessly to Pending Installation)
    const issueNo = await db.getNextWarehouseIssueNo();
    const nextSeq = await db.getNextSequentialId("warehouseIssues");
    const issueRecord = {
      id: nextSeq,
      issueNo,
      assetId: asset.id,
      warehouseLocationId: warehouseLocId,
      itEmployeeId: itEmpId,
      issuerUserId: AppState.currentUser ? AppState.currentUser.id : null,
      issuerName: currentUserName,
      issueDate: date,
      projectId,
      status: "In Transit",
      notes,
      siteName: siteName || null,
      administration: administration || null,
      officeName: officeName || null,
      deliveryDate: deliveryDate || null,
      receivingEmployee: receivingEmployee || null,
      createdAt: new Date().toISOString()
    };
    await db.put("warehouseIssues", issueRecord);
    issueCreated = true;

    // 3. AUDIT TRAIL
    await db.logTransaction({
      assetId: asset.id,
      transactionType: "Warehouse Issue",
      fromLocationId: warehouseLocId,
      toLocationId: null,
      toEmployeeId: itEmpId,
      transactionDate: date + " " + new Date().toTimeString().slice(0, 8),
      performedBy: currentUserName,
      notes: notes || `[${issueNo}] Warehouse issue to IT employee (In Transit)`
    });

    // 4. NOTIFICATION
    await db.createNotification({
      employeeId: itEmpId,
      titleAr: `تم صرف أصل إليك للتثبيت (${asset.assetId})`,
      titleEn: `Asset Issued to You for Installation (${asset.assetId})`,
      messageAr: `تم صرف الجهاز (${asset.brand} ${asset.model}) من المستودع بانتظار التركيب بالموقع النهائي.`,
      messageEn: `Asset (${asset.brand} ${asset.model}) has been issued to you from the warehouse for installation.`,
      type: "handover",
      relatedId: asset.id
    });

    App.closeModal("warehouseIssueModal");
    App.showToast(AppState.lang === "ar" ? "تم صرف الأصل إلى فني التقنية بنجاح" : "Asset issued to IT technician successfully", "success");
    await this.render();
    await AssetManager.render();
    await App.updateDashboard();
    } catch (e) {
      console.error("[handleWarehouseIssueSubmit]", e);
      if (!issueCreated && assetBeforeIssue) {
        try {
          await db.put("assets", assetBeforeIssue);
        } catch (rollbackError) {
          console.error("[handleWarehouseIssueSubmit rollback]", rollbackError);
        }
      }
      const isDuplicateHandoff = e && (e.code === "23505" || String(e.message || "").includes("warehouse_issues_one_open_asset"));
      App.showToast(
        isDuplicateHandoff
          ? (AppState.lang === "ar"
            ? "تعذر الصرف: يوجد إذن صرف مفتوح لهذا الأصل بالفعل."
            : "Issue blocked: this asset already has an open warehouse handoff.")
          : (AppState.lang === "ar" ? "حدث خطأ أثناء صرف الأصل ولم يتم حفظ العملية" : "The warehouse issue failed and was not saved"),
        "error"
      );
    }
  }

  async openInstallationModal(assetId, issueId = null) {
    const lang = AppState.lang;
    try {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    // Retrieve matching warehouse issue
    let issue = null;
    if (issueId) {
      issue = await db.getById("warehouseIssues", issueId);
    }
    if (!issue) {
      const issues = await db.getAll("warehouseIssues");
      issue = issues.find(i => i.assetId === asset.id && i.status === "In Transit") || null;
    }

    this.currentActiveAssetId = asset.id;
    this.currentActiveIssueId = issue ? issue.id : null;

    const [locations, employees, departments, projects, types] = await Promise.all([
      db.getAll("locations"),
      db.getAll("employees"),
      db.getAll("departments"),
      db.getAll("projects"),
      db.getAll("assetTypes")
    ]);

    this._cachedLocations = locations;
    this._cachedDepartments = departments;
    this._cachedEmployees = employees;

    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const prjMap = Object.fromEntries(projects.map(p => [p.id, lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));

    // Populate SECTION 1: LOCKED / READ-ONLY ISSUE INFORMATION (🔒 STRICTLY LOCKED)
    const lockedIssueNoEl = document.getElementById("instLockedIssueNo");
    if (lockedIssueNoEl) lockedIssueNoEl.textContent = issue ? issue.issueNo : "-";

    const deliveryDateVal = issue ? (issue.deliveryDate || issue.issueDate) : (asset.assignmentDate || "-");
    const lockedDeliveryDateEl = document.getElementById("instLockedDeliveryDate");
    if (lockedDeliveryDateEl) lockedDeliveryDateEl.textContent = deliveryDateVal;

    const lockedAssetCodeEl = document.getElementById("instLockedAssetCode");
    if (lockedAssetCodeEl) lockedAssetCodeEl.textContent = asset.assetId;

    const lockedProductEl = document.getElementById("instLockedProduct");
    if (lockedProductEl) lockedProductEl.textContent = `${asset.brand || ""} ${asset.model || ""}${typeMap[asset.assetTypeId] ? ` (${typeMap[asset.assetTypeId]})` : ""}`;

    const lockedSerialEl = document.getElementById("instLockedSerial");
    if (lockedSerialEl) lockedSerialEl.textContent = asset.serial || "-";

    const lockedQuantityEl = document.getElementById("instLockedQuantity");
    if (lockedQuantityEl) lockedQuantityEl.textContent = (issue && issue.quantity) ? issue.quantity : "1";

    const lockedWarehouseEl = document.getElementById("instLockedWarehouse");
    if (lockedWarehouseEl) lockedWarehouseEl.textContent = locMap[issue ? issue.warehouseLocationId : asset.locationId] || "-";

    const lockedItEmpEl = document.getElementById("instLockedItEmp");
    if (lockedItEmpEl) lockedItEmpEl.textContent = empMap[issue ? issue.itEmployeeId : asset.currentEmployeeId] || "-";

    const lockedProjectEl = document.getElementById("instLockedProject");
    if (lockedProjectEl) lockedProjectEl.textContent = (issue && issue.projectId) ? (prjMap[issue.projectId] || "-") : "-";

    const lockedSiteNameEl = document.getElementById("instLockedSiteName");
    if (lockedSiteNameEl) lockedSiteNameEl.textContent = (issue && (issue.siteName || issue.officeName)) ? `${issue.siteName || ""} ${issue.officeName ? `(${issue.officeName})` : ""}`.trim() : "-";

    const lockedNotesEl = document.getElementById("instLockedNotes");
    if (lockedNotesEl) lockedNotesEl.textContent = (issue && issue.notes) ? issue.notes : "-";

    // Set Hidden Asset & Issue IDs
    document.getElementById("formInstAssetId").value = asset.id;
    if (document.getElementById("formInstIssueId")) {
      document.getElementById("formInstIssueId").value = issue ? issue.id : "";
    }

    // Determine initial values (Draft values take precedence, else fall back)
    const initialLocId = (issue && (issue.installedLocationId || issue.warehouseLocationId)) || "";
    const initialDeptId = (issue && issue.installedDepartmentId) || "";
    const initialOffice = (issue && (issue.installedOffice || issue.officeName)) || "";
    const initialUserId = (issue && (issue.installedUserId || issue.endUserId)) || "";
    const initialDate = (issue && issue.installedDate) || new Date().toISOString().slice(0, 10);
    const initialCond = (issue && issue.installationCondition) || "Working";
    const initialNotes = (issue && issue.installationNotes) || "";

    // Determine initial branch
    let initialBranchId = (issue && issue.installedBranchId) || "";
    if (!initialBranchId && initialLocId) {
      const locObj = locations.find(l => l.id === initialLocId);
      if (locObj) {
        initialBranchId = locObj.parentId || locObj.id;
      }
    }
    if (!initialBranchId && locations.length > 0) {
      const bCandidate = locations.find(l => !l.parentId);
      initialBranchId = bCandidate ? bCandidate.id : locations[0].id;
    }

    // SECTION 2: EDITABLE INSTALLATION FIELDS WITH SEARCHABLE COMBOBOXES
    // 0. Branch (Database: locations table parent branches)
    const branches = locations.filter(l => !l.parentId || l.id === "loc-main" || l.code === "HQ" || l.id.startsWith("loc-br-") || (l.nameAr && l.nameAr.includes("فرع")));
    if (branches.length === 0) branches.push(...locations.filter(l => !l.parentId));
    if (branches.length === 0) branches.push(...locations);

    const branchSelect = document.getElementById("formInstBranch");
    if (branchSelect) {
      branchSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر الفرع *" : "Select Branch *"} --</option>` +
        branches.map(b => `<option value="${b.id}" ${b.id === initialBranchId ? "selected" : ""}>${lang === "ar" ? b.nameAr : (b.nameEn || b.nameAr)} (${b.code || ""})</option>`).join("");
      this.enhanceSelectWithSearch("formInstBranch", lang === "ar" ? "اختر الفرع *" : "Select Branch *", lang === "ar" ? "ابحث في الفروع..." : "Search branches...");
    }

    // 1. Location (Database: locations table - Filtered by Branch)
    this.handleInstallationBranchChange(initialBranchId, initialLocId);

    // 2. Department (Database: departments table)
    const deptSelect = document.getElementById("formInstDept");
    if (deptSelect) {
      deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "الإدارة / القسم (اختياري)" : "Department (Optional)"} --</option>` +
        departments.filter(d => d.active !== false).map(d => `<option value="${d.id}" ${d.id === initialDeptId ? "selected" : ""}>${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
      this.enhanceSelectWithSearch("formInstDept", lang === "ar" ? "الإدارة / القسم (اختياري)" : "Department (Optional)", lang === "ar" ? "ابحث في الأقسام..." : "Search departments...");
    }

    // 3. Office (Database: child offices / rooms from locations table)
    this.populateOfficeDropdown(initialLocId, initialOffice);

    // 4. Employee / End User (Database: employees table - STRICTLY OPTIONAL)
    this.populateEmployeeDropdown(initialDeptId, initialUserId);

    // 5. Installation Date, Condition, Notes
    document.getElementById("formInstDate").value = initialDate;
    document.getElementById("formInstCondition").value = initialCond;
    document.getElementById("formInstNotes").value = initialNotes;

    App.openModal("installationModal");
    } catch (e) {
      console.warn("[openInstallationModal]", e);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء فتح نافذة التركيب" : "Error opening installation modal", "error");
    }
  }

  handleInstallationBranchChange(branchId, selectedLocId = "") {
    const lang = AppState.lang;
    const locSelect = document.getElementById("formInstLoc");
    if (!locSelect) return;

    const locations = this._cachedLocations || [];
    let filteredLocs = [];
    if (branchId) {
      filteredLocs = locations.filter(l => l.parentId === branchId);
      if (filteredLocs.length === 0) {
        filteredLocs = locations.filter(l => l.id === branchId);
      }
    } else {
      filteredLocs = locations.filter(l => l.active !== false);
    }

    if (filteredLocs.length === 0) filteredLocs = locations;

    locSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر موقع التركيب *" : "Select Location *"} --</option>` +
      filteredLocs.map(l => `<option value="${l.id}" ${l.id === selectedLocId ? "selected" : ""}>${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)} (${l.code || ""})</option>`).join("");

    this.enhanceSelectWithSearch("formInstLoc", lang === "ar" ? "اختر موقع التركيب *" : "Select Location *", lang === "ar" ? "ابحث في المواقع..." : "Search locations...");

    const chosenLoc = selectedLocId || (filteredLocs.length === 1 ? filteredLocs[0].id : (filteredLocs[0] ? filteredLocs[0].id : ""));
    this.populateOfficeDropdown(chosenLoc);
  }

  populateOfficeDropdown(locationId = "", selectedOffice = "") {
    const lang = AppState.lang;
    const officeSelect = document.getElementById("formInstOffice");
    if (!officeSelect) return;

    const locations = this._cachedLocations || [];
    let officeOptions = [];

    if (locationId) {
      // Find offices / rooms with parentId matching locationId
      officeOptions = locations.filter(l => l.parentId === locationId);
      if (officeOptions.length === 0) {
        officeOptions = locations.filter(l => l.parentId && (l.code?.startsWith("OF") || l.nameAr?.includes("مكتب") || l.nameEn?.toLowerCase().includes("office")));
      }
    } else {
      officeOptions = locations.filter(l => l.parentId || l.code?.startsWith("OF") || l.nameAr?.includes("مكتب"));
    }

    if (officeOptions.length === 0) officeOptions = locations;

    officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب / القاعة (اختياري)" : "Select Office (Optional)"} --</option>` +
      officeOptions.map(l => {
        const name = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
        const isSel = (l.id === selectedOffice || name === selectedOffice || (l.code && l.code === selectedOffice));
        return `<option value="${name}" ${isSel ? "selected" : ""}>${name} ${l.code ? `(${l.code})` : ""}</option>`;
      }).join("");

    this.enhanceSelectWithSearch("formInstOffice", lang === "ar" ? "اختر المكتب / القاعة" : "Select Office", lang === "ar" ? "ابحث في المكاتب..." : "Search offices...");
  }

  populateEmployeeDropdown(departmentId = "", selectedEmpId = "") {
    const lang = AppState.lang;
    const empSelect = document.getElementById("formInstUser");
    if (!empSelect) return;

    const employees = this._cachedEmployees || [];
    let filteredEmps = employees.filter(e => e.status === "Active" || !e.status);
    if (departmentId) {
      const deptFiltered = filteredEmps.filter(e => e.departmentId === departmentId);
      if (deptFiltered.length > 0) filteredEmps = deptFiltered;
    }

    empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "الموظف المستلم (اختياري)" : "Receiving Employee (Optional)"} --</option>` +
      filteredEmps.map(e => {
        const isSel = (e.id === selectedEmpId);
        return `<option value="${e.id}" ${isSel ? "selected" : ""}>${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`;
      }).join("");

    this.enhanceSelectWithSearch("formInstUser", lang === "ar" ? "الموظف المستلم (اختياري)" : "Employee (Optional)", lang === "ar" ? "ابحث في الموظفين..." : "Search employees...");
  }

  async handleInstallationLocationChange(locationId) {
    await this.syncInstallationFilters("location", locationId);
  }

  async handleInstallationDeptChange(departmentId) {
    await this.syncInstallationFilters("department", departmentId);
  }

  async handleInstallationOfficeChange(officeId) {
    await this.syncInstallationFilters("office", officeId);
  }

  async syncInstallationFilters(triggerSource, value) {
    const lang = AppState.lang;
    const locSelect = document.getElementById("formInstLoc");
    const deptSelect = document.getElementById("formInstDept");
    const officeSelect = document.getElementById("formInstOffice");
    const empSelect = document.getElementById("formInstUser");

    if (!locSelect || !deptSelect || !officeSelect || !empSelect) return;

    let locId = locSelect.value;
    let deptId = deptSelect.value;
    let officeId = officeSelect.value;
    let empId = empSelect.value;

    if (triggerSource === "location") locId = value;
    else if (triggerSource === "department") deptId = value;
    else if (triggerSource === "office") officeId = value;

    const [locations, departments, offices, employees] = await Promise.all([
      db.getAll("locations"),
      db.getAll("departments"),
      db.getAll("offices"),
      db.getAll("employees")
    ]);

    const activeLocs = locations.filter(l => l.active !== false);
    const activeDepts = departments.filter(d => d.active !== false);
    const activeOffices = offices.filter(o => o.status !== "Inactive");
    const activeEmps = employees.filter(e => e.status === "Active" || !e.status);

    const deptMap = {}; activeDepts.forEach(d => deptMap[d.id] = d);
    const locMap = {}; activeLocs.forEach(l => locMap[l.id] = l);
    const officeMap = {}; activeOffices.forEach(o => officeMap[o.id] = o);
    const empMap = {}; activeEmps.forEach(e => empMap[e.id] = e);

    if (triggerSource === "location") {
      if (locId) {
        if (deptId && deptMap[deptId]?.locationId && deptMap[deptId].locationId !== locId) {
          deptId = ""; officeId = ""; empId = "";
        }
        if (officeId && officeMap[officeId]?.location_id !== locId) {
          officeId = ""; empId = "";
        }
      }
    } else if (triggerSource === "department") {
      if (deptId) {
        if (deptMap[deptId]?.locationId) {
          locId = deptMap[deptId].locationId;
        }
        if (officeId && officeMap[officeId]?.department_id && officeMap[officeId].department_id !== deptId) {
          officeId = ""; empId = "";
        }
        if (empId && empMap[empId]?.departmentId !== deptId) {
          empId = "";
        }
      } else {
        officeId = ""; empId = "";
      }
    } else if (triggerSource === "office") {
      if (officeId) {
        const off = officeMap[officeId];
        if (off) {
          if (off.location_id) locId = off.location_id;
          if (off.department_id) deptId = off.department_id;
        }
        if (empId && empMap[empId]?.officeId !== officeId) {
          empId = "";
        }
      }
    }

    locSelect.value = locId;
    deptSelect.value = deptId;
    officeSelect.value = officeId;
    empSelect.value = empId;

    let filteredDepts = activeDepts;
    if (locId) filteredDepts = activeDepts.filter(d => d.locationId === locId);
    
    deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "الإدارة / القسم (اختياري)" : "Department (Optional)"} --</option>` +
      filteredDepts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
    if (deptId && filteredDepts.some(d => d.id === deptId)) deptSelect.value = deptId;
    else if (!deptId && filteredDepts.length === 1 && locId) { deptId = filteredDepts[0].id; deptSelect.value = deptId; }

    let filteredOffices = activeOffices;
    if (locId) filteredOffices = filteredOffices.filter(o => o.location_id === locId);
    if (deptId) filteredOffices = filteredOffices.filter(o => o.department_id === deptId);

    officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "اختر المكتب / القاعة (اختياري)" : "Select Office (Optional)"} --</option>` +
      filteredOffices.map(o => `<option value="${o.id}">${lang === "ar" ? o.nameAr : (o.nameEn || o.nameAr)} ${o.code ? `(${o.code})` : ""}</option>`).join("");
    if (officeId && filteredOffices.some(o => o.id === officeId)) officeSelect.value = officeId;
    else officeId = "";

    let filteredEmps = activeEmps;
    if (deptId) filteredEmps = filteredEmps.filter(e => e.departmentId === deptId);
    if (officeId) filteredEmps = filteredEmps.filter(e => e.officeId === officeId);

    empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "الموظف المستلم (اختياري)" : "Employee (Optional)"} --</option>` +
      filteredEmps.map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
    if (empId && filteredEmps.some(e => e.id === empId)) empSelect.value = empId;
    else empId = "";
  }

  async saveInstallationDraft() {
    const assetId = document.getElementById("formInstAssetId")?.value;
    if (!assetId) return;

    const instBranchId = document.getElementById("formInstBranch")?.value || null;
    const instLocId = document.getElementById("formInstLoc")?.value || null;
    const instDeptId = document.getElementById("formInstDept")?.value || null;
    const instOffice = document.getElementById("formInstOffice")?.value || null;
    const instUserId = document.getElementById("formInstUser")?.value || null;
    const instDate = document.getElementById("formInstDate")?.value || new Date().toISOString().slice(0, 10);
    const condition = document.getElementById("formInstCondition")?.value || "Working";
    const notes = document.getElementById("formInstNotes")?.value.trim() || "";

    const issues = await db.getAll("warehouseIssues");
    let issue = this.currentActiveIssueId ? await db.getById("warehouseIssues", this.currentActiveIssueId) : null;
    if (!issue) {
      issue = issues.find(i => i.assetId === assetId && i.status === "In Transit");
    }

    if (issue) {
      issue.installedBranchId = instBranchId;
      issue.installedLocationId = instLocId;
      issue.installedDepartmentId = instDeptId;
      issue.installedOffice = instOffice;
      issue.installedUserId = instUserId;
      issue.installedDate = instDate;
      issue.installationCondition = condition;
      issue.installationNotes = notes;
      issue.installationStatus = "Draft";
      issue.updatedAt = new Date().toISOString();
      await db.put("warehouseIssues", issue);
    }

    App.showToast(AppState.lang === "ar" ? "تم حفظ مسودة التركيب بنجاح" : "Installation draft saved successfully", "info");
    App.closeModal("installationModal");
    await this.render();
  }

  async handleInstallationSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    try {
    const assetId = document.getElementById("formInstAssetId").value;
    const instBranchId = document.getElementById("formInstBranch")?.value || null;
    const instLocId = document.getElementById("formInstLoc").value;
    const instDeptId = document.getElementById("formInstDept")?.value || null;
    const instOffice = document.getElementById("formInstOffice")?.value || null;
    const instUserId = document.getElementById("formInstUser").value || null; // Strictly optional
    const instDate = document.getElementById("formInstDate").value;
    const condition = document.getElementById("formInstCondition").value || "Working";
    const notes = document.getElementById("formInstNotes").value.trim();

    if (!instLocId) {
      App.showToast(AppState.lang === "ar" ? "يرجى تحديد موقع التركيب" : "Please select installation location", "error");
      return;
    }

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const fromLoc = asset.locationId;
    const currentUserName = AppState.currentUser
      ? (AppState.currentUser.fullName || AppState.currentUser.username)
      : "System";
    const issueId = document.getElementById("formInstIssueId")?.value || this.currentActiveIssueId || null;

    // 1. LOOKUP MATCHING WAREHOUSE ISSUE FIRST (to resolve IT technician & Project)
    const issues = await db.getAll("warehouseIssues");
    let matchingIssue = issueId ? await db.getById("warehouseIssues", issueId) : null;
    if (!matchingIssue) {
      matchingIssue = issues.find(i => (i.assetId === asset.id || i.assetId === asset.assetId) && i.status === "In Transit");
    }
    if (!matchingIssue) {
      matchingIssue = issues.find(i => i.assetId === asset.id || i.assetId === asset.assetId);
    }
    if (!matchingIssue || !["Issued", "In Transit", "Awaiting Installation"].includes(matchingIssue.status)) {
      App.showToast(
        AppState.lang === "ar"
          ? "لا يمكن إكمال التركيب دون سجل صرف مفتوح من المستودع."
          : "Installation requires an open warehouse issue record.",
        "error"
      );
      return;
    }
    if (asset.status !== "In Transit") {
      App.showToast(
        AppState.lang === "ar"
          ? "حالة الأصل لا تطابق حالة أصل بانتظار التركيب."
          : "The asset status is not consistent with an asset awaiting installation.",
        "error"
      );
      return;
    }

    if (instDeptId && instLocId) {
      const department = await db.getById("departments", instDeptId);
      if (department && department.locationId && department.locationId !== instLocId) {
        App.showToast(
          AppState.lang === "ar"
            ? "القسم المحدد لا يتبع موقع التركيب المختار."
            : "The selected department does not belong to the selected installation location.",
          "error"
        );
        return;
      }
    }

    if (instBranchId) {
      const [branch, installationLocation, locations] = await Promise.all([
        db.getById("locations", instBranchId),
        db.getById("locations", instLocId),
        db.getAll("locations")
      ]);
      let belongsToBranch = Boolean(branch && installationLocation && branch.id === installationLocation.id);
      let cursor = installationLocation;
      const visited = new Set();
      while (!belongsToBranch && cursor && cursor.parentId && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        cursor = locations.find(location => location.id === cursor.parentId) || null;
        belongsToBranch = Boolean(cursor && cursor.id === instBranchId);
      }
      if (!belongsToBranch) {
        App.showToast(
          AppState.lang === "ar"
            ? "موقع التركيب لا يتبع الفرع المحدد."
            : "The installation location does not belong to the selected branch.",
          "error"
        );
        return;
      }
    }

    // 2. ATOMIC UPDATE OF ASSET: Single Source of Truth for all reports, lists, and inventory
    if (instBranchId) asset.branchId = instBranchId;
    asset.locationId = instLocId;
    asset.departmentId = instDeptId;
    asset.office = instOffice;
    if (!asset.specs) asset.specs = {};
    asset.specs.office = instOffice;
    asset.currentEmployeeId = instUserId || null;
    asset.condition = condition;

    // Devices installed on-site are marked "Installed" (or "Under Maintenance" if defective)
    if (condition === "Not Working") {
      asset.status = "Under Maintenance";
    } else if (instUserId) {
      asset.status = "Assigned";
    } else {
      asset.status = "Installed";
    }

    // Record installation date and assignment date
    asset.installationDate = instDate;
    asset.assignmentDate = instDate;

    // Record technician who performed installation (from warehouse issue)
    if (matchingIssue && matchingIssue.itEmployeeId) {
      asset.installedBy = matchingIssue.itEmployeeId;
    }

    // Propagate project from warehouse issue if linked
    if (matchingIssue && matchingIssue.projectId) {
      asset.projectId = matchingIssue.projectId;
    }

    asset.handoverStatus = instUserId ? "Pending" : null;
    asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.put("assets", asset);

    // 3. CLOSE PENDING WAREHOUSE ISSUE
    if (matchingIssue) {
      matchingIssue.status = "Installed";
      matchingIssue.installationStatus = "Completed";
      matchingIssue.installedDate = instDate;
      if (instBranchId) matchingIssue.installedBranchId = instBranchId;
      matchingIssue.installedLocationId = instLocId;
      matchingIssue.installedDepartmentId = instDeptId;
      matchingIssue.installedOffice = instOffice;
      matchingIssue.installedUserId = instUserId;
      matchingIssue.endUserId = instUserId;
      matchingIssue.installationNotes = notes;
      matchingIssue.updatedAt = new Date().toISOString();
      await db.put("warehouseIssues", matchingIssue);
    }

    // 4. COMPLETE AUDIT TRAIL / MOVEMENT HISTORY
    await db.logTransaction({
      assetId: asset.id,
      transactionType: "Installed",
      fromLocationId: fromLoc,
      toLocationId: instLocId,
      toEmployeeId: instUserId,
      transactionDate: instDate + " " + new Date().toTimeString().slice(0, 8),
      performedBy: currentUserName,
      notes: notes || `Installed on-site (Branch: ${instBranchId || '-'}, Location: ${instLocId}, Office: ${instOffice || '-'}, Dept: ${instDeptId || '-'}, Condition: ${condition})`
    });

    // 5. NOTIFY END USER IF APPLICABLE
    if (instUserId) {
      await db.createNotification({
        employeeId: instUserId,
        titleAr: `تم تثبيت عهدة جهاز في مكتبك (${asset.assetId})`,
        titleEn: `Asset Installed in Your Office (${asset.assetId})`,
        messageAr: `تم الانتهاء من تثبيت الجهاز (${asset.brand} ${asset.model}) في موقعك وهو الآن بعهدتك.`,
        messageEn: `Asset (${asset.brand} ${asset.model}) has been installed and assigned to you.`,
        type: "handover",
        relatedId: asset.id
      });
    }

    App.closeModal("installationModal");
    App.showToast(AppState.lang === "ar" ? "تم استكمال تركيب وتثبيت الأصل في الموقع بنجاح" : "Asset installed on-site successfully", "success");
    this.switchSubTab("installedDevices");
    if (typeof AssetManager !== "undefined" && AssetManager.render) await AssetManager.render();
    if (typeof App !== "undefined" && App.updateDashboard) await App.updateDashboard();
    } catch (e) {
      console.error("[handleInstallationSubmit]", e);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء استكمال التركيب" : "An error occurred during installation", "error");
    }
  }

  /* -------------------------------------------------------------
     INSTALLED DEVICES SUBTAB & LIFECYCLE MANAGEMENT
     ------------------------------------------------------------- */
  async renderInstalledDevices() {
    const tableBody = document.getElementById("installedDevicesTableBody");
    if (!tableBody) return;
    const lang = AppState.lang;
    try {
      const [assets, locations, departments, types, projects, employees] = await Promise.all([
        db.getAll("assets"),
        db.getAll("locations"),
        db.getAll("departments"),
        db.getAll("assetTypes"),
        db.getAll("projects"),
        db.getAll("employees")
      ]);

      const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
      const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
      const typeMap = Object.fromEntries(types.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));
      const prjMap = Object.fromEntries(projects.map(p => [p.id, lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));
      const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));

      // Filter assets that are installed on-site (status === "Installed", or status === "In Use", or has installation metadata)
      const installedAssets = assets.filter(a => 
        a.status === "Installed" || 
        (a.status === "In Use" && (!a.currentEmployeeId || a.installationDate || a.office)) ||
        (a.installationDate && a.locationId && a.status === "Assigned")
      );

      // Dynamically populate filter dropdowns if present
      const locFilter = document.getElementById("opsInstalledFilterLocation");
      if (locFilter && locFilter.options.length <= 1) {
        const activeLocIds = new Set(installedAssets.map(a => a.locationId).filter(Boolean));
        locations.filter(l => activeLocIds.has(l.id)).forEach(l => {
          const opt = document.createElement("option");
          opt.value = l.id;
          opt.textContent = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
          locFilter.appendChild(opt);
        });
      }

      const deptFilter = document.getElementById("opsInstalledFilterDepartment");
      if (deptFilter && deptFilter.options.length <= 1) {
        const activeDeptIds = new Set(installedAssets.map(a => a.departmentId).filter(Boolean));
        departments.filter(d => activeDeptIds.has(d.id)).forEach(d => {
          const opt = document.createElement("option");
          opt.value = d.id;
          opt.textContent = lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr);
          deptFilter.appendChild(opt);
        });
      }

      const typeFilter = document.getElementById("opsInstalledFilterType");
      if (typeFilter && typeFilter.options.length <= 1) {
        const activeTypeIds = new Set(installedAssets.map(a => a.assetTypeId || a.typeId).filter(Boolean));
        types.filter(t => activeTypeIds.has(t.id)).forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr);
          typeFilter.appendChild(opt);
        });
      }

      const prjFilter = document.getElementById("opsInstalledFilterProject");
      if (prjFilter && prjFilter.options.length <= 1) {
        const activePrjIds = new Set(installedAssets.map(a => a.projectId).filter(Boolean));
        projects.filter(p => activePrjIds.has(p.id)).forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
          prjFilter.appendChild(opt);
        });
      }

      // Filter by search query and dropdowns
      const query = (document.getElementById("opsInstalledSearchInput")?.value || "").trim().toLowerCase();
      const selLoc = locFilter?.value || "";
      const selDept = deptFilter?.value || "";
      const selType = typeFilter?.value || "";
      const selPrj = prjFilter?.value || "";
      const selStatus = document.getElementById("opsInstalledFilterStatus")?.value || "";

      let filtered = installedAssets.filter(a => {
        const codeMatch = (a.assetId || a.id || "").toLowerCase().includes(query);
        const serialMatch = (a.serial || "").toLowerCase().includes(query);
        const nameMatch = `${a.brand || ''} ${a.model || a.name || ''}`.toLowerCase().includes(query);
        if (query && !codeMatch && !serialMatch && !nameMatch) return false;

        if (selLoc && a.locationId !== selLoc) return false;
        if (selDept && a.departmentId !== selDept) return false;
        if (selType && (a.assetTypeId || a.typeId) !== selType) return false;
        if (selPrj && a.projectId !== selPrj) return false;
        if (selStatus && a.status !== selStatus) return false;

        return true;
      });

      if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج"}</td></tr>`;
        return;
      }

      const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";
      let html = "";

      filtered.forEach(a => {
        const assetCode = a.assetId || a.id;
        const typeName = typeMap[a.assetTypeId || a.typeId] || "-";
        const assetName = `${a.brand || ''} ${a.model || a.name || ''}`.trim() || "-";
        const locName = locMap[a.locationId] || "-";
        const deptName = deptMap[a.departmentId] || "-";
        const areaRoom = locMap[a.office] || a.office || a.room || locMap[a.specs?.office] || a.specs?.office || "-";
        const prjName = prjMap[a.projectId] || "-";
        const instDate = a.installationDate || a.assignmentDate || "-";
        const installedBy = empMap[a.installedBy] || a.installedBy || "-";
        const statusText = lang === "ar" ? (a.status === "Installed" ? "مركب" : a.status) : a.status;

        html += `
          <tr>
            <td><code class="serial-tag">${assetCode}</code></td>
            <td>${typeName}</td>
            <td>${a.serial || "-"}</td>
            <td><strong>${assetName}</strong></td>
            <td>${locName}</td>
            <td>${deptName}</td>
            <td>${areaRoom}</td>
            <td>${prjName}</td>
            <td>${instDate}</td>
            <td>${installedBy}</td>
            <td><span class="badge badge-success">${statusText}</span></td>
            <td>
              <div class="table-actions" style="display: flex; gap: 4px;">
                <button class="btn btn-xs btn-info" onclick="OpsManager.openInstalledDeviceDetailsModal('${a.id}')" title="${I18N[lang].btnViewAsset || 'عرض التفاصيل'}">
                  <i class="fas fa-eye"></i>
                </button>
                ${!isViewer ? `
                  <button class="btn btn-xs btn-primary" onclick="AssetManager.openTransferModal('${a.id}')" title="${I18N[lang].btnNewTransfer || 'نقل أصل'}">
                    <i class="fas fa-exchange-alt"></i>
                  </button>
                  <button class="btn btn-xs btn-warning" onclick="OpsManager.openRemoveFromInstallationModal('${a.id}')" title="${I18N[lang].btnRemoveFromInstallation || 'إزالة من الموقع'}">
                    <i class="fas fa-sign-out-alt"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      });

      tableBody.innerHTML = html;
    } catch (e) {
      console.warn("[OpsManager.renderInstalledDevices] warning:", e);
    }
  }

  resetInstalledFilters() {
    const s = document.getElementById("opsInstalledSearchInput");
    if (s) s.value = "";
    ["opsInstalledFilterLocation", "opsInstalledFilterDepartment", "opsInstalledFilterType", "opsInstalledFilterProject", "opsInstalledFilterStatus"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    this.renderInstalledDevices();
  }

  async openInstalledDeviceDetailsModal(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const [locations, departments, types, projects, employees] = await Promise.all([
      db.getAll("locations"),
      db.getAll("departments"),
      db.getAll("assetTypes"),
      db.getAll("projects"),
      db.getAll("employees")
    ]);

    const lang = AppState.lang;
    const isAr = lang === "ar";
    const locMap = Object.fromEntries(locations.map(l => [l.id, isAr ? l.nameAr : (l.nameEn || l.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, isAr ? d.nameAr : (d.nameEn || d.nameAr)]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, isAr ? t.nameAr : (t.nameEn || t.nameAr)]));
    const prjMap = Object.fromEntries(projects.map(p => [p.id, isAr ? p.nameAr : (p.nameEn || p.nameAr)]));
    const empObjMap = Object.fromEntries(employees.map(e => [e.id, e]));

    const assetCode = asset.assetId || asset.id;
    const typeName = typeMap[asset.assetTypeId || asset.typeId] || "-";
    const locObj = locations.find(l => l.id === asset.locationId);
    const locName = locMap[asset.locationId] || "-";
    
    // Resolve Place / Branch name
    let branchName = "-";
    if (asset.branchId && locMap[asset.branchId]) {
      branchName = locMap[asset.branchId];
    } else if (locObj && locObj.parentId && locMap[locObj.parentId]) {
      branchName = locMap[locObj.parentId];
    } else if (locObj) {
      branchName = isAr ? locObj.nameAr : (locObj.nameEn || locObj.nameAr);
    }

    const deptName = deptMap[asset.departmentId] || "-";
    const prjName = prjMap[asset.projectId] || "-";
    const areaRoom = locMap[asset.office] || asset.office || asset.room || locMap[asset.specs?.office] || asset.specs?.office || "-";
    const instDate = asset.installationDate || asset.assignmentDate || "-";
    
    // Resolve Technician who installed the device
    let installedByText = "-";
    if (asset.installedBy) {
      const techEmp = empObjMap[asset.installedBy] || employees.find(e => e.id === asset.installedBy || e.employeeNumber === asset.installedBy);
      if (techEmp) {
        installedByText = `${isAr ? techEmp.nameAr : (techEmp.nameEn || techEmp.nameAr)} (${techEmp.employeeNumber || techEmp.id})`;
      } else {
        installedByText = asset.installedBy;
      }
    }

    // Condition
    const cond = asset.condition || "Working";
    const condText = cond === "Working" ? (isAr ? "سليم ويعمل بكفاءة" : "Working / Good") : (isAr ? "معطل / يحتاج صيانة" : "Not Working");
    const condBadge = cond === "Working" ? "badge-success" : "badge-danger";

    // User / Employee Details
    let userCardHtml = "";
    if (asset.currentEmployeeId) {
      const empObj = empObjMap[asset.currentEmployeeId] || employees.find(e => e.id === asset.currentEmployeeId || e.employeeNumber === asset.currentEmployeeId);
      const empNum = empObj ? (empObj.employeeNumber || empObj.employeeId || empObj.id) : "-";
      const empName = empObj ? (isAr ? empObj.nameAr : (empObj.nameEn || empObj.nameAr)) : asset.currentEmployeeId;
      const empJob = empObj ? (isAr ? (empObj.jobTitleAr || empObj.jobTitle || "-") : (empObj.jobTitleEn || empObj.jobTitle || "-")) : "-";
      const empPhone = empObj ? (empObj.phone || empObj.mobile || "-") : "-";
      const empEmail = empObj ? (empObj.email || "-") : "-";

      userCardHtml = `
        <div class="card p-3" style="background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid var(--primary-color);">
          <h4 class="mb-2 text-primary" style="margin-top: 0; font-size: 14px;">
            <i class="fas fa-user-check"></i> ${isAr ? 'المستخدم المستلم (العهدة الشخصية)' : 'Assigned User / Employee'}
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px 16px; font-size: 13px;">
            <div><strong>${isAr ? 'اسم المستخدم / الموظف' : 'User / Employee'}:</strong> <span class="text-primary font-bold">${empName}</span></div>
            <div><strong>${isAr ? 'الرقم الوظيفي' : 'Employee ID'}:</strong> <code>${empNum}</code></div>
            <div><strong>${isAr ? 'المسمى الوظيفي' : 'Job Title'}:</strong> ${empJob}</div>
            <div><strong>${isAr ? 'رقم التواصل' : 'Phone'}:</strong> ${empPhone}</div>
            ${empEmail !== '-' ? `<div><strong>${isAr ? 'البريد الإلكتروني' : 'Email'}:</strong> ${empEmail}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      userCardHtml = `
        <div class="card p-3" style="background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid var(--success-color);">
          <h4 class="mb-2 text-success" style="margin-top: 0; font-size: 14px;">
            <i class="fas fa-network-wired"></i> ${isAr ? 'المستخدم / طبيعة الاستخدام' : 'User / Usage Nature'}
          </h4>
          <div class="text-sm">
            <span class="badge badge-success" style="margin-inline-end: 6px;">${isAr ? 'جهاز موقع عام' : 'Shared Location'}</span>
            ${isAr ? 'الجهاز مركب لخدمة الموقع والقاعة العامة وغير مسند كعهدة لموظف فردي.' : 'Installed for common facility use and not assigned to an individual staff member.'}
          </div>
        </div>
      `;
    }

    const html = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Card 1: Device Information -->
        <div class="card p-3" style="background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid var(--info-color);">
          <h4 class="mb-2 text-primary" style="margin-top: 0; font-size: 14px;">
            <i class="fas fa-desktop"></i> ${isAr ? 'معلومات الجهاز والأصل' : 'Device & Asset Information'}
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px 16px; font-size: 13px;">
            <div><strong>${isAr ? 'رقم الأصل (Asset ID)' : 'Asset ID'}:</strong> <code class="serial-tag font-bold">${assetCode}</code></div>
            <div><strong>${isAr ? 'نوع الجهاز' : 'Device Type'}:</strong> ${typeName}</div>
            <div><strong>${isAr ? 'الماركة والموديل' : 'Brand & Model'}:</strong> <strong>${asset.brand || ''} ${asset.model || ''}</strong></div>
            <div><strong>${isAr ? 'الرقم التسلسلي (S/N)' : 'Serial Number'}:</strong> <code>${asset.serial || '-'}</code></div>
            <div><strong>${isAr ? 'الحالة الفنية والتشغيلية' : 'Condition'}:</strong> <span class="badge ${condBadge}">${condText}</span></div>
            <div><strong>${isAr ? 'حالة الأصل' : 'Status'}:</strong> <span class="badge badge-success">${isAr ? 'مركب بالموقع' : 'Installed'}</span></div>
            ${asset.ip ? `<div><strong>${isAr ? 'عنوان IP' : 'IP Address'}:</strong> <code>${asset.ip}</code></div>` : ''}
            ${asset.mac ? `<div><strong>${isAr ? 'عنوان MAC' : 'MAC Address'}:</strong> <code>${asset.mac}</code></div>` : ''}
            ${asset.os ? `<div><strong>${isAr ? 'نظام التشغيل' : 'OS'}:</strong> ${asset.os}</div>` : ''}
          </div>
        </div>

        <!-- Card 2: Location, Place, Department & Office Information -->
        <div class="card p-3" style="background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid var(--warning-color);">
          <h4 class="mb-2 text-warning" style="margin-top: 0; font-size: 14px;">
            <i class="fas fa-map-marker-alt"></i> ${isAr ? 'معلومات الموقع والمكان والمكتب' : 'Location, Place, Department & Office Details'}
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px 16px; font-size: 13px;">
            <div><strong>${isAr ? 'المكان / الفرع' : 'Branch / Place'}:</strong> <span class="font-bold text-primary">${branchName}</span></div>
            <div><strong>${isAr ? 'الموقع / المبنى' : 'Location / Building'}:</strong> <span class="font-bold">${locName}</span></div>
            <div><strong>${isAr ? 'الإدارة / القسم' : 'Department'}:</strong> <span class="font-bold">${deptName}</span></div>
            <div><strong>${isAr ? 'اسم المكتب / القاعة / الغرفة' : 'Office / Room'}:</strong> <span class="font-bold text-primary">${areaRoom}</span></div>
            <div><strong>${isAr ? 'تاريخ التركيب' : 'Installation Date'}:</strong> <strong>${instDate}</strong></div>
            <div><strong>${isAr ? 'فني التقنية المنفذ' : 'Installed By Technician'}:</strong> ${installedByText}</div>
            <div><strong>${isAr ? 'المشروع المرتبط' : 'Project'}:</strong> ${prjName}</div>
          </div>
          ${asset.notes ? `<div class="mt-2 pt-2 border-top text-sm text-muted"><strong>${isAr ? 'ملاحظات التركيب' : 'Installation Notes'}:</strong> ${asset.notes}</div>` : ''}
        </div>

        <!-- Card 3: User Information -->
        ${userCardHtml}
      </div>
    `;

    document.getElementById("installedDeviceDetailsBody").innerHTML = html;
    App.openModal("installedDeviceDetailsModal");
  }

  async openRemoveFromInstallationModal(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const [locations, employees] = await Promise.all([
      db.getAll("locations"),
      db.getAll("employees")
    ]);
    const lang = AppState.lang;
    const isAr = lang === "ar";
    const locMap = Object.fromEntries(locations.map(l => [l.id, isAr ? l.nameAr : (l.nameEn || l.nameAr)]));

    document.getElementById("formRemoveAssetId").value = asset.id;
    
    // Set default date to today
    const today = new Date().toISOString().substring(0, 10);
    document.getElementById("formRemovalDate").value = today;
    document.getElementById("formRemovalReason").value = "";

    // Populate removedBy dropdown with employees
    const removedBySelect = document.getElementById("formRemovedBy");
    if (removedBySelect) {
      removedBySelect.innerHTML = `<option value="">${isAr ? 'اختر الفني / الموظف...' : 'Select Technician / Employee...'}</option>`;
      employees.forEach(e => {
        const name = isAr ? e.nameAr : (e.nameEn || e.nameAr);
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.textContent = `${name} (${e.employeeNumber || e.id})`;
        removedBySelect.appendChild(opt);
      });
    }

    const summaryHtml = `
      <strong>${isAr ? 'الجهاز' : 'Asset'}:</strong> <code class="serial-tag">${asset.assetId || asset.id}</code> - ${asset.brand || ''} ${asset.model || ''} (${asset.serial || '-'})<br>
      <strong>${isAr ? 'الموقع الحالي' : 'Current Location'}:</strong> ${locMap[asset.locationId] || '-'} (${locMap[asset.office] || asset.office || '-'})
    `;
    document.getElementById("removeAssetSummaryDisplay").innerHTML = summaryHtml;

    App.openModal("removeFromInstallationModal");
  }

  async handleRemoveFromInstallationSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    try {
      const assetId = document.getElementById("formRemoveAssetId").value;
      const removalDate = document.getElementById("formRemovalDate").value;
      const removedBy = document.getElementById("formRemovedBy")?.value || null;
      const destination = document.getElementById("formRemovalDestination").value;
      const reason = document.getElementById("formRemovalReason").value.trim();

      if (!assetId) return;
      const asset = await db.getById("assets", assetId);
      if (!asset) {
        App.showToast(I18N[AppState.lang].errAssetNotFound || "الأصل غير موجود", "error");
        return;
      }

      const oldLocationId = asset.locationId;
      const currentUserName = AppState.currentUser ? (AppState.currentUser.fullName || AppState.currentUser.username) : "admin";

      // Handle target destination
      let newStatus = "Available";
      let newLocationId = asset.locationId;

      if (destination === "warehouse") {
        newStatus = "Available";
        const locations = await db.getAll("locations");
        const mainWh = locations.find(l => (l.isWarehouse || (l.type && l.type.toLowerCase().includes("warehouse")) || (l.nameAr && l.nameAr.includes("مستودع"))));
        if (mainWh) newLocationId = mainWh.id;
      } else if (destination === "maintenance") {
        newStatus = "Under Maintenance";
      } else if (destination === "retired") {
        newStatus = "Retired";
      }

      // Atomic update of Asset
      asset.status = newStatus;
      asset.locationId = newLocationId;
      asset.currentEmployeeId = null;
      asset.office = null;
      if (asset.specs) asset.specs.office = null;
      asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
      await db.put("assets", asset);

      // Log removal transaction into Movement History
      await db.logTransaction({
        assetId: asset.id,
        transactionType: "Removed From Location",
        fromLocationId: oldLocationId,
        toLocationId: destination === "warehouse" ? newLocationId : null,
        toEmployeeId: null,
        transactionDate: removalDate + " " + new Date().toTimeString().slice(0, 8),
        performedBy: removedBy || currentUserName,
        notes: `Removal Reason: ${reason} (Target Destination: ${destination})`
      });

      App.closeModal("removeFromInstallationModal");
      App.showToast(I18N[AppState.lang].successRemoval || "تمت إزالة الجهاز بنجاح", "success");
      await this.render();
      if (typeof AssetManager !== "undefined" && AssetManager.render) await AssetManager.render();
      if (typeof App !== "undefined" && App.updateDashboard) await App.updateDashboard();
    } catch (e) {
      console.error("[handleRemoveFromInstallationSubmit]", e);
      App.showToast(AppState.lang === "ar" ? "حدث خطأ أثناء إزالة الجهاز" : "An error occurred during device removal", "error");
    }
  }

  /* -------------------------------------------------------------
     INTERACTIVE TREE VIEW FOR AWAITING INSTALLATION
     Full traceability from Warehouse Issue -> Dispatched Asset -> Target Installation
     ------------------------------------------------------------- */
  handleAwaitingRowClick(event, assetId) {
    if (event.target.closest("button, a, input, select, textarea, .tree-toggle-icon")) return;
    this.toggleAwaitingTree(assetId);
  }

  async toggleAwaitingTree(assetId) {
    const treeRow = document.getElementById(`awaitingTreeRow-${assetId}`);
    const toggleIcon = document.getElementById(`treeToggleIcon-${assetId}`);
    if (!treeRow) return;

    const isHidden = treeRow.style.display === "none" || !treeRow.style.display;
    if (isHidden) {
      const container = document.getElementById(`awaitingTreeContent-${assetId}`);
      if (container) {
        const [asset, locations, employees, types, projects, issues] = await Promise.all([
          db.getById("assets", assetId),
          db.getAll("locations"),
          db.getAll("employees"),
          db.getAll("assetTypes"),
          db.getAll("projects"),
          db.getAll("warehouseIssues")
        ]);
        const locMap = Object.fromEntries(locations.map(l => [l.id, AppState.lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
        const empMap = Object.fromEntries(employees.map(e => [e.id, AppState.lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
        const typeMap = Object.fromEntries(types.map(t => [t.id, AppState.lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));
        const prjMap = Object.fromEntries(projects.map(p => [p.id, AppState.lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));
        const issue = issues.find(i => i.assetId === assetId && i.status === "In Transit") || issues.find(i => i.assetId === assetId) || {};

        container.innerHTML = this.buildAwaitingTreeHtml(asset, issue, locMap, empMap, prjMap, typeMap);
      }
      treeRow.style.display = "table-row";
      if (toggleIcon) toggleIcon.classList.add("expanded");
    } else {
      treeRow.style.display = "none";
      if (toggleIcon) toggleIcon.classList.remove("expanded");
    }
  }

  async openAwaitingTreeModal(assetId, issueId = null) {
    const [asset, locations, employees, types, projects, issues] = await Promise.all([
      db.getById("assets", assetId),
      db.getAll("locations"),
      db.getAll("employees"),
      db.getAll("assetTypes"),
      db.getAll("projects"),
      db.getAll("warehouseIssues")
    ]);
    if (!asset) return;

    let issue = null;
    if (issueId) issue = issues.find(i => i.id === issueId);
    if (!issue) issue = issues.find(i => i.assetId === assetId && i.status === "In Transit") || issues.find(i => i.assetId === assetId) || {};

    const locMap = Object.fromEntries(locations.map(l => [l.id, AppState.lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, AppState.lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, AppState.lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));
    const prjMap = Object.fromEntries(projects.map(p => [p.id, AppState.lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));

    const body = document.getElementById("awaitingTreeModalBody");
    if (body) {
      body.innerHTML = this.buildAwaitingTreeHtml(asset, issue, locMap, empMap, prjMap, typeMap);
    }
    const actions = document.getElementById("awaitingTreeModalActions");
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-success" onclick="App.closeModal('awaitingTreeModal'); OpsManager.openInstallationModal('${asset.id}', '${issue.id || ""}')">
          <i class="fas fa-wrench"></i> ${AppState.lang === "ar" ? "فتح نموذج التركيب" : "Open Installation Form"}
        </button>
      `;
    }
    App.openModal("awaitingTreeModal");
  }

  buildAwaitingTreeHtml(asset, issue = {}, locMap = {}, empMap = {}, prjMap = {}, typeMap = {}) {
    if (!asset) return "";
    const lang = AppState.lang;
    const issueNo = issue.issueNo || "-";
    const issueDate = issue.issueDate || issue.deliveryDate || asset.assignmentDate || "-";
    const sourceLoc = locMap[issue.warehouseLocationId || asset.locationId] || "-";
    const techName = empMap[issue.itEmployeeId || asset.currentEmployeeId] || "-";
    const prjName = prjMap[issue.projectId] || "-";
    const issueNotes = issue.notes || (lang === "ar" ? "صرف الأجهزة من المستودع لتثبيتها في الموقع" : "Warehouse dispatch for on-site installation");

    const assetCode = asset.assetId || "-";
    const productName = `${asset.brand || ""} ${asset.model || ""}`.trim() || "-";
    const serialNo = asset.serial || "-";
    const typeName = typeMap[asset.assetTypeId] || "-";
    const assetCondition = asset.condition || "Working";

    const branchName = locMap[issue.installedBranchId] || (issue.installedLocationId ? locMap[issue.installedLocationId] : (lang === "ar" ? "بانتظار التحديد" : "Pending Selection"));
    const targetLoc = locMap[issue.installedLocationId] || (lang === "ar" ? "بانتظار التحديد" : "Pending Selection");
    const targetOffice = issue.installedOffice || issue.officeName || (lang === "ar" ? "بانتظار التحديد" : "Pending Selection");
    const endUserName = empMap[issue.installedUserId || issue.endUserId] || (lang === "ar" ? "اختياري / عهدة قسم" : "Optional / Dept Custody");
    const isDraft = issue.installationStatus === "Draft";

    return `
      <div class="tree-view-wrapper">
        <!-- TIER 1: ROOT NODE - Warehouse Delivery Order -->
        <div class="tree-node-wrapper">
          <div class="tree-node-card tree-card-issue">
            <div class="tree-node-header">
              <div class="tree-node-title">
                <i class="fas fa-file-invoice text-warning fa-lg"></i>
                <span>${lang === "ar" ? "أمر صرف المستودع والتسليم المعتمد" : "Warehouse Delivery & Issue Order"}</span>
                <span class="badge badge-primary font-bold">${issueNo}</span>
                <span class="badge badge-warning">${I18N[lang].statusInTransit || "قيد النقل والتسليم"}</span>
              </div>
              ${issue.id ? `
                <button type="button" class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); OpsManager.viewIssueDetails('${issue.id}')" title="${lang === "ar" ? "عرض تفاصيل أمر الصرف" : "View Issue Details"}">
                  <i class="fas fa-eye"></i> ${lang === "ar" ? "عرض الصرف" : "View Order"}
                </button>
              ` : ""}
            </div>
            <div class="tree-node-grid">
              <div class="tree-node-field">
                <label>${I18N[lang].issueNo || "رقم الصرف"}</label>
                <div class="val font-bold text-primary">${issueNo}</div>
              </div>
              <div class="tree-node-field">
                <label>${I18N[lang].issueDate || "تاريخ الصرف والتسليم"}</label>
                <div class="val">${issueDate}</div>
              </div>
              <div class="tree-node-field">
                <label>${I18N[lang].fromWarehouse || "المستودع المصدر"}</label>
                <div class="val"><i class="fas fa-warehouse text-warning"></i> ${sourceLoc}</div>
              </div>
              <div class="tree-node-field">
                <label>${I18N[lang].itTechnician || "فني التقنية المستلم"}</label>
                <div class="val"><i class="fas fa-user-cog text-primary"></i> ${techName}</div>
              </div>
              ${prjName !== "-" ? `
                <div class="tree-node-field">
                  <label>${I18N[lang].projectName || "المشروع المرتبط"}</label>
                  <div class="val">${prjName}</div>
                </div>
              ` : ""}
              <div class="tree-node-field" style="grid-column: 1 / -1;">
                <label>${I18N[lang].notes || "ملاحظات أمر الصرف"}</label>
                <div class="val text-muted text-xs">${issueNotes}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- TIER 2: CHILD NODE 1 - Dispatched Asset Details -->
        <div class="tree-node-wrapper">
          <div class="tree-node-card tree-card-asset">
            <div class="tree-node-header">
              <div class="tree-node-title">
                <i class="fas fa-laptop text-info fa-lg"></i>
                <span>${lang === "ar" ? "الأصل المسلّم من المستودع للتثبيت" : "Dispatched Asset Item"}</span>
                <code class="serial-tag font-bold">${assetCode}</code>
                <span class="badge badge-secondary">${typeName}</span>
              </div>
              <button type="button" class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); AssetManager.openDetailsModal('${asset.id}')" title="${lang === "ar" ? "فتح بطاقة الأصل" : "View Asset Details"}">
                <i class="fas fa-desktop"></i> ${lang === "ar" ? "بطاقة الأصل" : "Asset Card"}
              </button>
            </div>
            <div class="tree-node-grid">
              <div class="tree-node-field">
                <label>${I18N[lang].assetId || "كود الأصل"}</label>
                <div class="val font-bold text-primary">${assetCode}</div>
              </div>
              <div class="tree-node-field">
                <label>${I18N[lang].brand || "المنتج والموديل"}</label>
                <div class="val font-bold">${productName}</div>
              </div>
              <div class="tree-node-field">
                <label>${I18N[lang].serialNumber || "الرقم التسلسلي"}</label>
                <div class="val"><code>${serialNo}</code></div>
              </div>
              <div class="tree-node-field">
                <label>${I18N[lang].assetCondition || "الحالة الفنية"}</label>
                <div class="val"><span class="badge badge-success">${assetCondition}</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- TIER 3: CHILD NODE 2 - Field Installation & Linkages -->
        <div class="tree-node-wrapper">
          <div class="tree-node-card tree-card-install">
            <div class="tree-node-header">
              <div class="tree-node-title">
                <i class="fas fa-tools text-success fa-lg"></i>
                <span>${lang === "ar" ? "إجراء التركيب والربط الميداني بالموقع" : "Target Field Installation & Linkages"}</span>
                ${isDraft 
                  ? `<span class="badge badge-warning"><i class="fas fa-pencil-alt"></i> ${lang === "ar" ? "مسودة محفوظة" : "Draft Saved"}</span>` 
                  : `<span class="badge badge-secondary"><i class="fas fa-clock"></i> ${lang === "ar" ? "بانتظار بدء التثبيت" : "Awaiting Installation"}</span>`}
              </div>
              <button type="button" class="btn btn-sm btn-success" onclick="event.stopPropagation(); OpsManager.openInstallationModal('${asset.id}', '${issue.id || ""}')">
                <i class="fas fa-wrench"></i> <strong>${isDraft ? (lang === "ar" ? "تعديل مسودة التركيب" : "Edit Draft") : (lang === "ar" ? "استكمال نموذج التركيب الآن" : "Complete Installation")}</strong>
              </button>
            </div>
            <div class="tree-node-grid">
              <div class="tree-node-field">
                <label><i class="fas fa-building text-primary"></i> ${lang === "ar" ? "الفرع المستهدف" : "Target Branch"}</label>
                <div class="val font-bold text-primary">${branchName}</div>
              </div>
              <div class="tree-node-field">
                <label><i class="fas fa-map-marker-alt text-primary"></i> ${lang === "ar" ? "الموقع / المبنى" : "Location"}</label>
                <div class="val">${targetLoc}</div>
              </div>
              <div class="tree-node-field">
                <label><i class="fas fa-door-open text-primary"></i> ${lang === "ar" ? "المكتب / القاعة" : "Office / Room"}</label>
                <div class="val">${targetOffice}</div>
              </div>
              <div class="tree-node-field">
                <label><i class="fas fa-user-check text-primary"></i> ${lang === "ar" ? "الموظف المستلم (العهدة)" : "Assigned Employee"}</label>
                <div class="val">${endUserName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * View Warehouse Issue Details (Pure Read-Only Modal)
   */
  async viewIssueDetails(issueId) {
    if (!issueId) return;
    const issue = await db.getById("warehouseIssues", issueId);
    if (!issue) return;

    const lang = AppState.lang;
    const [assets, locations, employees, projects] = await Promise.all([
      db.getAll("assets"),
      db.getAll("locations"),
      db.getAll("employees"),
      db.getAll("projects")
    ]);

    const asset = assets.find(a => a.id === issue.assetId) || {};
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const prjMap = Object.fromEntries(projects.map(p => [p.id, lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr)]));

    document.getElementById("vwiIssueNo").textContent = issue.issueNo || "-";
    document.getElementById("vwiIssueDate").textContent = issue.issueDate || "-";
    document.getElementById("vwiStatus").textContent = issue.status === "Installed" ? (lang === "ar" ? "تم التركيب" : "Installed") : (lang === "ar" ? "قيد النقل / بانتظار التركيب" : "In Transit / Awaiting Installation");
    document.getElementById("vwiAssetCode").textContent = asset.assetId || "-";
    document.getElementById("vwiProduct").textContent = `${asset.brand || ""} ${asset.model || ""}`;
    document.getElementById("vwiSerial").textContent = asset.serial || "-";
    document.getElementById("vwiWarehouse").textContent = locMap[issue.warehouseLocationId] || "-";
    document.getElementById("vwiTechnician").textContent = empMap[issue.itEmployeeId] || "-";
    document.getElementById("vwiProject").textContent = issue.projectId ? (prjMap[issue.projectId] || "-") : "-";
    document.getElementById("vwiNotes").textContent = issue.notes || "-";

    const instDateWrap = document.getElementById("vwiInstallDateWrap");
    const instLocWrap = document.getElementById("vwiInstallLocWrap");
    const endUserWrap = document.getElementById("vwiEndUserWrap");

    if (issue.status === "Installed") {
      if (instDateWrap) {
        instDateWrap.style.display = "block";
        document.getElementById("vwiInstallDate").textContent = issue.installationDate || "-";
      }
      if (instLocWrap) {
        instLocWrap.style.display = "block";
        document.getElementById("vwiInstallLocation").textContent = locMap[issue.installedLocationId] || "-";
      }
      if (endUserWrap) {
        endUserWrap.style.display = "block";
        document.getElementById("vwiEndUser").textContent = issue.endUserId ? (empMap[issue.endUserId] || "-") : (lang === "ar" ? "بدون موظف (موقع عام)" : "None (Shared)");
      }
    } else {
      if (instDateWrap) instDateWrap.style.display = "none";
      if (instLocWrap) instLocWrap.style.display = "none";
      if (endUserWrap) endUserWrap.style.display = "none";
    }

    App.openModal("viewWarehouseIssueModal");
  }

  viewCurrentIssue() {
    if (this.currentActiveIssueId) {
      this.viewIssueDetails(this.currentActiveIssueId);
    } else {
      App.showToast(AppState.lang === "ar" ? "لا يوجد سجل صرف مرتبط" : "No linked issue record", "info");
    }
  }

  viewCurrentAsset() {
    if (this.currentActiveAssetId && window.AssetManager) {
      AssetManager.openDetailsModal(this.currentActiveAssetId);
    }
  }

  viewCurrentAssetHistory() {
    if (this.currentActiveAssetId && window.AssetManager) {
      AssetManager.openDetailsModal(this.currentActiveAssetId);
      AssetManager.switchDetailsTab("history");
    }
  }
}

// Singletons & Global Exports
const ContractorManager = new ContractorManagementController();
const ProjectManager = new ProjectManagementController();
const OpsManager = new AssetOperationsController();

window.ContractorManager = ContractorManager;
window.ProjectManager = ProjectManager;
window.OpsManager = OpsManager;

// Bridge helpers onto AssetManager for seamless invocation
if (window.AssetManager) {
  AssetManager.openWarehouseIssueModal = OpsManager.openWarehouseIssueModal.bind(OpsManager);
  AssetManager.handleWarehouseIssueSubmit = OpsManager.handleWarehouseIssueSubmit.bind(OpsManager);
  AssetManager.openInstallationModal = OpsManager.openInstallationModal.bind(OpsManager);
  AssetManager.handleInstallationSubmit = OpsManager.handleInstallationSubmit.bind(OpsManager);
  AssetManager.viewIssueDetails = OpsManager.viewIssueDetails.bind(OpsManager);
  AssetManager.openInstalledDeviceDetailsModal = OpsManager.openInstalledDeviceDetailsModal.bind(OpsManager);
  AssetManager.openRemoveFromInstallationModal = OpsManager.openRemoveFromInstallationModal.bind(OpsManager);
  AssetManager.handleRemoveFromInstallationSubmit = OpsManager.handleRemoveFromInstallationSubmit.bind(OpsManager);
}
