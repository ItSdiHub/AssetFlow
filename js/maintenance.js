/**
 * SDI IT Asset Hub - Maintenance Management Controller
 * Handles Repair Tickets, Technician Actions, and Asset State Synchronization
 */

class MaintenanceController {
  constructor() {
    this.filterStatus = "";
  }

  // =========================================================================
  // 1. RENDER MAINTENANCE TICKETS TABLE
  // =========================================================================
  async render() {
    const tableBody = document.getElementById("maintenanceTableBody");
    if (!tableBody) return;

    const tickets = await db.getAll("maintenance");
    const assets = await db.getAll("assets");
    const lang = AppState.lang;

    const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));

    const filterSelect = document.getElementById("maintFilterStatus");
    const statusFilter = filterSelect ? filterSelect.value : "";
    const searchInput = document.getElementById("maintSearchInput");
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const filtered = tickets.filter(t => {
      if (statusFilter === "Active") {
        if (t.status !== "Open" && t.status !== "In Progress") return false;
      } else if (statusFilter && t.status !== statusFilter) {
        return false;
      }
      if (searchVal) {
        const asset = assetMap[t.assetId] || {};
        const str = `${t.ticketNo || t.id || ""} ${asset.assetId || ""} ${asset.brand || ""} ${asset.model || ""} ${t.technician || ""} ${t.problem || ""} ${t.notes || ""} ${t.employeeId || ""} ${t.employeeName || ""} ${t.employeeNameAr || ""} ${t.employeeNameEn || ""} ${t.employeeNumber || ""} ${t.departmentName || ""} ${t.locationName || ""}`.toLowerCase();
        if (!str.includes(searchVal)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.maintenanceDate || 0) - new Date(a.maintenanceDate || 0));

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-5">
            <div class="empty-state">
              <i class="fas fa-clipboard-check empty-icon"></i>
              <h4>${lang === 'ar' ? 'لا توجد بطاقات صيانة حالية' : 'No maintenance tickets'}</h4>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    filtered.forEach(t => {
      const asset = assetMap[t.assetId];
      const assetTag = asset ? asset.assetId : "Unknown";
      const assetName = asset ? `${asset.brand || ""} ${asset.model || ""}` : "-";

      let statusBadge = "badge-danger";
      if (t.status === "Completed") statusBadge = "badge-success";
      else if (t.status === "In Progress") statusBadge = "badge-warning";

      const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

      html += `
        <tr>
          <td><span class="emp-id-badge">${t.id}</span></td>
          <td>
            <a href="javascript:void(0)" onclick="AssetManager.openDetailsModal('${t.assetId}')" class="font-bold text-primary">
              ${assetTag}
            </a>
            <div class="text-xs text-muted">${assetName}</div>
          </td>
          <td>
            ${t.employeeId || t.employeeName ? `
              <div class="font-bold text-sm">${lang === 'ar' ? (t.employeeNameAr || t.employeeName) : (t.employeeNameEn || t.employeeName)}</div>
              <div class="text-xs text-muted" style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
                <span class="emp-id-badge" style="font-size: 11px; padding: 2px 6px;">${t.employeeId}</span>
                ${t.employeeNumber && t.employeeNumber !== t.employeeId ? `<span class="badge badge-secondary" style="font-size: 10px;">#${t.employeeNumber}</span>` : ''}
              </div>
            ` : `<span class="text-muted text-xs">-</span>`}
          </td>
          <td>
            ${t.departmentName || t.locationName ? `
              <div class="text-sm font-semibold">${t.departmentName || '-'}</div>
              <div class="text-xs text-muted"><i class="fas fa-map-marker-alt text-danger"></i> ${t.locationName || '-'}</div>
            ` : `<span class="text-muted text-xs">-</span>`}
          </td>
          <td>${t.maintenanceDate || "-"}</td>
          <td>
            <div class="font-bold">${(lang === 'en' && t.problemEn) ? t.problemEn : (t.problem || "-")}</div>
            ${t.actionTaken ? `<div class="text-xs text-success"><i class="fas fa-check"></i> ${(lang === 'en' && t.actionTakenEn) ? t.actionTakenEn : t.actionTaken}</div>` : ''}
          </td>
          <td>${lang === 'en' ? (t.technicianEn || (t.technician && !/[\u0600-\u06FF]/.test(t.technician) ? t.technician : (t.vendor || "IT Support"))) : (t.technician || t.vendor || "-")}</td>
          <td>${t.cost ? t.cost + ' AED' : '0'}</td>
          <td><span class="badge ${statusBadge}">${lang === 'ar' ? (t.status === 'Completed' ? 'مكتمل' : (t.status === 'In Progress' ? 'قيد المعالجة' : 'مفتوح')) : t.status}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-xs btn-secondary" onclick="MaintManager.openEditModal('${t.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                <i class="fas fa-edit"></i>
              </button>
              ${t.status !== "Completed" && !isViewer ? `
                <button class="btn btn-xs btn-primary" onclick="MaintManager.openCompleteModal('${t.id}')" title="${lang === 'ar' ? 'إنهاء الصيانة' : 'Complete Maintenance'}">
                  <i class="fas fa-check"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  // =========================================================================
  // 2. ADD & SEND TO MAINTENANCE MODAL
  // =========================================================================
  async openAddModal() {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }

    const form = document.getElementById("maintenanceModalForm");
    form.reset();
    document.getElementById("formMaintId").value = "";
    document.getElementById("maintenanceModalTitle").textContent = AppState.lang === "ar" ? "تسجيل عطل / طلب صيانة جديد" : "New Maintenance Ticket";

    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const lang = AppState.lang;

    // 1. Assets Dropdown
    const assetSelect = document.getElementById("formMaintAssetId");
    if (assetSelect) {
      const selectPlaceholder = lang === "ar" ? "-- اختر الأصل المطلوب صيانته --" : "-- Select Asset for Maintenance --";
      assetSelect.innerHTML = `<option value="">${selectPlaceholder}</option>` +
        assets.map(a => `<option value="${a.id}">${a.assetId} - ${a.brand} ${a.model} (${AssetManager.formatStatus(a.status)})</option>`).join("");
    }

    // 2. Employees Dropdown (showing EMP ID and Org badge)
    const empSelect = document.getElementById("formMaintEmployeeId");
    if (empSelect) {
      const selectEmpPlaceholder = lang === "ar" ? "-- اختر الموظف (المسؤول / العهدة) --" : "-- Select Employee (Optional) --";
      empSelect.innerHTML = `<option value="">${selectEmpPlaceholder}</option>` +
        employees.filter(e => e.status === "Active").map(e => {
          const name = lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr);
          const orgPart = e.employeeNumber && e.employeeNumber !== e.id ? ` - #${e.employeeNumber}` : "";
          return `<option value="${e.id}">${name} (${e.id}${orgPart})</option>`;
        }).join("");
    }

    // 3. Departments Dropdown
    const deptSelect = document.getElementById("formMaintDepartmentId");
    if (deptSelect) {
      const selectDeptPlaceholder = lang === "ar" ? "-- اختر القسم / الإدارة --" : "-- Select Department --";
      deptSelect.innerHTML = `<option value="">${selectDeptPlaceholder}</option>` +
        departments.filter(d => d.active !== false).map(d => {
          const name = lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr);
          return `<option value="${d.id}">${name} (${d.code || d.id})</option>`;
        }).join("");
    }

    // 4. Locations Dropdown
    const locSelect = document.getElementById("formMaintLocationId");
    if (locSelect) {
      const selectLocPlaceholder = lang === "ar" ? "-- اختر الموقع / الفرع --" : "-- Select Location --";
      locSelect.innerHTML = `<option value="">${selectLocPlaceholder}</option>` +
        locations.filter(l => l.active !== false).map(l => {
          const name = lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr);
          return `<option value="${l.id}">${name} (${l.code || l.id})</option>`;
        }).join("");
    }

    document.getElementById("formMaintDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("formMaintStatus").value = "In Progress";
    document.getElementById("formMaintCost").value = "0";

    App.openModal("maintenanceModal");
  }

  // Cascading Linkage Handlers for Maintenance Modal
  async handleLocationSelect(locationId) {
    await this.syncMaintenanceFilters("location", locationId);
  }

  async handleDepartmentSelect(deptId) {
    await this.syncMaintenanceFilters("department", deptId);
  }

  async handleEmployeeSelect(empId) {
    await this.syncMaintenanceFilters("employee", empId);
  }

  async handleAssetSelect(assetId) {
    await this.syncMaintenanceFilters("asset", assetId);
  }

  async syncMaintenanceFilters(triggerSource, value) {
    const lang = AppState.lang;
    const locSelect = document.getElementById("formMaintLocationId");
    const deptSelect = document.getElementById("formMaintDepartmentId");
    const empSelect = document.getElementById("formMaintEmployeeId");
    const assetSelect = document.getElementById("formMaintAssetId");

    if (!locSelect || !deptSelect || !empSelect || !assetSelect) return;

    // 1. Gather current selected values (before any change or after trigger)
    let locId = locSelect.value;
    let deptId = deptSelect.value;
    let empId = empSelect.value;
    let assetId = assetSelect.value;

    // Update based on the trigger field
    if (triggerSource === "location") {
      locId = value;
    } else if (triggerSource === "department") {
      deptId = value;
    } else if (triggerSource === "employee") {
      empId = value;
    } else if (triggerSource === "asset") {
      assetId = value;
    }

    // 2. Load necessary metadata from database
    const [locations, departments, employees, assets] = await Promise.all([
      db.getAll("locations"),
      db.getAll("departments"),
      db.getAll("employees"),
      db.getAll("assets")
    ]);

    const activeLocations = locations.filter(l => l.active !== false);
    const activeDepts = departments.filter(d => d.active !== false);
    const activeEmps = employees.filter(e => e.status === "Active");

    const deptMap = {};
    activeDepts.forEach(d => { deptMap[d.id] = d; });
    const empMap = {};
    activeEmps.forEach(e => { empMap[e.id] = e; });
    const assetMap = {};
    assets.forEach(a => { assetMap[a.id] = a; });

    // Helper functions for validation
    const getEmpLocation = (emp) => {
      if (emp.locationId) return emp.locationId;
      if (emp.departmentId && deptMap[emp.departmentId]) {
        return deptMap[emp.departmentId].locationId;
      }
      return null;
    };

    // 3. Resolve Trigger Context & Cascading Validations
    if (triggerSource === "asset") {
      if (assetId) {
        const targetAsset = assetMap[assetId];
        if (targetAsset) {
          // If the asset has a current employee assigned, select that employee
          empId = targetAsset.currentEmployeeId || "";
          
          // Department can be derived from the asset, or if not present, from the employee
          deptId = targetAsset.departmentId || "";
          if (!deptId && empId && empMap[empId]) {
            deptId = empMap[empId].departmentId || "";
          }

          // Location can be derived from the asset, or employee, or department
          locId = targetAsset.locationId || "";
          if (!locId && empId && empMap[empId]) {
            locId = getEmpLocation(empMap[empId]) || "";
          }
          if (!locId && deptId && deptMap[deptId]) {
            locId = deptMap[deptId].locationId || "";
          }
        }
      }
    } else if (triggerSource === "employee") {
      if (empId) {
        const targetEmp = empMap[empId];
        if (targetEmp) {
          deptId = targetEmp.departmentId || "";
          locId = getEmpLocation(targetEmp) || "";
        }
        // Validate assetId: Is the asset in this employee's custody?
        if (assetId) {
          const targetAsset = assetMap[assetId];
          if (!targetAsset || targetAsset.currentEmployeeId !== empId) {
            assetId = ""; // Clear invalid asset
          }
        }
      } else {
        // If employee is cleared, we should clear assetId if it belongs to some employee
        if (assetId) {
          const targetAsset = assetMap[assetId];
          if (targetAsset && targetAsset.currentEmployeeId) {
            assetId = "";
          }
        }
      }
    } else if (triggerSource === "department") {
      if (deptId) {
        const targetDept = deptMap[deptId];
        if (targetDept && targetDept.locationId) {
          // Respect already set locId if they match, or override if different
          locId = targetDept.locationId;
        }
        // Validate employeeId: Does the employee belong to the new department?
        if (empId) {
          const targetEmp = empMap[empId];
          if (!targetEmp || targetEmp.departmentId !== deptId) {
            empId = "";
            assetId = ""; // Also clear asset if employee is cleared
          }
        }
        // Validate assetId (when no employee is chosen): Does the asset belong to the department?
        if (assetId && !empId) {
          const targetAsset = assetMap[assetId];
          if (!targetAsset || targetAsset.departmentId !== deptId) {
            assetId = "";
          }
        }
      } else {
        // If department is cleared: Clear children
        empId = "";
        assetId = "";
      }
    } else if (triggerSource === "location") {
      if (locId) {
        // Validate department: Does department belong to the new location?
        if (deptId) {
          const targetDept = deptMap[deptId];
          if (!targetDept || targetDept.locationId !== locId) {
            deptId = "";
            empId = ""; // Also clear child employee
            assetId = ""; // Also clear child asset
          }
        }
        // Validate employee: Does employee belong to the new location?
        if (empId) {
          const targetEmp = empMap[empId];
          if (!targetEmp || getEmpLocation(targetEmp) !== locId) {
            empId = "";
            assetId = "";
          }
        }
        // Validate asset: Does asset belong to the new location?
        if (assetId) {
          const targetAsset = assetMap[assetId];
          if (!targetAsset || targetAsset.locationId !== locId) {
            assetId = "";
          }
        }
      }
    }

    // 4. Set Selection Dropdowns values in DOM
    locSelect.value = locId;
    deptSelect.value = deptId;
    empSelect.value = empId;
    assetSelect.value = assetId;

    // 5. Re-render/Re-populate Option Lists based on the active filtered context

    // --- REBUILD DEPARTMENTS ---
    let filteredDepts = activeDepts;
    if (locId) {
      filteredDepts = activeDepts.filter(d => d.locationId === locId);
    }
    const selectDeptPlaceholder = lang === "ar" ? "-- اختر القسم / الإدارة --" : "-- Select Department --";
    deptSelect.innerHTML = `<option value="">${selectDeptPlaceholder}</option>` +
      filteredDepts.map(d => {
        const name = lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr);
        return `<option value="${d.id}">${name} (${d.code || d.id})</option>`;
      }).join("");

    // Restore selected value, or auto-select if there is exactly 1 department (Location First)
    if (deptId && filteredDepts.some(d => d.id === deptId)) {
      deptSelect.value = deptId;
    } else if (!deptId && filteredDepts.length === 1 && triggerSource === "location") {
      deptId = filteredDepts[0].id;
      deptSelect.value = deptId;
    } else {
      deptId = "";
      deptSelect.value = "";
    }

    // --- REBUILD EMPLOYEES ---
    let filteredEmps = activeEmps;
    if (deptId) {
      filteredEmps = filteredEmps.filter(e => e.departmentId === deptId);
    }
    if (locId) {
      filteredEmps = filteredEmps.filter(e => getEmpLocation(e) === locId);
    }
    const selectEmpPlaceholder = lang === "ar" ? "-- اختر الموظف (المسؤول / العهدة) --" : "-- Select Employee (Optional) --";
    empSelect.innerHTML = `<option value="">${selectEmpPlaceholder}</option>` +
      filteredEmps.map(e => {
        const name = lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr);
        const orgPart = e.employeeNumber && e.employeeNumber !== e.id ? ` - #${e.employeeNumber}` : "";
        return `<option value="${e.id}">${name} (${e.id}${orgPart})</option>`;
      }).join("");

    if (empId && filteredEmps.some(e => e.id === empId)) {
      empSelect.value = empId;
    } else {
      empId = "";
      empSelect.value = "";
    }

    // --- REBUILD ASSETS ---
    let filteredAssets = assets;
    if (empId) {
      filteredAssets = assets.filter(a => a.currentEmployeeId === empId);
    } else {
      if (deptId) {
        filteredAssets = filteredAssets.filter(a => a.departmentId === deptId);
      }
      if (locId) {
        filteredAssets = filteredAssets.filter(a => a.locationId === locId);
      }
    }
    const selectAssetPlaceholder = lang === "ar" ? "-- اختر الأصل المطلوب صيانته --" : "-- Select Asset for Maintenance --";
    assetSelect.innerHTML = `<option value="">${selectAssetPlaceholder}</option>` +
      filteredAssets.map(a => `<option value="${a.id}">${a.assetId} - ${a.brand} ${a.model} (${AssetManager.formatStatus(a.status)})</option>`).join("");

    if (assetId && filteredAssets.some(a => a.id === assetId)) {
      assetSelect.value = assetId;
    } else if (!assetId && filteredAssets.length === 1 && empId) {
      assetId = filteredAssets[0].id;
      assetSelect.value = assetId;
    } else {
      assetId = "";
      assetSelect.value = "";
    }
  }

  async openAddModalForAsset(assetId) {
    await this.openAddModal();
    const assetSelect = document.getElementById("formMaintAssetId");
    if (assetSelect) {
      assetSelect.value = assetId;
      await this.handleAssetSelect(assetId);
    }
  }

  async openAddModalForHelpdesk(req) {
    await this.openAddModal();
    this.linkedRequestId = req.id;
    const title = document.getElementById("maintenanceModalTitle");
    if (title) title.textContent = AppState.lang === "ar" ? `إنشاء بطاقة صيانة لطلب الدعم (${req.requestId || req.id})` : `Create Maintenance for (${req.requestId || req.id})`;
    const assetSelect = document.getElementById("formMaintAssetId");
    if (assetSelect && req.assetId) {
      assetSelect.value = req.assetId;
      await this.handleAssetSelect(req.assetId);
    }
    if (req.employeeId) {
      const empSelect = document.getElementById("formMaintEmployeeId");
      if (empSelect) {
        empSelect.value = req.employeeId;
        await this.handleEmployeeSelect(req.employeeId);
      }
    }
    const problemInp = document.getElementById("formMaintProblem");
    if (problemInp) problemInp.value = `[${req.requestId || req.id}] ${req.subject}: ${req.description || ""}`;
  }

  async openEditModal(ticketId) {
    const t = await db.getById("maintenance", ticketId);
    if (!t) return;

    await this.openAddModal();
    document.getElementById("maintenanceModalTitle").textContent = AppState.lang === "ar" ? "تعديل بطاقة الصيانة" : "Edit Maintenance Ticket";
    document.getElementById("formMaintId").value = t.id;
    document.getElementById("formMaintAssetId").value = t.assetId;
    if (document.getElementById("formMaintEmployeeId")) {
      document.getElementById("formMaintEmployeeId").value = t.employeeId || "";
    }
    if (document.getElementById("formMaintDepartmentId")) {
      document.getElementById("formMaintDepartmentId").value = t.departmentId || "";
    }
    if (document.getElementById("formMaintLocationId")) {
      document.getElementById("formMaintLocationId").value = t.locationId || "";
    }
    document.getElementById("formMaintDate").value = t.maintenanceDate || "";
    document.getElementById("formMaintStatus").value = t.status || "Open";
    if (document.getElementById("formMaintTech")) document.getElementById("formMaintTech").value = t.technician || "";
    if (document.getElementById("formMaintTechnician")) document.getElementById("formMaintTechnician").value = t.technician || "";
    document.getElementById("formMaintVendor").value = t.vendor || "";
    document.getElementById("formMaintCost").value = t.cost || 0;
    document.getElementById("formMaintReturnDate").value = t.returnDate || "";
    document.getElementById("formMaintProblem").value = t.problem || "";
    document.getElementById("formMaintAction").value = t.actionTaken || "";
    document.getElementById("formMaintNotes").value = t.notes || "";
  }

  async handleSaveTicket(event) {
    event.preventDefault();
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(AppState.lang === "ar" ? "غير مصرح لك بإجراء عمليات الصيانة." : "Unauthorized to perform maintenance operations.", "error");
      return;
    }
    const id = document.getElementById("formMaintId").value;
    const assetId = document.getElementById("formMaintAssetId").value;
    let empId = document.getElementById("formMaintEmployeeId")?.value || "";
    let deptId = document.getElementById("formMaintDepartmentId")?.value || "";
    let locId = document.getElementById("formMaintLocationId")?.value || "";
    const maintenanceDate = document.getElementById("formMaintDate").value;
    const status = document.getElementById("formMaintStatus").value;
    const techEl = document.getElementById("formMaintTechnician") || document.getElementById("formMaintTech");
    const technician = techEl ? techEl.value.trim() : "";
    const vendor = (document.getElementById("formMaintVendor")?.value || "").trim();
    const cost = parseFloat(document.getElementById("formMaintCost")?.value) || 0;
    const returnDate = document.getElementById("formMaintReturnDate")?.value || "";
    const problem = (document.getElementById("formMaintProblem")?.value || "").trim();
    const actionTaken = (document.getElementById("formMaintAction")?.value || "").trim();
    const notes = (document.getElementById("formMaintNotes")?.value || "").trim();

    if (!problem) {
      App.showToast(I18N[AppState.lang].errProblemReq, "error");
      return;
    }

    // Validate custody relationship if both are selected
    if (empId && assetId) {
      const actualAsset = await db.getById("assets", assetId);
      if (!actualAsset || actualAsset.currentEmployeeId !== empId) {
        const msg = AppState.lang === "ar" 
          ? "تنبيه: هذا الجهاز غير مسند للموظف المختار!" 
          : "Alert: This asset is not assigned to the selected employee!";
        App.showToast(msg, "error");
        return;
      }
    }

    // Auto-detect employee / department / location from asset if not set
    const targetAsset = assetId ? await db.getById("assets", assetId) : null;
    if (!empId && targetAsset && targetAsset.currentEmployeeId) {
      empId = targetAsset.currentEmployeeId;
    }
    if (!deptId && targetAsset && targetAsset.departmentId) {
      deptId = targetAsset.departmentId;
    }
    if (!locId && targetAsset && targetAsset.locationId) {
      locId = targetAsset.locationId;
    }

    const emp = empId ? await db.getById("employees", empId) : null;
    if (emp && !deptId && emp.departmentId) {
      deptId = emp.departmentId;
    }
    const dept = deptId ? await db.getById("departments", deptId) : null;
    const loc = locId ? await db.getById("locations", locId) : null;

    const nextSeq = await db.getNextSequentialId("maintenance");
    const ticketData = {
      id: id || nextSeq,
      assetId,
      employeeId: emp ? (emp.id || empId) : (empId || ""),
      employeeName: emp ? (AppState.lang === "ar" ? emp.nameAr : (emp.nameEn || emp.nameAr)) : "",
      employeeNameAr: emp ? emp.nameAr : "",
      employeeNameEn: emp ? (emp.nameEn || emp.nameAr) : "",
      employeeNumber: emp ? (emp.employeeNumber || "") : "",
      departmentId: deptId,
      departmentName: dept ? (AppState.lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr)) : "",
      departmentNameAr: dept ? dept.nameAr : "",
      departmentNameEn: dept ? (dept.nameEn || dept.nameAr) : "",
      locationId: locId,
      locationName: loc ? (AppState.lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)) : "",
      locationNameAr: loc ? loc.nameAr : "",
      locationNameEn: loc ? (loc.nameEn || loc.nameAr) : "",
      maintenanceDate,
      status,
      technician,
      vendor,
      cost,
      returnDate,
      problem,
      actionTaken,
      notes
    };

    await db.put("maintenance", ticketData);

    // Link with Helpdesk Request if initiated from Helpdesk (REQ-9)
    if (this.linkedRequestId) {
      const helpdeskReq = await db.getById("helpdeskRequests", this.linkedRequestId);
      if (helpdeskReq) {
        helpdeskReq.maintenanceId = ticketData.id;
        if (helpdeskReq.status === "New") helpdeskReq.status = "In Progress";
        if (!helpdeskReq.messages) helpdeskReq.messages = [];
        helpdeskReq.messages.push({
          id: "msg-" + Date.now(),
          senderType: "IT",
          senderName: AppState.lang === "ar" ? "نظام الصيانة (Maintenance)" : "Maintenance System",
          senderNameEn: "Maintenance System",
          text: AppState.lang === "ar" 
            ? `تم تحويل الطلب لبطاقة صيانة رقم (${ticketData.id}) وبدء الفحص والإصلاح الميداني.` 
            : `Maintenance ticket (${ticketData.id}) created for hardware inspection and repair.`,
          textEn: `Maintenance ticket (${ticketData.id}) created for hardware inspection and repair.`,
          date: new Date().toISOString().replace("T", " ").substring(0, 19)
        });
        await db.put("helpdeskRequests", helpdeskReq);
        App.showToast(I18N[AppState.lang].linkedMaintSuccess || (AppState.lang === "ar" ? "تم ربط سجل الصيانة بالطلب بنجاح" : "Maintenance ticket linked to request"), "success");
      }
      this.linkedRequestId = null;
    }

    // Update Asset Status
    const asset = await db.getById("assets", assetId);
    if (asset) {
      if (status === "Completed") {
        asset.status = asset.currentEmployeeId ? "Assigned" : "Available";
        await db.put("assets", asset);
        await db.logTransaction({
          assetId: asset.id,
          transactionType: "Returned from Maintenance",
          transactionDate: (returnDate || maintenanceDate) + " " + new Date().toTimeString().slice(0, 8),
          performedBy: (typeof getUserDisplayName === "function" && AppState.currentUser) ? getUserDisplayName(AppState.currentUser, AppState.lang) : "admin",
          notes: AppState.lang === "ar" ? `انتهاء أعمال الصيانة والإصلاح: ${actionTaken || problem}` : `Maintenance and repair completed: ${actionTaken || problem}`
        });
      } else {
        if (asset.status !== "Under Maintenance") {
          asset.status = "Under Maintenance";
          await db.put("assets", asset);
          await db.logTransaction({
            assetId: asset.id,
            transactionType: "Sent to Maintenance",
            transactionDate: maintenanceDate + " " + new Date().toTimeString().slice(0, 8),
            performedBy: (typeof getUserDisplayName === "function" && AppState.currentUser) ? getUserDisplayName(AppState.currentUser, AppState.lang) : "admin",
            notes: AppState.lang === "ar" ? `إرسال للصيانة بسبب: ${problem}` : `Sent to maintenance due to: ${problem}`
          });
        }
      }
    }

    App.closeModal("maintenanceModal");
    App.showToast(I18N[AppState.lang].maintRecordCreatedSuccess || "تم إنشاء سجل الصيانة بنجاح.", "success");
    await this.render();
    await AssetManager.render();
    await App.updateDashboard();

    if (AssetManager.currentDetailAssetId === assetId) {
      await AssetManager.openDetailsModal(assetId);
    }
  }

  // Complete Maintenance Directly
  async openCompleteModal(ticketId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(AppState.lang === "ar" ? "غير مصرح لك بإجراء عمليات الصيانة." : "Unauthorized to perform maintenance operations.", "error");
      return;
    }
    const t = await db.getById("maintenance", ticketId);
    if (!t) return;

    const action = prompt(AppState.lang === "ar" ? "يرجى إدخال تفاصيل الإصلاح والإجراء المتخذ لإغلاق بطاقة الصيانة:" : "Please enter repair details and action taken to close maintenance ticket:", t.actionTaken || (AppState.lang === "ar" ? "تم الإصلاح بنجاح وفحص كفاءة التشغيل" : "Repaired successfully and operational test passed"));
    if (action === null) return;

    const costInput = prompt(AppState.lang === "ar" ? "التكلفة النهائية للإصلاح (AED):" : "Final repair cost (AED):", t.cost || "0");
    const cost = parseFloat(costInput) || 0;

    t.actionTaken = action;
    t.cost = cost;
    t.status = "Completed";
    t.returnDate = new Date().toISOString().slice(0, 10);
    await db.put("maintenance", t);

    // Update asset
    const asset = await db.getById("assets", t.assetId);
    if (asset) {
      asset.status = asset.currentEmployeeId ? "Assigned" : "Available";
      await db.put("assets", asset);

      await db.logTransaction({
        assetId: asset.id,
        transactionType: "Returned from Maintenance",
        transactionDate: new Date().toISOString().replace("T", " ").substring(0, 19),
        performedBy: (typeof getUserDisplayName === "function" && AppState.currentUser) ? getUserDisplayName(AppState.currentUser, AppState.lang) : "admin",
        notes: AppState.lang === "ar" ? `إنهاء الصيانة واستلام الأصل: ${action} (التكلفة: ${cost} درهم)` : `Maintenance completed and asset returned: ${action} (Cost: ${cost} AED)`
      });
    }

    App.showToast(AppState.lang === "ar" ? "تم إغلاق بطاقة الصيانة وإعادة الأصل للخدمة بنجاح" : "Maintenance ticket closed and asset returned to service successfully", "success");
    await this.render();
    await AssetManager.render();
    await App.updateDashboard();

    if (AssetManager.currentDetailAssetId === t.assetId) {
      await AssetManager.openDetailsModal(t.assetId);
    }
  }

  async openCompleteModalForAsset(assetId) {
    const allMaint = await db.getAll("maintenance");
    const active = allMaint.find(m => m.assetId === assetId && m.status !== "Completed");
    if (active) {
      await this.openCompleteModal(active.id);
    } else {
      // Prompt direct status restoration
      await AssetManager.updateAssetStatusPrompt(assetId, "Available");
    }
  }

  resetFilters() {
    const s = document.getElementById("maintSearchInput");
    if (s) s.value = "";
    const st = document.getElementById("maintFilterStatus");
    if (st) st.value = "";
    this.render();
  }
}

// Global Singleton
const MaintManager = new MaintenanceController();
MaintManager.renderMaintenanceList = function() { return this.render(); };
window.MaintManager = MaintManager;
window.MaintenanceManager = MaintManager;
