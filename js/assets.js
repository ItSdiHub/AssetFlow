/**
 * SDI IT Asset Hub - Asset Inventory Manager
 * Complete Lifecycle: Creation, Assignment, Transfer, Return, Maintenance, and History
 */

class AssetInventoryManager {
  constructor() {
    this.currentFilterType = "";
    this.currentFilterStatus = "";
    this.currentFilterDept = "";
    this.currentFilterLoc = "";
    this.currentFilterEmp = "";
    this.currentFilterBrand = "";
    this.currentFilterWarranty = "";
    this.currentSearchText = "";
    this.activeDetailTab = "general";
    this.currentDetailAssetId = null;
  }

  // =========================================================================
  // 1. ASSET LIST & TABLE RENDERING
  // =========================================================================
  async render() {
    const tableBody = document.getElementById("assetsTableBody");
    if (!tableBody) return;

    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const assetTypes = await db.getAll("assetTypes");
    const lang = AppState.lang;

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const typeMap = Object.fromEntries(assetTypes.map(t => [t.id, t]));

    // Administrative Alert for Assets Requiring Location Assignment
    const unassignedLocAssets = assets.filter(a => !a.locationId);
    const alertContainer = document.getElementById("assetLocationAlertContainer");
    if (alertContainer) {
      if (unassignedLocAssets.length > 0) {
        alertContainer.style.display = "block";
        alertContainer.innerHTML = `
          <div class="alert alert-warning d-flex align-items-center justify-content-between p-2 mb-3" style="border-inline-start: 4px solid var(--accent-orange, #f59e0b); background: rgba(245, 158, 11, 0.12); border-radius: 6px; cursor: pointer;" onclick="AssetManager.filterUnassignedLocationAssets()">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-exclamation-triangle text-warning" style="font-size: 16px;"></i>
              <div>
                <strong style="font-size: 13px;">${lang === "ar" ? `أصول تتطلب تحديد الموقع: ${unassignedLocAssets.length}` : `Assets requiring location assignment: ${unassignedLocAssets.length}`}</strong>
                <span class="text-muted ms-2" style="font-size: 12px;">${lang === "ar" ? "(انقر هنا لعرضها وتعيين الموقع)" : "(Click here to list & assign location)"}</span>
              </div>
            </div>
            <button class="btn btn-xs btn-outline-warning" onclick="event.stopPropagation(); AssetManager.filterUnassignedLocationAssets();">
              <i class="fas fa-edit me-1"></i> ${lang === "ar" ? "معالجة" : "Fix Location"}
            </button>
          </div>
        `;
      } else {
        alertContainer.style.display = "none";
      }
    }

    // Apply Filter Logic
    const filtered = assets.filter(item => {
      // Type filter
      if (this.currentFilterType && item.assetTypeId !== this.currentFilterType) return false;
      // Status filter
      if (this.currentFilterStatus && item.status !== this.currentFilterStatus) return false;
      // Dept filter
      if (this.currentFilterDept && item.departmentId !== this.currentFilterDept) return false;
      // Loc filter
      if (this.currentFilterLoc) {
        if (this.currentFilterLoc === "__unassigned__") {
          if (item.locationId) return false;
        } else if (item.locationId !== this.currentFilterLoc) {
          return false;
        }
      }
      // Emp filter
      if (this.currentFilterEmp && item.currentEmployeeId !== this.currentFilterEmp) return false;
      // Brand filter
      if (this.currentFilterBrand && (!item.brand || !item.brand.toLowerCase().includes(this.currentFilterBrand.toLowerCase()))) return false;
      // Warranty filter
      if (this.currentFilterWarranty && !this.matchesWarrantyFilter(item, this.currentFilterWarranty)) return false;

      // Text search
      if (this.currentSearchText) {
        const query = this.currentSearchText.toLowerCase();
        const empName = (empMap[item.currentEmployeeId] || "").toLowerCase();
        const deptName = (deptMap[item.departmentId] || "").toLowerCase();
        const locName = (locMap[item.locationId] || "").toLowerCase();
        const typeName = (typeMap[item.assetTypeId] ? (typeMap[item.assetTypeId].nameAr + " " + (typeMap[item.assetTypeId].nameEn || "")).toLowerCase() : "");

        const match = (
          (item.assetId && item.assetId.toLowerCase().includes(query)) ||
          (item.serial && item.serial.toLowerCase().includes(query)) ||
          (item.brand && item.brand.toLowerCase().includes(query)) ||
          (item.model && item.model.toLowerCase().includes(query)) ||
          (item.computerName && item.computerName.toLowerCase().includes(query)) ||
          (item.ip && item.ip.includes(query)) ||
          empName.includes(query) ||
          deptName.includes(query) ||
          locName.includes(query) ||
          typeName.includes(query)
        );
        if (!match) return false;
      }

      return true;
    });

    const countBadge = document.getElementById("assetFilteredCount");
    if (countBadge) countBadge.textContent = `${filtered.length} / ${assets.length}`;

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-5">
            <div class="empty-state">
              <i class="fas fa-search empty-icon"></i>
              <h4>${I18N[lang].noResultsFound}</h4>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    filtered.forEach(asset => {
      const typeObj = typeMap[asset.assetTypeId];
      const typeName = typeObj ? (lang === "ar" ? typeObj.nameAr : (typeObj.nameEn || typeObj.nameAr)) : "-";
      const empName = empMap[asset.currentEmployeeId] || "-";
      const deptName = deptMap[asset.departmentId] || "-";
      const locName = locMap[asset.locationId] || (asset.locationId ? asset.locationId : (lang === "ar" ? "غير محدد ⚠️" : "Unassigned ⚠️"));
      const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

      // Status Badge Style
      const statusClass = this.getStatusBadgeClass(asset.status);
      const statusText = this.formatStatus(asset.status);

      html += `
        <tr class="asset-row" style="cursor: pointer;">
          <td onclick="AssetManager.openDetailsModal('${asset.id}')">
            <span class="asset-id-tag">${asset.assetId}</span>
          </td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')">
            <span class="badge badge-secondary">${typeName}</span>
          </td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')"><strong>${asset.brand || "-"}</strong></td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')">${asset.model || "-"}</td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')"><code class="serial-tag">${asset.serial || "-"}</code></td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')">
            ${asset.currentEmployeeId ? `<span class="emp-name-tag"><i class="fas fa-user text-primary"></i> ${empName}</span>` : `<span class="text-muted">-</span>`}
          </td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')">${deptName}</td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')"><i class="fas fa-map-marker-alt ${asset.locationId ? 'text-warning' : 'text-danger'}"></i> ${locName}</td>
          <td onclick="AssetManager.openDetailsModal('${asset.id}')">
            <span class="badge ${statusClass}">${statusText}</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;" onclick="event.stopPropagation();">
              <button class="btn btn-xs btn-secondary" onclick="AssetManager.openDetailsModal('${asset.id}')" title="${I18N[lang].viewDetails || 'عرض التفاصيل'}">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-xs btn-secondary" onclick="AssetManager.openActivityTimeline('${asset.id}')" title="${I18N[lang].activityTimeline || 'سجل الأنشطة والعمليات'}">
                <i class="fas fa-stream text-primary"></i>
              </button>
              ${!isViewer ? `
                <button class="btn btn-xs btn-secondary" onclick="AssetManager.openEditModal('${asset.id}')" title="${I18N[lang].btnEdit || 'تعديل'}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-xs btn-secondary text-danger" onclick="AssetManager.deleteAsset('${asset.id}')" title="${I18N[lang].btnDelete || 'حذف'}">
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

  getStatusBadgeClass(status) {
    switch (status) {
      case "Available": return "badge-primary";
      case "Assigned": return "badge-success";
      case "Installed": return "badge-success";
      case "In Transit": return "badge-warning";
      case "Under Maintenance": return "badge-danger";
      case "In Store": return "badge-warning";
      case "Damaged": return "badge-danger";
      case "Lost": return "badge-danger";
      case "Retired": return "badge-secondary";
      case "Disposed": return "badge-secondary";
      default: return "badge-secondary";
    }
  }

  formatStatus(status) {
    const lang = AppState.lang;
    switch (status) {
      case "Available": return lang === "ar" ? "متاح" : "Available";
      case "Assigned": return lang === "ar" ? "مسند لموظف" : "Assigned";
      case "Installed": return lang === "ar" ? "مركب" : "Installed";
      case "In Transit": return lang === "ar" ? "قيد النقل / بانتظار التركيب" : "In Transit";
      case "Under Maintenance": return lang === "ar" ? "في الصيانة" : "Under Maintenance";
      case "In Store": return lang === "ar" ? "في المستودع" : "In Store";
      case "Damaged": return lang === "ar" ? "تالف" : "Damaged";
      case "Lost": return lang === "ar" ? "مفقود" : "Lost";
      case "Retired": return lang === "ar" ? "مكهن" : "Retired";
      case "Disposed": return lang === "ar" ? "مستبعد" : "Disposed";
      default: return status || "-";
    }
  }

  matchesWarrantyFilter(asset, filterVal) {
    if (!filterVal) return true;
    const st = (asset.status || "").trim();
    if (st === "Disposed" || st === "Retired") return false;
    if (!asset.warrantyExpiry) return false;

    const parts = String(asset.warrantyExpiry).split("-");
    if (parts.length !== 3) return false;
    const expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(expDate.getTime())) return false;
    expDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (filterVal === "expiring_30d") {
      return diffDays >= 0 && diffDays <= 30;
    }
    if (filterVal === "expiring_7d") {
      return diffDays >= 0 && diffDays <= 7;
    }
    if (filterVal === "expired") {
      return diffDays < 0;
    }
    if (filterVal === "valid") {
      return diffDays > 30;
    }
    return true;
  }

  // Filter Handler
  handleFilterChange() {
    this.currentSearchText = document.getElementById("assetSearchInput") ? document.getElementById("assetSearchInput").value.trim() : "";
    this.currentFilterType = document.getElementById("assetFilterType") ? document.getElementById("assetFilterType").value : "";
    this.currentFilterStatus = document.getElementById("assetFilterStatus") ? document.getElementById("assetFilterStatus").value : "";
    this.currentFilterDept = document.getElementById("assetFilterDept") ? document.getElementById("assetFilterDept").value : "";
    this.currentFilterLoc = document.getElementById("assetFilterLoc") ? document.getElementById("assetFilterLoc").value : "";
    this.currentFilterEmp = document.getElementById("assetFilterEmp") ? document.getElementById("assetFilterEmp").value : "";
    this.currentFilterBrand = document.getElementById("assetFilterBrand") ? document.getElementById("assetFilterBrand").value.trim() : "";
    const warrantySel = document.getElementById("assetFilterWarranty");
    this.currentFilterWarranty = warrantySel ? warrantySel.value : (this.currentFilterWarranty || "");
    this.render();
  }

  resetFilterInputs() {
    const searchInp = document.getElementById("assetSearchInput");
    const brandInp = document.getElementById("assetFilterBrand");
    const deptSel = document.getElementById("assetFilterDept");
    const locSel = document.getElementById("assetFilterLoc");
    const empSel = document.getElementById("assetFilterEmp");
    const typeSel = document.getElementById("assetFilterType");
    const statusSel = document.getElementById("assetFilterStatus");
    const warrantySel = document.getElementById("assetFilterWarranty");

    if (searchInp) searchInp.value = "";
    if (brandInp) brandInp.value = "";
    if (deptSel) deptSel.value = "";
    if (locSel) locSel.value = "";
    if (empSel) empSel.value = "";
    if (typeSel) typeSel.value = "";
    if (statusSel) statusSel.value = "";
    if (warrantySel) warrantySel.value = "";
    this.currentFilterWarranty = "";
  }

  resetFilters() {
    this.resetFilterInputs();
    this.handleFilterChange();
  }

  filterByWarrantyAndSwitch(warrantyCategory = "expiring_30d") {
    this.resetFilterInputs();
    const warrantySel = document.getElementById("assetFilterWarranty");
    if (warrantySel) warrantySel.value = warrantyCategory || "";
    this.currentFilterWarranty = warrantyCategory || "";
    App.switchTab("assets");
    this.handleFilterChange();
  }

  filterAndSwitch(typeId = "", status = "") {
    this.resetFilterInputs();
    const typeSel = document.getElementById("assetFilterType");
    const statusSel = document.getElementById("assetFilterStatus");
    if (typeSel) typeSel.value = typeId || "";
    if (statusSel) statusSel.value = status || "";
    App.switchTab("assets");
    this.handleFilterChange();
  }

  filterByDeptAndSwitch(deptId) {
    this.resetFilterInputs();
    const deptSel = document.getElementById("assetFilterDept");
    if (deptSel) deptSel.value = deptId || "";
    App.switchTab("assets");
    this.handleFilterChange();
  }

  filterByLocAndSwitch(locId) {
    this.resetFilterInputs();
    const locSel = document.getElementById("assetFilterLoc");
    if (locSel) locSel.value = locId || "";
    App.switchTab("assets");
    this.handleFilterChange();
  }

  filterByEmpAndSwitch(empId) {
    this.resetFilterInputs();
    const empSel = document.getElementById("assetFilterEmp");
    if (empSel) empSel.value = empId || "";
    App.switchTab("assets");
    this.handleFilterChange();
  }

  // Populate Dropdowns in Modals and Filters
  async populateDropdowns() {
    const types = await db.getAll("assetTypes");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const employees = await db.getAll("employees");
    const lang = AppState.lang;

    // Filter Dropdowns
    const filterType = document.getElementById("assetFilterType");
    if (filterType) {
      filterType.innerHTML = `<option value="">${I18N[lang].allTypes}</option>` +
        types.filter(t => t.active !== false).map(t => `<option value="${t.id}">${lang === 'ar' ? t.nameAr : (t.nameEn || t.nameAr)}</option>`).join("");
    }

    const filterDept = document.getElementById("assetFilterDept");
    if (filterDept) {
      filterDept.innerHTML = `<option value="">${I18N[lang].allDepts}</option>` +
        departments.filter(d => d.active !== false).map(d => `<option value="${d.id}">${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
    }

    const filterLoc = document.getElementById("assetFilterLoc");
    if (filterLoc) {
      filterLoc.innerHTML = `<option value="">${I18N[lang].allLocs}</option>` +
        locations.filter(l => l.active !== false).map(l => `<option value="${l.id}">${lang === 'ar' ? l.nameAr : (l.nameEn || l.nameAr)}</option>`).join("");
    }

    const filterEmp = document.getElementById("assetFilterEmp");
    if (filterEmp) {
      filterEmp.innerHTML = `<option value="">${I18N[lang].allEmployees}</option>` +
        employees.filter(e => e.status === "Active").map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber})</option>`).join("");
    }

    // Modal Form Dropdowns
    const formType = document.getElementById("formAssetType");
    if (formType) {
      formType.innerHTML = types.filter(t => t.active !== false).map(t => `<option value="${t.id}">${lang === 'ar' ? t.nameAr : (t.nameEn || t.nameAr)}</option>`).join("");
    }

    const formDept = document.getElementById("formAssetDept");
    if (formDept) {
      formDept.innerHTML = departments.filter(d => d.active !== false).map(d => `<option value="${d.id}">${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
    }

    const formLoc = document.getElementById("formAssetLoc");
    if (formLoc) {
      formLoc.innerHTML = locations.filter(l => l.active !== false).map(l => `<option value="${l.id}">${lang === 'ar' ? l.nameAr : (l.nameEn || l.nameAr)}</option>`).join("");
    }

    const formEmp = document.getElementById("formAssetEmp");
    if (formEmp) {
      formEmp.innerHTML = `<option value="">-- ${lang === 'ar' ? 'بدون موظف (غير مسند)' : 'None (Unassigned)'} --</option>` +
        employees.filter(e => e.status === "Active").map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber})</option>`).join("");
    }

    if (window.App && typeof App.enhanceAllSelects === "function") {
      App.enhanceAllSelects();
    }
  }

  async handleAssetLocChange(locId) {
    if (!locId) return;
    const departments = await db.getAll("departments");
    const employees = await db.getAll("employees");
    const lang = AppState.lang;

    const deptSelect = document.getElementById("formAssetDept");
    const empSelect = document.getElementById("formAssetEmp");

    if (deptSelect) {
      const activeDepts = departments.filter(d => d.active !== false);
      const locDepts = activeDepts.filter(d => (d.locationId === locId || d.location_id === locId));
      const listToShow = locDepts.length > 0 ? locDepts : activeDepts;
      const curDept = deptSelect.value;
      deptSelect.innerHTML = listToShow.map(d => `<option value="${d.id}">${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
      if (curDept && listToShow.some(d => d.id === curDept)) {
        deptSelect.value = curDept;
      }
    }

    if (empSelect) {
      const activeEmps = employees.filter(e => e.status === "Active" || !e.status);
      const locEmps = activeEmps.filter(e => (e.locationId === locId || e.location_id === locId));
      const listToShow = locEmps.length > 0 ? locEmps : activeEmps;
      const curEmp = empSelect.value;
      empSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'بدون موظف (غير مسند)' : 'None (Unassigned)'} --</option>` +
        listToShow.map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
      if (curEmp && listToShow.some(e => e.id === curEmp)) {
        empSelect.value = curEmp;
      }
    }
  }

  async handleAssetDeptChange(deptId) {
    if (!deptId) return;
    const dept = await db.getById("departments", deptId);
    const locSelect = document.getElementById("formAssetLoc");
    const empSelect = document.getElementById("formAssetEmp");
    const lang = AppState.lang;

    if (dept) {
      const dLoc = dept.locationId || dept.location_id;
      if (dLoc && locSelect && locSelect.value !== dLoc) {
        locSelect.value = dLoc;
      }
    }

    if (empSelect) {
      const employees = await db.getAll("employees");
      const activeEmps = employees.filter(e => e.status === "Active" || !e.status);
      const deptEmps = activeEmps.filter(e => (e.departmentId === deptId || e.department_id === deptId));
      const listToShow = deptEmps.length > 0 ? deptEmps : activeEmps;
      const curEmp = empSelect.value;
      empSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'بدون موظف (غير مسند)' : 'None (Unassigned)'} --</option>` +
        listToShow.map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
      if (curEmp && listToShow.some(e => e.id === curEmp)) {
        empSelect.value = curEmp;
      }
    }
  }

  async handleAssetEmpChange(empId) {
    if (!empId) return;
    const emp = await db.getById("employees", empId);
    if (!emp) return;

    const deptSelect = document.getElementById("formAssetDept");
    const locSelect = document.getElementById("formAssetLoc");

    const empDept = emp.departmentId || emp.department_id;
    if (empDept && deptSelect && deptSelect.value !== empDept) {
      deptSelect.value = empDept;
    }

    let empLoc = emp.locationId || emp.location_id;
    if (!empLoc && empDept) {
      const dept = await db.getById("departments", empDept);
      if (dept) empLoc = dept.locationId || dept.location_id;
    }

    if (empLoc && locSelect && locSelect.value !== empLoc) {
      locSelect.value = empLoc;
    }
  }

  // Toggle Technical Specifications in Add/Edit Modal
  async toggleTechFieldsByType(typeId) {
    const typeObj = await db.getById("assetTypes", typeId);
    const techSection = document.getElementById("techFieldsSection");
    const imeiGroup = document.getElementById("imeiGroup");
    const camGroup = document.getElementById("cameraInfoGroup");

    if (!typeObj) return;

    if (typeId === "type-camera") {
      techSection.style.display = "block";
      if (camGroup) camGroup.style.display = "block";
      if (imeiGroup) imeiGroup.style.display = "none";
    } else if (typeId === "type-tablet" || typeId === "type-mobile") {
      techSection.style.display = "block";
      if (imeiGroup) imeiGroup.style.display = "block";
      if (camGroup) camGroup.style.display = "none";
    } else if (typeObj.hasTechSpecs) {
      techSection.style.display = "block";
      if (imeiGroup) imeiGroup.style.display = "none";
      if (camGroup) camGroup.style.display = "none";
    } else {
      techSection.style.display = "none";
    }
  }

  async filterUnassignedLocationAssets() {
    App.switchTab("assets");
    this.currentFilterLoc = "__unassigned__";
    const locSelect = document.getElementById("assetFilterLoc") || document.getElementById("assetFilterLocation");
    if (locSelect) locSelect.value = "";
    await this.render();
  }

  // =========================================================================
  // 2. ADD & EDIT ASSET MODALS
  // =========================================================================
  async openAddModal() {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }

    await this.populateDropdowns();
    const form = document.getElementById("assetModalForm");
    form.reset();

    document.getElementById("formAssetInternalId").value = "";
    document.getElementById("assetModalTitle").textContent = AppState.lang === "ar" ? "إضافة أصل / جهاز جديد" : "Add New Asset";

    // Generate next sequential Asset ID
    const nextId = await db.getNextAssetId();
    document.getElementById("formAssetId").value = nextId;
    const barcodeEl = document.getElementById("formAssetBarcode");
    if (barcodeEl) barcodeEl.value = nextId;
    const qrEl = document.getElementById("formAssetQr");
    if (qrEl) qrEl.value = nextId;

    // Defaults
    document.getElementById("formAssetStatus").value = "In Store";
    document.getElementById("serialValidationMsg").style.display = "none";
    const barcodeValMsg = document.getElementById("barcodeValidationMsg");
    if (barcodeValMsg) barcodeValMsg.style.display = "none";
    const qrValMsg = document.getElementById("qrValidationMsg");
    if (qrValMsg) qrValMsg.style.display = "none";

    // Set default location to existing "المستودع الرئيسي / Main Warehouse" (NEW ASSET ONLY)
    const locations = await db.getAll("locations");
    const mainWarehouse = locations.find(l => {
      const nameAr = (l.nameAr || "").trim();
      const nameEn = (l.nameEn || "").trim().toLowerCase();
      const code = (l.code || "").trim().toUpperCase();
      return nameAr.includes("المستودع الرئيسي") ||
             nameEn.includes("main warehouse") ||
             nameAr === "المستودع" ||
             nameEn === "store" ||
             nameEn === "main store" ||
             code === "STR" ||
             code === "WH" ||
             code === "MWH" ||
             l.id === "loc-store" ||
             l.id === "loc-wh1";
    }) || locations.find(l => {
      const nameAr = (l.nameAr || "").trim();
      const nameEn = (l.nameEn || "").trim().toLowerCase();
      return nameAr.includes("المستودع") || nameEn.includes("warehouse") || nameEn.includes("store");
    });

    const locSelect = document.getElementById("formAssetLoc");
    if (locSelect && mainWarehouse) {
      locSelect.value = mainWarehouse.id;
    }

    const typeSelect = document.getElementById("formAssetType");
    if (typeSelect && typeSelect.value) {
      await this.toggleTechFieldsByType(typeSelect.value);
    }

    if (window.App && typeof App.enhanceAllSelects === "function") {
      App.enhanceAllSelects(document.getElementById("assetModal"));
    }

    App.openModal("assetModal");
  }

  async openEditModal(assetId) {
    if (AppState.currentUser && AppState.currentUser.role === "Viewer") {
      App.showToast(I18N[AppState.lang].errViewerNoPermission, "error");
      return;
    }

    await this.populateDropdowns();
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    document.getElementById("assetModalTitle").textContent = AppState.lang === "ar" ? "تعديل بيانات الأصل" : "Edit Asset";
    document.getElementById("formAssetInternalId").value = asset.id;
    document.getElementById("formAssetId").value = asset.assetId;
    document.getElementById("formAssetType").value = asset.assetTypeId || "";
    document.getElementById("formAssetBrand").value = asset.brand || "";
    document.getElementById("formAssetModel").value = asset.model || "";
    document.getElementById("formAssetSerial").value = asset.serial || "";
    
    const barcodeEl = document.getElementById("formAssetBarcode");
    if (barcodeEl) barcodeEl.value = asset.barcodeValue || asset.assetId || "";
    const qrEl = document.getElementById("formAssetQr");
    if (qrEl) qrEl.value = asset.qrCodeValue || asset.assetId || "";

    document.getElementById("formAssetStatus").value = asset.status || "Available";
    document.getElementById("formAssetDept").value = asset.departmentId || "";
    document.getElementById("formAssetLoc").value = asset.locationId || "";
    document.getElementById("formAssetEmp").value = asset.currentEmployeeId || "";
    document.getElementById("formAssetPurchaseDate").value = asset.purchaseDate || "";
    document.getElementById("formAssetWarrantyExpiry").value = asset.warrantyExpiry || "";
    document.getElementById("formAssetCost").value = asset.purchaseCost || "";
    document.getElementById("formAssetSupplier").value = asset.supplier || "";
    document.getElementById("formAssetNotes").value = asset.notes || "";

    // Technical Fields
    document.getElementById("formAssetCompName").value = asset.computerName || "";
    document.getElementById("formAssetOS").value = asset.os || "";
    document.getElementById("formAssetCPU").value = asset.cpu || "";
    document.getElementById("formAssetRAM").value = asset.ram || "";
    document.getElementById("formAssetStorage").value = asset.storage || "";
    document.getElementById("formAssetIP").value = asset.ip || "";
    document.getElementById("formAssetMAC").value = asset.mac || "";
    document.getElementById("formAssetIMEI").value = asset.imei || "";
    document.getElementById("formAssetCamInfo").value = asset.cameraInfo || "";

    document.getElementById("serialValidationMsg").style.display = "none";
    const barcodeValMsg = document.getElementById("barcodeValidationMsg");
    if (barcodeValMsg) barcodeValMsg.style.display = "none";
    const qrValMsg = document.getElementById("qrValidationMsg");
    if (qrValMsg) qrValMsg.style.display = "none";
    
    // Rule 2: Lock Location/Department if In Transit
    const isLocked = (asset.status === "In Transit");
    document.getElementById("formAssetLoc").disabled = isLocked;
    document.getElementById("formAssetDept").value = asset.departmentId || ""; // Reset value before disabling
    document.getElementById("formAssetDept").disabled = isLocked;
    if (isLocked) {
      document.getElementById("formAssetLoc").title = AppState.lang === "ar" ? "مقفل أثناء النقل" : "Locked while In Transit";
      document.getElementById("formAssetDept").title = AppState.lang === "ar" ? "مقفل أثناء النقل" : "Locked while In Transit";
    } else {
      document.getElementById("formAssetLoc").title = "";
      document.getElementById("formAssetDept").title = "";
    }

    await this.toggleTechFieldsByType(asset.assetTypeId);

    App.openModal("assetModal");
  }

  async handleSaveAsset(event) {
    try {
      return await this.handleSaveAssetInternal(event);
    } catch (error) {
      console.error("[handleSaveAsset]", error);
      const duplicate = error && error.code === "23505";
      const message = duplicate
        ? (AppState.lang === "ar"
          ? "تعذر حفظ الأصل: رقم الأصل أو الباركود أو رمز QR مستخدم مسبقاً."
          : "The asset was not saved because the asset number, barcode, or QR code already exists.")
        : (AppState.lang === "ar"
          ? "تعذر حفظ الأصل. تحقق من اتصال قاعدة البيانات السحابية ولم يتم تسجيل السجل محلياً."
          : "The asset was not saved. Check the cloud database connection; no local-only record was created.");
      App.showToast(message, "error");
    }
  }

  async handleSaveAssetInternal(event) {
    event.preventDefault();
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بإضافة أو تعديل الأصول." : "Unauthorized to save or edit assets."), "error");
      return;
    }
    const internalId = document.getElementById("formAssetInternalId").value;
    const assetId = document.getElementById("formAssetId").value.trim();
    const assetTypeId = document.getElementById("formAssetType").value;
    const brand = document.getElementById("formAssetBrand").value.trim();
    const model = document.getElementById("formAssetModel").value.trim();
    const serial = document.getElementById("formAssetSerial").value.trim();
    const rawBarcode = document.getElementById("formAssetBarcode")?.value.trim();
    const rawQr = document.getElementById("formAssetQr")?.value.trim();
    const barcodeValue = rawBarcode || assetId;
    const qrCodeValue = rawQr || assetId;

    const status = document.getElementById("formAssetStatus").value;
    const departmentId = document.getElementById("formAssetDept").value;
    const locationId = document.getElementById("formAssetLoc").value;
    const currentEmployeeId = document.getElementById("formAssetEmp").value || null;
    const purchaseDate = document.getElementById("formAssetPurchaseDate").value;
    const warrantyExpiry = document.getElementById("formAssetWarrantyExpiry").value;
    const purchaseCost = parseFloat(document.getElementById("formAssetCost").value) || 0;
    const supplier = document.getElementById("formAssetSupplier").value.trim();
    const notes = document.getElementById("formAssetNotes").value.trim();

    // Technical fields
    const computerName = document.getElementById("formAssetCompName").value.trim();
    const os = document.getElementById("formAssetOS").value.trim();
    const cpu = document.getElementById("formAssetCPU").value.trim();
    const ram = document.getElementById("formAssetRAM").value.trim();
    const storage = document.getElementById("formAssetStorage").value.trim();
    const ip = document.getElementById("formAssetIP").value.trim();
    const mac = document.getElementById("formAssetMAC").value.trim();
    const imei = document.getElementById("formAssetIMEI").value.trim();
    const cameraInfo = document.getElementById("formAssetCamInfo").value.trim();

    // 1. Validation
    if (!assetId) {
      App.showToast(
        AppState.lang === "ar"
          ? "تعذر إنشاء الأصل: رقم الأصل غير متوفر."
          : "The asset cannot be created because its asset number is missing.",
        "error"
      );
      return;
    }
    if (!assetTypeId) {
      App.showToast(I18N[AppState.lang].errAssetTypeReq, "error");
      return;
    }
    if (!brand) {
      App.showToast(I18N[AppState.lang].errBrandReq, "error");
      return;
    }
    if (!model) {
      App.showToast(I18N[AppState.lang].errModelReq, "error");
      return;
    }

    // Strict Rule: Mandatory Location for active/physical assets
    const activeStatuses = ["Available", "Assigned", "Installed", "In Use", "In Store"];
    if (activeStatuses.includes(status) && !locationId) {
      App.showToast(
        AppState.lang === "ar"
          ? "خطأ: الموقع الجغرافي إلزامي للأصول المتاحة والمسندة بالنظام."
          : "Error: Location is required for active/assigned assets.",
        "error"
      );
      return;
    }

    // Relationship Validation: Department -> Location
    if (departmentId && locationId) {
      const deptObj = await db.getById("departments", departmentId);
      if (deptObj && deptObj.locationId && deptObj.locationId !== locationId) {
        App.showToast(
          AppState.lang === "ar"
            ? `خطأ: القسم المحدد [${deptObj.nameAr || deptObj.id}] غير تابع للموقع الجغرافي المختار.`
            : `Error: Selected department belongs to a different location.`,
          "error"
        );
        return;
      }
    }

    // Relationship Validation: Employee -> Department / Location
    if (currentEmployeeId) {
      const empObj = await db.getById("employees", currentEmployeeId);
      if (empObj) {
        if (departmentId && empObj.departmentId && empObj.departmentId !== departmentId) {
          App.showToast(
            AppState.lang === "ar"
              ? `تنبيه تحذيري: الموظف المحدد ينتمي لقسم آخر [${empObj.departmentId}]، يرجى التثبت من صحة البيانات.`
              : `Warning: Selected employee belongs to a different department.`,
            "warning"
          );
        }
      }
    }

    // 2. Check duplicate serial
    if (serial) {
      const serialExists = await db.checkSerialExists(serial, internalId);
      if (serialExists) {
        document.getElementById("serialValidationMsg").textContent = I18N[AppState.lang].errSerialExists;
        document.getElementById("serialValidationMsg").style.display = "block";
        App.showToast(I18N[AppState.lang].errSerialExists, "error");
        return;
      }
    }

    // 3. Check duplicate barcode
    if (barcodeValue) {
      const barcodeExists = await db.checkBarcodeExists(barcodeValue, internalId);
      if (barcodeExists) {
        const barcodeValMsg = document.getElementById("barcodeValidationMsg");
        if (barcodeValMsg) {
          barcodeValMsg.textContent = I18N[AppState.lang].errBarcodeExists;
          barcodeValMsg.style.display = "block";
        }
        App.showToast(I18N[AppState.lang].errBarcodeExists, "error");
        return;
      }
    }

    // 4. Check duplicate QR code
    if (qrCodeValue) {
      const qrExists = await db.checkQrExists(qrCodeValue, internalId);
      if (qrExists) {
        const qrValMsg = document.getElementById("qrValidationMsg");
        if (qrValMsg) {
          qrValMsg.textContent = I18N[AppState.lang].errQrExists;
          qrValMsg.style.display = "block";
        }
        App.showToast(I18N[AppState.lang].errQrExists, "error");
        return;
      }
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    if (!internalId) {
      // ADD NEW ASSET
      const newInternalId = await db.getNextSequentialId("assets");
      const assetData = {
        id: newInternalId,
        assetId,
        assetTypeId,
        brand,
        model,
        serial,
        barcodeValue,
        qrCodeValue,
        status: currentEmployeeId ? "Assigned" : status,
        departmentId,
        locationId,
        currentEmployeeId,
        purchaseDate,
        warrantyExpiry,
        purchaseCost,
        supplier,
        notes,
        computerName,
        os,
        cpu,
        ram,
        storage,
        ip,
        mac,
        imei,
        cameraInfo,
        attachments: [],
        createdDate: now,
        updatedDate: now
      };

      try {
        await db.put("assets", assetData);

        // The asset and its first audit entries must succeed together from the
        // user's perspective. If a cloud audit write fails, remove the asset
        // instead of reporting a successful but incomplete creation.
        await db.logTransaction({
          assetId: newInternalId,
          transactionType: "Added",
          toDepartmentId: departmentId,
          toLocationId: locationId,
          toEmployeeId: currentEmployeeId,
          transactionDate: now,
          performedBy: AppState.currentUser ? getUserDisplayName(AppState.currentUser, AppState.lang) : "System",
          notes: AppState.lang === "ar" ? `تم تسجيل وإدخال الأصل الجديد [${brand} ${model}]` : `New asset created [${brand} ${model}]`
        });

        if (currentEmployeeId) {
          await db.logTransaction({
            assetId: newInternalId,
            transactionType: "Assigned",
            toDepartmentId: departmentId,
            toLocationId: locationId,
            toEmployeeId: currentEmployeeId,
            transactionDate: now,
            performedBy: AppState.currentUser ? getUserDisplayName(AppState.currentUser, AppState.lang) : "System",
            notes: AppState.lang === "ar" ? "تسليم العهدة للموظف عند الإدخال الأولي" : "Initial custody handover to employee upon asset creation"
          });
        }

        await db.incrementAssetIdSeq();
      } catch (creationError) {
        try {
          await db.delete("assets", newInternalId);
          const transactions = await db.getAll("assetTransactions");
          const createdTransactions = transactions.filter(transaction => transaction.assetId === newInternalId);
          for (const transaction of createdTransactions) {
            await db.delete("assetTransactions", transaction.id);
          }
        } catch (rollbackError) {
          console.error("[handleSaveAsset] asset rollback failed", rollbackError);
        }
        throw creationError;
      }

      App.showToast(I18N[AppState.lang].saveSuccess, "success");
    } else {
      // EDIT EXISTING ASSET (Preserve attachments and createdDate)
      const existing = await db.getById("assets", internalId);
      const finalBarcode = rawBarcode || existing.barcodeValue || existing.assetId;
      const finalQr = rawQr || existing.qrCodeValue || existing.assetId;
      const updatedAsset = {
        ...existing,
        assetTypeId,
        brand,
        model,
        serial: serial || existing.serial || null,
        barcodeValue: finalBarcode,
        qrCodeValue: finalQr,
        status,
        departmentId,
        locationId,
        currentEmployeeId,
        office: existing.office || null,
        officeId: existing.officeId || existing.office || null,
        purchaseDate,
        warrantyExpiry,
        purchaseCost,
        supplier,
        notes,
        computerName: computerName || existing.computerName || (existing.specs ? existing.specs.computerName : "") || "",
        os: os || existing.os || (existing.specs ? existing.specs.os : "") || "",
        cpu: cpu || existing.cpu || (existing.specs ? existing.specs.cpu : "") || "",
        ram: ram || existing.ram || (existing.specs ? existing.specs.ram : "") || "",
        storage: storage || existing.storage || (existing.specs ? existing.specs.storage : "") || "",
        ip: ip || existing.ip || (existing.specs ? existing.specs.ip : "") || "",
        mac: mac || existing.mac || (existing.specs ? existing.specs.mac : "") || "",
        imei: imei || existing.imei || (existing.specs ? existing.specs.imei : "") || "",
        cameraInfo: cameraInfo || existing.cameraInfo || (existing.specs ? existing.specs.cameraInfo : "") || "",
        updatedDate: now
      };

      await db.put("assets", updatedAsset);

      // Log transactions for changes (Audit Trail & Activity Timeline)
      try {
        const currentUserName = AppState.currentUser ? (typeof getUserDisplayName === "function" ? getUserDisplayName(AppState.currentUser, AppState.lang) : (AppState.currentUser.fullName || AppState.currentUser.username)) : "Admin";
        const isAr = AppState.lang === "ar";

        // 1. Status Changed
        if (existing.status !== status) {
          await db.logTransaction({
            assetId: internalId,
            transactionType: "Status Changed",
            fromStatus: existing.status,
            toStatus: status,
            transactionDate: now,
            performedBy: currentUserName,
            notes: isAr 
              ? `تغيير حالة الأصل من [${existing.status}] إلى [${status}] عبر تعديل البيانات`
              : `Status changed from [${existing.status}] to [${status}] via edit form`
          });
        }

        // 2. Location or Department Moved
        if (existing.locationId !== locationId || existing.departmentId !== departmentId) {
          await db.logTransaction({
            assetId: internalId,
            transactionType: "Moved",
            fromLocationId: existing.locationId || null,
            toLocationId: locationId || null,
            fromDepartmentId: existing.departmentId || null,
            toDepartmentId: departmentId || null,
            transactionDate: now,
            performedBy: currentUserName,
            notes: isAr 
              ? `نقل الأصل وتعديل موقعه أو قسمه عبر تعديل البيانات`
              : `Asset location or department updated via edit form`
          });
        }

        // 3. Custody Assignment Change
        if (existing.currentEmployeeId !== currentEmployeeId) {
          await db.logTransaction({
            assetId: internalId,
            transactionType: currentEmployeeId ? "Assigned" : "Returned",
            fromEmployeeId: existing.currentEmployeeId || null,
            toEmployeeId: currentEmployeeId || null,
            transactionDate: now,
            performedBy: currentUserName,
            notes: isAr 
              ? (currentEmployeeId ? `إسناد العهدة لموظف جديد عبر تعديل البيانات` : `إلغاء تخصيص العهدة عبر تعديل البيانات`)
              : (currentEmployeeId ? `Custody assigned to employee via edit form` : `Custody cleared via edit form`)
          });
        }

        // 4. Details & Technical Specs Updated
        const fieldsToCheck = [
          { key: "brand", label: isAr ? "الماركة" : "Brand" },
          { key: "model", label: isAr ? "الموديل" : "Model" },
          { key: "serial", label: isAr ? "الرقم التسلسلي" : "Serial" },
          { key: "purchaseCost", label: isAr ? "سعر الشراء" : "Cost" },
          { key: "supplier", label: isAr ? "المورد" : "Supplier" },
          { key: "computerName", label: isAr ? "اسم الجهاز" : "Hostname" },
          { key: "os", label: isAr ? "نظام التشغيل" : "OS" },
          { key: "cpu", label: isAr ? "المعالج" : "CPU" },
          { key: "ram", label: isAr ? "الذاكرة" : "RAM" },
          { key: "storage", label: isAr ? "التخزين" : "Storage" },
          { key: "ip", label: isAr ? "عنوان IP" : "IP" },
          { key: "mac", label: isAr ? "عنوان MAC" : "MAC" }
        ];

        const fieldDiffs = [];
        fieldsToCheck.forEach(f => {
          const oldVal = (existing[f.key] || "").toString().trim();
          const newVal = (updatedAsset[f.key] || "").toString().trim();
          if (oldVal !== newVal) {
            fieldDiffs.push(`${f.label}: "${oldVal || '-'}" → "${newVal || '-'}"`);
          }
        });

        if (fieldDiffs.length > 0) {
          await db.logTransaction({
            assetId: internalId,
            transactionType: "Details Updated",
            transactionDate: now,
            performedBy: currentUserName,
            notes: (isAr ? "تحديث بيانات ومواصفات الأصل: " : "Updated asset specifications: ") + fieldDiffs.join(" | ")
          });
        }
      } catch (logErr) {
        console.warn("[handleSaveAsset] Failed to log audit transaction:", logErr);
      }

      App.showToast(I18N[AppState.lang].saveSuccess, "success");
    }

    App.closeModal("assetModal");
    await this.render();
    await App.updateDashboard();

    // If details modal was open, refresh it
    if (this.currentDetailAssetId === (internalId || assetId)) {
      await this.openDetailsModal(internalId || assetId);
    }
  }

  async deleteAsset(assetId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(I18N[AppState.lang].errViewerNoPermission || (AppState.lang === "ar" ? "غير مصرح لك بحذف الأصول." : "Unauthorized to delete assets."), "error");
      return;
    }

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    // Check relations & history (REQ-36 Prevent Dangerous Delete)
    const history = await db.getAssetHistory(asset.id);
    const allMaint = await db.getAll("maintenance");
    const assetMaint = allMaint.filter(m => m.assetId === asset.id);
    const allRequests = await db.getAll("helpdeskRequests");
    const assetRequests = allRequests.filter(r => r.assetId === asset.id);

    const hasHistory = history.length > 1; // More than initial creation
    const hasMaint = assetMaint.length > 0;
    const hasRequests = assetRequests.length > 0;
    const isAssigned = asset.status === "Assigned" || !!asset.currentEmployeeId;

    if (hasHistory || hasMaint || hasRequests || isAssigned) {
      const lang = AppState.lang;
      const warningMsg = lang === "ar"
        ? "لا يمكن حذف هذا الأصل نهائياً لوجود سجلات حركات أو صيانة أو طلبات دعم مرتبطة به. يوصى بتغيير حالته إلى (مكهن Retired) أو (مستبعد Disposed) للحفاظ على سلامة البيانات التاريخية.\n\nهل ترغب بتغيير حالته إلى (مكهن Retired) الآن بدلاً من الحذف؟"
        : "This asset cannot be permanently deleted because it has associated history, maintenance, or helpdesk records. It is recommended to change its status to 'Retired' or 'Disposed' to preserve data integrity.\n\nWould you like to change its status to 'Retired' now instead of deleting?";

      if (confirm(warningMsg)) {
        await this.updateAssetStatusPrompt(assetId, "Retired");
      }
      return;
    }

    if (!confirm(I18N[AppState.lang].confirmDeleteRecord || I18N[AppState.lang].confirmDelete || (AppState.lang === 'ar' ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?"))) return;

    await db.delete("assets", assetId);
    App.showToast(I18N[AppState.lang].deleteSuccess, "success");
    await this.render();
    await App.updateDashboard();
  }

  // =========================================================================
  // 3. ASSET DETAILS COMPREHENSIVE CARD
  // =========================================================================
  async openDetailsModal(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    this.currentDetailAssetId = asset.id;
    const lang = AppState.lang;

    // Header Info
    document.getElementById("detailsModalAssetId").textContent = `${asset.assetId} - ${asset.brand || ""} ${asset.model || ""}`;
    const badge = document.getElementById("detailsModalStatusBadge");
    badge.className = `badge ${this.getStatusBadgeClass(asset.status)}`;
    badge.textContent = this.formatStatus(asset.status);

    // Build Context Actions
    this.renderContextActions(asset);

    // Render SubTab
    await this.renderDetailsSubTab(this.activeDetailTab, asset);

    App.openModal("assetDetailsModal");
  }

  renderContextActions(asset) {
    const container = document.getElementById("detailsContextActions");
    if (!container) return;

    const lang = AppState.lang;
    const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";
    if (isViewer) {
      container.innerHTML = `
        <span class="text-muted text-xs mr-2"><i class="fas fa-eye"></i> ${lang === "ar" ? "وضع الاستعراض والقراءة فقط" : "View-only Mode"}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="AssetManager.openActivityTimeline('${asset.id}')">
          <i class="fas fa-stream text-primary"></i> <span>${lang === "ar" ? "سجل الأنشطة والعمليات" : "Activity Timeline"}</span>
        </button>
      `;
      return;
    }

    let actionsHtml = "";

    // Edit button always available
    actionsHtml += `
      <button class="btn btn-secondary btn-sm" onclick="AssetManager.openEditModal('${asset.id}')">
        <i class="fas fa-edit"></i> ${I18N[lang].btnEdit || "تعديل البيانات"}
      </button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="AssetManager.openActivityTimeline('${asset.id}')">
        <i class="fas fa-stream text-primary"></i> <span>${lang === "ar" ? "سجل الأنشطة والعمليات" : "Activity Timeline"}</span>
      </button>
    `;

    // Contextual Actions based on Asset Status
    if (asset.status === "Available" || asset.status === "In Store") {
      actionsHtml += `
        <button class="btn btn-primary btn-sm" onclick="AssetManager.openAssignModal('${asset.id}')">
          <i class="fas fa-user-plus"></i> ${lang === "ar" ? "تسليم لموظف (Assign)" : "Assign to Employee"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="MaintManager.openAddModalForAsset('${asset.id}')">
          <i class="fas fa-tools text-danger"></i> ${lang === "ar" ? "إرسال للصيانة" : "Send to Maintenance"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="AssetManager.updateAssetStatusPrompt('${asset.id}', 'Retired')">
          <i class="fas fa-archive"></i> ${lang === "ar" ? "تكهين الأصل" : "Retire Asset"}
        </button>
        <button class="btn btn-secondary btn-sm text-danger" onclick="AssetManager.updateAssetStatusPrompt('${asset.id}', 'Disposed')">
          <i class="fas fa-trash-alt"></i> ${lang === "ar" ? "إتلاف / استبعاد" : "Dispose Asset"}
        </button>
      `;
    } else if (asset.status === "Assigned") {
      actionsHtml += `
        <button class="btn btn-primary btn-sm" onclick="AssetManager.openTransferModal('${asset.id}')">
          <i class="fas fa-exchange-alt"></i> ${lang === "ar" ? "نقل الأصل" : "Transfer Asset"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="AssetManager.openReturnModal('${asset.id}')">
          <i class="fas fa-undo"></i> ${lang === "ar" ? "إرجاع الأصل" : "Return Asset"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="MaintManager.openAddModalForAsset('${asset.id}')">
          <i class="fas fa-tools text-danger"></i> ${lang === "ar" ? "إرسال للصيانة" : "Send to Maintenance"}
        </button>
      `;
    } else if (asset.status === "Installed") {
      actionsHtml += `
        <button class="btn btn-primary btn-sm" onclick="AssetManager.openTransferModal('${asset.id}')">
          <i class="fas fa-exchange-alt"></i> ${lang === "ar" ? "نقل الأصل" : "Transfer Asset"}
        </button>
        <button class="btn btn-warning btn-sm" onclick="OpsManager.openRemoveFromInstallationModal('${asset.id}')">
          <i class="fas fa-sign-out-alt"></i> ${lang === "ar" ? "إزالة من الموقع" : "Remove From Location"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="MaintManager.openAddModalForAsset('${asset.id}')">
          <i class="fas fa-tools text-danger"></i> ${lang === "ar" ? "إرسال للصيانة" : "Send to Maintenance"}
        </button>
      `;
    } else if (asset.status === "Under Maintenance") {
      actionsHtml += `
        <button class="btn btn-primary btn-sm" onclick="MaintManager.openCompleteModalForAsset('${asset.id}')">
          <i class="fas fa-check"></i> ${lang === "ar" ? "إنهاء الصيانة وإعادة الأصل للخدمة" : "Complete Maintenance & Restore"}
        </button>
      `;
    } else if (asset.status === "Damaged" || asset.status === "Lost") {
      actionsHtml += `
        <button class="btn btn-primary btn-sm" onclick="MaintManager.openAddModalForAsset('${asset.id}')">
          <i class="fas fa-tools"></i> ${lang === "ar" ? "محاولة الإصلاح والصيانة" : "Attempt Repair"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="AssetManager.updateAssetStatusPrompt('${asset.id}', 'Available')">
          <i class="fas fa-check-circle text-success"></i> ${lang === "ar" ? "إعادة لحالة متاح" : "Restore to Available"}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="AssetManager.updateAssetStatusPrompt('${asset.id}', 'Retired')">
          <i class="fas fa-archive"></i> ${lang === "ar" ? "تكهين الأصل" : "Retire Asset"}
        </button>
      `;
    } else if (asset.status === "Retired" || asset.status === "Disposed") {
      actionsHtml += `
        <button class="btn btn-secondary btn-sm" onclick="AssetManager.updateAssetStatusPrompt('${asset.id}', 'Available')">
          <i class="fas fa-recycle text-success"></i> ${lang === "ar" ? "إعادة تنشيط الأصل" : "Reactivate Asset"}
        </button>
      `;
    }

    container.innerHTML = actionsHtml;
  }

  async switchDetailTab(tabName) {
    this.activeDetailTab = tabName;
    document.querySelectorAll("#assetDetailsModal .settings-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-detailtab") === tabName);
    });

    if (this.currentDetailAssetId) {
      const asset = await db.getById("assets", this.currentDetailAssetId);
      if (asset) await this.renderDetailsSubTab(tabName, asset);
    }
  }

  async renderDetailsSubTab(tabName, asset) {
    const body = document.getElementById("assetDetailsBody");
    if (!body) return;

    const lang = AppState.lang;
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const types = await db.getAll("assetTypes");

    const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const typeObj = types.find(t => t.id === asset.assetTypeId);

    let html = "";

    if (tabName === "general") {
      html = `
        <div class="details-spec-grid">
          <div class="spec-box"><label>${I18N[lang].brand}</label><div><strong>${asset.brand || "-"}</strong></div></div>
          <div class="spec-box"><label>${I18N[lang].model}</label><div><strong>${asset.model || "-"}</strong></div></div>
          <div class="spec-box"><label>${I18N[lang].serialNumber}</label><div><code>${asset.serial || "-"}</code></div></div>
          <div class="spec-box"><label>${I18N[lang].assetType}</label><div>${typeObj ? (lang === "ar" ? typeObj.nameAr : typeObj.nameEn) : "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].purchaseDate}</label><div>${asset.purchaseDate || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].warrantyExpiry}</label><div>${asset.warrantyExpiry || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].purchaseCost}</label><div>${asset.purchaseCost ? asset.purchaseCost + ' AED' : '-'}</div></div>
          <div class="spec-box"><label>${I18N[lang].supplier}</label><div>${asset.supplier || "-"}</div></div>
          <div class="spec-box full-width"><label>${I18N[lang].notes}</label><div>${asset.notes || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].createdDate}</label><div>${asset.createdDate || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].updatedDate}</label><div>${asset.updatedDate || "-"}</div></div>
        </div>
        <div class="mt-3 p-3 rounded d-flex justify-between items-center" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25);">
          <div class="d-flex items-center gap-3">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(59, 130, 246, 0.15); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan);">
              <i class="fas fa-stream fa-lg"></i>
            </div>
            <div>
              <div class="font-bold text-sm">${lang === 'ar' ? 'سجل الأنشطة والعمليات الزمني' : 'Activity Timeline & History'}</div>
              <div class="text-xs text-muted">${lang === 'ar' ? 'استعراض زمني لكافة الحركات وتغييرات الحالة والعهدة وتحديثات المواصفات ومن قام بها' : 'Audit trail of status changes, movements, assignments, and specifications updates'}</div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="AssetManager.openActivityTimeline('${asset.id}')">
            <i class="fas fa-history"></i> ${lang === 'ar' ? 'عرض السجل الزمني' : 'View Timeline'}
          </button>
        </div>
      `;
    } else if (tabName === "tech") {
      html = `
        <div class="details-spec-grid">
          <div class="spec-box"><label>${I18N[lang].computerName}</label><div><strong>${asset.computerName || "-"}</strong></div></div>
          <div class="spec-box"><label>${I18N[lang].operatingSystem}</label><div>${asset.os || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].cpu}</label><div>${asset.cpu || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].ram}</label><div>${asset.ram || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].storage}</label><div>${asset.storage || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].ipAddress}</label><div><code>${asset.ip || "-"}</code></div></div>
          <div class="spec-box"><label>${I18N[lang].macAddress}</label><div><code>${asset.mac || "-"}</code></div></div>
          ${asset.imei ? `<div class="spec-box"><label>${I18N[lang].imei}</label><div><code>${asset.imei}</code></div></div>` : ''}
          ${asset.cameraInfo ? `<div class="spec-box full-width"><label>${I18N[lang].cameraInfo}</label><div>${asset.cameraInfo}</div></div>` : ''}
        </div>
      `;
    } else if (tabName === "assignment") {
      const currentEmp = empMap[asset.currentEmployeeId];
      const isReceived = asset.handoverStatus === "Received";
      html = `
        <div class="details-spec-grid">
          <div class="spec-box full-width">
            <label>${I18N[lang].assignedTo || I18N[lang].assignedEmployee || "الموظف المسند إليه"}</label>
            <div style="font-size: 16px; margin-top: 4px;">
              ${currentEmp ? `
                <i class="fas fa-user-check text-success"></i> <strong>${lang === 'ar' ? currentEmp.nameAr : (currentEmp.nameEn || currentEmp.nameAr)}</strong> 
                <span class="text-muted">(${currentEmp.employeeNumber}) - ${currentEmp.phone || ''}</span>
              ` : (asset.status === "Installed" ? `
                <span class="text-success"><i class="fas fa-network-wired"></i> <strong>${lang === 'ar' ? 'مركب في موقع' : 'Installed on Location'}</strong> (${locMap[asset.office] || asset.office || locMap[asset.locationId] || '-'})</span>
              ` : `<span class="text-muted"><i class="fas fa-minus-circle"></i> ${lang === 'ar' ? 'غير مسند لأي موظف حالياً' : 'Not currently assigned to any employee'}</span>`)}
            </div>
          </div>
          <div class="spec-box"><label>${I18N[lang].assignmentDate || "تاريخ التسليم"}</label><div><strong>${asset.assignmentDate || asset.purchaseDate || "-"}</strong></div></div>
          <div class="spec-box"><label>${I18N[lang].assignedBy || "تم التسليم بواسطة"}</label><div>${asset.assignedBy || "IT"}</div></div>
          <div class="spec-box"><label>${I18N[lang].department}</label><div><i class="fas fa-building text-primary"></i> ${deptMap[asset.departmentId] || "-"}</div></div>
          <div class="spec-box"><label>${I18N[lang].location}</label><div><i class="fas fa-map-marker-alt text-warning"></i> ${locMap[asset.locationId] || "-"}</div></div>
          <div class="spec-box full-width">
            <label>${I18N[lang].handoverStatus || "حالة استلام العهدة"}</label>
            <div class="d-flex items-center gap-2 mt-1">
              <span class="badge ${isReceived ? 'badge-success' : 'badge-warning'}">
                <i class="fas ${isReceived ? 'fa-check-circle' : 'fa-clock'}"></i>
                ${isReceived ? (lang === 'ar' ? 'تم الاستلام' : 'Received') : (lang === 'ar' ? 'قيد الاستلام' : 'Pending')}
              </span>
              ${!isReceived && asset.currentEmployeeId ? `
                <button class="btn btn-xs btn-primary" onclick="Helpdesk.confirmHandover('${asset.id}')">
                  <i class="fas fa-check"></i> ${I18N[lang].confirmHandoverBtn || "تأكيد الاستلام"}
                </button>
              ` : ''}
              ${isReceived && asset.handoverDate ? `
                <span class="text-xs text-muted">(${lang === 'ar' ? 'تاريخ التأكيد:' : 'Confirmed:'} ${asset.handoverDate})</span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    } else if (tabName === "maint") {
      const allMaint = await db.getAll("maintenance");
      const assetMaint = allMaint.filter(m => m.assetId === asset.id);

      const allRequests = await db.getAll("helpdeskRequests");
      const assetRequests = allRequests.filter(r => r.assetId === asset.id);

      let maintHtml = "";
      if (assetMaint.length === 0) {
        maintHtml = `<div class="text-center py-4 text-muted"><i class="fas fa-clipboard-check fa-lg mb-1"></i><div>${lang === 'ar' ? 'لا توجد سجلات صيانة لهذا الأصل' : 'No maintenance records for this asset'}</div></div>`;
      } else {
        maintHtml = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${I18N[lang].maintenanceId || "رقم التذكرة"}</th>
                  <th>${I18N[lang].maintenanceDate || "التاريخ"}</th>
                  <th>${I18N[lang].issue || "المشكلة"}</th>
                  <th>${I18N[lang].actionTaken || "الإجراء"}</th>
                  <th>${I18N[lang].cost || "التكلفة"}</th>
                  <th>${I18N[lang].status || "الحالة"}</th>
                </tr>
              </thead>
              <tbody>
                ${assetMaint.map(m => `
                  <tr>
                    <td><strong>${m.id}</strong></td>
                    <td>${m.maintenanceDate || "-"}</td>
                    <td>${m.problem || "-"}</td>
                    <td>${m.actionTaken || "-"}</td>
                    <td>${m.cost ? m.cost + ' AED' : '0'}</td>
                    <td><span class="badge ${m.status === 'Completed' ? 'badge-success' : 'badge-danger'}">${m.status}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }

      let helpdeskHtml = "";
      if (assetRequests.length === 0) {
        helpdeskHtml = `<div class="text-center py-4 text-muted"><i class="fas fa-headset fa-lg mb-1"></i><div>${lang === 'ar' ? 'لا توجد طلبات دعم فني مرتبطة' : 'No linked support requests'}</div></div>`;
      } else {
        helpdeskHtml = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${lang === 'ar' ? 'رقم الطلب' : 'Request No'}</th>
                  <th>${lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th>${lang === 'ar' ? 'الموضوع' : 'Subject'}</th>
                  <th>${lang === 'ar' ? 'النوع' : 'Type'}</th>
                  <th>${lang === 'ar' ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${assetRequests.map(r => `
                  <tr>
                    <td><strong>${r.requestId || r.id}</strong></td>
                    <td>${r.createdDate ? r.createdDate.substring(0, 10) : "-"}</td>
                    <td>${r.subject || "-"}</td>
                    <td>${r.requestType || "-"}</td>
                    <td><span class="badge ${r.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }

      html = `
        <div class="maint-tab-content" style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <h5 class="font-bold text-sm mb-2" style="color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-tools"></i>
              <span>${lang === 'ar' ? 'سجل الصيانة الميدانية' : 'Field Maintenance History'}</span>
            </h5>
            ${maintHtml}
          </div>
          <div style="border-top: 1px dashed rgba(255, 255, 255, 0.1); padding-top: 15px;">
            <h5 class="font-bold text-sm mb-2" style="color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-headset"></i>
              <span>${lang === 'ar' ? 'طلبات الدعم الفني المرتبطة' : 'Linked Support Requests'}</span>
            </h5>
            ${helpdeskHtml}
          </div>
        </div>
      `;
    } else if (tabName === "history") {
      // FULL AUDIT LOG TIMELINE
      const history = await db.getAssetHistory(asset.id);
      
      const timelineBanner = `
        <div class="mb-3 p-3 rounded d-flex justify-between items-center" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25);">
          <div class="d-flex items-center gap-3">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(59, 130, 246, 0.15); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan);">
              <i class="fas fa-stream fa-lg"></i>
            </div>
            <div>
              <div class="font-bold text-sm">${lang === 'ar' ? 'سجل الأنشطة والعمليات الزمني الشامل' : 'Chronological Activity Timeline'}</div>
              <div class="text-xs text-muted">${lang === 'ar' ? 'عرض تسلسلي تفاعلي مع فلاتر تغيير الحالة والنقل وتحديث البيانات وخيارات الطباعة' : 'Interactive timeline view with filters for status changes, movements, updates, and export'}</div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="AssetManager.openActivityTimeline('${asset.id}')">
            <i class="fas fa-external-link-alt"></i> ${lang === 'ar' ? 'فتح الجدول الزمني الكامل' : 'Open Full Timeline'}
          </button>
        </div>
      `;

      if (history.length === 0) {
        html = `
          ${timelineBanner}
          <div class="text-center py-4 text-muted"><i class="fas fa-history fa-2x mb-2"></i><div>${lang === 'ar' ? 'لا توجد حركات مسجلة' : 'No transaction history recorded'}</div></div>
        `;
      } else {
        html = `${timelineBanner}<div class="history-timeline">`;
        history.forEach(tx => {
          let typeClass = "tx-blue";
          let icon = "fa-plus-circle";
          if (tx.transactionType === "Assigned" || tx.transactionType === "Handover Confirmed") { typeClass = "tx-green"; icon = "fa-user-check"; }
          else if (tx.transactionType === "Returned") { typeClass = "tx-amber"; icon = "fa-undo"; }
          else if (tx.transactionType === "Transferred" || tx.transactionType === "Moved") { typeClass = "tx-purple"; icon = "fa-exchange-alt"; }
          else if (tx.transactionType === "Status Changed") { typeClass = "tx-amber"; icon = "fa-tag"; }
          else if (tx.transactionType === "Details Updated") { typeClass = "tx-cyan"; icon = "fa-edit"; }
          else if (tx.transactionType === "Sent to Maintenance") { typeClass = "tx-red"; icon = "fa-tools"; }
          else if (tx.transactionType === "Returned from Maintenance") { typeClass = "tx-green"; icon = "fa-check"; }
          else if (tx.transactionType === "Retired" || tx.transactionType === "Disposed") { typeClass = "tx-gray"; icon = "fa-archive"; }

          const fromEmp = empMap[tx.fromEmployeeId];
          const toEmp = empMap[tx.toEmployeeId];

          html += `
            <div class="timeline-item ${typeClass}">
              <div class="timeline-icon"><i class="fas ${icon}"></i></div>
              <div class="timeline-content">
                <div class="d-flex justify-between">
                  <span class="font-bold text-primary">${this.formatTxType(tx.transactionType)}</span>
                  <span class="text-muted text-xs">${tx.transactionDate}</span>
                </div>
                ${toEmp ? `<div class="text-sm mt-1">${lang === 'ar' ? 'المستلم:' : 'Recipient:'} <strong>${lang === 'ar' ? (toEmp.nameAr || toEmp.name) : (toEmp.nameEn || toEmp.nameAr || toEmp.name)}</strong></div>` : ''}
                ${fromEmp ? `<div class="text-xs text-muted">${lang === 'ar' ? 'من الموظف السابق:' : 'From previous employee:'} ${lang === 'ar' ? (fromEmp.nameAr || fromEmp.name) : (fromEmp.nameEn || fromEmp.nameAr || fromEmp.name)}</div>` : ''}
                ${tx.notes ? `<div class="timeline-notes">${tx.notes}</div>` : ''}
                <div class="timeline-author text-xs text-muted mt-1">${lang === 'ar' ? 'بواسطة:' : 'By:'} ${tx.performedBy || 'System'}</div>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }
    } else if (tabName === "attachments") {
      const attachments = asset.attachments || [];
      const isViewer = AppState.currentUser && AppState.currentUser.role === "Viewer";

      html = `
        <div class="attachments-panel">
          ${!isViewer ? `
            <div class="mb-3 d-flex gap-2 items-center">
              <input type="file" id="assetAttachmentFileInput" style="display: none;" onchange="AssetManager.handleAttachmentUpload(event, '${asset.id}')">
              <button class="btn btn-primary btn-sm" onclick="document.getElementById('assetAttachmentFileInput').click()">
                <i class="fas fa-paperclip"></i> ${lang === 'ar' ? 'إرفاق ملف جديد (فاتورة / ضمان / صورة)' : 'Attach New File (Invoice / Warranty / Image)'}
              </button>
            </div>
          ` : ''}

          ${attachments.length === 0 ? `
            <div class="text-center py-4 text-muted"><i class="fas fa-folder-open fa-2x mb-2"></i><div>${I18N[lang].noAttachments}</div></div>
          ` : `
            <div class="attachments-list">
              ${attachments.map((att, idx) => `
                <div class="attachment-item card p-2 mb-2 d-flex justify-between items-center">
                  <div class="d-flex items-center gap-2">
                    <i class="fas fa-file-alt text-primary fa-lg"></i>
                    <div>
                      <strong>${att.name}</strong>
                      <div class="text-xs text-muted">${att.size} &bull; ${att.uploadDate}</div>
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <a href="${att.dataUrl}" download="${att.name}" class="btn btn-xs btn-secondary" title="${I18N[lang].download || 'تحميل'}">
                      <i class="fas fa-download"></i>
                    </a>
                    ${!isViewer ? `
                      <button class="btn btn-xs btn-secondary text-danger" onclick="AssetManager.deleteAttachment('${asset.id}', ${idx})" title="${I18N[lang].btnDelete || 'حذف'}">
                        <i class="fas fa-trash"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      `;
    } else if (tabName === "barcodeQr") {
      const barcodeVal = asset.barcodeValue || asset.assetId;
      const qrVal = asset.qrCodeValue || asset.assetId;
      const barcodeSvg = this.generateBarcodeSvg(barcodeVal, 58);
      const qrSvg = this.generateQrSvg(qrVal, 160);

      html = `
        <div class="barcode-qr-pane" style="padding: 15px; display: flex; flex-direction: column; gap: 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            
            <!-- QR Code Card -->
            <div class="card p-4 text-center" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-top: 4px solid var(--sdi-orange);">
              <div>
                <h4 style="margin-bottom: 8px; color: var(--text-color);"><i class="fas fa-qrcode text-accent"></i> ${I18N[lang].qrCode}</h4>
                <p class="text-xs text-muted mb-3">${I18N[lang].qrInstructions}</p>
                <div class="qr-code-display-box" id="assetDetailsQrBox" style="margin: 0 auto 12px; background: #fff; padding: 12px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${qrSvg}
                </div>
                <div style="margin-top: 6px;">
                  <code style="font-size: 13px; font-weight: bold; background: rgba(0,0,0,0.06); padding: 4px 8px; border-radius: 4px;">${qrVal}</code>
                </div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; justify-content: center;">
                <button type="button" class="btn btn-secondary btn-sm" id="btnDownloadAssetQr" onclick="AssetManager.downloadAssetQr('${asset.id}')">
                  <i class="fas fa-download"></i> <span>${I18N[lang].downloadQrBtn}</span>
                </button>
                <button type="button" class="btn btn-primary btn-sm" id="btnPrintAssetQr" onclick="AssetManager.printAssetQr('${asset.id}')">
                  <i class="fas fa-print"></i> <span>${I18N[lang].printQrBtn}</span>
                </button>
              </div>
            </div>

            <!-- Barcode Card -->
            <div class="card p-4 text-center" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-top: 4px solid var(--sdi-blue);">
              <div>
                <h4 style="margin-bottom: 8px; color: var(--text-color);"><i class="fas fa-barcode text-primary"></i> ${I18N[lang].barcode}</h4>
                <p class="text-xs text-muted mb-3">${I18N[lang].barcodeInstructions}</p>
                <div style="margin: 0 auto 12px; background: #fff; padding: 12px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%; overflow-x: auto;">
                  ${barcodeSvg}
                </div>
                <div style="margin-top: 6px;">
                  <code style="font-size: 13px; font-weight: bold; background: rgba(0,0,0,0.06); padding: 4px 8px; border-radius: 4px;">${barcodeVal}</code>
                </div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; justify-content: center;">
                <button type="button" class="btn btn-primary btn-sm" onclick="AssetManager.printAssetLabel('${asset.id}')">
                  <i class="fas fa-tag"></i> <span>${I18N[lang].printAssetLabelBtn}</span>
                </button>
              </div>
            </div>

          </div>

          <!-- Bottom: Asset Tag info preview -->
          <div class="card p-3" style="background: rgba(11, 60, 104, 0.04); border: 1px dashed var(--sdi-blue);">
            <div class="d-flex justify-between items-center mb-2">
              <strong style="color: var(--sdi-blue);"><i class="fas fa-info-circle"></i> ${lang === 'ar' ? 'ملصق الأصل الموحد' : 'Unified SDI Asset Tag'}</strong>
              <button class="btn btn-xs btn-secondary" onclick="AssetManager.printAssetLabel('${asset.id}')"><i class="fas fa-print"></i> ${lang === 'ar' ? 'طباعة الملصق كاملاً' : 'Print Label'}</button>
            </div>
            <div class="text-xs text-muted">
              ${lang === 'ar' ? 'يمكن استخدام هذا الملصق للطباعة على طابعات الملصقات الحرارية ولصقه مباشرة على الجهاز للتعرف الفوري عبر كاميرا الهاتف أو أجهزة القارئ اللاسلكي.' : 'This label can be printed using thermal barcode printers and applied directly to devices for instant scanning via mobile camera or barcode readers.'}
            </div>
          </div>
        </div>
      `;
    }

    body.innerHTML = html;
  }

  formatTxType(type) {
    const lang = AppState.lang;
    if (typeof window.formatTxType === "function") {
      return window.formatTxType(type, lang);
    }
    switch (type) {
      case "Added": return lang === "ar" ? "إضافة أصل جديد" : "Added";
      case "Assigned": return lang === "ar" ? "تسليم عهدة لموظف" : "Assigned";
      case "Returned": return lang === "ar" ? "إرجاع عهدة" : "Returned";
      case "Transferred": return lang === "ar" ? "نقل عهدة وموقع" : "Transferred";
      case "Moved": return lang === "ar" ? "نقل موقع" : "Moved";
      case "Status Changed": return lang === "ar" ? "تغيير الحالة" : "Status Changed";
      case "Details Updated": return lang === "ar" ? "تحديث البيانات والمواصفات" : "Details Updated";
      case "Sent to Maintenance": return lang === "ar" ? "إرسال للصيانة" : "Sent to Maintenance";
      case "Returned from Maintenance": return lang === "ar" ? "استلام من الصيانة" : "Returned from Maintenance";
      case "Retired": return lang === "ar" ? "تكهين الأصل" : "Retired";
      case "Disposed": return lang === "ar" ? "إتلاف واستبعاد" : "Disposed";
      default: return type;
    }
  }

  // =========================================================================
  // 4. ATTACHMENTS HANDLING
  // =========================================================================
  async handleAttachmentUpload(event, assetId) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      App.showToast(AppState.lang === "ar" ? "الحد الأقصى لحجم المرفق هو 5 ميجابايت" : "Max attachment size is 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const asset = await db.getById("assets", assetId);
      if (!asset) return;

      if (!asset.attachments) asset.attachments = [];
      asset.attachments.push({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        uploadDate: new Date().toISOString().slice(0, 10),
        dataUrl: e.target.result
      });

      await db.put("assets", asset);
      App.showToast(AppState.lang === "ar" ? "تم إرفاق الملف بنجاح" : "File attached successfully", "success");
      await this.renderDetailsSubTab("attachments", asset);
    };
    reader.readAsDataURL(file);
  }

  async deleteAttachment(assetId, index) {
    if (confirm(AppState.lang === "ar" ? "هل أنت متأكد من حذف هذا المرفق؟" : "Are you sure you want to delete this attachment?")) {
      const asset = await db.getById("assets", assetId);
      if (asset && asset.attachments) {
        asset.attachments.splice(index, 1);
        await db.put("assets", asset);
        App.showToast(AppState.lang === "ar" ? "تم حذف المرفق" : "Attachment deleted", "success");
        await this.renderDetailsSubTab("attachments", asset);
      }
    }
  }

  // =========================================================================
  // 5. ASSIGN ASSET MODAL & WORKFLOW
  // =========================================================================
  async openAssignModal(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    // Prevent Invalid Assignment (REQ-8)
    if (asset.status === "Under Maintenance") {
      App.showToast(I18N[AppState.lang].errAssetUnderMaint || "لا يمكن تخصيص جهاز موجود حاليًا تحت الصيانة.", "error");
      return;
    }
    if (asset.status === "Retired" || asset.status === "Disposed") {
      App.showToast(I18N[AppState.lang].errAssetRetiredDisposed || "لا يمكن تخصيص جهاز تم تكهينه أو استبعاده.", "error");
      return;
    }

    document.getElementById("formAssignAssetId").value = asset.id;
    document.getElementById("assignAssetDisplay").textContent = `${asset.assetId} - ${asset.brand} ${asset.model}`;

    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const lang = AppState.lang;

    // Populate selects
    document.getElementById("formAssignEmp").innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموظف المستلم' : 'Select Receiving Employee'} --</option>` +
      employees.filter(e => e.status === "Active").map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber})</option>`).join("");

    document.getElementById("formAssignDept").innerHTML = departments.filter(d => d.active !== false).map(d => `<option value="${d.id}">${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
    document.getElementById("formAssignLoc").innerHTML = locations.filter(l => l.active !== false).map(l => `<option value="${l.id}">${lang === 'ar' ? l.nameAr : (l.nameEn || l.nameAr)}</option>`).join("");

    document.getElementById("formAssignDept").value = asset.departmentId || "";
    document.getElementById("formAssignLoc").value = asset.locationId || "";
    document.getElementById("formAssignDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("formAssignReturnExpected").value = "";
    document.getElementById("formAssignNotes").value = "";

    if (window.OpsManager && typeof window.OpsManager.enhanceSelectWithSearch === "function") {
      window.OpsManager.enhanceSelectWithSearch("formAssignEmp", lang === 'ar' ? 'اختر الموظف المستلم *' : 'Select Receiving Employee *', lang === 'ar' ? 'ابحث عن الموظف...' : 'Search employee...');
      window.OpsManager.enhanceSelectWithSearch("formAssignDept", lang === 'ar' ? 'القسم' : 'Department', lang === 'ar' ? 'ابحث في الأقسام...' : 'Search departments...');
      window.OpsManager.enhanceSelectWithSearch("formAssignLoc", lang === 'ar' ? 'الموقع' : 'Location', lang === 'ar' ? 'ابحث في المواقع...' : 'Search locations...');
    }

    App.openModal("assignModal");
  }

  async handleAssignEmpChange(empId) {
    if (!empId) return;
    const emp = await db.getById("employees", empId);
    if (!emp) return;

    const deptSelect = document.getElementById("formAssignDept");
    const locSelect = document.getElementById("formAssignLoc");

    const empDept = emp.departmentId || emp.department_id;
    if (empDept && deptSelect) {
      deptSelect.value = empDept;
    }

    let empLoc = emp.locationId || emp.location_id;
    if (!empLoc && empDept) {
      const dept = await db.getById("departments", empDept);
      if (dept) empLoc = dept.locationId || dept.location_id;
    }

    if (empLoc && locSelect) {
      locSelect.value = empLoc;
    }
  }

  async handleAssignDeptChange(deptId) {
    if (!deptId) return;
    const dept = await db.getById("departments", deptId);
    const locSelect = document.getElementById("formAssignLoc");
    const empSelect = document.getElementById("formAssignEmp");
    const lang = AppState.lang;

    if (dept) {
      const dLoc = dept.locationId || dept.location_id;
      if (dLoc && locSelect) {
        locSelect.value = dLoc;
      }
    }

    if (empSelect) {
      const employees = await db.getAll("employees");
      const activeEmps = employees.filter(e => e.status === "Active" || !e.status);
      const deptEmps = activeEmps.filter(e => (e.departmentId === deptId || e.department_id === deptId));
      const listToShow = deptEmps.length > 0 ? deptEmps : activeEmps;
      const curEmp = empSelect.value;
      empSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموظف المستلم' : 'Select Receiving Employee'} --</option>` +
        listToShow.map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
      if (curEmp && listToShow.some(e => e.id === curEmp)) {
        empSelect.value = curEmp;
      }
    }
  }

  async handleAssignLocChange(locId) {
    if (!locId) return;
    const departments = await db.getAll("departments");
    const employees = await db.getAll("employees");
    const lang = AppState.lang;

    const deptSelect = document.getElementById("formAssignDept");
    const empSelect = document.getElementById("formAssignEmp");

    if (deptSelect) {
      const activeDepts = departments.filter(d => d.active !== false);
      const locDepts = activeDepts.filter(d => (d.locationId === locId || d.location_id === locId));
      const listToShow = locDepts.length > 0 ? locDepts : activeDepts;
      const curDept = deptSelect.value;
      deptSelect.innerHTML = listToShow.map(d => `<option value="${d.id}">${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
      if (curDept && listToShow.some(d => d.id === curDept)) {
        deptSelect.value = curDept;
      }
    }

    if (empSelect) {
      const activeEmps = employees.filter(e => e.status === "Active" || !e.status);
      const locEmps = activeEmps.filter(e => (e.locationId === locId || e.location_id === locId));
      const listToShow = locEmps.length > 0 ? locEmps : activeEmps;
      const curEmp = empSelect.value;
      empSelect.innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموظف المستلم' : 'Select Receiving Employee'} --</option>` +
        listToShow.map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
      if (curEmp && listToShow.some(e => e.id === curEmp)) {
        empSelect.value = curEmp;
      }
    }
  }

  async handleAssignSubmit(event) {
    event.preventDefault();
    const assetId = document.getElementById("formAssignAssetId").value;
    const empId = document.getElementById("formAssignEmp").value;
    const deptId = document.getElementById("formAssignDept").value;
    const locId = document.getElementById("formAssignLoc").value;
    const assignDate = document.getElementById("formAssignDate").value;
    const returnExpected = document.getElementById("formAssignReturnExpected").value;
    const notes = document.getElementById("formAssignNotes").value.trim();

    if (!empId) {
      App.showToast(I18N[AppState.lang].errEmployeeReq, "error");
      return;
    }
    if (!locId) {
      App.showToast(I18N[AppState.lang].errLocationReq, "error");
      return;
    }

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    // Prevent Invalid Assignment (REQ-8)
    if (asset.status === "Under Maintenance") {
      App.showToast(I18N[AppState.lang].errAssetUnderMaint || "لا يمكن تخصيص جهاز موجود حاليًا تحت الصيانة.", "error");
      return;
    }
    if (asset.status === "Retired" || asset.status === "Disposed") {
      App.showToast(I18N[AppState.lang].errAssetRetiredDisposed || "لا يمكن تخصيص جهاز تم تكهينه أو استبعاده.", "error");
      return;
    }

    const currentUserName = AppState.currentUser ? (AppState.currentUser.fullName || AppState.currentUser.username) : "admin";

    asset.status = "Assigned";
    asset.currentEmployeeId = empId;
    asset.departmentId = deptId;
    asset.locationId = locId;
    asset.assignmentDate = assignDate;
    asset.assignedBy = currentUserName;
    asset.handoverStatus = "Pending"; // Handover Pending (REQ-2)
    asset.handoverDate = null;
    asset.confirmedBy = null;
    asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);

    await db.put("assets", asset);

    // Log Transaction (REQ-5)
    await db.logTransaction({
      assetId: asset.id,
      transactionType: "Assigned",
      toEmployeeId: empId,
      toDepartmentId: deptId,
      toLocationId: locId,
      transactionDate: assignDate + " " + new Date().toTimeString().slice(0, 8),
      performedBy: currentUserName,
      notes: notes + (returnExpected ? (AppState.lang === "ar" ? ` (تاريخ متوقع للإرجاع: ${returnExpected})` : ` (Expected return date: ${returnExpected})`) : "")
    });

    // Notify Employee (REQ-22)
    await db.createNotification({
      employeeId: empId,
      titleAr: `تم تخصيص جهاز عهدة جديد لك (${asset.assetId})`,
      titleEn: `New IT Asset Assigned to You (${asset.assetId})`,
      messageAr: `تم تسليمك جهاز (${asset.brand} ${asset.model}). يرجى تأكيد الاستلام في بوابة الموظف.`,
      messageEn: `An asset (${asset.brand} ${asset.model}) has been assigned to you. Please confirm receipt in the Employee Portal.`,
      type: "handover",
      relatedId: asset.id
    });

    App.closeModal("assignModal");
    App.showToast(I18N[AppState.lang].saveAssetSuccess || I18N[AppState.lang].assignSuccess, "success");
    await this.render();
    await App.updateDashboard();

    if (this.currentDetailAssetId === assetId) {
      await this.openDetailsModal(assetId);
    }
  }

  // =========================================================================
  // 6. RETURN ASSET WORKFLOW (REQ-3, REQ-4)
  // =========================================================================
  async openReturnModal(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    document.getElementById("formReturnAssetId").value = asset.id;
    document.getElementById("returnAssetDisplay").textContent = `${asset.assetId} - ${asset.brand} ${asset.model}`;
    document.getElementById("formReturnDate").value = new Date().toISOString().slice(0, 10);
    
    // Condition dropdown (Good, Minor Damage, Damaged, Not Working)
    const condSelect = document.getElementById("formReturnCondition");
    if (condSelect) condSelect.value = "Good";

    const returnToInp = document.getElementById("formReturnTo");
    if (returnToInp) returnToInp.value = AppState.currentUser ? (AppState.currentUser.fullName || AppState.currentUser.username) : "IT Support";

    document.getElementById("formReturnNotes").value = "";

    App.openModal("returnModal");
  }

  async handleReturnSubmit(event) {
    event.preventDefault();
    const assetId = document.getElementById("formReturnAssetId").value;
    const returnDate = document.getElementById("formReturnDate").value;
    const conditionSelect = document.getElementById("formReturnCondition");
    const condition = conditionSelect ? conditionSelect.value : "Good";
    const returnToInp = document.getElementById("formReturnTo");
    const returnTo = returnToInp ? returnToInp.value.trim() : "IT Support";
    const notes = document.getElementById("formReturnNotes").value.trim();

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const oldEmp = asset.currentEmployeeId;

    // Condition-based status transition (REQ-3 & REQ-4)
    // Good -> Available (or In Store if returned to warehouse)
    // Minor Damage / Damaged / Not Working -> Under Maintenance
    let newStatus = "Available";
    if (condition === "Minor Damage" || condition === "Damaged" || condition === "Not Working") {
      newStatus = "Under Maintenance";
    } else {
      const locations = await db.getAll("locations");
      const curLoc = locations.find(l => l.id === asset.locationId);
      const isWarehouse = Boolean(curLoc && (curLoc.isWarehouse || (curLoc.type && curLoc.type.toLowerCase().includes("warehouse")) || curLoc.type === "store" || (curLoc.nameAr && curLoc.nameAr.includes("مستودع"))));
      if (isWarehouse) {
        newStatus = "In Store";
      }
    }

    asset.status = newStatus;
    asset.currentEmployeeId = null;
    asset.condition = condition;
    asset.handoverStatus = null;
    asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);

    await db.put("assets", asset);

    const lang = AppState.lang;
    const condLabel = formatCondition ? formatCondition(condition, lang) : condition;

    // Log Transaction (REQ-5)
    await db.logTransaction({
      assetId: asset.id,
      transactionType: "Returned",
      fromEmployeeId: oldEmp,
      toDepartmentId: asset.departmentId,
      toLocationId: asset.locationId,
      transactionDate: returnDate + " " + new Date().toTimeString().slice(0, 8),
      performedBy: AppState.currentUser ? getUserDisplayName(AppState.currentUser, AppState.lang) : "System",
      notes: AppState.lang === "ar" ? `إرجاع الأصل بحالة [${condLabel}]. المستلم: ${returnTo}. ملاحظات: ${notes}` : `Asset returned in condition [${condLabel}]. Received by: ${returnTo}. Notes: ${notes}`
    });

    App.closeModal("returnModal");
    App.showToast(I18N[AppState.lang].returnSuccess, "success");
    await this.render();
    await App.updateDashboard();

    if (this.currentDetailAssetId === assetId) {
      await this.openDetailsModal(assetId);
    }
  }

  // =========================================================================
  // 7. TRANSFER ASSET WORKFLOW (REQ-6, REQ-7)
  // =========================================================================
  async openTransferModal(assetId = null) {
    const allAssets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const lang = AppState.lang;

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));

    let asset = null;
    if (assetId) {
      asset = allAssets.find(a => a.id === assetId);
    } else {
      const eligible = allAssets.filter(a => a.status !== "Retired" && a.status !== "Disposed");
      asset = eligible.length > 0 ? eligible[0] : allAssets[0];
    }

    if (!asset) {
      App.showToast(lang === "ar" ? "لا توجد أصول مسجلة في النظام للنقل" : "No assets available in system to transfer", "warning");
      return;
    }

    const assetSelect = document.getElementById("formTransferAssetSelect");
    const displayEl = document.getElementById("transferAssetDisplay");

    if (assetSelect) {
      const eligible = allAssets.filter(a => a.status !== "Retired" && a.status !== "Disposed");
      assetSelect.innerHTML = eligible.map(a => 
        `<option value="${a.id}" ${a.id === asset.id ? "selected" : ""}>${a.assetId} - ${a.brand || ""} ${a.model || ""} (${a.serial || "-"})</option>`
      ).join("");

      if (assetId) {
        assetSelect.style.display = "none";
        if (displayEl) {
          displayEl.style.display = "block";
          displayEl.textContent = `${asset.assetId} - ${asset.brand} ${asset.model}`;
        }
      } else {
        assetSelect.style.display = "block";
        if (displayEl) displayEl.style.display = "none";
      }
    } else if (displayEl) {
      displayEl.textContent = `${asset.assetId} - ${asset.brand} ${asset.model}`;
      displayEl.style.display = "block";
    }

    document.getElementById("formTransferAssetId").value = asset.id;

    document.getElementById("trCurEmp").textContent = empMap[asset.currentEmployeeId] || "-";
    document.getElementById("trCurDept").textContent = deptMap[asset.departmentId] || "-";
    document.getElementById("trCurLoc").textContent = locMap[asset.locationId] || "-";

    document.getElementById("formTrToLoc").innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموقع المستهدف' : 'Select Destination Location'} --</option>` +
      locations.filter(l => l.active !== false && l.id !== asset.locationId)
        .map(l => `<option value="${l.id}">${lang === 'ar' ? l.nameAr : (l.nameEn || l.nameAr)} (${l.code || ''})</option>`).join("");

    document.getElementById("formTrToEmp").innerHTML = `<option value="">-- ${lang === 'ar' ? 'الموظف / المستلم الجديد (اختياري)' : 'New Employee / Custodian (Optional)'} --</option>` +
      employees.filter(e => e.status === "Active")
        .map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber})</option>`).join("");

    document.getElementById("formTrToDept").innerHTML = `<option value="">-- ${lang === 'ar' ? 'القسم (اختياري)' : 'Department (Optional)'} --</option>` +
      departments.filter(d => d.active !== false).map(d => `<option value="${d.id}">${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");

    const responsibleSelect = document.getElementById("formTrResponsibleEmp");
    if (responsibleSelect) {
      responsibleSelect.innerHTML = employees.filter(e => e.status === "Active")
        .map(e => `<option value="${e.id}">${lang === 'ar' ? e.nameAr : (e.nameEn || e.nameAr)}</option>`).join("");
      const curUserEmp = AppState.currentUser ? AppState.currentUser.employeeId : null;
      if (curUserEmp) responsibleSelect.value = curUserEmp;
    }

    const condSelect = document.getElementById("formTrCondition");
    if (condSelect) condSelect.value = "Working";

    document.getElementById("formTrDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("formTrNotes").value = "";

    if (window.OpsManager && typeof window.OpsManager.enhanceSelectWithSearch === "function") {
      window.OpsManager.enhanceSelectWithSearch("formTrToLoc", lang === 'ar' ? 'اختر الموقع المستهدف *' : 'Select Destination Location *', lang === 'ar' ? 'ابحث في المواقع...' : 'Search locations...');
      window.OpsManager.enhanceSelectWithSearch("formTrToEmp", lang === 'ar' ? 'الموظف / المستلم الجديد (اختياري)' : 'New Employee / Custodian (Optional)', lang === 'ar' ? 'ابحث في الموظفين...' : 'Search employees...');
      window.OpsManager.enhanceSelectWithSearch("formTrToDept", lang === 'ar' ? 'القسم (اختياري)' : 'Department (Optional)', lang === 'ar' ? 'ابحث في الأقسام...' : 'Search departments...');
    }

    App.openModal("transferModal");
  }

  async handleTransferAssetSelect(assetId) {
    if (!assetId) return;
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const [employees, departments, locations] = await Promise.all([
      db.getAll("employees"),
      db.getAll("departments"),
      db.getAll("locations")
    ]);
    const lang = AppState.lang;

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));

    document.getElementById("formTransferAssetId").value = asset.id;
    document.getElementById("trCurEmp").textContent = empMap[asset.currentEmployeeId] || "-";
    document.getElementById("trCurDept").textContent = deptMap[asset.departmentId] || "-";
    document.getElementById("trCurLoc").textContent = locMap[asset.locationId] || "-";

    const toLocEl = document.getElementById("formTrToLoc");
    if (toLocEl) {
      toLocEl.innerHTML = `<option value="">-- ${lang === 'ar' ? 'اختر الموقع المستهدف' : 'Select Destination Location'} --</option>` +
        locations.filter(l => l.active !== false && l.id !== asset.locationId)
          .map(l => `<option value="${l.id}">${lang === 'ar' ? l.nameAr : (l.nameEn || l.nameAr)} (${l.code || ''})</option>`).join("");
      if (window.OpsManager && typeof window.OpsManager.enhanceSelectWithSearch === "function") {
        window.OpsManager.enhanceSelectWithSearch("formTrToLoc", lang === 'ar' ? 'اختر الموقع المستهدف *' : 'Select Destination Location *', lang === 'ar' ? 'ابحث في المواقع...' : 'Search locations...');
      }
    }
  }

  async syncTransferFilters(triggerSource) {
    const lang = AppState.lang;
    const locSelect = document.getElementById("formTrToLoc");
    const deptSelect = document.getElementById("formTrToDept");
    const officeSelect = document.getElementById("formTrToOffice");
    const empSelect = document.getElementById("formTrToEmp");

    if (!locSelect || !deptSelect || !officeSelect || !empSelect) return;

    let locId = locSelect.value;
    let deptId = deptSelect.value;
    let officeId = officeSelect.value;
    let empId = empSelect.value;

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
        if (deptId && (deptMap[deptId]?.locationId || deptMap[deptId]?.location_id) && (deptMap[deptId]?.locationId || deptMap[deptId]?.location_id) !== locId) {
          deptId = ""; officeId = ""; empId = "";
        }
        if (officeId && (officeMap[officeId]?.location_id || officeMap[officeId]?.locationId) && (officeMap[officeId]?.location_id || officeMap[officeId]?.locationId) !== locId) {
          officeId = ""; empId = "";
        }
      }
    } else if (triggerSource === "department") {
      if (deptId) {
        const dLoc = deptMap[deptId]?.locationId || deptMap[deptId]?.location_id;
        if (dLoc) {
          locId = dLoc;
        }
        if (officeId && (officeMap[officeId]?.department_id || officeMap[officeId]?.departmentId) && (officeMap[officeId]?.department_id || officeMap[officeId]?.departmentId) !== deptId) {
          officeId = ""; empId = "";
        }
        if (empId && (empMap[empId]?.departmentId || empMap[empId]?.department_id) && (empMap[empId]?.departmentId || empMap[empId]?.department_id) !== deptId) {
          empId = "";
        }
      } else {
        officeId = ""; empId = "";
      }
    } else if (triggerSource === "office") {
      if (officeId) {
        const off = officeMap[officeId];
        if (off) {
          if (off.location_id || off.locationId) locId = off.location_id || off.locationId;
          if (off.department_id || off.departmentId) deptId = off.department_id || off.departmentId;
        }
        if (empId && (empMap[empId]?.officeId || empMap[empId]?.office_id) && (empMap[empId]?.officeId || empMap[empId]?.office_id) !== officeId) {
          empId = "";
        }
      }
    } else if (triggerSource === "employee") {
      if (empId) {
        const emp = empMap[empId];
        if (emp) {
          if (emp.departmentId || emp.department_id) deptId = emp.departmentId || emp.department_id;
          if (emp.officeId || emp.office_id) officeId = emp.officeId || emp.office_id;
          if (emp.locationId || emp.location_id) locId = emp.locationId || emp.location_id;
          else if (deptId && (deptMap[deptId]?.locationId || deptMap[deptId]?.location_id)) locId = deptMap[deptId]?.locationId || deptMap[deptId]?.location_id;
        }
      }
    }

    locSelect.value = locId;
    deptSelect.value = deptId;
    officeSelect.value = officeId;
    empSelect.value = empId;

    let filteredDepts = activeDepts;
    if (locId) filteredDepts = activeDepts.filter(d => (d.locationId === locId || d.location_id === locId));

    
    deptSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "القسم (اختياري)" : "Department (Optional)"} --</option>` +
      filteredDepts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
    if (deptId && filteredDepts.some(d => d.id === deptId)) deptSelect.value = deptId;
    else if (!deptId && filteredDepts.length === 1 && locId) { deptId = filteredDepts[0].id; deptSelect.value = deptId; }

    let filteredOffices = activeOffices;
    if (locId) filteredOffices = filteredOffices.filter(o => (o.location_id === locId || o.locationId === locId));
    if (deptId) filteredOffices = filteredOffices.filter(o => (o.department_id === deptId || o.departmentId === deptId));

    officeSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "المكتب الجديد (Office)" : "New Office" } --</option>` +
      filteredOffices.map(o => `<option value="${o.id}">${lang === "ar" ? o.nameAr : (o.nameEn || o.nameAr)} ${o.code ? `(${o.code})` : ""}</option>`).join("");
    if (officeId && filteredOffices.some(o => o.id === officeId)) officeSelect.value = officeId;
    else officeId = "";

    let filteredEmps = activeEmps;
    if (deptId) filteredEmps = filteredEmps.filter(e => (e.departmentId === deptId || e.department_id === deptId));
    if (officeId) filteredEmps = filteredEmps.filter(e => (e.officeId === officeId || e.office_id === officeId));
    if (locId && !deptId) filteredEmps = filteredEmps.filter(e => (e.locationId === locId || e.location_id === locId));


    empSelect.innerHTML = `<option value="">-- ${lang === "ar" ? "الموظف / المستلم الجديد (اختياري)" : "New Employee / Custodian (Optional)"} --</option>` +
      filteredEmps.map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber || e.id})</option>`).join("");
    if (empId && filteredEmps.some(e => e.id === empId)) empSelect.value = empId;
    else empId = "";
  }

  async handleTransferSubmit(event) {
    event.preventDefault();
    const assetId = document.getElementById("formTransferAssetId").value;
    const toLocId = document.getElementById("formTrToLoc").value;
    const toEmpId = document.getElementById("formTrToEmp").value || null;
    const toDeptId = document.getElementById("formTrToDept").value || null;
    const toOfficeId = document.getElementById("formTrToOffice")?.value || null;
    const responsibleEmpId = document.getElementById("formTrResponsibleEmp")?.value || null;
    const condition = document.getElementById("formTrCondition")?.value || "Working";
    const trDate = document.getElementById("formTrDate").value;
    const notes = document.getElementById("formTrNotes").value.trim();

    if (!toLocId) {
      App.showToast(I18N[AppState.lang].errDestLocationReq || "يرجى تحديد الموقع المستهدف", "error");
      return;
    }

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    if (asset.locationId === toLocId) {
      App.showToast(I18N[AppState.lang].errSameLocation || "لا يمكن النقل لنفس الموقع الحالي", "error");
      return;
    }

    const fromEmp = asset.currentEmployeeId;
    const fromDept = asset.departmentId;
    const fromLoc = asset.locationId;
    const fromOffice = asset.office;
    const currentUserName = AppState.currentUser ? (AppState.currentUser.fullName || AppState.currentUser.username) : "admin";

    // 1. ATOMIC UPDATE OF ASSET CURRENT STATE (PART 7 & PART 20)
    asset.locationId = toLocId;
    if (toDeptId) asset.departmentId = toDeptId;
    if (toOfficeId) {
      asset.office = toOfficeId;
      asset.officeId = toOfficeId;
      if (!asset.specs) asset.specs = {};
      asset.specs.office = toOfficeId;
    } else {
      asset.office = null;
      asset.officeId = null;
      if (asset.specs) asset.specs.office = null;
    }

    const locations = await db.getAll("locations");
    const targetLoc = locations.find(l => l.id === toLocId);
    const isTargetWarehouse = Boolean(targetLoc && (targetLoc.isWarehouse || (targetLoc.type && targetLoc.type.toLowerCase().includes("warehouse")) || (targetLoc.type === "store") || (targetLoc.nameAr && targetLoc.nameAr.includes("مستودع"))));

    if (condition === "Not Working") {
      asset.status = "Under Maintenance";
      asset.currentEmployeeId = toEmpId || null;
      asset.handoverStatus = null;
    } else if (isTargetWarehouse) {
      asset.status = "In Store";
      asset.currentEmployeeId = null;
      asset.handoverStatus = null;
    } else if (toEmpId) {
      asset.currentEmployeeId = toEmpId;
      asset.status = "Assigned";
      asset.handoverStatus = "Pending";
    } else {
      asset.currentEmployeeId = null;
      asset.handoverStatus = null;
      asset.status = (asset.status === "Installed") ? "Installed" : "Available";
    }
    asset.condition = condition;
    asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);

    await db.put("assets", asset);

    // 2. CREATE ASSET TRANSFER RECORD (Excel Compatible Model)
    const transferNo = await db.getNextTransferNo();
    const nextSeq = await db.getNextSequentialId("assetTransfers");
    const transferRecord = {
      id: nextSeq,
      transferNo,
      assetId: asset.id,
      fromLocationId: fromLoc,
      fromDepartmentId: fromDept,
      fromOffice: fromOffice,
      fromEmployeeId: fromEmp,
      toLocationId: toLocId,
      toDepartmentId: toDeptId,
      toOffice: toOfficeId,
      toEmployeeId: toEmpId,
      transferDate: trDate,
      responsibleEmployeeId: responsibleEmpId,
      status: "Completed",
      condition,
      notes,
      createdAt: new Date().toISOString()
    };
    await db.put("assetTransfers", transferRecord);

    // 3. LOG ASSET TRANSACTION AUDIT TRAIL (PART 8)
    await db.logTransaction({
      assetId: asset.id,
      transactionType: "Transferred",
      fromEmployeeId: fromEmp,
      toEmployeeId: toEmpId,
      fromDepartmentId: fromDept,
      toDepartmentId: toDeptId,
      fromLocationId: fromLoc,
      toLocationId: toLocId,
      transactionDate: trDate + " " + new Date().toTimeString().slice(0, 8),
      performedBy: currentUserName,
      notes: notes || `[${transferNo}] Location Transfer: ${fromLoc} -> ${toLocId} (${condition})`
    });

    if (toEmpId && toEmpId !== fromEmp) {
      await db.createNotification({
        employeeId: toEmpId,
        titleAr: `تم نقل جهاز عهدة إليك (${asset.assetId})`,
        titleEn: `Asset Transferred to You (${asset.assetId})`,
        messageAr: `تم نقل الأصل (${asset.brand} ${asset.model}) إليك. يرجى مراجعة بوابة الموظف وتأكيد الاستلام.`,
        messageEn: `Asset (${asset.brand} ${asset.model}) transferred to you. Please confirm receipt in the Employee Portal.`,
        type: "handover",
        relatedId: asset.id
      });
    }

    App.closeModal("transferModal");
    App.showToast(I18N[AppState.lang].transferSuccess || "تمت عملية النقل وتحديث الموقع بنجاح", "success");
    await this.render();
    await App.updateDashboard();

    if (this.currentDetailAssetId === assetId) {
      await this.openDetailsModal(assetId);
    }
  }


  // Quick Status Update Prompt (Retire, Dispose, Reactivate)
  async updateAssetStatusPrompt(assetId, targetStatus) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const reason = prompt(AppState.lang === "ar" ? `تأكيد تغيير حالة الأصل [${asset.assetId}] إلى (${targetStatus}). يرجى إدخال السبب أو الملاحظات:` : `Confirm status change of asset [${asset.assetId}] to (${targetStatus}). Enter reason or notes:`);
    if (reason === null) return; // user cancelled

    const oldStatus = asset.status;
    asset.status = targetStatus;
    if (targetStatus === "Retired" || targetStatus === "Disposed") {
      asset.currentEmployeeId = null;
    }
    asset.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.put("assets", asset);

    let txType = targetStatus === "Retired" ? "Retired" : (targetStatus === "Disposed" ? "Disposed" : "Returned");
    await db.logTransaction({
      assetId: asset.id,
      transactionType: txType,
      transactionDate: new Date().toISOString().replace("T", " ").substring(0, 19),
      performedBy: AppState.currentUser ? (getUserDisplayName(AppState.currentUser, AppState.lang)) : "System",
      notes: AppState.lang === "ar" ? `تغيير الحالة من [${oldStatus}] إلى [${targetStatus}]: ${reason}` : `Status changed from [${oldStatus}] to [${targetStatus}]: ${reason}`
    });

    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.render();
    await App.updateDashboard();

    if (this.currentDetailAssetId === assetId) {
      await this.openDetailsModal(assetId);
    }
  }

  // =========================================================================
  // 7. BARCODE & QR CODE UTILITIES
  // =========================================================================
  generateQrSvg(text, size = 160) {
    try {
      if (typeof window.qrcode === "function") {
        const qr = window.qrcode(0, "M");
        qr.addData(text || "SDI");
        qr.make();
        const moduleCount = qr.getModuleCount();
        const cellSize = Math.max(2, Math.floor(size / moduleCount));
        const margin = 2;
        const actualSize = (moduleCount + margin * 2) * cellSize;
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${actualSize} ${actualSize}" width="${size}" height="${size}" shape-rendering="crispEdges">`;
        svg += `<rect width="${actualSize}" height="${actualSize}" fill="#ffffff"/>`;
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (qr.isDark(r, c)) {
              svg += `<rect x="${(c + margin) * cellSize}" y="${(r + margin) * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0B3C68"/>`;
            }
          }
        }
        svg += `</svg>`;
        return svg;
      }
    } catch (e) {
      console.error("QR Generation error:", e);
    }
    return `<div style="padding:20px; background:#f1f5f9; border-radius:6px; font-family:monospace;">${text}</div>`;
  }

  generateBarcodeSvg(text, height = 55) {
    try {
      const patterns = [
        '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
        '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
        '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
        '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
        '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
        '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
        '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
        '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
        '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
        '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
        '114131','311141','411131','211412','211214','211232','2331112'
      ];
      const cleanText = (text || "AST").replace(/[^\x20-\x7E]/g, "");
      const codes = [104];
      let check = 104;
      for (let i = 0; i < cleanText.length; i++) {
        const val = cleanText.charCodeAt(i) - 32;
        codes.push(val);
        check += (i + 1) * val;
      }
      codes.push(check % 103);
      codes.push(106);
      let bars = '';
      codes.forEach(c => { if (patterns[c]) bars += patterns[c]; });
      
      let totalWidth = 20;
      for (let i = 0; i < bars.length; i++) totalWidth += parseInt(bars[i]) * 2;
      
      let x = 10;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" shape-rendering="crispEdges">`;
      svg += `<rect width="${totalWidth}" height="${height}" fill="#ffffff"/>`;
      for (let i = 0; i < bars.length; i++) {
        const w = parseInt(bars[i]) * 2;
        if (i % 2 === 0) {
          svg += `<rect x="${x}" y="4" width="${w}" height="${height - 20}" fill="#0B3C68"/>`;
        }
        x += w;
      }
      svg += `<text x="${totalWidth / 2}" y="${height - 4}" text-anchor="middle" font-family="monospace, monospace" font-size="11" font-weight="bold" fill="#0B3C68">${cleanText}</text>`;
      svg += `</svg>`;
      return svg;
    } catch (e) {
      console.error("Barcode generation error:", e);
      return `<code>${text}</code>`;
    }
  }

  async downloadAssetQr(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;
    const qrVal = asset.qrCodeValue || asset.assetId;
    const svgString = this.generateQrSvg(qrVal, 400);

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `${asset.assetId}-QR.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      App.showToast(AppState.lang === "ar" ? "تم تحميل رمز QR بنجاح" : "QR Code downloaded successfully", "success");
    };
    img.src = url;
  }

  async printAssetQr(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;
    const qrVal = asset.qrCodeValue || asset.assetId;
    const qrSvg = this.generateQrSvg(qrVal, 240);
    const lang = AppState.lang;
    const orgName = lang === "ar" ? (settings.orgNameAr || "معهد الشارقة للسياقة") : (settings.orgNameEn || "Sharjah Driving Institute");
    const logoHtml = settings.logoDataUrl 
      ? `<img src="${settings.logoDataUrl}" style="max-height: 50px; max-width: 160px; object-fit: contain; margin-bottom: 8px;">`
      : `<h2 style="margin:0; color:#0B3C68;">${orgName}</h2>`;

    const printWin = window.open("", "_blank", "width=600,height=600");
    if (!printWin) {
      App.showToast(lang === "ar" ? "يرجى السماح بالنوافذ المنبثقة لطباعة الرمز" : "Please allow popups to print QR code", "warning");
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <title>SDI QR Code - ${asset.assetId}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 24px; text-align: center; color: #0F172A; }
          .tag-card { border: 2px solid #0B3C68; border-radius: 12px; padding: 24px; max-width: 360px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .asset-id { font-size: 22px; font-weight: bold; color: #0B3C68; margin: 12px 0 4px; }
          .asset-title { font-size: 15px; color: #475569; margin-bottom: 16px; }
          .qr-box { margin: 16px auto; display: inline-block; }
          .footer-note { font-size: 11px; color: #64748B; margin-top: 14px; }
          @media print { body { padding: 0; } .tag-card { box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="tag-card">
          ${logoHtml}
          <div class="asset-id">${asset.assetId}</div>
          <div class="asset-title">${asset.brand || ""} ${asset.model || ""}</div>
          <div class="qr-box">${qrSvg}</div>
          <div style="font-family: monospace; font-size: 14px; font-weight: bold; color: #F37021;">${qrVal}</div>
          <div class="footer-note">${lang === 'ar' ? "نظام إدارة الأجهزة | SDI IT Asset Hub" : "Device Management System | SDI IT Asset Hub"}</div>
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  async printAssetLabel(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;
    const barcodeVal = asset.barcodeValue || asset.assetId;
    const qrVal = asset.qrCodeValue || asset.assetId;
    const barcodeSvg = this.generateBarcodeSvg(barcodeVal, 46);
    const qrSvg = this.generateQrSvg(qrVal, 90);
    const settings = await db.getSystemSettings();
    const departments = await db.getAll("departments");
    const lang = AppState.lang;
    const dept = departments.find(d => d.id === asset.departmentId);
    const deptName = dept ? (lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr)) : "";
    const orgName = lang === "ar" ? (settings.orgNameAr || "معهد الشارقة للسياقة") : (settings.orgNameEn || "Sharjah Driving Institute");

    const logoHtml = settings.logoDataUrl 
      ? `<img src="${settings.logoDataUrl}" style="max-height: 28px; max-width: 90px; object-fit: contain;">`
      : `<span style="font-weight:bold; color:#0B3C68; font-size:12px;">${orgName}</span>`;

    const printWin = window.open("", "_blank", "width=600,height=400");
    if (!printWin) {
      App.showToast(lang === "ar" ? "يرجى السماح بالنوافذ المنبثقة لطباعة الملصق" : "Please allow popups to print label", "warning");
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <title>SDI Asset Label - ${asset.assetId}</title>
        <style>
          @page { size: auto; margin: 0mm; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 10px; color: #000; }
          .asset-label {
            width: 80mm;
            border: 1.5px solid #0B3C68;
            border-radius: 6px;
            padding: 8px 10px;
            box-sizing: border-box;
            background: #fff;
          }
          .label-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .label-body {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .label-info {
            flex: 1;
            font-size: 11px;
            line-height: 1.4;
          }
          .label-id {
            font-size: 14px;
            font-weight: 800;
            color: #0B3C68;
          }
          .label-barcode {
            margin-top: 6px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="asset-label">
          <div class="label-head">
            ${logoHtml}
            <span style="font-size: 10px; font-weight: bold; color: #F37021;">SDI IT ASSET</span>
          </div>
          <div class="label-body">
            <div class="label-qr">${qrSvg}</div>
            <div class="label-info">
              <div class="label-id">${asset.assetId}</div>
              <div><strong>${lang === 'ar' ? 'الجهاز:' : 'Device:'}</strong> ${asset.brand || ""} ${asset.model || ""}</div>
              ${asset.serial ? `<div><strong>${lang === 'ar' ? 'السيريال:' : 'Serial:'}</strong> ${asset.serial}</div>` : ''}
              ${deptName ? `<div><strong>${lang === 'ar' ? 'القسم:' : 'Dept:'}</strong> ${deptName}</div>` : ''}
            </div>
          </div>
          <div class="label-barcode">
            ${barcodeSvg}
          </div>
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  // =========================================================================
  // 8. ASSET ACTIVITY CHRONOLOGICAL TIMELINE & AUDIT TRAIL
  // =========================================================================
  async openActivityTimeline(assetId) {
    if (!assetId) return;

    this.timelineAssetId = assetId;
    this.timelineFilterType = "all";
    this.timelineSearchQuery = "";
    this.timelineSortOrder = "desc";

    const data = await this.fetchAssetTimelineData(assetId);
    if (!data || !data.asset) {
      App.showToast(AppState.lang === "ar" ? "تعذر تحميل بيانات الأصل" : "Could not load asset data", "error");
      return;
    }

    this.currentTimelineData = data;
    this.allTimelineActivities = data.activities;

    // 1. Update Header Information
    const asset = data.asset;
    const lang = AppState.lang;
    const isAr = lang === "ar";

    const titleEl = document.getElementById("timelineModalAssetId");
    if (titleEl) {
      titleEl.textContent = `${asset.assetId} - ${asset.brand || ""} ${asset.model || ""}`;
    }

    const badgeEl = document.getElementById("timelineModalStatusBadge");
    if (badgeEl) {
      badgeEl.className = `badge ${this.getStatusBadgeClass(asset.status)}`;
      badgeEl.textContent = this.formatStatus(asset.status);
    }

    const specsEl = document.getElementById("timelineAssetSpecsSummary");
    if (specsEl) {
      const typeName = data.typeObj ? (isAr ? data.typeObj.nameAr : (data.typeObj.nameEn || data.typeObj.nameAr)) : "";
      const locName = data.locMap[asset.locationId] ? (isAr ? data.locMap[asset.locationId].nameAr : (data.locMap[asset.locationId].nameEn || data.locMap[asset.locationId].nameAr)) : "-";
      specsEl.textContent = `${typeName ? typeName + " • " : ""}${isAr ? "الموقع:" : "Location:"} ${locName} • S/N: ${asset.serial || "-"}`;
    }

    // 2. Reset Filter buttons & Search Input
    const filterButtons = document.querySelectorAll("#timelineTypeFilterGroup .timeline-filter-btn");
    filterButtons.forEach(btn => {
      const isAll = btn.getAttribute("data-filter") === "all";
      btn.classList.toggle("active", isAll);
      btn.classList.toggle("btn-primary", isAll);
      btn.classList.toggle("btn-secondary", !isAll);
    });

    const searchInput = document.getElementById("timelineSearchInput");
    if (searchInput) {
      searchInput.value = "";
      searchInput.placeholder = (I18N[lang] && I18N[lang].searchTimelinePlaceholder) || (isAr ? "بحث في الملاحظات أو المنفذ أو التغييرات..." : "Search notes, performed by, changes...");
    }

    const sortLabel = document.getElementById("timelineSortLabel");
    const sortIcon = document.getElementById("timelineSortIcon");
    if (sortLabel) sortLabel.textContent = (I18N[lang] && I18N[lang].newestFirst) || (isAr ? "الأحدث أولاً" : "Newest First");
    if (sortIcon) sortIcon.className = "fas fa-sort-amount-down";

    // 3. Render Summary Bar & Counts
    this.renderTimelineSummaryBar();

    // 4. Render Timeline entries list
    this.renderTimelineList();

    // 5. Seamless Transition: Close details modal if open and open timeline modal
    App.closeModal("assetDetailsModal");
    App.openModal("assetTimelineModal");
  }

  async fetchAssetTimelineData(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return null;

    const [transactions, transfers, maintenance, supportRequests, employees, departments, locations, assetTypes] = await Promise.all([
      db.getAssetHistory(asset.id),
      db.getAll("assetTransfers"),
      db.getAll("maintenance"),
      db.getAll("supportRequests"),
      db.getAll("employees"),
      db.getAll("departments"),
      db.getAll("locations"),
      db.getAll("assetTypes")
    ]);

    const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, l]));
    const typeObj = assetTypes.find(t => t.id === asset.assetTypeId);

    const activities = [];

    // 1. Audit Transactions
    transactions.forEach(tx => {
      let category = "other";
      if (tx.transactionType === "Status Changed") category = "status";
      else if (tx.transactionType === "Moved" || tx.transactionType === "Transferred") category = "movement";
      else if (["Assigned", "Received", "Returned", "Handover Confirmed", "Handover Rejected"].includes(tx.transactionType)) category = "custody";
      else if (["Sent to Maintenance", "Returned from Maintenance", "Maintenance Ticket"].includes(tx.transactionType)) category = "maint";
      else if (tx.transactionType === "Details Updated") category = "update";
      else if (tx.transactionType === "Added") category = "creation";

      activities.push({
        id: `tx-${tx.id}`,
        date: tx.transactionDate || asset.createdDate || "",
        type: tx.transactionType,
        category,
        performedBy: tx.performedBy || "System",
        notes: tx.notes || "",
        fromEmployee: empMap[tx.fromEmployeeId],
        toEmployee: empMap[tx.toEmployeeId],
        fromDepartment: deptMap[tx.fromDepartmentId],
        toDepartment: deptMap[tx.toDepartmentId],
        fromLocation: locMap[tx.fromLocationId],
        toLocation: locMap[tx.toLocationId],
        fromStatus: tx.fromStatus,
        toStatus: tx.toStatus,
        raw: tx
      });
    });

    // 2. Location Transfers (Reconcile any transfer not explicitly in transactions)
    const assetTransfers = transfers.filter(t => t.assetId === asset.id);
    assetTransfers.forEach(tr => {
      const alreadyLogged = activities.some(a => a.date && tr.transferDate && a.date.startsWith(tr.transferDate) && a.category === "movement");
      if (!alreadyLogged) {
        const respEmp = empMap[tr.responsibleEmployeeId];
        activities.push({
          id: `trf-${tr.id}`,
          date: tr.transferDate ? `${tr.transferDate} 10:00:00` : (tr.createdAt || asset.createdDate || ""),
          type: "Transferred",
          category: "movement",
          performedBy: respEmp ? (AppState.lang === "ar" ? (respEmp.nameAr || respEmp.name) : (respEmp.nameEn || respEmp.nameAr || respEmp.name)) : "System",
          notes: (AppState.lang === "ar" ? `تحويل موقع برقم [${tr.transferNo || tr.id}]` : `Location Transfer [${tr.transferNo || tr.id}]`) + (tr.notes ? ` - ${tr.notes}` : ""),
          fromLocation: locMap[tr.fromLocationId],
          toLocation: locMap[tr.toLocationId],
          raw: tr
        });
      }
    });

    // 3. Maintenance Records (Reconcile tickets)
    const assetMaint = maintenance.filter(m => m.assetId === asset.id);
    assetMaint.forEach(m => {
      const alreadyLogged = activities.some(a => a.raw && (a.raw.maintenanceId === m.id || (a.notes && a.notes.includes(m.id))));
      if (!alreadyLogged) {
        activities.push({
          id: `maint-${m.id}`,
          date: m.maintenanceDate ? `${m.maintenanceDate} 09:00:00` : (m.createdAt || asset.createdDate || ""),
          type: m.status === "Completed" ? "Returned from Maintenance" : "Sent to Maintenance",
          category: "maint",
          performedBy: m.technician || "Maintenance Team",
          notes: (AppState.lang === "ar" ? `تذكرة صيانة [${m.id}]: ${m.problem || '-'}` : `Maintenance Ticket [${m.id}]: ${m.problem || '-'}`) + (m.actionTaken ? ` | ${m.actionTaken}` : ""),
          cost: m.cost,
          raw: m
        });
      }
    });

    // 4. Initial Creation Fallback
    const hasCreation = activities.some(a => a.type === "Added" || a.category === "creation");
    if (!hasCreation && asset.createdDate) {
      activities.push({
        id: `init-${asset.id}`,
        date: asset.createdDate,
        type: "Added",
        category: "creation",
        performedBy: asset.createdBy || "System",
        notes: AppState.lang === "ar" 
          ? `تسجيل وإدخال الأصل بالنظام لأول مرة برقم [${asset.assetId}]`
          : `Initial asset registration in system as [${asset.assetId}]`,
        toLocation: locMap[asset.locationId],
        toDepartment: deptMap[asset.departmentId],
        toEmployee: empMap[asset.currentEmployeeId],
        raw: null
      });
    }

    return {
      asset,
      activities,
      empMap,
      deptMap,
      locMap,
      typeObj
    };
  }

  renderTimelineSummaryBar() {
    const data = this.currentTimelineData;
    if (!data) return;

    const activities = this.allTimelineActivities;
    const counts = {
      all: activities.length,
      status: activities.filter(a => a.category === "status").length,
      movement: activities.filter(a => a.category === "movement").length,
      custody: activities.filter(a => a.category === "custody").length,
      update: activities.filter(a => a.category === "update").length,
      maint: activities.filter(a => a.category === "maint").length
    };

    // Update buttons count badges
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt("timelineCountAll", counts.all);
    setTxt("timelineCountStatus", counts.status);
    setTxt("timelineCountMove", counts.movement);
    setTxt("timelineCountCustody", counts.custody);
    setTxt("timelineCountUpdate", counts.update);
    setTxt("timelineCountMaint", counts.maint);

    // Summary Bar Metrics
    const bar = document.getElementById("timelineSummaryBar");
    if (!bar) return;

    const lang = AppState.lang;
    const isAr = lang === "ar";
    const asset = data.asset;
    const currentCust = data.empMap[asset.currentEmployeeId];
    const currentLoc = data.locMap[asset.locationId];

    bar.innerHTML = `
      <div class="timeline-stat-chip">
        <i class="fas fa-list-ol text-primary"></i>
        <span>${(I18N[lang] && I18N[lang].totalActivities) || (isAr ? "إجمالي الأنشطة:" : "Total Activities:")}</span>
        <span class="stat-value text-primary">${counts.all}</span>
      </div>
      <div class="timeline-stat-chip">
        <i class="fas fa-tag text-warning"></i>
        <span>${(I18N[lang] && I18N[lang].statusChangesCount) || (isAr ? "تغييرات الحالة:" : "Status Changes:")}</span>
        <span class="stat-value text-warning">${counts.status}</span>
      </div>
      <div class="timeline-stat-chip">
        <i class="fas fa-truck text-purple"></i>
        <span>${(I18N[lang] && I18N[lang].movesCount) || (isAr ? "عمليات النقل:" : "Movements:")}</span>
        <span class="stat-value text-purple">${counts.movement}</span>
      </div>
      <div class="timeline-stat-chip">
        <i class="fas fa-edit text-info"></i>
        <span>${(I18N[lang] && I18N[lang].updatesCount) || (isAr ? "تحديثات البيانات:" : "Details Updates:")}</span>
        <span class="stat-value text-info">${counts.update}</span>
      </div>
      <div class="timeline-stat-chip" style="margin-right: auto; margin-left: 0;">
        <i class="fas fa-map-marker-alt text-danger"></i>
        <span>${isAr ? "الموقع الحالي:" : "Current Location:"}</span>
        <strong>${currentLoc ? (isAr ? currentLoc.nameAr : (currentLoc.nameEn || currentLoc.nameAr)) : "-"}</strong>
      </div>
      <div class="timeline-stat-chip">
        <i class="fas fa-user-check text-success"></i>
        <span>${isAr ? "العهدة الحالية:" : "Current Custodian:"}</span>
        <strong>${currentCust ? (isAr ? (currentCust.nameAr || currentCust.name) : (currentCust.nameEn || currentCust.nameAr || currentCust.name)) : (isAr ? "غير مسند" : "Unassigned")}</strong>
      </div>
    `;
  }

  renderTimelineList() {
    const body = document.getElementById("assetTimelineBody");
    if (!body) return;

    const lang = AppState.lang;
    const isAr = lang === "ar";
    let list = [...this.allTimelineActivities];

    // Filter by Category
    if (this.timelineFilterType && this.timelineFilterType !== "all") {
      list = list.filter(a => a.category === this.timelineFilterType);
    }

    // Filter by Search Query
    if (this.timelineSearchQuery) {
      const q = this.timelineSearchQuery;
      list = list.filter(a => {
        const text = [
          a.type,
          a.notes,
          a.performedBy,
          a.date,
          a.fromStatus,
          a.toStatus,
          a.fromLocation ? (isAr ? a.fromLocation.nameAr : a.fromLocation.nameEn) : "",
          a.toLocation ? (isAr ? a.toLocation.nameAr : a.toLocation.nameEn) : "",
          a.fromEmployee ? (isAr ? a.fromEmployee.nameAr : a.fromEmployee.nameEn) : "",
          a.toEmployee ? (isAr ? a.toEmployee.nameAr : a.toEmployee.nameEn) : ""
        ].join(" ").toLowerCase();
        return text.includes(q);
      });
    }

    // Sort Order
    list.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return this.timelineSortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    if (list.length === 0) {
      body.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="fas fa-stream fa-3x mb-3 text-muted" style="opacity: 0.4;"></i>
          <h4 class="font-bold mb-1">${(I18N[lang] && I18N[lang].noActivitiesFound) || (isAr ? "لا توجد أنشطة مسجلة" : "No activities found")}</h4>
          <p class="text-xs text-muted">${isAr ? "لم يتم العثور على أي أحداث تطابق الفلتر أو كلمة البحث المحددة" : "No activity events match your current filter or search criteria"}</p>
        </div>
      `;
      return;
    }

    // Group activities by date (YYYY-MM-DD)
    const groups = {};
    list.forEach(item => {
      const dateKey = (item.date || "Unknown").substring(0, 10);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });

    let html = "";
    Object.keys(groups).forEach(dateKey => {
      let displayDate = dateKey;
      try {
        const d = new Date(dateKey);
        if (!isNaN(d.getTime())) {
          displayDate = d.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        }
      } catch (e) {}

      html += `
        <div class="activity-date-group">
          <span class="activity-date-badge">
            <i class="far fa-calendar-alt text-primary"></i> ${displayDate}
          </span>
        </div>
        <div class="activity-timeline-rail">
      `;

      groups[dateKey].forEach(act => {
        let icon = "fa-circle";
        let nodeColor = "var(--accent-cyan)";
        let borderColor = "rgba(59, 130, 246, 0.4)";

        if (act.category === "status") {
          icon = "fa-tag";
          nodeColor = "var(--accent-amber)";
          borderColor = "rgba(245, 158, 11, 0.4)";
        } else if (act.category === "movement") {
          icon = "fa-truck";
          nodeColor = "var(--accent-indigo)";
          borderColor = "rgba(99, 102, 241, 0.4)";
        } else if (act.category === "custody") {
          icon = act.type === "Returned" ? "fa-undo" : "fa-user-check";
          nodeColor = act.type === "Returned" ? "var(--accent-amber)" : "var(--accent-emerald)";
          borderColor = act.type === "Returned" ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)";
        } else if (act.category === "update") {
          icon = "fa-edit";
          nodeColor = "var(--accent-cyan)";
          borderColor = "rgba(6, 182, 212, 0.4)";
        } else if (act.category === "maint") {
          icon = "fa-tools";
          nodeColor = "var(--accent-rose)";
          borderColor = "rgba(239, 68, 68, 0.4)";
        } else if (act.category === "creation") {
          icon = "fa-plus-circle";
          nodeColor = "var(--accent-cyan)";
          borderColor = "rgba(59, 130, 246, 0.4)";
        }

        const formattedTitle = this.formatTxType(act.type);

        // Build Diff / Changes Grid if present
        let diffItemsHtml = "";

        if (act.fromStatus || act.toStatus) {
          diffItemsHtml += `
            <div class="diff-item">
              <div class="diff-label">${isAr ? "الحالة" : "Status"}</div>
              <div class="diff-values">
                ${act.fromStatus ? `<span class="diff-val-prev">${this.formatStatus(act.fromStatus)}</span> <span class="diff-val-arrow">➔</span>` : ""}
                <span class="diff-val-next">${this.formatStatus(act.toStatus || act.fromStatus)}</span>
              </div>
            </div>
          `;
        }

        if (act.fromLocation || act.toLocation) {
          const fromLocTxt = act.fromLocation ? (isAr ? act.fromLocation.nameAr : (act.fromLocation.nameEn || act.fromLocation.nameAr)) : (isAr ? "غير محدد" : "Unspecified");
          const toLocTxt = act.toLocation ? (isAr ? act.toLocation.nameAr : (act.toLocation.nameEn || act.toLocation.nameAr)) : "-";
          diffItemsHtml += `
            <div class="diff-item">
              <div class="diff-label">${isAr ? "الموقع" : "Location"}</div>
              <div class="diff-values">
                <span class="diff-val-prev">${fromLocTxt}</span>
                <span class="diff-val-arrow">➔</span>
                <span class="diff-val-next">${toLocTxt}</span>
              </div>
            </div>
          `;
        }

        if (act.fromEmployee || act.toEmployee) {
          const fromEmpTxt = act.fromEmployee ? (isAr ? (act.fromEmployee.nameAr || act.fromEmployee.name) : (act.fromEmployee.nameEn || act.fromEmployee.nameAr || act.fromEmployee.name)) : (isAr ? "لا يوجد موظف سابق" : "None");
          const toEmpTxt = act.toEmployee ? (isAr ? (act.toEmployee.nameAr || act.toEmployee.name) : (act.toEmployee.nameEn || act.toEmployee.nameAr || act.toEmployee.name)) : (isAr ? "تم إرجاع العهدة للمستودع" : "Returned to Store");
          diffItemsHtml += `
            <div class="diff-item">
              <div class="diff-label">${isAr ? "العهدة والموظف" : "Custodian"}</div>
              <div class="diff-values">
                <span class="diff-val-prev">${fromEmpTxt}</span>
                <span class="diff-val-arrow">➔</span>
                <span class="diff-val-next">${toEmpTxt}</span>
              </div>
            </div>
          `;
        }

        if (act.fromDepartment || act.toDepartment) {
          const fromDeptTxt = act.fromDepartment ? (isAr ? act.fromDepartment.nameAr : (act.fromDepartment.nameEn || act.fromDepartment.nameAr)) : "-";
          const toDeptTxt = act.toDepartment ? (isAr ? act.toDepartment.nameAr : (act.toDepartment.nameEn || act.toDepartment.nameAr)) : "-";
          diffItemsHtml += `
            <div class="diff-item">
              <div class="diff-label">${isAr ? "القسم" : "Department"}</div>
              <div class="diff-values">
                <span class="diff-val-prev">${fromDeptTxt}</span>
                <span class="diff-val-arrow">➔</span>
                <span class="diff-val-next">${toDeptTxt}</span>
              </div>
            </div>
          `;
        }

        html += `
          <div class="activity-entry">
            <div class="activity-node-icon" style="color: ${nodeColor}; border-color: ${borderColor};">
              <i class="fas ${icon}"></i>
            </div>
            <div class="activity-card" style="border-left: 3px solid ${nodeColor};">
              <div class="activity-card-header">
                <div class="activity-title">
                  <span>${formattedTitle}</span>
                </div>
                <div class="activity-meta">
                  <span class="activity-actor-badge">
                    <i class="fas fa-user-shield text-primary"></i> ${act.performedBy || "System"}
                  </span>
                  <span>
                    <i class="far fa-clock"></i> ${act.date || ""}
                  </span>
                </div>
              </div>

              ${diffItemsHtml ? `<div class="activity-diff-grid">${diffItemsHtml}</div>` : ""}

              ${act.notes ? `
                <div class="activity-notes-box">
                  <i class="fas fa-quote-left text-muted mr-1"></i> ${act.notes}
                </div>
              ` : ""}
            </div>
          </div>
        `;
      });

      html += `</div>`; // end rail
    });

    body.innerHTML = html;
  }

  filterTimelineByType(type) {
    this.timelineFilterType = type;
    const buttons = document.querySelectorAll("#timelineTypeFilterGroup .timeline-filter-btn");
    buttons.forEach(btn => {
      const match = btn.getAttribute("data-filter") === type;
      btn.classList.toggle("active", match);
      btn.classList.toggle("btn-primary", match);
      btn.classList.toggle("btn-secondary", !match);
    });
    this.renderTimelineList();
  }

  handleTimelineSearch(query) {
    this.timelineSearchQuery = (query || "").trim().toLowerCase();
    this.renderTimelineList();
  }

  toggleTimelineSortOrder() {
    this.timelineSortOrder = this.timelineSortOrder === "desc" ? "asc" : "desc";
    const lang = AppState.lang;
    const isAr = lang === "ar";
    const label = document.getElementById("timelineSortLabel");
    const icon = document.getElementById("timelineSortIcon");

    if (this.timelineSortOrder === "desc") {
      if (label) label.textContent = (I18N[lang] && I18N[lang].newestFirst) || (isAr ? "الأحدث أولاً" : "Newest First");
      if (icon) icon.className = "fas fa-sort-amount-down";
    } else {
      if (label) label.textContent = (I18N[lang] && I18N[lang].oldestFirst) || (isAr ? "الأقدم أولاً" : "Oldest First");
      if (icon) icon.className = "fas fa-sort-amount-up";
    }
    this.renderTimelineList();
  }

  returnToDetailsModal() {
    App.closeModal("assetTimelineModal");
    if (this.timelineAssetId) {
      this.openDetailsModal(this.timelineAssetId);
    }
  }

  printAssetTimeline() {
    const data = this.currentTimelineData;
    if (!data || !data.asset) return;

    const asset = data.asset;
    const lang = AppState.lang;
    const isAr = lang === "ar";
    const activities = [...this.allTimelineActivities].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const printWin = window.open("", "_blank");
    if (!printWin) {
      App.showToast(isAr ? "يرجى السماح بالنوافذ المنبثقة للطباعة" : "Please allow popups to print report", "warning");
      return;
    }

    const typeName = data.typeObj ? (isAr ? data.typeObj.nameAr : (data.typeObj.nameEn || data.typeObj.nameAr)) : "-";
    const locName = data.locMap[asset.locationId] ? (isAr ? data.locMap[asset.locationId].nameAr : (data.locMap[asset.locationId].nameEn || data.locMap[asset.locationId].nameAr)) : "-";
    const empName = data.empMap[asset.currentEmployeeId] ? (isAr ? (data.empMap[asset.currentEmployeeId].nameAr || data.empMap[asset.currentEmployeeId].name) : (data.empMap[asset.currentEmployeeId].nameEn || data.empMap[asset.currentEmployeeId].nameAr || data.empMap[asset.currentEmployeeId].name)) : "-";

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
      <head>
        <meta charset="utf-8">
        <title>${isAr ? 'تقرير سجل الأنشطة الزمني' : 'Asset Activity Timeline'} - ${asset.assetId}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 25px; color: #1e293b; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #0284c7; }
          .asset-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13px; }
          .timeline-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          .timeline-table th, .timeline-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: ${isAr ? 'right' : 'left'}; }
          .timeline-table th { background: #f1f5f9; font-weight: bold; }
          .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .tag-status { background: #fef3c7; color: #92400e; }
          .tag-movement { background: #e0e7ff; color: #3730a3; }
          .tag-custody { background: #d1fae5; color: #065f46; }
          .tag-update { background: #e0f2fe; color: #0369a1; }
          .tag-maint { background: #fee2e2; color: #991b1b; }
          .tag-creation { background: #e0f2fe; color: #0369a1; }
          .tag-other { background: #f1f5f9; color: #475569; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${isAr ? 'سجل الأنشطة والعمليات الزمني للأصل' : 'Asset Chronological Activity Audit Trail'}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${asset.assetId} - ${asset.brand || ''} ${asset.model || ''}</div>
          </div>
          <div style="text-align: ${isAr ? 'left' : 'right'}; font-size: 12px; color: #64748b;">
            <div>${isAr ? 'تاريخ الطباعة:' : 'Printed on:'} ${new Date().toLocaleString(isAr ? 'ar-EG' : 'en-US')}</div>
            <div>${isAr ? 'الحالة الحالية:' : 'Current Status:'} <strong>${this.formatStatus(asset.status)}</strong></div>
          </div>
        </div>

        <div class="asset-info">
          <div><strong>${isAr ? 'الماركة والموديل:' : 'Brand & Model:'}</strong> ${asset.brand || '-'} ${asset.model || '-'}</div>
          <div><strong>${isAr ? 'الرقم التسلسلي:' : 'Serial Number:'}</strong> ${asset.serial || '-'}</div>
          <div><strong>${isAr ? 'نوع الأصل:' : 'Asset Type:'}</strong> ${typeName}</div>
          <div><strong>${isAr ? 'الموقع الحالي:' : 'Current Location:'}</strong> ${locName}</div>
          <div><strong>${isAr ? 'العهدة الحالية:' : 'Current Custodian:'}</strong> ${empName}</div>
          <div><strong>${isAr ? 'إجمالي الأنشطة:' : 'Total Activities:'}</strong> ${activities.length}</div>
        </div>

        <table class="timeline-table">
          <thead>
            <tr>
              <th style="width: 130px;">${isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
              <th style="width: 140px;">${isAr ? 'نوع النشاط' : 'Activity'}</th>
              <th style="width: 120px;">${isAr ? 'المنفذ' : 'Performed By'}</th>
              <th>${isAr ? 'تفاصيل العملية والتغييرات والملاحظات' : 'Details, Changes & Notes'}</th>
            </tr>
          </thead>
          <tbody>
            ${activities.map(a => `
              <tr>
                <td>${a.date || '-'}</td>
                <td><span class="tag tag-${a.category}">${this.formatTxType(a.type)}</span></td>
                <td><strong>${a.performedBy || 'System'}</strong></td>
                <td>
                  ${a.fromStatus || a.toStatus ? `<div><strong>${isAr ? 'الحالة:' : 'Status:'}</strong> ${a.fromStatus ? this.formatStatus(a.fromStatus) + ' ➔ ' : ''}${this.formatStatus(a.toStatus || a.fromStatus)}</div>` : ''}
                  ${a.fromLocation || a.toLocation ? `<div><strong>${isAr ? 'الموقع:' : 'Location:'}</strong> ${(a.fromLocation ? (isAr ? a.fromLocation.nameAr : a.fromLocation.nameEn) : '-') + ' ➔ ' + (a.toLocation ? (isAr ? a.toLocation.nameAr : a.toLocation.nameEn) : '-')}</div>` : ''}
                  ${a.fromEmployee || a.toEmployee ? `<div><strong>${isAr ? 'العهدة:' : 'Custodian:'}</strong> ${(a.fromEmployee ? (isAr ? a.fromEmployee.nameAr : a.fromEmployee.nameEn) : '-') + ' ➔ ' + (a.toEmployee ? (isAr ? a.toEmployee.nameAr : a.toEmployee.nameEn) : '-')}</div>` : ''}
                  ${a.notes ? `<div style="color: #475569; margin-top: 2px;">${a.notes}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
}

// Global Singleton
const AssetManager = new AssetInventoryManager();
AssetManager.renderAssetList = function() { return this.render(); };
AssetManager.applyFilters = function() { return this.handleFilterChange(); };
AssetManager.openTimelineModal = function(assetId) { return this.openActivityTimeline(assetId); };
AssetManager.openInstallationModal = function(assetId) {
  if (window.OpsManager && typeof window.OpsManager.openInstallationModal === "function") {
    return window.OpsManager.openInstallationModal(assetId);
  }
};
window.AssetManager = AssetManager;
