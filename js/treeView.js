/**
 * SDI IT Asset Hub - Interactive Locations & Hierarchy Tree
 * Restored visual layout and logic from previous version, adapted to current Locations database
 */

class TreeViewManager {
  constructor() {
    this.selectedLocationId = null;
    this.collapsedNodes = new Set();
    this.currentView = "tree"; // "tree" or "table"
  }

  async render() {
    const container = document.getElementById("branchTreeContainer");
    if (!container) return;

    const locations = await db.getAll("locations");
    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const lang = AppState.lang || "ar";

    // 1. Calculate direct asset and employee counts per location
    const directAssetMap = {};
    const directEmpMap = {};

    assets.forEach(a => {
      if (a.locationId) {
        directAssetMap[a.locationId] = (directAssetMap[a.locationId] || 0) + 1;
      }
    });

    // Map employees with assigned assets at each location
    employees.forEach(e => {
      const empAssets = assets.filter(a => a.currentEmployeeId === e.id && a.locationId);
      empAssets.forEach(a => {
        directEmpMap[a.locationId] = (directEmpMap[a.locationId] || 0) + 1;
      });
    });

    // 2. Build parent -> children map
    const childrenMap = {};
    const locationById = {};
    locations.forEach(loc => {
      locationById[loc.id] = loc;
      const pid = loc.parentId || "__root__";
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(loc);
    });

    // Recursive calculation of total assets in subtree
    const getSubtreeAssetCount = (locId) => {
      let count = directAssetMap[locId] || 0;
      const children = childrenMap[locId] || [];
      children.forEach(child => {
        count += getSubtreeAssetCount(child.id);
      });
      return count;
    };

    const getSubtreeEmpCount = (locId) => {
      let count = directEmpMap[locId] || 0;
      const children = childrenMap[locId] || [];
      children.forEach(child => {
        count += getSubtreeEmpCount(child.id);
      });
      return count;
    };

    // 3. Render tree nodes recursively
    const renderNode = (node, depth = 0) => {
      const children = childrenMap[node.id] || [];
      const hasChildren = children.length > 0;
      const isCollapsed = this.collapsedNodes.has(node.id);
      const isSelected = this.selectedLocationId === node.id;

      const locName = lang === "ar" ? (node.nameAr || node.nameEn) : (node.nameEn || node.nameAr);
      const totalDevs = getSubtreeAssetCount(node.id);
      const totalStaff = getSubtreeEmpCount(node.id);

      const isRoot = depth === 0;

      let html = "";

      if (isRoot) {
        html += `
          <div class="tree-node ${isSelected ? 'selected' : ''}" data-branch-id="${node.id}">
            <div class="node-header" onclick="TreeManager.selectLocation('${node.id}')">
              ${hasChildren ? `
                <button class="tree-toggle-btn" onclick="event.stopPropagation(); TreeManager.toggleNode('${node.id}')" title="${isCollapsed ? 'توسيع' : 'طي'}">
                  <i class="fas fa-chevron-${isCollapsed ? (lang === 'ar' ? 'left' : 'right') : 'down'}"></i>
                </button>
              ` : `<span class="tree-leaf-spacer"></span>`}
              <span class="node-icon"><i class="fas fa-${node.icon || 'building'}"></i></span>
              <span class="node-title">${locName}</span>
              ${node.code ? `<span class="node-code-badge">${node.code}</span>` : ''}
              <div class="node-badges">
                <span class="badge badge-primary" title="${I18N[lang].statTotalAssetsAtLoc || 'إجمالي الأجهزة'}">
                  <i class="fas fa-laptop"></i> ${totalDevs}
                </span>
                ${totalStaff > 0 ? `
                  <span class="badge badge-secondary" title="${I18N[lang].totalStaffCount || 'الموظفون'}">
                    <i class="fas fa-user"></i> ${totalStaff}
                  </span>
                ` : ''}
              </div>
            </div>
            ${hasChildren ? `
              <div class="node-children ${isCollapsed ? 'collapsed' : ''}" id="children-${node.id}">
                ${children.map(child => renderNode(child, depth + 1)).join("")}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        // Child node (can also have nested sub-children!)
        html += `
          <div class="child-node-wrapper" style="display: flex; flex-direction: column;">
            <div class="child-node ${isSelected ? 'selected' : ''}" data-branch-id="${node.id}" onclick="TreeManager.selectLocation('${node.id}')">
              ${hasChildren ? `
                <button class="tree-toggle-btn" style="width: 18px; height: 18px; margin-inline-end: 4px;" onclick="event.stopPropagation(); TreeManager.toggleNode('${node.id}')" title="${isCollapsed ? 'توسيع' : 'طي'}">
                  <i class="fas fa-chevron-${isCollapsed ? (lang === 'ar' ? 'left' : 'right') : 'down'}" style="font-size: 10px;"></i>
                </button>
              ` : ''}
              <span class="node-icon child-icon"><i class="fas fa-${node.icon || 'door-open'}"></i></span>
              <span class="node-title">${locName}</span>
              ${node.code ? `<span class="node-code-badge child-badge">${node.code}</span>` : ''}
              <div class="node-badges">
                <span class="badge badge-primary badge-sm" title="${I18N[lang].statTotalAssetsAtLoc || 'إجمالي الأجهزة'}">
                  <i class="fas fa-laptop"></i> ${totalDevs}
                </span>
                ${totalStaff > 0 ? `
                  <span class="badge badge-secondary badge-sm" title="${I18N[lang].totalStaffCount || 'الموظفون'}">
                    <i class="fas fa-user"></i> ${totalStaff}
                  </span>
                ` : ''}
              </div>
            </div>
            ${hasChildren ? `
              <div class="node-children ${isCollapsed ? 'collapsed' : ''}" style="padding-inline-start: 24px;" id="children-${node.id}">
                ${children.map(child => renderNode(child, depth + 1)).join("")}
              </div>
            ` : ''}
          </div>
        `;
      }

      return html;
    };

    const rootNodes = childrenMap["__root__"] || [];
    let html = `<div class="tree-root">`;
    rootNodes.forEach(root => {
      html += renderNode(root, 0);
    });

    // Exception Category Nodes (Assets Needing Location, Dept, Office)
    const unassignedLocAssets = assets.filter(a => !a.locationId);
    const unassignedDeptAssets = assets.filter(a => a.locationId && !a.departmentId);
    const unassignedOfficeAssets = assets.filter(a => a.locationId && a.departmentId && !a.office && !a.officeId && a.status === 'Assigned');

    if (unassignedLocAssets.length > 0) {
      const isSelected = this.selectedLocationId === "__unassigned_loc__";
      html += `
        <div class="tree-node exception-node mt-2" data-branch-id="__unassigned_loc__">
          <div class="node-header ${isSelected ? 'selected' : ''}" onclick="TreeManager.selectLocation('__unassigned_loc__')" style="border-inline-start: 3px solid var(--accent-orange, #f59e0b);">
            <span class="tree-leaf-spacer"></span>
            <span class="node-icon text-warning"><i class="fas fa-exclamation-triangle"></i></span>
            <span class="node-title text-warning" style="font-weight: 700;">
              ${lang === 'ar' ? '⚠ أصول تتطلب تحديد الموقع (Needs Location)' : '⚠ Assets Needing Location'}
            </span>
            <div class="node-badges">
              <span class="badge badge-warning">
                <i class="fas fa-laptop"></i> ${unassignedLocAssets.length}
              </span>
            </div>
          </div>
        </div>
      `;
    }

    if (unassignedDeptAssets.length > 0) {
      const isSelected = this.selectedLocationId === "__unassigned_dept__";
      html += `
        <div class="tree-node exception-node mt-1" data-branch-id="__unassigned_dept__">
          <div class="node-header ${isSelected ? 'selected' : ''}" onclick="TreeManager.selectLocation('__unassigned_dept__')" style="border-inline-start: 3px solid var(--accent-orange, #f59e0b);">
            <span class="tree-leaf-spacer"></span>
            <span class="node-icon text-warning"><i class="fas fa-exclamation-circle"></i></span>
            <span class="node-title text-warning" style="font-weight: 700;">
              ${lang === 'ar' ? '⚠ أصول تتطلب تحديد القسم (Needs Dept)' : '⚠ Assets Needing Department'}
            </span>
            <div class="node-badges">
              <span class="badge badge-warning">
                <i class="fas fa-laptop"></i> ${unassignedDeptAssets.length}
              </span>
            </div>
          </div>
        </div>
      `;
    }

    if (unassignedOfficeAssets.length > 0) {
      const isSelected = this.selectedLocationId === "__unassigned_office__";
      html += `
        <div class="tree-node exception-node mt-1" data-branch-id="__unassigned_office__">
          <div class="node-header ${isSelected ? 'selected' : ''}" onclick="TreeManager.selectLocation('__unassigned_office__')" style="border-inline-start: 3px solid var(--accent-orange, #f59e0b);">
            <span class="tree-leaf-spacer"></span>
            <span class="node-icon text-warning"><i class="fas fa-door-closed"></i></span>
            <span class="node-title text-warning" style="font-weight: 700;">
              ${lang === 'ar' ? '⚠ أصول تتطلب تحديد المكتب (Needs Office)' : '⚠ Assets Needing Office'}
            </span>
            <div class="node-badges">
              <span class="badge badge-warning">
                <i class="fas fa-laptop"></i> ${unassignedOfficeAssets.length}
              </span>
            </div>
          </div>
        </div>
      `;
    }

    html += `</div>`;

    container.innerHTML = html;

    // Update details pane
    await this.renderLocationDetails();
  }

  toggleNode(nodeId) {
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
    } else {
      this.collapsedNodes.add(nodeId);
    }
    this.render();
  }

  expandAll() {
    this.collapsedNodes.clear();
    this.render();
  }

  async collapseAll() {
    const locations = await db.getAll("locations");
    locations.forEach(l => this.collapsedNodes.add(l.id));
    this.render();
  }

  selectBranch(branchId) {
    this.selectLocation(branchId);
  }

  async selectLocation(locId) {
    this.selectedLocationId = locId;
    this.render();
  }

  async renderLocationDetails() {
    const pane = document.getElementById("branchDetailsPane");
    if (!pane) return;

    const lang = AppState.lang || "ar";

    if (!this.selectedLocationId) {
      pane.innerHTML = `
        <div class="empty-state" style="padding: 56px 24px; text-align: center;">
          <i class="fas fa-sitemap empty-icon" style="font-size: 52px; color: var(--accent-cyan); opacity: 0.6; margin-bottom: 16px; display: block;"></i>
          <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">${I18N[lang].selectLocationToView || 'اختر موقعاً أو غرفة من الشجرة لمعاينة التفاصيل'}</h4>
          <p class="text-muted" style="max-width: 420px; margin: 0 auto; font-size: 13px;">${I18N[lang].locationHierarchySubtitle || 'انقر على أي فرع أو قسم أو غرفة لعرض الأجهزة المتواجدة بها فوراً'}</p>
        </div>
      `;
      return;
    }

    const locations = await db.getAll("locations");

    if (this.selectedLocationId === '__unassigned_loc__' || this.selectedLocationId === '__unassigned_dept__' || this.selectedLocationId === '__unassigned_office__') {
      const allAssets = await db.getAll("assets");
      const allTypes = await db.getAll("assetTypes");
      const typeMap = Object.fromEntries(allTypes.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));

      let targetAssets = [];
      let title = "";
      let subtitle = "";

      if (this.selectedLocationId === '__unassigned_loc__') {
        targetAssets = allAssets.filter(a => !a.locationId);
        title = lang === 'ar' ? '⚠ أصول تتطلب تحديد الموقع (Needs Location)' : '⚠ Assets Needing Location Assignment';
        subtitle = lang === 'ar' ? 'أجهزة مضافة بالنظام ولكن لم يتم تعيين موقعها الجغرافي بعد (مثل AST-000008). انقر على الزر لتحديد موقع الجهاز.' : 'Assets in database with missing location assignment.';
      } else if (this.selectedLocationId === '__unassigned_dept__') {
        targetAssets = allAssets.filter(a => a.locationId && !a.departmentId);
        title = lang === 'ar' ? '⚠ أصول تتطلب تحديد القسم (Needs Dept)' : '⚠ Assets Needing Department';
        subtitle = lang === 'ar' ? 'أجهزة معينة بموقع ولكن لم يتم ربطها بقسم إداري.' : 'Assets assigned to location but missing department linkage.';
      } else {
        targetAssets = allAssets.filter(a => a.locationId && a.departmentId && !a.office && !a.officeId && a.status === 'Assigned');
        title = lang === 'ar' ? '⚠ أصول تتطلب تحديد المكتب (Needs Office)' : '⚠ Assets Needing Office';
        subtitle = lang === 'ar' ? 'أجهزة مسندة لموظفين دون تحديد رقم المكتب.' : 'Assigned assets with missing office assignment.';
      }

      pane.innerHTML = `
        <div class="branch-card-header mb-3" style="border-bottom: 2px solid var(--accent-orange, #f59e0b);">
          <div class="branch-meta">
            <div class="branch-icon-large text-warning">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <h3 style="margin-bottom: 4px; font-size: 18px; color: var(--accent-orange, #f59e0b);">${title}</h3>
              <div style="font-size: 12px; color: var(--text-muted);">${subtitle}</div>
            </div>
          </div>
        </div>

        <div class="branch-subpanel p-2">
          <div class="subpanel-header mb-2">
            <h4><i class="fas fa-laptop text-warning"></i> ${lang === 'ar' ? 'قائمة الأصول المعلقة' : 'Pending Assets'} (${targetAssets.length})</h4>
          </div>
          <div class="subpanel-list">
            ${targetAssets.length === 0 ? `<p class="text-muted p-3 text-center">${lang === 'ar' ? 'لا توجد أصول في هذه الفئة' : 'No assets in this category'}</p>` :
              targetAssets.map(a => `
                <div class="mini-list-item">
                  <div class="item-avatar text-warning"><i class="fas fa-laptop"></i></div>
                  <div class="item-info">
                    <span class="item-name">${a.brand || ''} ${a.model || ''}</span>
                    <span class="item-sub"><strong>${a.assetId}</strong> &bull; ${typeMap[a.assetTypeId] || a.assetTypeId || ''} &bull; S/N: ${a.serial || '-'}</span>
                  </div>
                  <span class="badge badge-warning badge-sm">${a.status}</span>
                  <button class="btn btn-xs btn-primary" onclick="AssetManager.openEditModal('${a.id}')" title="${lang === 'ar' ? 'تعديل وتعيين الموقع' : 'Edit & Assign Location'}">
                    <i class="fas fa-edit"></i> ${lang === 'ar' ? 'معالجة' : 'Assign'}
                  </button>
                </div>
              `).join("")
            }
          </div>
        </div>
      `;
      return;
    }

    const loc = locations.find(l => l.id === this.selectedLocationId);
    if (!loc) return;

    // Collect all descendant IDs of this location
    const childrenMap = {};
    locations.forEach(l => {
      const pid = l.parentId || "__root__";
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(l);
    });

    const getDescendantIds = (parentId) => {
      let ids = [parentId];
      const children = childrenMap[parentId] || [];
      children.forEach(c => {
        ids = ids.concat(getDescendantIds(c.id));
      });
      return ids;
    };

    const targetLocationIds = getDescendantIds(loc.id);

    const allAssets = await db.getAll("assets");
    const allEmployees = await db.getAll("employees");
    const allTypes = await db.getAll("assetTypes");
    const typeMap = Object.fromEntries(allTypes.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));

    const locAssets = allAssets.filter(a => targetLocationIds.includes(a.locationId));

    // Employees who hold assets at this location
    const empIdsWithAssets = [...new Set(locAssets.map(a => a.currentEmployeeId).filter(Boolean))];
    const locEmployees = allEmployees.filter(e => empIdsWithAssets.includes(e.id));

    const locName = lang === "ar" ? (loc.nameAr || loc.nameEn) : (loc.nameEn || loc.nameAr);

    // Build breadcrumb
    let path = [];
    let curr = loc;
    while (curr) {
      path.unshift(lang === "ar" ? (curr.nameAr || curr.nameEn) : (curr.nameEn || curr.nameAr));
      curr = curr.parentId ? locations.find(l => l.id === curr.parentId) : null;
    }
    const breadcrumbStr = path.join(" &bull; ");

    pane.innerHTML = `
      <div class="branch-card-header">
        <div class="branch-meta">
          <div class="branch-icon-large">
            <i class="fas fa-${loc.icon || 'map-marker-alt'}"></i>
          </div>
          <div>
            <h3 style="margin-bottom: 4px; font-size: 18px;">${locName}</h3>
            <div style="display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--text-muted);">
              ${loc.code ? `<span class="branch-code-tag">${loc.code}</span>` : ''}
              <span>${breadcrumbStr}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm" onclick="TreeManager.filterAssetsByLocation('${loc.id}')">
            <i class="fas fa-filter"></i> ${I18N[lang].filterBySelectedLocation || 'تصفية الأجهزة بهذا الموقع'}
          </button>
          <button class="btn btn-secondary btn-sm user-write-action" onclick="UserManager.openLocationModal('${loc.id}')" title="تعديل الموقع">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </div>

      <div class="stats-mini-grid">
        <div class="mini-stat-box" style="cursor: pointer;" onclick="TreeManager.filterAssetsByLocation('${loc.id}')" title="${I18N[lang].statTotalAssets || 'إجمالي الأجهزة'}">
          <span class="mini-stat-label">${I18N[lang].statTotalAssets || 'إجمالي الأجهزة'}</span>
          <span class="mini-stat-val text-primary">${locAssets.length}</span>
        </div>
        <div class="mini-stat-box" style="cursor: pointer;" onclick="TreeManager.filterAssetsByLocation('${loc.id}', 'Assigned')" title="${I18N[lang].statusActive || 'نشط / مسند'}">
          <span class="mini-stat-label">${I18N[lang].statusActive || 'نشط / مسند'}</span>
          <span class="mini-stat-val text-success">${locAssets.filter(a => a.status === 'Assigned' || a.status === 'Available').length}</span>
        </div>
        <div class="mini-stat-box" style="cursor: pointer;" onclick="TreeManager.filterAssetsByLocation('${loc.id}', 'Under Maintenance')" title="${I18N[lang].statusUnderMaintenance || 'قيد الصيانة'}">
          <span class="mini-stat-label">${I18N[lang].statusUnderMaintenance || 'قيد الصيانة'}</span>
          <span class="mini-stat-val text-danger">${locAssets.filter(a => a.status === 'Under Maintenance').length}</span>
        </div>
        <div class="mini-stat-box" style="cursor: pointer;" onclick="TreeManager.filterAssetsByLocation('${loc.id}', 'In Store')" title="${I18N[lang].statusInStore || 'بالمستودع / احتياطي'}">
          <span class="mini-stat-label">${I18N[lang].statusInStore || 'بالمستودع / احتياطي'}</span>
          <span class="mini-stat-val text-info">${locAssets.filter(a => a.status === 'In Store').length}</span>
        </div>
      </div>

      <div class="branch-split-view">
        <!-- Assets at this location -->
        <div class="branch-subpanel">
          <div class="subpanel-header">
            <h4><i class="fas fa-laptop text-primary"></i> ${I18N[lang].navAssets} (${locAssets.length})</h4>
          </div>
          <div class="subpanel-list">
            ${locAssets.length === 0 ? `<p class="text-muted p-3 text-center" style="font-size: 13px;">${I18N[lang].noResultsFound || 'لا توجد أجهزة متواجدة بهذا الموقع حالياً'}</p>` :
              locAssets.map(a => {
                const typeName = typeMap[a.assetTypeId] || a.assetTypeId || "";
                let statusBadge = "badge-success";
                if (a.status === "Under Maintenance") statusBadge = "badge-danger";
                else if (a.status === "In Store") statusBadge = "badge-info";
                else if (a.status === "Damaged" || a.status === "Lost") statusBadge = "badge-warning";
                else if (a.status === "Retired" || a.status === "Disposed") statusBadge = "badge-secondary";

                const icon = a.assetTypeId === "type-laptop" ? "laptop" :
                             (a.assetTypeId === "type-camera" ? "video" :
                             (a.assetTypeId === "type-printer" ? "print" :
                             (a.assetTypeId === "type-server" ? "server" : "desktop")));

                return `
                  <div class="mini-list-item">
                    <div class="item-avatar"><i class="fas fa-${icon}"></i></div>
                    <div class="item-info">
                      <span class="item-name">${a.brand || ''} ${a.model || ''}</span>
                      <span class="item-sub">${a.assetId} &bull; ${typeName} &bull; S/N: ${a.serial || '-'}</span>
                    </div>
                    <span class="badge ${statusBadge} badge-sm">${a.status}</span>
                    <button class="btn btn-xs btn-outline-secondary" onclick="AssetManager.openDetailsModal('${a.id}')" title="معاينة تفاصيل الأصل">
                      <i class="fas fa-eye"></i>
                    </button>
                  </div>
                `;
              }).join("")
            }
          </div>
        </div>

        <!-- Sub-locations & Staff Panel -->
        <div class="branch-subpanel">
          <div class="subpanel-header">
            <h4><i class="fas fa-sitemap text-info"></i> ${I18N[lang].subLocationsTitle || 'المواقع والغرف التابعة'}</h4>
          </div>
          <div class="subpanel-list">
            <!-- Direct Sub-locations -->
            ${(childrenMap[loc.id] || []).length > 0 ? `
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 4px 8px; text-transform: uppercase;">
                ${I18N[lang].subLocationsTitle || 'المواقع والغرف التابعة'}:
              </div>
              ${(childrenMap[loc.id] || []).map(child => {
                const childName = lang === "ar" ? (child.nameAr || child.nameEn) : (child.nameEn || child.nameAr);
                const childAssetCount = allAssets.filter(a => a.locationId === child.id).length;
                return `
                  <div class="mini-list-item" style="cursor: pointer;" onclick="TreeManager.selectLocation('${child.id}')">
                    <div class="item-avatar" style="color: var(--accent-cyan);"><i class="fas fa-${child.icon || 'door-open'}"></i></div>
                    <div class="item-info">
                      <span class="item-name">${childName}</span>
                      <span class="item-sub">${child.code || ''} ${child.description ? '&bull; ' + child.description : ''}</span>
                    </div>
                    <span class="badge badge-primary badge-sm"><i class="fas fa-laptop"></i> ${childAssetCount}</span>
                  </div>
                `;
              }).join("")}
            ` : ''}

            <!-- Associated Employees -->
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 4px 8px; margin-top: 6px; text-transform: uppercase;">
              ${I18N[lang].colAssignedUser || 'الموظفون المسؤولون عن أجهزة بالموقع'} (${locEmployees.length}):
            </div>
            ${locEmployees.length === 0 ? `<p class="text-muted p-2" style="font-size: 12px;">${I18N[lang].noResultsFound || 'لا يوجد موظفون'}</p>` :
              locEmployees.map(e => {
                const eName = lang === "ar" ? (e.nameAr || e.nameEn) : (e.nameEn || e.nameAr);
                return `
                  <div class="mini-list-item">
                    <div class="item-avatar"><i class="fas fa-user-circle"></i></div>
                    <div class="item-info">
                      <span class="item-name">${eName}</span>
                      <span class="item-sub">${e.employeeNumber} &bull; ${e.phone || '-'}</span>
                    </div>
                  </div>
                `;
              }).join("")
            }
          </div>
        </div>
      </div>
    `;
  }

  async filterAssetsByLocation(locId, status = '') {
    if (window.AssetManager && AssetManager.filterByLocAndSwitch) {
      await AssetManager.filterByLocAndSwitch(locId);
      if (status) {
        const statusSelect = document.getElementById('assetFilterStatus');
        if (statusSelect) {
          statusSelect.value = status;
          AssetManager.applyFilters();
        }
      }
    } else {
      App.switchTab('assets');
      const select = document.getElementById('assetFilterLoc') || document.getElementById('assetFilterLocation');
      if (select) {
        select.value = locId;
        if (status) {
          const statusSelect = document.getElementById('assetFilterStatus');
          if (statusSelect) statusSelect.value = status;
        }
        AssetManager.applyFilters();
      }
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    const treeView = document.getElementById("locationsTreeViewContainer");
    const tableView = document.getElementById("locationsTableViewContainer");
    const btnTree = document.getElementById("btnViewLocTree");
    const btnTable = document.getElementById("btnViewLocTable");

    if (viewName === "tree") {
      if (treeView) treeView.style.display = "block";
      if (tableView) tableView.style.display = "none";
      if (btnTree) { btnTree.classList.remove("btn-secondary"); btnTree.classList.add("btn-primary"); }
      if (btnTable) { btnTable.classList.remove("btn-primary"); btnTable.classList.add("btn-secondary"); }
      this.render();
    } else {
      if (treeView) treeView.style.display = "none";
      if (tableView) tableView.style.display = "block";
      if (btnTree) { btnTree.classList.remove("btn-primary"); btnTree.classList.add("btn-secondary"); }
      if (btnTable) { btnTable.classList.remove("btn-secondary"); btnTable.classList.add("btn-primary"); }
      UserManager.renderLocations();
    }
  }
}

const TreeManager = new TreeViewManager();
window.TreeManager = TreeManager;
