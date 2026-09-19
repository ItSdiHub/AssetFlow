/**
 * SDI IT Asset Hub - Helpdesk & Employee Portal Controller
 * Manages Support Tickets, In-Request Conversations, IT Responses,
 * Direct Maintenance Bridging, and Employee Device Handover Acknowledgement.
 */

class HelpdeskManager {
  constructor() {
    this.filterStatus = "";
    this.filterSearch = "";
    this.activePortalSubTab = "devices"; // devices, requests, notifications, profile
    this.currentRequestId = null;
    this.pendingAttachment = null;
  }

  // =========================================================================
  // 1. MAIN RENDER DISPATCHER
  // =========================================================================
  async render() {
    const user = AppState.currentUser;
    if (!user) return;

    if (user.role === "Employee") {
      await this.renderEmployeePortal();
    } else {
      await this.renderITHelpdesk();
    }
  }

  // =========================================================================
  // 2. IT HELPDESK DASHBOARD & TICKETS LIST
  // =========================================================================
  async renderITHelpdesk() {
    const pane = document.getElementById("tab-helpdesk");
    if (!pane) return;

    const requests = await db.getAll("helpdeskRequests");
    const employees = await db.getAll("employees");
    const assets = await db.getAll("assets");
    const departments = await db.getAll("departments");
    const lang = AppState.lang;

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const empObjMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, typeof getEntityName === "function" ? getEntityName(d, lang) : (lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr))]));

    // 1. KPI Counters
    const countNew = requests.filter(r => r.status === "New").length;
    const countInProgress = requests.filter(r => r.status === "In Progress").length;
    const countWaiting = requests.filter(r => r.status === "Waiting for Employee").length;
    const countCompleted = requests.filter(r => r.status === "Completed").length;

    const elNew = document.getElementById("hdCountNew");
    const elInProg = document.getElementById("hdCountInProgress");
    const elWait = document.getElementById("hdCountWaiting");
    const elComp = document.getElementById("hdCountCompleted");

    if (elNew) elNew.textContent = countNew;
    if (elInProg) elInProg.textContent = countInProgress;
    if (elWait) elWait.textContent = countWaiting;
    if (elComp) elComp.textContent = countCompleted;

    // 2. Filter logic
    const statusSelect = document.getElementById("hdFilterStatus");
    const currentFilterStatus = statusSelect ? statusSelect.value : this.filterStatus;
    const searchInput = document.getElementById("hdSearchInput");
    const currentSearch = searchInput ? searchInput.value.trim().toLowerCase() : this.filterSearch;

    const filtered = requests.filter(r => {
      if (currentFilterStatus && r.status !== currentFilterStatus) return false;
      if (currentSearch) {
        const empName = (empMap[r.employeeId] || "").toLowerCase();
        const asset = assetMap[r.assetId];
        const assetTag = asset ? (asset.assetId + " " + asset.brand + " " + asset.model).toLowerCase() : "";
        const match = (
          (r.requestId && r.requestId.toLowerCase().includes(currentSearch)) ||
          (r.subject && r.subject.toLowerCase().includes(currentSearch)) ||
          (r.description && r.description.toLowerCase().includes(currentSearch)) ||
          empName.includes(currentSearch) ||
          assetTag.includes(currentSearch)
        );
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));

    // 3. Render Table
    const tbody = document.getElementById("helpdeskTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5">
            <div class="empty-state">
              <i class="fas fa-headset empty-icon"></i>
              <h4>${lang === "ar" ? "لا توجد طلبات دعم فني مطابقة" : "No matching support requests"}</h4>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    filtered.forEach(req => {
      const empName = req.employeeId ? (empMap[req.employeeId] || (lang === "ar" ? "موظف غير معروف" : "Unknown Employee")) : (lang === "ar" ? "طلب عام / بدون موظف" : "General / No Employee");
      const asset = assetMap[req.assetId];
      const assetDisplay = asset ? `${asset.assetId} - ${asset.brand} ${asset.model}` : (lang === "ar" ? "طلب عام / بدون جهاز" : "General / No device");

      // Resolve Department using existing relationships
      let deptName = "-";
      if (req.departmentId) {
        deptName = deptMap[req.departmentId] || req.departmentId;
      } else if (req.employeeId && empObjMap[req.employeeId] && empObjMap[req.employeeId].departmentId) {
        const dId = empObjMap[req.employeeId].departmentId;
        deptName = deptMap[dId] || dId;
      } else if (req.assetId && asset && asset.departmentId) {
        const dId = asset.departmentId;
        deptName = deptMap[dId] || dId;
      } else if (req.department) {
        deptName = typeof req.department === "object" ? (typeof getEntityName === "function" ? getEntityName(req.department, lang) : (req.department.nameAr || req.department.nameEn || "-")) : req.department;
      }

      const q = this.filterSearch || "";
      const reqIdHtml = highlightText(req.requestId || req.id, q);
      const empNameHtml = highlightText(empName, q);
      const assetDisplayHtml = highlightText(assetDisplay, q);
      const deptNameHtml = highlightText(deptName, q);
      const rawSubject = (lang === "en" && req.subjectEn) ? req.subjectEn : req.subject;
      const rawDesc = (lang === "en" && req.descriptionEn) ? req.descriptionEn : (req.description || "");
      const subjectHtml = highlightText(rawSubject, q);
      const descHtml = rawDesc ? highlightText(rawDesc, q) : "";

      const statusBadge = this.getStatusBadge(req.status);
      const msgCount = (req.messages || []).length;
      const hasMaint = !!req.maintenanceId;

      html += `
        <tr>
          <td>
            <a href="javascript:void(0)" onclick="Helpdesk.openRequestDetails('${req.id}')" class="font-bold text-primary">
              ${reqIdHtml}
            </a>
          </td>
          <td>
            <div class="font-bold">${empNameHtml}</div>
          </td>
          <td>
            <div class="text-xs ${asset ? 'text-primary' : 'text-muted'}">${assetDisplayHtml}</div>
          </td>
          <td>
            <div class="text-sm">${deptNameHtml}</div>
          </td>
          <td><span class="badge badge-secondary">${this.formatType(req.requestType)}</span></td>
          <td>
            <div class="font-bold text-sm">${subjectHtml}</div>
            <div class="text-muted text-xs truncate" style="max-width: 250px;">${descHtml}</div>
          </td>
          <td>${statusBadge}</td>
          <td>
            <span class="text-xs text-muted">${req.createdDate ? req.createdDate.substring(0, 16) : "-"}</span>
            ${hasMaint ? `<div class="text-xs text-danger font-bold mt-1"><i class="fas fa-tools"></i> ${lang === 'ar' ? 'صيانة مرتبطة' : 'Maint Linked'}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn btn-xs btn-primary" onclick="Helpdesk.openRequestDetails('${req.id}')" title="${lang === 'ar' ? 'فتح الطلب والرد' : 'Open & Reply'}">
                <i class="fas fa-folder-open"></i> ${lang === 'ar' ? 'فتح' : 'Open'} ${msgCount > 0 ? `(${msgCount})` : ''}
              </button>
              ${!hasMaint && asset && req.status !== "Completed" ? `
                <button class="btn btn-xs btn-secondary text-warning" onclick="Helpdesk.handleCreateMaintenanceFromRequest('${req.id}')" title="${lang === 'ar' ? 'تحويل لصيانة فعلية' : 'Create Maintenance'}">
                  <i class="fas fa-tools"></i>
                </button>
              ` : ''}
              ${req.status !== "Completed" ? `
                <button class="btn btn-xs btn-secondary text-success" onclick="Helpdesk.quickCompleteRequest('${req.id}')" title="${lang === 'ar' ? 'إكمال الطلب' : 'Complete'}">
                  <i class="fas fa-check"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // =========================================================================
  // 3. EMPLOYEE PORTAL
  // =========================================================================
  async renderEmployeePortal() {
    const user = AppState.currentUser;
    if (!user) return;

    const pane = document.getElementById("tab-employeePortal");
    if (!pane) return;

    const employee = user.employeeId ? await db.getById("employees", user.employeeId) : null;
    const lang = AppState.lang;

    // Welcome title & employee details
    const welcomeName = document.getElementById("epWelcomeName") || document.getElementById("empPortalName");
    const welcomeDept = document.getElementById("epWelcomeDept") || document.getElementById("empPortalDept");
    if (welcomeName) welcomeName.textContent = employee ? (lang === "ar" ? employee.nameAr : (employee.nameEn || employee.nameAr)) : user.fullName;
    
    if (welcomeDept && employee) {
      const dept = await db.getById("departments", employee.departmentId);
      welcomeDept.textContent = dept ? (lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr)) : "";
    }

    // Render active sub tab
    await this.switchPortalSubTab(this.activePortalSubTab);
  }

  async switchPortalSubTab(subTab) {
    this.activePortalSubTab = subTab;
    document.querySelectorAll(".portal-tab-btn, .emp-subtab-btn").forEach(btn => {
      btn.classList.toggle("active", (btn.getAttribute("data-portal-tab") === subTab || btn.getAttribute("data-subtab") === subTab));
    });

    // Toggle sub-panes
    const panes = ["devices", "requests", "notifications", "profile"];
    panes.forEach(p => {
      const el = document.getElementById(`epSubPane-${p}`) || document.getElementById(`portalPane-${p}`);
      if (el) el.style.display = (p === subTab) ? "block" : "none";
    });

    if (subTab === "devices") await this.renderEmployeeDevices();
    else if (subTab === "requests") await this.renderEmployeeRequests();
    else if (subTab === "notifications") await this.renderEmployeeNotifications();
    else if (subTab === "profile") await this.renderEmployeeProfile();
  }

  // SubTab: My Devices
  async renderEmployeeDevices() {
    const user = AppState.currentUser;
    if (!user) return;

    const container = document.getElementById("epDevicesContainer") || document.getElementById("portalDevicesContainer");
    if (!container) return;

    const lang = AppState.lang;

    if (!user.employeeId) {
      container.innerHTML = `<div class="empty-state p-4"><p class="text-muted">${lang === 'ar' ? 'الحساب غير مربوط بملف موظف.' : 'Account is not linked to an employee profile.'}</p></div>`;
      return;
    }

    const allAssets = await db.getAll("assets");
    const myAssets = allAssets.filter(a => a.currentEmployeeId === user.employeeId);

    if (myAssets.length === 0) {
      container.innerHTML = `
        <div class="empty-state py-5 text-center">
          <i class="fas fa-laptop-slash fa-3x text-muted mb-3"></i>
          <h4>${I18N[lang].noAssignedDevices || (lang === 'ar' ? "لا توجد أجهزة مسندة إليك حالياً" : "No devices currently assigned to you")}</h4>
          <p class="text-muted text-sm">${lang === 'ar' ? 'إذا تم تسليمك جهازاً حديثاً، يرجى مراجعة قسم تقنية المعلومات لتوثيقه في النظام.' : 'If you recently received a device, please contact the IT department to document it in the system.'}</p>
        </div>
      `;
      return;
    }

    let html = `<div class="ep-devices-grid">`;
    for (const asset of myAssets) {
      const isReceived = asset.handoverStatus === "Received";
      const statusBadge = `<span class="badge ${AssetManager.getStatusBadgeClass(asset.status)}">${AssetManager.formatStatus(asset.status)}</span>`;
      const handoverBadge = isReceived 
        ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> ${lang === "ar" ? "تم الاستلام" : "Received"}</span>`
        : `<span class="badge badge-warning"><i class="fas fa-clock"></i> ${lang === "ar" ? "قيد الاستلام" : "Pending Handover"}</span>`;

      html += `
        <div class="ep-device-card">
          <div class="ep-device-card-header">
            <div>
              <span class="asset-id-tag">${asset.assetId}</span>
              <h3 style="margin: 4px 0 0 0; font-size: 16px;">${asset.brand} ${asset.model}</h3>
            </div>
            <div class="d-flex gap-1">
              ${statusBadge}
              ${handoverBadge}
            </div>
          </div>
          
          <div class="ep-device-meta">
            <div><span class="text-muted text-xs">${I18N[lang].serialNumber || "السيريال"}:</span> <code>${asset.serial || "-"}</code></div>
            <div><span class="text-muted text-xs">${lang === "ar" ? "تاريخ التسليم" : "Assigned Date"}:</span> <strong>${asset.assignmentDate || asset.purchaseDate || "-"}</strong></div>
            ${asset.computerName ? `<div><span class="text-muted text-xs">${I18N[lang].computerName || "اسم الجهاز"}:</span> <code>${asset.computerName}</code></div>` : ''}
            ${asset.ip ? `<div><span class="text-muted text-xs">${I18N[lang].ipAddress || "الآي بي"}:</span> <code>${asset.ip}</code></div>` : ''}
          </div>

          <div class="ep-device-card-footer">
            ${!isReceived ? `
              <button class="btn btn-sm btn-primary" onclick="Helpdesk.confirmHandover('${asset.id}')">
                <i class="fas fa-check"></i> ${lang === "ar" ? "تأكيد استلام الجهاز" : "Confirm Receipt"}
              </button>
            ` : `
              <span class="text-xs text-success"><i class="fas fa-check-double"></i> ${lang === "ar" ? "مستلم ومثبت بالعهدة" : "Acknowledged in custody"}</span>
            `}
            <button class="btn btn-sm btn-secondary" onclick="Helpdesk.openNewSupportRequestModal('${asset.id}')">
              <i class="fas fa-headset"></i> ${lang === "ar" ? "طلب صيانة لهذا الجهاز" : "Request Support"}
            </button>
          </div>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
  }

  // SubTab: My Requests
  async renderEmployeeRequests() {
    const user = AppState.currentUser;
    if (!user) return;

    const container = document.getElementById("epRequestsContainer") || document.getElementById("portalRequestsContainer");
    if (!container) return;

    const allRequests = await db.getAll("helpdeskRequests");
    const myRequests = allRequests.filter(r => r.employeeId === user.employeeId).sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));
    const lang = AppState.lang;

    if (myRequests.length === 0) {
      container.innerHTML = `
        <div class="empty-state py-5 text-center">
          <i class="fas fa-clipboard-list fa-3x text-muted mb-3"></i>
          <h4>${I18N[lang].noRequestsFound || "لم تقم بتقديم أي طلبات دعم فني حتى الآن"}</h4>
          <button class="btn btn-primary btn-sm mt-3" onclick="Helpdesk.openNewSupportRequestModal()">
            <i class="fas fa-plus"></i> ${lang === 'ar' ? 'تقديم طلب جديد' : 'New Request'}
          </button>
        </div>
      `;
      return;
    }

    let html = `<div class="ep-requests-list">`;
    for (const req of myRequests) {
      const statusBadge = this.getStatusBadge(req.status);
      const msgCount = (req.messages || []).length;
      const lastMsg = msgCount > 0 ? req.messages[msgCount - 1] : null;

      html += `
        <div class="ep-request-card" onclick="Helpdesk.openRequestDetails('${req.id}')">
          <div class="d-flex justify-between items-center mb-2">
            <span class="font-bold text-primary">${req.requestId || req.id}</span>
            <div class="d-flex gap-2 items-center">
              ${statusBadge}
              <span class="text-xs text-muted">${req.createdDate ? req.createdDate.substring(0, 10) : ""}</span>
            </div>
          </div>
          <h4 style="margin: 0 0 6px 0; font-size: 15px;">${(lang === "en" && req.subjectEn) ? req.subjectEn : req.subject}</h4>
          <p class="text-muted text-sm mb-2" style="margin: 0;">${(lang === "en" && req.descriptionEn) ? req.descriptionEn : (req.description || "")}</p>
          
          ${lastMsg ? `
            <div class="ep-last-msg-box ${lastMsg.senderType === 'IT' ? 'it-reply' : ''}">
              <strong class="text-xs">${lang === 'en' ? (lastMsg.senderNameEn || (lastMsg.senderType === 'IT' ? 'IT Support' : (lastMsg.senderName && !/[\u0600-\u06FF]/.test(lastMsg.senderName) ? lastMsg.senderName : 'Employee'))) : lastMsg.senderName}:</strong>
              <span class="text-xs">${lang === 'en' ? (lastMsg.textEn || (lastMsg.text && !/[\u0600-\u06FF]/.test(lastMsg.text) ? lastMsg.text : 'Response message')) : lastMsg.text}</span>
            </div>
          ` : ''}

          <div class="d-flex justify-between items-center mt-2 text-xs text-muted">
            <span><i class="fas fa-comments"></i> ${msgCount} ${lang === 'ar' ? 'رسالة وتحديث' : 'Messages'}</span>
            <span class="text-primary font-bold">${lang === 'ar' ? 'فتح المحادثة والمتابعة ←' : 'View & Follow-up →'}</span>
          </div>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
  }

  // SubTab: Notifications
  async renderEmployeeNotifications() {
    const user = AppState.currentUser;
    if (!user) return;

    const container = document.getElementById("epNotificationsContainer") || document.getElementById("portalNotificationsContainer");
    if (!container) return;

    const notifs = await db.getNotifications({ employeeId: user.employeeId, userId: user.id });
    const lang = AppState.lang;

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="empty-state py-5 text-center">
          <i class="fas fa-bell-slash fa-3x text-muted mb-3"></i>
          <h4>${I18N[lang].noNotifications || "لا توجد إشعارات جديدة"}</h4>
        </div>
      `;
      return;
    }

    let html = `
      <div class="d-flex justify-between items-center mb-3">
        <h4 style="margin: 0;"><i class="fas fa-bell text-warning"></i> ${I18N[lang].notificationsTitle || "الإشعارات والتنبيهات"}</h4>
        <button class="btn btn-secondary btn-xs" onclick="Helpdesk.markAllNotificationsRead()">
          <i class="fas fa-check-double"></i> ${I18N[lang].markAllAsRead || "تحديد الكل كمقروء"}
        </button>
      </div>
      <div class="notifications-feed">
    `;

    notifs.forEach(n => {
      const title = lang === "ar" ? n.titleAr : (n.titleEn || n.titleAr);
      const msg = lang === "ar" ? n.messageAr : (n.messageEn || n.messageAr);
      const unreadClass = !n.isRead ? "unread" : "";

      html += `
        <div class="notif-feed-item ${unreadClass}" onclick="Helpdesk.handleNotificationClick('${n.id}', '${n.relatedId}', '${n.type}')">
          <div class="notif-icon"><i class="fas ${this.getNotifIcon(n.type)}"></i></div>
          <div class="notif-body">
            <div class="d-flex justify-between items-center">
              <strong>${title}</strong>
              <span class="text-xs text-muted">${n.createdDate ? n.createdDate.substring(0, 16) : ""}</span>
            </div>
            <p class="text-sm mt-1 mb-0">${msg}</p>
          </div>
          ${!n.isRead ? `<span class="unread-dot"></span>` : ''}
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // SubTab: Profile
  async renderEmployeeProfile() {
    const user = AppState.currentUser;
    if (!user) return;

    const container = document.getElementById("epProfileContainer");
    if (!container) return;

    const employee = user.employeeId ? await db.getById("employees", user.employeeId) : null;
    const lang = AppState.lang;

    container.innerHTML = `
      <div class="ep-profile-card">
        <div class="profile-header-strip">
          <div class="profile-avatar"><i class="fas fa-user-circle"></i></div>
          <div>
            <h3>${getUserDisplayName(user, lang)}</h3>
            <span class="badge badge-primary">${this.formatType(user.role) || user.role}</span>
          </div>
        </div>

        <div class="profile-details-grid mt-3">
          <div class="spec-box"><label>${I18N[lang].username || "اسم المستخدم"}</label><div><strong>${user.username}</strong></div></div>
          ${employee ? `
            <div class="spec-box"><label>${lang === 'ar' ? 'الرقم الوظيفي' : 'Employee ID'}</label><div><strong>${employee.employeeNumber}</strong></div></div>
            <div class="spec-box"><label>${I18N[lang].phone || "الهاتف"}</label><div>${employee.phone || "-"}</div></div>
            <div class="spec-box"><label>${I18N[lang].email || "البريد الإلكتروني"}</label><div>${employee.email || "-"}</div></div>
          ` : ''}
        </div>

        <div class="mt-4 pt-3 border-top d-flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="App.openChangePasswordModal()">
            <i class="fas fa-key"></i> ${I18N[lang].changePassword || "تغيير كلمة المرور"}
          </button>
          <button class="btn btn-secondary btn-sm text-danger" onclick="App.logout()">
            <i class="fas fa-sign-out-alt"></i> ${I18N[lang].btnLogout || "تسجيل الخروج"}
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 4. REQUEST DETAILS MODAL & IN-REQUEST MESSAGING
  // =========================================================================
  async openRequestDetails(requestId) {
    const user = AppState.currentUser;
    if (!user) return;

    const req = await db.getById("helpdeskRequests", requestId);
    if (!req) return;

    this.currentRequestId = req.id;
    const lang = AppState.lang;
    const isIT = user ? (user.role === "Administrator" || user.role === "IT User") : false;

    const employee = req.employeeId ? await db.getById("employees", req.employeeId) : null;
    const empName = employee ? getEntityName(employee, lang) : (lang === "ar" ? "طلب عام / بدون موظف" : "General / No Employee");
    
    let deptName = "-";
    if (employee && employee.departmentId) {
      const d = await db.getById("departments", employee.departmentId);
      if (d) deptName = getEntityName(d, lang);
    }

    const asset = req.assetId ? await db.getById("assets", req.assetId) : null;
    const deviceName = asset ? `${asset.assetId} - ${asset.brand} ${asset.model}` : (lang === "ar" ? "طلب عام" : "General Request");

    // 1. Fill Header Card
    const numEl = document.getElementById("reqModalNumber") || document.getElementById("hdSumNumber");
    if (numEl) numEl.textContent = req.requestId || req.id;

    const empEl = document.getElementById("reqModalEmp") || document.getElementById("hdSumEmp");
    if (empEl) empEl.textContent = empName;

    const devEl = document.getElementById("reqModalDevice") || document.getElementById("hdSumDevice");
    if (devEl) devEl.textContent = deviceName;

    const deptEl = document.getElementById("reqModalDept") || document.getElementById("hdSumDept");
    if (deptEl) deptEl.textContent = deptName;

    const dateEl = document.getElementById("reqModalDate") || document.getElementById("hdSumDate");
    if (dateEl) dateEl.textContent = req.createdDate ? req.createdDate.substring(0, 16) : "-";
    
    const badgeEl = document.getElementById("reqModalStatusBadge") || document.getElementById("hdSumStatus");
    if (badgeEl) {
      badgeEl.className = `badge ${this.getStatusBadgeClass(req.status)}`;
      badgeEl.textContent = this.formatStatus(req.status);
    }

    // 2. Problem Description
    const subEl = document.getElementById("reqModalSubject") || document.getElementById("hdModalTitle");
    if (subEl) subEl.textContent = (lang === "en" && req.subjectEn) ? req.subjectEn : req.subject;

    const probEl = document.getElementById("reqModalProblem") || document.getElementById("hdSumProblem");
    if (probEl) probEl.textContent = (lang === "en" && req.descriptionEn) ? req.descriptionEn : (req.description || "-");

    // 3. Messages Thread
    const messagesContainer = document.getElementById("reqModalMessagesList") || document.getElementById("hdMessagesThread");
    const messages = req.messages || [];

    if (messagesContainer) {
      if (messages.length === 0) {
        messagesContainer.innerHTML = `<div class="text-center py-3 text-muted text-xs">${lang === 'ar' ? 'لا توجد ردود سابقة. يمكنك كتابة أول رد أدناه.' : 'No messages yet. Type your reply below.'}</div>`;
      } else {
        let msgHtml = "";
        messages.forEach(m => {
          const isSelf = (isIT && m.senderType === "IT") || (!isIT && m.senderType === "Employee");
          const bubbleClass = isSelf ? "msg-bubble-self" : "msg-bubble-other";
          const senderBadge = m.senderType === "IT" 
            ? `<span class="badge badge-primary text-xs"><i class="fas fa-user-shield"></i> IT</span>`
            : `<span class="badge badge-secondary text-xs"><i class="fas fa-user"></i> ${lang === 'ar' ? 'الموظف' : 'Employee'}</span>`;

          const senderDisplayName = lang === "en" 
            ? (m.senderNameEn || (m.senderType === "IT" ? "IT Support" : (m.senderName && !/[\u0600-\u06FF]/.test(m.senderName) ? m.senderName : "Employee"))) 
            : m.senderName;
          const msgBody = lang === "en" 
            ? (m.textEn || (m.text && !/[\u0600-\u06FF]/.test(m.text) ? m.text : "Update note")) 
            : m.text;

          msgHtml += `
            <div class="chat-msg-row ${bubbleClass}">
              <div class="msg-header">
                <strong>${senderDisplayName}</strong>
                ${senderBadge}
                <span class="text-xs text-muted">${m.date ? m.date.substring(11, 16) : ""}</span>
              </div>
              <div class="msg-text">${msgBody}</div>
            </div>
          `;
        });
        messagesContainer.innerHTML = msgHtml;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    // 4. Linked Maintenance Card
    const maintCard = document.getElementById("reqModalMaintContainer") || document.getElementById("hdMaintenanceCard");
    if (maintCard) {
      if (req.maintenanceId) {
        const maint = await db.getById("maintenance", req.maintenanceId);
        if (maint) {
          maintCard.style.display = "block";
          maintCard.innerHTML = `
            <div class="p-3 border rounded bg-card">
              <div class="d-flex justify-between items-center mb-1">
                <strong><i class="fas fa-tools text-danger"></i> ${lang === 'ar' ? 'سجل الصيانة الميداني المرتبط:' : 'Linked Maintenance Record:'} ${maint.id}</strong>
                <span class="badge ${maint.status === 'Completed' ? 'badge-success' : 'badge-danger'}">${maint.status}</span>
              </div>
              <div class="text-xs text-muted">${maint.problem || ""}</div>
              ${maint.actionTaken ? `<div class="text-xs text-success font-bold mt-1"><i class="fas fa-check"></i> ${maint.actionTaken}</div>` : ''}
              ${maint.technician ? `<div class="text-xs mt-1">${lang === 'ar' ? 'الفني' : 'Technician'}: ${maint.technician}</div>` : ''}
            </div>
          `;
        }
      } else {
        if (isIT && asset && req.status !== "Completed") {
          maintCard.style.display = "block";
          maintCard.innerHTML = `
            <div class="p-3 border rounded border-dashed text-center">
              <p class="text-xs text-muted mb-2">${lang === 'ar' ? 'يتطلب هذا العطل صيانة فعلية أو استبدال قطع؟' : 'Does this issue require hardware maintenance?'}</p>
              <button class="btn btn-secondary btn-sm text-primary" onclick="Helpdesk.handleCreateMaintenanceFromRequest('${req.id}')">
                <i class="fas fa-tools"></i> ${lang === 'ar' ? 'إنشاء سجل صيانة وتمرير البيانات آلياً' : 'Create Maintenance Record'}
              </button>
            </div>
          `;
        } else {
          maintCard.style.display = "none";
        }
      }
    }

    // 5. IT Status Update Controls
    const itControls = document.getElementById("reqModalITControls") || document.getElementById("hdITActionsToolbar");
    if (itControls) {
      itControls.style.display = isIT ? "flex" : "none";
      const statusSelect = document.getElementById("reqModalChangeStatusSelect") || document.getElementById("hdActionStatusSelect");
      if (statusSelect) statusSelect.value = req.status;
    }

    App.openModal("helpdeskRequestModal");
  }

  // Send Reply inside Request
  async handleSendReply(event) {
    if (event && event.preventDefault) event.preventDefault();
    const user = AppState.currentUser;
    if (!user) return;
    if (!this.currentRequestId) return;

    const input = document.getElementById("reqModalReplyInput") || document.getElementById("hdReplyInput");
    const text = input ? input.value.trim() : "";
    if (!text) return;

    const req = await db.getById("helpdeskRequests", this.currentRequestId);
    if (!req) return;

    const isIT = user ? (user.role === "Administrator" || user.role === "IT User") : false;
    const lang = AppState.lang;

    if (!req.messages) req.messages = [];
    req.messages.push({
      id: "msg-" + Date.now(),
      senderType: isIT ? "IT" : "Employee",
      senderName: getUserDisplayName(user, "ar"),
      senderNameEn: getUserDisplayName(user, "en"),
      text: text,
      textEn: text,
      date: new Date().toISOString().replace("T", " ").substring(0, 19)
    });

    req.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);

    // Auto status adjustment
    if (isIT) {
      const statusSelect = document.getElementById("reqModalChangeStatusSelect") || document.getElementById("hdActionStatusSelect");
      if (statusSelect && statusSelect.value) {
        req.status = statusSelect.value;
      } else if (req.status === "New") {
        req.status = "In Progress";
      }

      // Notify Employee
      if (req.employeeId) {
        await db.createNotification({
          employeeId: req.employeeId,
          titleAr: `رد جديد من الدعم الفني على طلبك (${req.requestId})`,
          titleEn: `IT replied to your request (${req.requestId})`,
          messageAr: text,
          messageEn: text,
          type: "it_reply",
          relatedId: req.id
        });
      }
    } else {
      // Employee replying
      if (req.status === "Waiting for Employee") {
        req.status = "In Progress";
      }

      // Notify IT
      await db.createNotification({
        titleAr: `رد من الموظف على الطلب (${req.requestId})`,
        titleEn: `Employee replied on (${req.requestId})`,
        messageAr: `${getUserDisplayName(user, 'ar')}: ${text}`,
        messageEn: `${getUserDisplayName(user, 'en')}: ${text}`,
        type: "employee_reply",
        relatedId: req.id
      });
    }

    await db.put("helpdeskRequests", req);
    input.value = "";
    App.showToast(I18N[lang].saveSuccess || (lang === "ar" ? "تم إرسال الرد بنجاح" : "Reply sent successfully"), "success");

    await this.openRequestDetails(req.id);
    await this.render();
  }

  // Update Status from Dropdown
  async handleStatusSelectChange(newStatus) {
    if (!this.currentRequestId) return;
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(AppState.lang === "ar" ? "غير مصرح لك بتغيير حالة الطلب." : "Unauthorized to update request status.", "error");
      return;
    }
    const req = await db.getById("helpdeskRequests", this.currentRequestId);
    if (!req) return;

    req.status = newStatus;
    req.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
    if (!req.statusHistory) req.statusHistory = [];
    req.statusHistory.push({
      status: newStatus,
      changedBy: getUserDisplayName(AppState.currentUser, "ar"),
      changedByEn: getUserDisplayName(AppState.currentUser, "en"),
      date: req.updatedDate,
      note: AppState.lang === "ar" ? "تحديث الحالة من نافذة الطلب" : "Status updated from request modal"
    });

    await db.put("helpdeskRequests", req);

    // Notify employee
    if (req.employeeId) {
      await db.createNotification({
        employeeId: req.employeeId,
        titleAr: `تحديث حالة طلب الدعم (${req.requestId})`,
        titleEn: `Status updated on request (${req.requestId})`,
        messageAr: `أصبحت حالة طلبك: ${this.formatStatus(newStatus)}`,
        messageEn: `Your request status is now: ${this.formatStatus(newStatus)}`,
        type: "request_update",
        relatedId: req.id
      });
    }

    App.showToast(I18N[AppState.lang].saveSuccess, "success");
    await this.openRequestDetails(req.id);
    await this.render();
  }

  // Direct Maintenance Bridging (REQ-9)
  async handleCreateMaintenanceFromRequest(requestId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(AppState.lang === "ar" ? "غير مصرح لك بإنشاء صيانة من الطلب." : "Unauthorized to create maintenance from request.", "error");
      return;
    }
    const req = await db.getById("helpdeskRequests", requestId);
    if (!req) return;

    App.closeModal("helpdeskRequestModal");

    if (window.MaintManager && typeof window.MaintManager.openAddModalForHelpdesk === "function") {
      await window.MaintManager.openAddModalForHelpdesk(req);
    } else {
      App.showToast(AppState.lang === "ar" ? "تعذر فتح وحدة الصيانة" : "Failed to open maintenance module", "error");
    }
  }

  // Quick Complete Request (REQ-15)
  async quickCompleteRequest(requestId) {
    if (!AppState.currentUser || (AppState.currentUser.role !== "Administrator" && AppState.currentUser.role !== "IT User")) {
      App.showToast(AppState.lang === "ar" ? "غير مصرح لك بإغلاق الطلبات." : "Unauthorized to close requests.", "error");
      return;
    }
    const req = await db.getById("helpdeskRequests", requestId);
    if (!req) return;

    if (!confirm(AppState.lang === "ar" ? `هل أنت متأكد من إكمال وإغلاق الطلب (${req.requestId})؟` : `Complete and close request (${req.requestId})?`)) return;

    req.status = "Completed";
    req.updatedDate = new Date().toISOString().replace("T", " ").substring(0, 19);
    if (!req.statusHistory) req.statusHistory = [];
    req.statusHistory.push({
      status: "Completed",
      changedBy: getUserDisplayName(AppState.currentUser, "ar"),
      changedByEn: getUserDisplayName(AppState.currentUser, "en"),
      date: req.updatedDate,
      note: AppState.lang === "ar" ? "إكمال الطلب بواسطة الدعم الفني" : "Request completed by IT Support"
    });

    await db.put("helpdeskRequests", req);

    // Notify employee
    if (req.employeeId) {
      await db.createNotification({
        employeeId: req.employeeId,
        titleAr: `تم اكتمال طلب الدعم الفني (${req.requestId})`,
        titleEn: `Support Request Completed (${req.requestId})`,
        messageAr: "تم اكتمال طلب الدعم الفني الخاص بك بنجاح.",
        messageEn: "Your support request has been completed successfully.",
        type: "request_completed",
        relatedId: req.id
      });
    }

    App.showToast(I18N[AppState.lang].saveSuccess || "تم إكمال الطلب بنجاح", "success");
    await this.render();
  }

  // =========================================================================
  // 5. NEW SUPPORT REQUEST MODAL
  // =========================================================================
  async openNewSupportRequestModal(preselectedAssetId = null) {
    const user = AppState.currentUser;
    if (!user) return;

    const lang = AppState.lang;
    const form = document.getElementById("newSupportRequestForm");
    if (form) form.reset();

    const empGroup = document.getElementById("formGroupReqEmployee");
    const empDetails = document.getElementById("formReqEmployeeDetails");
    const empSelect = document.getElementById("formReqEmployeeId");
    const deviceSelect = document.getElementById("formReqAssetId") || document.getElementById("nsrDeviceSelect");
    
    const allAssets = await db.getAll("assets");

    if (user && (user.role === "Administrator" || user.role === "IT User")) {
      // Show Employee selection for admins/IT users
      if (empGroup) empGroup.style.display = "block";
      if (empDetails) empDetails.style.display = "none"; // hidden until an employee is selected
      
      // Populate Employee dropdown
      if (empSelect) {
        const employees = await db.getAll("employees");
        // Sort active employees alphabetically
        const activeEmployees = employees.filter(e => e.status === "Active").sort((a, b) => {
          const nameA = lang === "ar" ? a.nameAr : (a.nameEn || a.nameAr);
          const nameB = lang === "ar" ? b.nameAr : (b.nameEn || b.nameAr);
          return nameA.localeCompare(nameB, lang === "ar" ? "ar" : "en");
        });

        let empOptionsHtml = `<option value="">-- ${lang === 'ar' ? 'طلب عام / بدون موظف' : 'General Request / No Employee'} --</option>`;
        activeEmployees.forEach(e => {
          const name = lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr);
          empOptionsHtml += `<option value="${e.id}">${name} (${e.employeeNumber || e.employeeId || ''})</option>`;
        });
        empSelect.innerHTML = empOptionsHtml;
        empSelect.value = ""; // Default to General Request
      }

      // Populate assets initially for General Request (show all assets)
      let optionsHtml = `<option value="">-- ${lang === 'ar' ? 'بدون جهاز محدد / طلب عام' : 'No specific device / General'} --</option>`;
      allAssets.forEach(a => {
        optionsHtml += `<option value="${a.id}">${a.assetId} - ${a.brand} ${a.model} (${a.serial || ''})</option>`;
      });
      if (deviceSelect) {
        deviceSelect.innerHTML = optionsHtml;
        if (preselectedAssetId) deviceSelect.value = preselectedAssetId;
      }

      // Context-aware: If we have preselectedAssetId, load its current employee context automatically!
      if (preselectedAssetId) {
        const preselectedAsset = allAssets.find(a => a.id === preselectedAssetId);
        if (preselectedAsset && preselectedAsset.currentEmployeeId) {
          if (empSelect) {
            empSelect.value = preselectedAsset.currentEmployeeId;
            await this.handleFormEmployeeChange(preselectedAsset.currentEmployeeId);
          }
        }
      }
    } else {
      // Ordinary employee
      if (empGroup) empGroup.style.display = "none";
      if (empDetails) empDetails.style.display = "none";

      const candidateAssets = allAssets.filter(a => a.currentEmployeeId === user.employeeId);
      let optionsHtml = `<option value="">-- ${lang === 'ar' ? 'بدون جهاز محدد / طلب عام' : 'No specific device / General'} --</option>`;
      candidateAssets.forEach(a => {
        optionsHtml += `<option value="${a.id}">${a.assetId} - ${a.brand} ${a.model} (${a.serial || ''})</option>`;
      });
      if (deviceSelect) {
        deviceSelect.innerHTML = optionsHtml;
        if (preselectedAssetId) deviceSelect.value = preselectedAssetId;
      }
    }

    App.openModal("newSupportRequestModal");
  }

  async handleFormEmployeeChange(employeeId) {
    const lang = AppState.lang;
    const detailsContainer = document.getElementById("formReqEmployeeDetails");
    const numEl = document.getElementById("reqEmpNumber");
    const deptEl = document.getElementById("reqEmpDept");
    const locEl = document.getElementById("reqEmpLoc");
    const officeEl = document.getElementById("reqEmpOffice");
    const deviceSelect = document.getElementById("formReqAssetId");

    const allAssets = await db.getAll("assets");

    if (!employeeId) {
      if (detailsContainer) detailsContainer.style.display = "none";
      // General Request - allow any asset
      let optionsHtml = `<option value="">-- ${lang === 'ar' ? 'بدون جهاز محدد / طلب عام' : 'No specific device / General'} --</option>`;
      allAssets.forEach(a => {
        optionsHtml += `<option value="${a.id}">${a.assetId} - ${a.brand} ${a.model} (${a.serial || ''})</option>`;
      });
      if (deviceSelect) deviceSelect.innerHTML = optionsHtml;
      return;
    }

    // Load selected employee info
    const emp = await db.getById("employees", employeeId);
    if (emp) {
      if (detailsContainer) detailsContainer.style.display = "block";
      if (numEl) numEl.textContent = emp.employeeNumber || emp.employeeId || "-";
      
      // Get Department Name
      let deptName = "-";
      if (emp.departmentId) {
        const dept = await db.getById("departments", emp.departmentId);
        if (dept) {
          deptName = lang === "ar" ? dept.nameAr : (dept.nameEn || dept.nameAr);
        } else {
          deptName = emp.departmentId;
        }
      }
      if (deptEl) deptEl.textContent = deptName;

      // Get Location Name
      let locName = "-";
      let locId = emp.locationId;
      if (!locId && emp.departmentId) {
        const dept = await db.getById("departments", emp.departmentId);
        if (dept) locId = dept.locationId;
      }
      if (locId) {
        const loc = await db.getById("locations", locId);
        if (loc) {
          locName = lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr);
        } else {
          locName = locId;
        }
      }
      if (locEl) locEl.textContent = locName;
      if (officeEl) officeEl.textContent = emp.officeName || emp.office || "-";

      // Filter assets assigned to this employee
      const empAssets = allAssets.filter(a => a.currentEmployeeId === employeeId);
      let optionsHtml = `<option value="">-- ${lang === 'ar' ? 'بدون جهاز محدد / طلب عام' : 'No specific device / General'} --</option>`;
      empAssets.forEach(a => {
        optionsHtml += `<option value="${a.id}">${a.assetId} - ${a.brand} ${a.model} (${a.serial || ''})</option>`;
      });
      if (deviceSelect) deviceSelect.innerHTML = optionsHtml;
    }
  }

  async handleNewSupportRequestSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    const user = AppState.currentUser;
    if (!user) return;

    const lang = AppState.lang;

    const deviceSelect = document.getElementById("formReqAssetId") || document.getElementById("nsrDeviceSelect");
    const deviceId = (deviceSelect && deviceSelect.value) ? deviceSelect.value : (document.getElementById("nsrDeviceSelect")?.value || "");
    const typeSelect = document.getElementById("formReqType") || document.getElementById("nsrTypeSelect");
    const reqType = (typeSelect && typeSelect.value) ? typeSelect.value : (document.getElementById("nsrTypeSelect")?.value || "Hardware");
    const subjectEl = document.getElementById("formReqSubject") || document.getElementById("nsrSubject");
    const subject = (subjectEl && subjectEl.value.trim()) ? subjectEl.value.trim() : (document.getElementById("nsrSubject")?.value.trim() || "");
    const descEl = document.getElementById("formReqDesc") || document.getElementById("nsrDescription");
    const description = (descEl && descEl.value.trim()) ? descEl.value.trim() : (document.getElementById("nsrDescription")?.value.trim() || "");

    if (!subject) {
      App.showToast(lang === "ar" ? "يرجى كتابة موضوع الطلب" : "Please enter subject", "error");
      return;
    }

    // Determine target employee ID based on user role and selection
    let employeeId = null;
    if (user && (user.role === "Administrator" || user.role === "IT User")) {
      const empSelect = document.getElementById("formReqEmployeeId");
      if (empSelect && empSelect.value) {
        employeeId = empSelect.value;
      } else {
        employeeId = null; // General Request
      }
    } else {
      employeeId = user ? (user.employeeId || null) : null;
    }

    const targetAssetId = deviceId || null;

    // Validate asset relationship if both employee and asset are selected
    if (employeeId && targetAssetId) {
      const asset = await db.getById("assets", targetAssetId);
      if (!asset || asset.currentEmployeeId !== employeeId) {
        const msg = lang === "ar" 
          ? "تنبيه: هذا الجهاز غير مسند للموظف المختار!" 
          : "Alert: This asset is not assigned to the selected employee!";
        App.showToast(msg, "error");
        return;
      }
    }

    const nextReqId = await db.getNextRequestId();
    const nextSeq = await db.getNextSequentialId("helpdeskRequests");
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    const newReq = {
      id: nextSeq,
      requestId: nextReqId,
      employeeId: employeeId,
      assetId: targetAssetId,
      requestType: reqType,
      subject,
      description,
      status: "New",
      createdDate: now,
      updatedDate: now,
      messages: [
        {
          id: "msg-" + Date.now(),
          senderType: (user && user.role === "Employee") ? "Employee" : "IT",
          senderName: getUserDisplayName(user, "ar"),
          senderNameEn: getUserDisplayName(user, "en"),
          text: description || subject,
          textEn: description || subject,
          date: now
        }
      ],
      maintenanceId: null,
      statusHistory: [
        {
          status: "New",
          changedBy: getUserDisplayName(user, "ar"),
          changedByEn: getUserDisplayName(user, "en"),
          date: now,
          note: lang === "ar" ? "إنشاء الطلب" : "Request created"
        }
      ]
    };

    await db.put("helpdeskRequests", newReq);

    // Notify IT
    await db.createNotification({
      titleAr: `طلب دعم فني جديد: ${nextReqId}`,
      titleEn: `New Support Request: ${nextReqId}`,
      messageAr: `${subject} - مقدم من: ${getUserDisplayName(user, "ar")}`,
      messageEn: `${subject} - Submitted by: ${getUserDisplayName(user, "en")}`,
      type: "new_request",
      relatedId: newReq.id
    });

    App.closeModal("newSupportRequestModal");
    App.showToast(I18N[lang].requestSubmittedSuccess || (lang === "ar" ? "تم إرسال الطلب بنجاح." : "Request submitted successfully."), "success");

    await this.render();
  }

  // =========================================================================
  // 6. ASSET HANDOVER ACKNOWLEDGEMENT (REQ-1, REQ-2)
  // =========================================================================
  async confirmHandover(assetId) {
    const user = AppState.currentUser;
    if (!user) return;

    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const lang = AppState.lang;
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    asset.handoverStatus = "Received";
    asset.handoverDate = now;
    asset.confirmedBy = getUserDisplayName(user, lang);
    asset.updatedDate = now;

    await db.put("assets", asset);

    // Log transaction
    await db.logTransaction({
      assetId: asset.id,
      transactionType: "Received",
      toEmployeeId: asset.currentEmployeeId,
      transactionDate: now,
      performedBy: getUserDisplayName(user, lang),
      notes: lang === "ar" ? "تم تأكيد استلام الجهاز من قبل الموظف" : "Asset handover acknowledged by employee"
    });

    // Notify IT
    await db.createNotification({
      titleAr: `تأكيد استلام عهدة: ${asset.assetId}`,
      titleEn: `Handover Acknowledged: ${asset.assetId}`,
      messageAr: `قام الموظف (${getUserDisplayName(user, 'ar')}) بتأكيد استلام الأصل (${asset.brand} ${asset.model}).`,
      messageEn: `Employee (${getUserDisplayName(user, 'en')}) confirmed receipt of asset (${asset.brand} ${asset.model}).`,
      type: "handover",
      relatedId: asset.id
    });

    App.showToast(I18N[lang].handoverConfirmedSuccess || "تم تأكيد استلام الجهاز بنجاح.", "success");

    if (user && user.role === "Employee") {
      await this.renderEmployeeDevices();
    }
    if (AssetManager.currentDetailAssetId === assetId) {
      await AssetManager.openDetailsModal(assetId);
    }
    await AssetManager.render();
  }

  // =========================================================================
  // 7. NOTIFICATION ACTIONS
  // =========================================================================
  async markAllNotificationsRead() {
    const user = AppState.currentUser;
    if (!user) return;
    await db.markAllNotificationsRead({ employeeId: user.employeeId, userId: user.id });
    App.showToast(AppState.lang === "ar" ? "تم تحديد جميع الإشعارات كمقروءة" : "All notifications marked as read", "info");
    if (user.role === "Employee") {
      await this.renderEmployeeNotifications();
    }
  }

  async handleNotificationClick(notifId, relatedId, type) {
    const user = AppState.currentUser;
    if (!user) return;

    await db.markNotificationRead(notifId);
    if (relatedId && (type === "it_reply" || type === "request_update" || type === "request_completed" || type === "new_request" || type === "employee_reply")) {
      await this.openRequestDetails(relatedId);
    } else if (relatedId && type === "handover") {
      await AssetManager.openDetailsModal(relatedId);
    }
  }

  // =========================================================================
  // 8. HELPERS & FORMATTERS
  // =========================================================================
  getStatusBadge(status) {
    const cls = this.getStatusBadgeClass(status);
    const txt = this.formatStatus(status);
    return `<span class="badge ${cls}">${txt}</span>`;
  }

  getStatusBadgeClass(status) {
    switch (status) {
      case "New": return "badge-danger";
      case "In Progress": return "badge-warning";
      case "Waiting for Employee": return "badge-info";
      case "Completed": return "badge-success";
      case "Cancelled": return "badge-secondary";
      default: return "badge-secondary";
    }
  }

  formatStatus(status) {
    const lang = AppState.lang;
    switch (status) {
      case "New": return lang === "ar" ? "جديد" : "New";
      case "In Progress": return lang === "ar" ? "قيد المعالجة" : "In Progress";
      case "Waiting for Employee": return lang === "ar" ? "بانتظار الموظف" : "Waiting for Employee";
      case "Completed": return lang === "ar" ? "مكتمل" : "Completed";
      case "Cancelled": return lang === "ar" ? "ملغي" : "Cancelled";
      default: return status || "-";
    }
  }

  formatType(type) {
    const lang = AppState.lang;
    switch (type) {
      case "Hardware": return lang === "ar" ? "أجهزة وعتاد" : "Hardware";
      case "Software": return lang === "ar" ? "برمجيات" : "Software";
      case "Network": return lang === "ar" ? "شبكات" : "Network";
      case "General": return lang === "ar" ? "عام" : "General";
      default: return type || "-";
    }
  }

  getNotifIcon(type) {
    switch (type) {
      case "it_reply": return "fa-reply text-primary";
      case "request_completed": return "fa-check-circle text-success";
      case "request_update": return "fa-sync-alt text-info";
      case "handover": return "fa-laptop text-warning";
      case "new_request": return "fa-headset text-danger";
      default: return "fa-bell text-warning";
    }
  }

  // Status and Search Filters
  filterByStatus(status) {
    this.filterStatus = status;
    const el = document.getElementById("hdFilterStatus");
    if (el) el.value = status;
    return this.renderITHelpdesk();
  }

  handleSearch(val) {
    this.filterSearch = (val || "").trim().toLowerCase();
    return this.renderITHelpdesk();
  }

  handleStatusChange(status) {
    this.filterStatus = status;
    return this.renderITHelpdesk();
  }

  resetFilters() {
    this.filterSearch = "";
    this.filterStatus = "";
    const s = document.getElementById("hdSearchInput");
    if (s) s.value = "";
    const st = document.getElementById("hdFilterStatus");
    if (st) st.value = "";
    return this.renderITHelpdesk();
  }

  // Modal Actions
  async openLinkedMaintenance() {
    const user = AppState.currentUser;
    if (!user) return;
    if (!this.currentRequestId) return;
    const req = await db.getById("helpdeskRequests", this.currentRequestId);
    if (!req || !req.maintenanceId) {
      App.showToast(AppState.lang === "ar" ? "لا يوجد سجل صيانة مرتبط بهذا الطلب" : "No linked maintenance ticket for this request", "warning");
      return;
    }
    App.closeModal("helpdeskRequestModal");
    App.switchTab("maintenance");
    if (window.MaintManager && typeof window.MaintManager.openEditModal === "function") {
      await window.MaintManager.openEditModal(req.maintenanceId);
    }
  }

  async handleUpdateStatus() {
    const sel = document.getElementById("reqModalChangeStatusSelect") || document.getElementById("hdActionStatusSelect");
    if (sel && sel.value) {
      await this.handleStatusSelectChange(sel.value);
    }
  }

  async handleCreateMaintenanceFromModal() {
    if (this.currentRequestId) {
      await this.handleCreateMaintenanceFromRequest(this.currentRequestId);
    }
  }

  async handleCompleteRequestFromModal() {
    if (this.currentRequestId) {
      await this.quickCompleteRequest(this.currentRequestId);
    }
  }

  async handleSubmitNewRequest(event) {
    return this.handleNewSupportRequestSubmit(event);
  }

  async viewRequestDetails(id) {
    return this.openRequestDetails(id);
  }
}

// Global Singleton
const HelpdeskController = new HelpdeskManager();
const Helpdesk = HelpdeskController;
window.Helpdesk = Helpdesk;
window.HelpdeskController = HelpdeskController;
