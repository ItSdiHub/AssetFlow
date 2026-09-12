/**
 * SDI IT Asset Hub - Main Application Controller
 * Orchestrates Tabs, Navigation, Dashboard, Reports, Authentication, and Settings
 */

function safeGetStorage(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch(e) {
    return fallback;
  }
}

window.AppState = window.AppState || {
  lang: safeGetStorage("sdi_lang", "ar"),
  theme: safeGetStorage("sdi_theme", "dark"),
  currentTab: "dashboard",
  currentSettingsSubTab: "dbTest",
  currentUser: (() => {
    try {
      const u = localStorage.getItem("sdi_user");
      if (u) return JSON.parse(u);
    } catch(e) {}
    return null;
  })()
};
var AppState = window.AppState;

class Application {
  constructor() {
    this.toastTimeout = null;
    this.navHistory = [];
    this.hasUnsavedChanges = false;
    this.pendingNavTarget = null;
  }

  async init() {
    console.log("Initializing SDI IT Asset Hub...");

    // 1. Setup global listeners
    this.setupEventListeners();

    // 2. Set Language, Theme & Color Palette
    this.applyLanguage(AppState.lang);
    this.applyTheme(AppState.theme);
    const savedColor = localStorage.getItem("sdi_color_theme") || "orange";
    this.setColorTheme(savedColor);

    // Outside click listener for palette dropdown
    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("themePaletteDropdown");
      const btn = document.getElementById("themeSettingsBtn");
      if (dropdown && dropdown.style.display === "block") {
        if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
          dropdown.style.display = "none";
        }
      }
    });

    // 3. Initialize Database
    try {
      await db.init();
      this.updateCloudStatus();
      if (!db.isCloudOnline) {
        this.showCloudUnavailableScreen("cloud");
        return;
      }
      if (!db.isOperationalReady) this.showCloudUnavailableScreen("realtime");
    } catch (e) {
      console.warn("Database init warning:", e);
      this.showCloudUnavailableScreen("cloud");
      return;
    }

    // 4. Update Current User Badge & Permissions
    this.applyUserRolePermissions();

    // 5. Apply Institutional Branding (Logo & System Name)
    try { await this.applyBranding(); } catch (e) { console.warn("applyBranding warning:", e); }

    // 6. Populate and render UI modules with individual protections
    try { await AssetManager.populateDropdowns(); } catch (e) { console.warn("populateDropdowns warning:", e); }
    try { await this.updateDashboard(); } catch (e) { console.warn("updateDashboard warning:", e); }
    try { await AssetManager.render(); } catch (e) { console.warn("AssetManager.render warning:", e); }
    try { await UserManager.renderEmployees(); } catch (e) { console.warn("renderEmployees warning:", e); }
    try { await UserManager.renderDepartments(); } catch (e) { console.warn("renderDepartments warning:", e); }
    try { await UserManager.renderLocations(); } catch (e) { console.warn("renderLocations warning:", e); }
    try { if (window.TreeManager) await TreeManager.render(); } catch (e) { console.warn("TreeManager.render warning:", e); }
    try { await MaintManager.render(); } catch (e) { console.warn("MaintManager.render warning:", e); }
    try { await UserManager.renderAssetTypes(); } catch (e) { console.warn("renderAssetTypes warning:", e); }
    try { await UserManager.renderUsers(); } catch (e) { console.warn("renderUsers warning:", e); }
    try { await this.generateSelectedReport(); } catch (e) { console.warn("generateSelectedReport warning:", e); }
    try { await this.updateNotificationBadge(); } catch (e) { console.warn("updateNotificationBadge warning:", e); }

        // Real Supabase Auth validation
    if (db.supabase) {
        try {
            const { data: { session } } = await db.supabase.auth.getSession();
            if (!session) {
                if (typeof db !== "undefined" && db.clear) {
                    const sensitiveStores = ["assets", "employees", "maintenance", "assetTransactions", "warehouseIssues", "assetTransfers", "helpdeskRequests", "notifications", "users"];
                    for (const store of sensitiveStores) { try { await db.clear(store); } catch(err) {} }
                }
                AppState.currentUser = null;
                localStorage.removeItem("sdi_user");
                sessionStorage.removeItem("sdi_user");
                this.applyUserRolePermissions();
            }
            
            // Listen to auth state changes
            db.supabase.auth.onAuthStateChange(async (event, currentSession) => {
                if (event === 'SIGNED_OUT' || !currentSession) {
                    if (typeof db !== "undefined" && db.clear) {
                        const sensitiveStores = ["assets", "employees", "maintenance", "assetTransactions", "warehouseIssues", "assetTransfers", "helpdeskRequests", "notifications", "users"];
                        for (const store of sensitiveStores) { try { await db.clear(store); } catch(err) {} }
                    }
                    AppState.currentUser = null;
                    localStorage.removeItem("sdi_user");
                    sessionStorage.removeItem("sdi_user");
                    this.applyUserRolePermissions();
                    
                    const loginModal = document.getElementById("loginModal");
                    if (loginModal && loginModal.style.display !== "flex") {
                        this.openLoginModal();
                    }
                }
            });
        } catch (e) {
            console.warn("Auth initialization error:", e);
        }
    }

    // Require an explicitly provisioned account in production.
    if (!AppState.currentUser) {
      await this.openLoginModal();
    } else if (AppState.currentUser.role === "Employee") {
      await this.switchTab("employeePortal", true);
    }

    // Auto-enhance all selects across the entire system with live search comboboxes
    try { this.enhanceAllSelects(document); } catch (e) { console.warn("enhanceAllSelects warning:", e); }

    console.log("SDI IT Asset Hub initialized successfully.");
  }

  updateCloudStatus() {
    const statusText = document.getElementById("sidebarStatusText");
    if (!statusText) return;
    if (!db.isCloudOnline) {
      this.showCloudUnavailableScreen("cloud");
      statusText.textContent = AppState.lang === "ar"
        ? "السحابة غير متصلة - قراءة فقط"
        : "Cloud unavailable - read only";
      return;
    }
    if (!db.isOperationalReady) {
      this.showCloudUnavailableScreen("realtime");
      statusText.textContent = AppState.lang === "ar"
        ? "السحابة متصلة - العمليات متوقفة حتى يتصل التحديث الفوري"
        : "Cloud connected - operations paused until realtime is ready";
      return;
    }
    statusText.textContent = db.isRealtimeOnline
      ? (AppState.lang === "ar" ? "السحابة والتحديث الفوري متصلان" : "Cloud and realtime connected")
      : (AppState.lang === "ar"
        ? `السحابة متصلة - التحديث الفوري: ${db.realtimeStatus || "جاري الاتصال"}`
        : `Cloud connected - realtime: ${db.realtimeStatus || "connecting"}`);
  }

  showCloudUnavailableScreen(reason = "cloud") {
    let overlay = document.getElementById("cloudUnavailableOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "cloudUnavailableOverlay";
      overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(7,18,32,.96);padding:24px;text-align:center;";
      document.body.appendChild(overlay);
    }
    const isRealtime = reason === "realtime";
    overlay.innerHTML = `
      <div style="max-width:520px;">
        <i class="fas ${isRealtime ? "fa-sync-alt fa-spin" : "fa-cloud-slash"}" style="font-size:48px;color:#f59e0b;margin-bottom:18px;"></i>
        <h2>${isRealtime
          ? (AppState.lang === "ar" ? "جاري تفعيل التحديث الفوري" : "Waiting for realtime synchronization")
          : (AppState.lang === "ar" ? "الاتصال بالسحابة غير متاح" : "Cloud connection unavailable")}</h2>
        <p>${isRealtime
          ? (AppState.lang === "ar" ? "لن تبدأ العمليات حتى يتصل التحديث الفوري، حتى يرى جميع المستخدمين نفس التغييرات." : "Operations remain paused until realtime is connected so all users see the same changes.")
          : (AppState.lang === "ar" ? "تم إيقاف النظام مؤقتاً حتى لا يتم عرض أو تسجيل بيانات محلية قديمة. أعد الاتصال بالإنترنت ثم أعد تحميل الصفحة." : "The system is paused so stale local data cannot be displayed or recorded. Reconnect to the internet and reload the page.")}</p>
        <button class="btn btn-primary" onclick="App.retryCloudConnection()">
          <i class="fas fa-redo me-1"></i>
          ${AppState.lang === "ar" ? "إعادة المحاولة" : "Retry connection"}
        </button>
      </div>
    `;
  }

  async retryCloudConnection() {
    this.showCloudUnavailableScreen("realtime");
    try {
      if (!db.supabase) {
        this.showCloudUnavailableScreen("cloud");
        return;
      }
      const cloudReady = await db.checkCloudConnection();
      if (!cloudReady) {
        this.showCloudUnavailableScreen("cloud");
        return;
      }
      db.subscribeRealtime();
      if (!db.isOperationalReady) return;
      await this.refreshAllCloudViews();
    } catch (error) {
      console.warn("Manual cloud retry failed:", error);
      this.showCloudUnavailableScreen("cloud");
    }
  }

  async refreshAllCloudViews() {
    try {
      if (typeof db.checkCloudConnection === "function" && !(await db.checkCloudConnection())) {
        this.showCloudUnavailableScreen("cloud");
        return;
      }
      if (!db.isOperationalReady) {
        this.showCloudUnavailableScreen("realtime");
        return;
      }
      const overlay = document.getElementById("cloudUnavailableOverlay");
      if (overlay) overlay.remove();
      await this.updateDashboard();
      if (typeof AssetManager !== "undefined") {
        await AssetManager.populateDropdowns();
        await AssetManager.render();
      }
      if (typeof UserManager !== "undefined") {
        await UserManager.renderEmployees();
        await UserManager.renderDepartments();
        await UserManager.renderLocations();
        await UserManager.renderAssetTypes();
        await UserManager.renderUsers();
      }
      if (typeof MaintManager !== "undefined") await MaintManager.render();
      if (typeof OpsManager !== "undefined") {
        await OpsManager.renderWarehouseIssues();
        await OpsManager.renderAwaitingInstall();
        await OpsManager.renderInstalledDevices();
        await OpsManager.renderTransfers();
      }
      await this.generateSelectedReport();
      await this.updateNotificationBadge();
    } catch (error) {
      console.warn("Cloud resynchronization warning:", error);
    } finally {
      this.updateCloudStatus();
    }
  }

  isOperationalReady() {
    return Boolean(db && db.isOperationalReady);
  }

  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        if (tab) this.switchTab(tab);
      });
    });

    // Top Header Search Bar
    const headerSearch = document.getElementById("headerQuickSearch");
    if (headerSearch) {
      headerSearch.addEventListener("input", (e) => {
        this.handleHeaderSearch(e.target.value.trim());
      });
      headerSearch.addEventListener("focus", (e) => {
        if (e.target.value.trim().length > 0) {
          this.handleHeaderSearch(e.target.value.trim());
        }
      });
      // Close dropdown when clicking outside
      document.addEventListener("click", (e) => {
        const container = document.getElementById("headerSearchContainer");
        if (container && !container.contains(e.target)) {
          const dropdown = document.getElementById("headerSearchResults");
          if (dropdown) dropdown.style.display = "none";
        }
      });
    }

    // Close modals on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-container.active, .modal-container.show").forEach(m => {
          this.closeModal(m.id);
        });
        if (this.isScanningActive) this.closeScannerModal();
      }
    });

    // Static backdrop behavior (Prevent modal from closing or falling behind when clicking outside)
    document.addEventListener("click", (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("modal-backdrop")) {
        const parentModal = e.target.closest(".modal-container");
        if (parentModal) {
          parentModal.classList.remove("modal-static-shake");
          void parentModal.offsetWidth; // Trigger browser reflow
          parentModal.classList.add("modal-static-shake");
          setTimeout(() => {
            parentModal.classList.remove("modal-static-shake");
          }, 400);
        }
      }
    });

    // Browser back button handler (REQ-46)
    window.addEventListener("popstate", (e) => {
      if (e.state && e.state.tab) {
        this.switchTab(e.state.tab, true);
      } else {
        this.navigateBack();
      }
    });
  }

  // =========================================================================
  // 1. NAVIGATION & TAB SWITCHING (With Authorization & Unsaved Changes Guard)
  // =========================================================================
  async switchTab(tabName, skipHistory = false) {
    if (this.hasUnsavedChanges) {
      this.pendingNavTarget = { type: 'tab', tab: tabName, skipHistory };
      this.openModal("unsavedChangesModal");
      return;
    }

    // REQ-32: Authorization Enforcement
    const role = AppState.currentUser ? AppState.currentUser.role : "Viewer";
    let targetTab = tabName;

    if (role === "Employee") {
      // Employee can ONLY access employeePortal or accessDenied
      if (tabName !== "employeePortal" && tabName !== "accessDenied") {
        targetTab = "accessDenied";
      }
    } else if (role === "IT User") {
      // IT User cannot access settings
      if (tabName === "settings") {
        targetTab = "accessDenied";
      }
    }

    // Record navigation history (REQ-45, REQ-46)
    if (!skipHistory && AppState.currentTab && AppState.currentTab !== targetTab) {
      this.navHistory.push(AppState.currentTab);
      try {
        window.history.pushState({ tab: targetTab }, "", `#${targetTab}`);
      } catch(e) {}
    }

    AppState.currentTab = targetTab;

    // Update Sidebar Navigation
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-tab") === targetTab);
    });

    // Update Panes
    document.querySelectorAll(".tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === `tab-${targetTab}`);
    });

    // Refresh specific tab data
    if (targetTab === "dashboard") await this.updateDashboard();
    else if (targetTab === "assets") await AssetManager.render();
    else if (targetTab === "employees") await UserManager.renderEmployees();
    else if (targetTab === "departments") await UserManager.renderDepartments();
    else if (targetTab === "locations") {
      if (window.TreeManager) await TreeManager.render();
      await UserManager.renderLocations();
    }
    else if (targetTab === "maintenance") await MaintManager.render();
    else if (targetTab === "helpdesk") {
      if (window.HelpdeskController) await HelpdeskController.render();
    }
    else if (targetTab === "employeePortal") {
      if (window.HelpdeskController) await HelpdeskController.renderEmployeePortal();
    }
    else if (targetTab === "operations") {
      if (window.OpsManager) await OpsManager.render();
    }
    else if (targetTab === "projects") {
      if (window.ProjectManager) await ProjectManager.render();
    }
    else if (targetTab === "contractors") {
      if (window.ContractorManager) await ContractorManager.render();
    }
    else if (targetTab === "reports") await this.generateSelectedReport();
    else if (targetTab === "settings") {
      await UserManager.renderAssetTypes();
      await UserManager.renderUsers();
      if (AppState.currentSettingsSubTab === "branding") {
        await UserManager.renderBrandingSettings();
      }
    }

    // Auto-enhance selects on switched tab
    setTimeout(() => {
      try {
        const tabEl = document.getElementById(`tab-${targetTab}`) || document;
        this.enhanceAllSelects(tabEl);
      } catch (e) {}
    }, 60);
  }

  // REQ-45 & REQ-46: Back Navigation
  async navigateBack() {
    if (this.hasUnsavedChanges) {
      this.pendingNavTarget = { type: 'back' };
      this.openModal("unsavedChangesModal");
      return;
    }

    if (this.navHistory.length > 0) {
      const prevTab = this.navHistory.pop();
      await this.switchTab(prevTab, true);
    } else {
      const role = AppState.currentUser ? AppState.currentUser.role : "Employee";
      if (role === "Employee") {
        await this.switchTab("employeePortal", true);
      } else {
        await this.switchTab("dashboard", true);
      }
    }
  }

  // REQ-47: Unsaved Changes Confirmation
  confirmLeaveUnsaved() {
    this.hasUnsavedChanges = false;
    this.closeModal("unsavedChangesModal");
    if (this.pendingNavTarget) {
      const target = this.pendingNavTarget;
      this.pendingNavTarget = null;
      if (target.type === 'tab') {
        this.switchTab(target.tab, target.skipHistory);
      } else if (target.type === 'back') {
        this.navigateBack();
      }
    }
  }

  setUnsavedChanges(val) {
    this.hasUnsavedChanges = !!val;
  }

  async switchSettingsSubTab(subTabName) {
    AppState.currentSettingsSubTab = subTabName;
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-subtab") === subTabName);
    });
    document.querySelectorAll(".settings-pane").forEach(pane => {
      const isActive = pane.id === `settingsPane-${subTabName}`;
      pane.classList.toggle("active", isActive);
      pane.style.display = isActive ? "block" : "none";
    });

    if (subTabName === "branding" && UserManager && typeof UserManager.renderBrandingSettings === "function") {
      await UserManager.renderBrandingSettings();
    }
    if (subTabName === "licenses" && window.TechTools && typeof window.TechTools.renderSoftware === "function") {
      await window.TechTools.renderSoftware();
    }
  }

  // =========================================================================
  // 2. DASHBOARD KPI COUNTERS & SUMMARIES
  // =========================================================================
  async updateDashboard() {
    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const assetTypes = await db.getAll("assetTypes");
    const maintenance = await db.getAll("maintenance");
    const projects = await db.getAll("projects");
    const lang = AppState.lang;

    // 1. Institutional High-Level Counts
    const countEmployees = employees.length;
    const countDepartments = departments.length;
    const countLocations = locations.length;
    const countActiveMaint = maintenance.filter(m => m.status === "Open" || m.status === "In Progress").length;

    // 2. Operational Asset Status Counts
    let countTotal = assets.length;
    let countAssigned = 0;
    let countAvailable = 0;
    let countInStore = 0;
    let countInTransit = 0;
    let countMaintenance = 0;
    let countDamaged = 0;
    let countLost = 0;
    let countRetired = 0;
    let countDisposed = 0;

    // Summaries Maps
    const typeCountMap = {};
    const deptCountMap = {};
    const locCountMap = {};

    assets.forEach(a => {
      const st = (a.status || "").trim();
      if (st === "Assigned") countAssigned++;
      else if (st === "Available") countAvailable++;
      else if (st === "In Store") countInStore++;
      else if (st === "In Transit" || st === "Pending Installation") countInTransit++;
      else if (st === "Under Maintenance") countMaintenance++;
      else if (st === "Damaged") countDamaged++;
      else if (st === "Lost") countLost++;
      else if (st === "Retired") countRetired++;
      else if (st === "Disposed") countDisposed++;

      if (a.assetTypeId) typeCountMap[a.assetTypeId] = (typeCountMap[a.assetTypeId] || 0) + 1;
      if (a.departmentId) deptCountMap[a.departmentId] = (deptCountMap[a.departmentId] || 0) + 1;
      if (a.locationId) locCountMap[a.locationId] = (locCountMap[a.locationId] || 0) + 1;
    });

    // Update Counter Elements
    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    // Set 4 Institutional Overview Indicators
    setElem("dashCountEmployees", countEmployees);
    setElem("dashCountDepartments", countDepartments);
    setElem("dashCountLocations", countLocations);
    setElem("dashCountActiveMaint", countActiveMaint);

    // Set Projects Metrics, Follow-Up Notifications & Overall Progress
    const countProjects = (projects || []).length;
    let countProjectsCompleted = 0;
    let countProjectsInProgress = 0;
    let countProjectsOverdue = 0;
    let totalProgressSum = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueProjects = [];
    const inProgressProjects = [];

    (projects || []).forEach(p => {
      const st = (p.status || "").trim();
      const progress = Number(p.progress) || 0;
      totalProgressSum += progress;

      if (st === "Completed") {
        countProjectsCompleted++;
      } else if (st === "In Progress") {
        countProjectsInProgress++;
      }

      // Overdue check
      const isOverdue = st !== "Completed" && st !== "Cancelled" && p.plannedEndDate && p.plannedEndDate < todayStr;
      if (isOverdue) {
        countProjectsOverdue++;
        overdueProjects.push(p);
      } else if (st === "In Progress" || st === "Planning") {
        inProgressProjects.push(p);
      }
    });

    const overallProgress = countProjects > 0 ? Math.round(totalProgressSum / countProjects) : 0;

    setElem("dashCountProjects", countProjects);
    setElem("dashCountProjectsCompleted", countProjectsCompleted);
    setElem("dashCountProjectsInProgress", countProjectsInProgress);
    setElem("dashCountProjectsOverdue", countProjectsOverdue);
    setElem("dashProjectsOverallProgress", `${overallProgress}%`);
    const progressBar = document.getElementById("dashProjectsProgressBar");
    if (progressBar) {
      progressBar.style.width = `${overallProgress}%`;
    }

    const alertsBox = document.getElementById("dashProjectsAlertsContainer");
    if (alertsBox) {
      if (countProjects === 0) {
        alertsBox.innerHTML = `
          <div class="text-xs text-muted p-2 text-center rounded border" style="background: rgba(148, 163, 184, 0.05); border-color: rgba(148, 163, 184, 0.2);">
            <i class="fas fa-folder-open me-1"></i> <span>${lang === 'ar' ? 'لا توجد مشاريع مسجلة حالياً' : 'No projects registered currently'}</span>
          </div>
        `;
      } else if (overdueProjects.length === 0 && inProgressProjects.length === 0) {
        alertsBox.innerHTML = `
          <div class="text-xs text-muted p-2 text-center rounded border" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2);">
            <i class="fas fa-check-circle text-success me-1"></i> <span data-i18n="noProjectAlerts">${I18N[lang].noProjectAlerts}</span>
          </div>
        `;
      } else {
        let alertsHtml = "";
        
        // Overdue alerts
        overdueProjects.forEach(p => {
          const pName = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
          alertsHtml += `
            <div class="d-flex justify-between items-center p-2 rounded border" style="background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); cursor: pointer;" onclick="ProjectManager.viewProjectDetails('${p.id}')" title="${lang === 'ar' ? 'عرض تفاصيل المشروع' : 'View project details'}">
              <div class="d-flex items-center gap-2">
                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 16px;"></i>
                <div>
                  <div class="text-xs font-bold text-danger">
                    ${p.projectCode ? `[${p.projectCode}] ` : ""}${pName} - ${I18N[lang].projectOverdueAlert}
                  </div>
                  <div class="text-xs text-muted">
                    ${I18N[lang].projectDueAlertText} ${p.plannedEndDate || '---'} | ${I18N[lang].dashOverallProgress}: ${p.progress || 0}%
                  </div>
                </div>
              </div>
              <span class="badge badge-danger text-xs">${p.progress || 0}%</span>
            </div>
          `;
        });

        // Top 3 in-progress notifications
        const displayInProgress = inProgressProjects.slice(0, 3);
        displayInProgress.forEach(p => {
          const pName = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
          alertsHtml += `
            <div class="d-flex justify-between items-center p-2 rounded border" style="background: rgba(243, 112, 33, 0.05); border-color: rgba(243, 112, 33, 0.25); cursor: pointer;" onclick="ProjectManager.viewProjectDetails('${p.id}')" title="${lang === 'ar' ? 'عرض تفاصيل المشروع' : 'View project details'}">
              <div class="d-flex items-center gap-2">
                <i class="fas fa-tasks" style="font-size: 15px; color: var(--sdi-orange);"></i>
                <div>
                  <div class="text-xs font-bold">
                    ${p.projectCode ? `[${p.projectCode}] ` : ""}${pName}
                  </div>
                  <div class="text-xs text-muted">
                    ${I18N[lang].projectInProgressNote} | ${I18N[lang].dashOverallProgress}: ${p.progress || 0}%
                  </div>
                </div>
              </div>
              <div style="min-width: 80px; text-align: ${lang === 'ar' ? 'left' : 'right'};">
                <span class="text-xs font-bold" style="color: var(--sdi-orange);">${p.progress || 0}%</span>
                <div style="height: 4px; background: rgba(0,0,0,0.06); border-radius: 2px; overflow: hidden; margin-top: 2px;">
                  <div style="width: ${p.progress || 0}%; height: 100%; background: var(--sdi-orange);"></div>
                </div>
              </div>
            </div>
          `;
        });

        alertsBox.innerHTML = alertsHtml;
      }
    }

    // =========================================================================
    // WARRANTY EXPIRATION ALERTS (Within Next 30 Days)
    // =========================================================================
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const typeMap = Object.fromEntries(assetTypes.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));

    const expiringSoonAssets = [];
    let countWarrantyExpiring30d = 0;
    let countWarrantyExpiring7d = 0;
    let countWarrantyExpired = 0;
    let countWarrantyValid = 0;

    assets.forEach(a => {
      if (!a.warrantyExpiry) return;
      const st = (a.status || "").trim();
      if (st === "Disposed" || st === "Retired") return;

      const parts = String(a.warrantyExpiry).split("-");
      if (parts.length !== 3) return;
      const expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (isNaN(expDate.getTime())) return;
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        countWarrantyExpired++;
      } else if (diffDays <= 30) {
        countWarrantyExpiring30d++;
        if (diffDays <= 7) {
          countWarrantyExpiring7d++;
        }
        expiringSoonAssets.push({
          asset: a,
          diffDays,
          isCritical: diffDays <= 7,
          isToday: diffDays === 0
        });
      } else {
        countWarrantyValid++;
      }
    });

    // Update Warranty Counters
    setElem("dashWarrantyCount30d", countWarrantyExpiring30d);
    setElem("dashWarrantyCount7d", countWarrantyExpiring7d);
    setElem("dashWarrantyCountExpired", countWarrantyExpired);
    setElem("dashWarrantyCountValid", countWarrantyValid);

    const warrantyBadge = document.getElementById("dashWarrantyAlertCountBadge");
    if (warrantyBadge) {
      warrantyBadge.textContent = countWarrantyExpiring30d;
      warrantyBadge.className = countWarrantyExpiring7d > 0
        ? "badge badge-danger font-bold"
        : (countWarrantyExpiring30d > 0 ? "badge badge-warning font-bold" : "badge badge-secondary");
    }

    const warrantyAlertsBox = document.getElementById("dashWarrantyAlertsContainer");
    if (warrantyAlertsBox) {
      if (expiringSoonAssets.length === 0) {
        warrantyAlertsBox.innerHTML = `
          <div class="text-xs text-muted p-3 text-center rounded border" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2);">
            <i class="fas fa-check-circle text-success me-1" style="font-size: 15px;"></i>
            <span class="font-bold text-success" data-i18n="dashWarrantyNoAlerts">${I18N[lang].dashWarrantyNoAlerts}</span>
            <span class="text-muted ms-1" data-i18n="dashWarrantyNoAlertsDesc">(${I18N[lang].dashWarrantyNoAlertsDesc})</span>
          </div>
        `;
      } else {
        // Sort: closest expiration date first
        expiringSoonAssets.sort((a, b) => a.diffDays - b.diffDays);

        let wHtml = "";
        expiringSoonAssets.forEach(item => {
          const a = item.asset;
          const diffDays = item.diffDays;
          const isCritical = item.isCritical;
          const isToday = item.isToday;

          let badgeText = "";
          if (isToday) {
            badgeText = lang === "ar" ? "ينتهي اليوم!" : "Expires Today!";
          } else if (diffDays === 1) {
            badgeText = lang === "ar" ? "متبقي يوم واحد" : "1 day left";
          } else if (diffDays === 2) {
            badgeText = lang === "ar" ? "متبقي يومان" : "2 days left";
          } else if (diffDays >= 3 && diffDays <= 10) {
            badgeText = lang === "ar" ? `متبقي ${diffDays} أيام` : `${diffDays} days left`;
          } else {
            badgeText = lang === "ar" ? `متبقي ${diffDays} يوم` : `${diffDays} days left`;
          }
          if (isCritical && !isToday) {
            badgeText += lang === "ar" ? " (حرج)" : " (Critical)";
          }

          const badgeClass = isCritical ? "badge-danger" : "badge-warning";
          const borderStyle = isCritical
            ? "background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.35);"
            : "background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.35);";

          const typeName = typeMap[a.assetTypeId] || "";
          const deptName = deptMap[a.departmentId] || "";
          const locName = locMap[a.locationId] || "";
          const empName = empMap[a.currentEmployeeId] || "";

          wHtml += `
            <div class="d-flex justify-between items-center p-3 rounded border" style="${borderStyle} flex-wrap: wrap; gap: 12px; transition: all 0.2s ease;">
              <div class="d-flex items-center gap-3" style="flex: 1; min-width: 260px;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: ${isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <i class="fas ${isCritical ? 'fa-exclamation-triangle text-danger' : 'fa-hourglass-half text-warning'}" style="font-size: 18px;"></i>
                </div>
                <div>
                  <div class="d-flex items-center gap-2 flex-wrap">
                    <strong class="text-sm font-bold" style="cursor: pointer; color: var(--text-primary);" onclick="AssetManager.openDetailsModal('${a.id}')" title="${lang === 'ar' ? 'عرض تفاصيل الأصل' : 'View asset details'}">${a.assetId}</strong>
                    <span class="text-xs text-muted">&bull;</span>
                    <span class="text-xs font-bold">${a.brand || ""} ${a.model || ""}</span>
                    ${typeName ? `<span class="badge badge-secondary text-xs">${typeName}</span>` : ""}
                    <span class="badge ${badgeClass} text-xs font-bold"><i class="fas ${isCritical ? 'fa-fire' : 'fa-clock'}"></i> ${badgeText}</span>
                  </div>
                  <div class="text-xs text-muted d-flex items-center gap-3 flex-wrap mt-1">
                    <span><i class="far fa-calendar-alt text-warning"></i> <strong>${lang === 'ar' ? 'تاريخ الانتهاء:' : 'Expiry Date:'}</strong> ${a.warrantyExpiry}</span>
                    ${a.serial ? `<span><i class="fas fa-barcode"></i> S/N: <code>${a.serial}</code></span>` : ""}
                    ${locName ? `<span><i class="fas fa-map-marker-alt"></i> ${locName}</span>` : ""}
                    ${deptName ? `<span><i class="fas fa-building"></i> ${deptName}</span>` : ""}
                    ${empName ? `<span><i class="fas fa-user"></i> ${empName}</span>` : ""}
                    ${a.supplier ? `<span><i class="fas fa-truck"></i> ${a.supplier}</span>` : ""}
                  </div>
                </div>
              </div>
              <div class="d-flex items-center gap-2" style="flex-shrink: 0;">
                <button type="button" class="btn btn-primary btn-xs" onclick="AssetManager.openDetailsModal('${a.id}')" title="${lang === 'ar' ? 'عرض تفاصيل الأصل' : 'View asset details'}">
                  <i class="fas fa-eye"></i> <span>${lang === 'ar' ? 'التفاصيل' : 'Details'}</span>
                </button>
                <button type="button" class="btn btn-secondary btn-xs" onclick="AssetManager.openActivityTimeline('${a.id}')" title="${lang === 'ar' ? 'سجل الأنشطة والعمليات' : 'Activity timeline'}">
                  <i class="fas fa-stream"></i> <span>${lang === 'ar' ? 'السجل الزمني' : 'Timeline'}</span>
                </button>
              </div>
            </div>
          `;
        });
        warrantyAlertsBox.innerHTML = wHtml;
      }
    }

    // Set Operational Status Indicators
    setElem("dashCountTotal", countTotal);
    setElem("dashCountAssigned", countAssigned);
    setElem("dashCountAvailable", countAvailable);
    setElem("dashCountInStore", countInStore);
    setElem("dashCountPendingInstall", countInTransit);
    setElem("dashCountMaintenance", countMaintenance);
    setElem("dashCountDamaged", countDamaged);
    setElem("dashCountLost", countLost);
    setElem("dashCountRetired", countRetired);
    setElem("dashCountDisposed", countDisposed);

    // 2. Summary by Asset Type
    const typeBox = document.getElementById("dashSummaryByType");
    if (typeBox) {
      if (assetTypes.length === 0 || countTotal === 0) {
        typeBox.innerHTML = `<div class="text-muted text-center py-3">${I18N[lang].noAssetsFound || "لا توجد أصول مسجلة"}</div>`;
      } else {
        let html = `<div class="summary-list">`;
        assetTypes.forEach(t => {
          const c = typeCountMap[t.id] || 0;
          if (c > 0) {
            const pct = Math.round((c / countTotal) * 100);
            html += `
              <div class="summary-item mb-2" style="cursor: pointer;" onclick="AssetManager.filterAndSwitch('${t.id}', '')" title="${lang === 'ar' ? 'تصفية الأصول حسب هذا النوع' : 'Filter assets by this type'}">
                <div class="d-flex justify-between text-sm mb-1">
                  <span><strong>${lang === 'ar' ? t.nameAr : (t.nameEn || t.nameAr)}</strong></span>
                  <span class="font-bold">${c} (${pct}%)</span>
                </div>
                <div class="progress-bar-bg" style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: var(--accent-cyan); border-radius: 4px;"></div>
                </div>
              </div>
            `;
          }
        });
        html += `</div>`;
        typeBox.innerHTML = html;
      }
    }

    // 3. Summary by Department
    const deptBox = document.getElementById("dashSummaryByDept");
    if (deptBox) {
      if (departments.length === 0 || countTotal === 0) {
        deptBox.innerHTML = `<div class="text-muted text-center py-3">${I18N[lang].noAssetsFound || "لا توجد أصول مسجلة"}</div>`;
      } else {
        let html = `<div class="summary-list">`;
        departments.forEach(d => {
          const c = deptCountMap[d.id] || 0;
          if (c > 0) {
            const pct = Math.round((c / countTotal) * 100);
            html += `
              <div class="summary-item mb-2" style="cursor: pointer;" onclick="AssetManager.filterByDeptAndSwitch('${d.id}')" title="${lang === 'ar' ? 'عرض الأصول التابعة لهذا القسم' : 'View assets for this department'}">
                <div class="d-flex justify-between text-sm mb-1">
                  <span><i class="fas fa-building text-primary"></i> ${lang === 'ar' ? d.nameAr : (d.nameEn || d.nameAr)}</span>
                  <span class="font-bold">${c} (${pct}%)</span>
                </div>
                <div class="progress-bar-bg" style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: var(--accent-emerald); border-radius: 4px;"></div>
                </div>
              </div>
            `;
          }
        });
        html += `</div>`;
        deptBox.innerHTML = html;
      }
    }

    // 4. Summary by Location
    const locBox = document.getElementById("dashSummaryByLoc");
    if (locBox) {
      if (locations.length === 0 || countTotal === 0) {
        locBox.innerHTML = `<div class="text-muted text-center py-3">${I18N[lang].noAssetsFound || "لا توجد أصول مسجلة"}</div>`;
      } else {
        let html = `<div class="summary-list">`;
        locations.forEach(l => {
          const c = locCountMap[l.id] || 0;
          if (c > 0) {
            const pct = Math.round((c / countTotal) * 100);
            html += `
              <div class="summary-item mb-2" style="cursor: pointer;" onclick="AssetManager.filterByLocAndSwitch('${l.id}')" title="${lang === 'ar' ? 'عرض الأجهزة المتواجدة بهذا الموقع' : 'View assets at this location'}">
                <div class="d-flex justify-between text-sm mb-1">
                  <span><i class="fas fa-map-marker-alt text-warning"></i> ${lang === 'ar' ? l.nameAr : (l.nameEn || l.nameAr)}</span>
                  <span class="font-bold">${c} (${pct}%)</span>
                </div>
                <div class="progress-bar-bg" style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: var(--accent-amber); border-radius: 4px;"></div>
                </div>
              </div>
            `;
          }
        });
        html += `</div>`;
        locBox.innerHTML = html;
      }
    }
  }

  filterActiveMaintenanceAndSwitch() {
    this.switchTab('maintenance');
    const filterSelect = document.getElementById("maintFilterStatus");
    if (filterSelect) {
      filterSelect.value = "Active";
    }
    if (window.MaintManager) {
      MaintManager.render();
    }
  }

  openWarrantyReport() {
    this.switchTab('reports');
    const select = document.getElementById('reportSelect');
    if (select) {
      select.value = 'warranty';
      this.handleReportTypeChange();
    }
    this.generateSelectedReport();
  }

  // =========================================================================
  // 3. TOP SEARCH & FAST LOOKUP
  // =========================================================================
  async handleHeaderSearch(query) {
    const dropdown = document.getElementById("headerSearchResults");
    if (!dropdown) return;

    if (!query) {
      dropdown.style.display = "none";
      return;
    }

    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const lang = AppState.lang;

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));

    const q = query.toLowerCase();

    // Exact match for Asset ID (e.g. AST-000001)
    const exactAsset = assets.find(a => a.assetId && a.assetId.toLowerCase() === q);

    const matches = assets.filter(a => {
      const empName = (empMap[a.currentEmployeeId] || "").toLowerCase();
      const deptName = (deptMap[a.departmentId] || "").toLowerCase();
      const locName = (locMap[a.locationId] || "").toLowerCase();
      const barcodeVal = (a.barcodeValue || "").toLowerCase();
      const qrVal = (a.qrCodeValue || "").toLowerCase();
      return (
        (a.assetId && a.assetId.toLowerCase().includes(q)) ||
        barcodeVal.includes(q) ||
        qrVal.includes(q) ||
        (a.serial && a.serial.toLowerCase().includes(q)) ||
        (a.brand && a.brand.toLowerCase().includes(q)) ||
        (a.model && a.model.toLowerCase().includes(q)) ||
        (a.computerName && a.computerName.toLowerCase().includes(q)) ||
        (a.ip && a.ip.includes(q)) ||
        empName.includes(q) ||
        deptName.includes(q) ||
        locName.includes(q)
      );
    }).slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="search-result-item text-muted text-center py-3">${lang === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results'}</div>`;
      dropdown.style.display = "block";
      return;
    }

    let html = "";
    matches.forEach(a => {
      const empName = empMap[a.currentEmployeeId] || (lang === 'ar' ? 'غير مسند' : 'Unassigned');
      const deptName = deptMap[a.departmentId] || "";
      const isBarcodeMatch = a.barcodeValue && a.barcodeValue.toLowerCase().includes(q);
      const isQrMatch = a.qrCodeValue && a.qrCodeValue.toLowerCase().includes(q);

      html += `
        <div class="search-result-item" onclick="App.selectSearchResult('${a.id}')">
          <div class="d-flex justify-between items-center">
            <strong>${a.assetId} - ${a.brand || ''} ${a.model || ''}</strong>
            <span class="badge ${AssetManager.getStatusBadgeClass(a.status)}">${AssetManager.formatStatus(a.status)}</span>
          </div>
          <div class="text-xs text-muted mt-1" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
            <span>${lang === 'ar' ? 'سيريال:' : 'Serial:'} <code>${a.serial || '-'}</code></span>
            ${a.barcodeValue ? `&bull; <span>${lang === 'ar' ? 'باركود:' : 'Barcode:'} <code style="color: var(--sdi-blue);">${a.barcodeValue}</code></span>` : ''}
            ${a.qrCodeValue && a.qrCodeValue !== a.assetId ? `&bull; <span>QR: <code style="color: var(--sdi-orange);">${a.qrCodeValue}</code></span>` : ''}
            &bull; <span>${lang === 'ar' ? 'الموظف:' : 'Employee:'} <strong>${empName}</strong></span>
            &bull; <span>${deptName}</span>
          </div>
        </div>
      `;
    });

    dropdown.innerHTML = html;
    dropdown.style.display = "block";
  }

  selectSearchResult(assetId) {
    const dropdown = document.getElementById("headerSearchResults");
    if (dropdown) dropdown.style.display = "none";
    document.getElementById("headerQuickSearch").value = "";
    this.openAssetQuickView(assetId);
  }

  // REQ-19: Asset Quick View Modal
  async openAssetQuickView(assetId) {
    const asset = await db.getById("assets", assetId);
    if (!asset) return;

    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const assetTypes = await db.getAll("assetTypes");
    const lang = AppState.lang;

    const emp = employees.find(e => e.id === asset.currentEmployeeId);
    const dept = departments.find(d => d.id === asset.departmentId);
    const loc = locations.find(l => l.id === asset.locationId);
    const type = assetTypes.find(t => t.id === asset.assetTypeId);

    const empName = emp ? (lang === 'ar' ? emp.nameAr : (emp.nameEn || emp.nameAr)) : (lang === 'ar' ? 'غير مسند' : 'Unassigned');
    const deptName = dept ? (lang === 'ar' ? dept.nameAr : (dept.nameEn || dept.nameAr)) : '-';
    const locName = loc ? (lang === 'ar' ? loc.nameAr : (loc.nameEn || loc.nameAr)) : '-';
    const typeName = type ? (lang === 'ar' ? type.nameAr : (type.nameEn || type.nameAr)) : '-';

    const qvAssetId = document.getElementById("qvAssetId");
    if (qvAssetId) qvAssetId.textContent = asset.assetId;
    const qvType = document.getElementById("qvType");
    if (qvType) qvType.textContent = typeName;
    const qvBrand = document.getElementById("qvBrand");
    if (qvBrand) qvBrand.textContent = asset.brand || '-';
    const qvModel = document.getElementById("qvModel");
    if (qvModel) qvModel.textContent = asset.model || '-';
    const qvSerial = document.getElementById("qvSerial");
    if (qvSerial) qvSerial.textContent = asset.serial || '-';
    const qvEmp = document.getElementById("qvEmployee");
    if (qvEmp) qvEmp.textContent = empName;
    const qvDept = document.getElementById("qvDepartment");
    if (qvDept) qvDept.textContent = deptName;
    const qvLoc = document.getElementById("qvLocation");
    if (qvLoc) qvLoc.textContent = locName;

    const statusBadge = document.getElementById("qvStatus");
    if (statusBadge) {
      statusBadge.className = `badge ${AssetManager.getStatusBadgeClass(asset.status)}`;
      statusBadge.textContent = AssetManager.formatStatus(asset.status);
    }

    const fullBtn = document.getElementById("qvFullDetailsBtn");
    if (fullBtn) {
      fullBtn.onclick = () => {
        App.closeModal("assetQuickViewModal");
        AssetManager.openDetailsModal(asset.id);
      };
    }

    this.openModal("assetQuickViewModal");
  }

  // =========================================================================
  // BRANDING & LOGO CONTROLLER
  // =========================================================================
  async applyBranding() {
    try {
      const settings = await db.getSystemSettings();
      const logoUrl = settings.logoDataUrl || "";
      const isAr = AppState.lang === "ar";
      let orgName = "";
      let subName = "";
      if (isAr) {
        orgName = settings.systemNameAr || settings.orgNameAr || "معهد الشارقة للسياقة";
        subName = settings.systemNameEn || settings.orgNameEn || "SDI IT Asset Hub";
      } else {
        orgName = settings.systemNameEn || settings.orgNameEn || "SDI IT Asset Hub";
        subName = settings.orgNameEn || "Sharjah Driving Institute";
      }

      // Document Title
      document.title = `${orgName} - ${subName}`;

      // 1. Sidebar Logo & Titles
      const sidebarLogoImg = document.getElementById("sidebarLogoImg");
      const sidebarLogoFallback = document.getElementById("sidebarLogoFallback");
      const sidebarOrg = document.getElementById("sidebarOrgName");
      const sidebarSub = document.getElementById("sidebarSystemName");
      if (sidebarLogoImg && sidebarLogoFallback) {
        if (logoUrl) {
          sidebarLogoImg.src = logoUrl;
          sidebarLogoImg.style.display = "block";
          sidebarLogoFallback.style.display = "none";
        } else {
          sidebarLogoImg.src = "";
          sidebarLogoImg.style.display = "none";
          sidebarLogoFallback.style.display = "block";
        }
      }
      if (sidebarOrg) sidebarOrg.textContent = orgName;
      if (sidebarSub) sidebarSub.textContent = subName;

      // 2. Header Logo
      const headerLogoImg = document.getElementById("headerLogoImg");
      if (headerLogoImg) {
        if (logoUrl) {
          headerLogoImg.src = logoUrl;
          headerLogoImg.style.display = "block";
        } else {
          headerLogoImg.src = "";
          headerLogoImg.style.display = "none";
        }
      }

      // 3. Login Modal Logo & Titles
      const loginLogoImg = document.getElementById("loginLogoImg");
      const loginLogoFallback = document.getElementById("loginLogoFallback");
      const loginSubTitle = document.getElementById("loginSubTitle");
      if (loginLogoImg && loginLogoFallback) {
        if (logoUrl) {
          loginLogoImg.src = logoUrl;
          loginLogoImg.style.display = "block";
          loginLogoFallback.style.display = "none";
        } else {
          loginLogoImg.src = "";
          loginLogoImg.style.display = "none";
          loginLogoFallback.style.display = "block";
        }
      }
      if (loginSubTitle) loginSubTitle.textContent = subName;

      // 4. Update preview in settings pane if open
      if (window.UserManager && typeof window.UserManager.updateBrandingPreviewUI === "function") {
        window.UserManager.updateBrandingPreviewUI(logoUrl);
      }
    } catch (e) {
      console.warn("applyBranding error:", e);
    }
  }

  // =========================================================================
  // MOBILE CAMERA BARCODE & QR SCANNER (UNIVERSAL CONTINUOUS DUAL ENGINE)
  // =========================================================================
  setScannerMode(mode) {
    this.scannerMode = mode || "all";
    const lang = AppState.lang;

    // Update active tab buttons
    ["all", "qr", "barcode"].forEach(m => {
      const btn = document.getElementById(`btnMode${m.charAt(0).toUpperCase() + m.slice(1)}`);
      if (btn) btn.classList.toggle("active", m === this.scannerMode);
    });

    // Update reticle appearance
    const reticle = document.getElementById("scannerReticle") || document.querySelector(".scanner-reticle");
    if (reticle) {
      reticle.classList.remove("mode-all", "mode-qr", "mode-barcode");
      reticle.classList.add(`mode-${this.scannerMode}`);
    }

    // Update status text prompt
    const statusText = document.getElementById("scannerStatusText");
    if (statusText) {
      if (this.scannerMode === "qr") {
        statusText.textContent = lang === "ar" ? "الكاميرا نشطة، وجّه العدسة نحو رمز QR المربع..." : "Camera active. Point at QR code...";
      } else if (this.scannerMode === "barcode") {
        statusText.textContent = lang === "ar" ? "الكاميرا نشطة، وجّه العدسة نحو الباركود الخطي العادي..." : "Camera active. Point at regular barcode...";
      } else {
        statusText.textContent = lang === "ar" ? "الكاميرا نشطة، وجّه العدسة نحو الباركود أو رمز QR..." : "Camera active. Point at barcode or QR code...";
      }
      statusText.style.color = "var(--text-muted)";
    }

    // Reconfigure detection instances if scanning is live
    if (this.isScanningActive) {
      this.initDetectorInstances();
    }
  }

  initDetectorInstances() {
    // 1. Hardware-Accelerated Native BarcodeDetector (Chrome Android, Edge, Chromium)
    if ("BarcodeDetector" in window) {
      try {
        let desiredFormats = [];
        if (this.scannerMode === "qr") {
          desiredFormats = ["qr_code", "data_matrix", "aztec"];
        } else if (this.scannerMode === "barcode") {
          desiredFormats = ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"];
        } else {
          desiredFormats = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "data_matrix", "itf", "codabar"];
        }
        this.nativeBarcodeDetector = new window.BarcodeDetector({ formats: desiredFormats });
      } catch (e) {
        try { this.nativeBarcodeDetector = new window.BarcodeDetector(); } catch (e2) {}
      }
    }

    // 2. ZXing Cross-Platform Software Decoders (iOS Safari, Firefox, Android, Desktop)
    if (window.ZXing) {
      try {
        const hints = new Map();
        hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);

        let formats = [];
        if (this.scannerMode === "qr") {
          formats = [window.ZXing.BarcodeFormat.QR_CODE, window.ZXing.BarcodeFormat.DATA_MATRIX];
        } else if (this.scannerMode === "barcode") {
          formats = [
            window.ZXing.BarcodeFormat.CODE_128,
            window.ZXing.BarcodeFormat.CODE_39,
            window.ZXing.BarcodeFormat.CODE_93,
            window.ZXing.BarcodeFormat.EAN_13,
            window.ZXing.BarcodeFormat.EAN_8,
            window.ZXing.BarcodeFormat.UPC_A,
            window.ZXing.BarcodeFormat.UPC_E,
            window.ZXing.BarcodeFormat.ITF,
            window.ZXing.BarcodeFormat.CODABAR
          ];
        } else {
          formats = [
            window.ZXing.BarcodeFormat.QR_CODE,
            window.ZXing.BarcodeFormat.CODE_128,
            window.ZXing.BarcodeFormat.CODE_39,
            window.ZXing.BarcodeFormat.CODE_93,
            window.ZXing.BarcodeFormat.EAN_13,
            window.ZXing.BarcodeFormat.EAN_8,
            window.ZXing.BarcodeFormat.UPC_A,
            window.ZXing.BarcodeFormat.UPC_E,
            window.ZXing.BarcodeFormat.DATA_MATRIX,
            window.ZXing.BarcodeFormat.ITF,
            window.ZXing.BarcodeFormat.CODABAR
          ];
        }
        hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);

        this.zxingMultiReader = new window.ZXing.BrowserMultiFormatReader(hints);

        if (window.ZXing.BrowserQRCodeReader && (this.scannerMode === "qr" || this.scannerMode === "all")) {
          this.zxingQrReader = new window.ZXing.BrowserQRCodeReader();
        }
        if (window.ZXing.BrowserBarcodeReader && (this.scannerMode === "barcode" || this.scannerMode === "all")) {
          this.zxingBarcodeReader = new window.ZXing.BrowserBarcodeReader();
        }
      } catch (err) {
        console.warn("ZXing detector instance init warning:", err);
      }
    }
  }

  async openScannerModal() {
    const modal = document.getElementById("scannerModal");
    if (!modal) return;

    this.openModal("scannerModal");

    const video = document.getElementById("scannerVideo");
    const notice = document.getElementById("scannerFallbackNotice");
    const statusText = document.getElementById("scannerStatusText");
    const manualInput = document.getElementById("scannerManualInput");
    const switchBtn = document.getElementById("btnSwitchCamera");
    const torchBtn = document.getElementById("btnToggleTorch");

    if (statusText) {
      statusText.textContent = AppState.lang === "ar" ? "جاري تشغيل الكاميرا..." : "Starting camera...";
      statusText.style.color = "var(--text-muted)";
    }
    if (notice) notice.style.display = "none";
    if (video) {
      video.style.display = "block";
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("muted", "true");
      video.setAttribute("autoplay", "true");
      video.muted = true;
      video.playsInline = true;
    }
    if (manualInput) {
      manualInput.value = "";
      setTimeout(() => {
        if (typeof manualInput.focus === "function") manualInput.focus();
      }, 200);
    }

    this.scannerMode = this.scannerMode || "all";
    this.isScanningActive = true;
    this.isProcessingDetection = false;
    this.torchActive = false;
    if (torchBtn) {
      torchBtn.classList.remove("active");
      torchBtn.style.display = "none";
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(AppState.lang === "ar" 
          ? "المتصفح أو الاتصال الحالي لا يدعم الوصول المباشر للكاميرا (يتطلب HTTPS أو localhost). يمكنك إدخال الرمز يدوياً."
          : "Camera access unavailable (requires HTTPS or localhost). Please enter code manually below.");
      }

      // Stop any existing stream
      if (this.scannerStream) {
        try {
          this.scannerStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        this.scannerStream = null;
      }

      // Enumerate available videoinput devices to support multi-camera smartphones
      let devices = [];
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (e) {
        console.warn("Device enumeration pre-permission warning:", e);
      }
      this.videoDevices = (devices || []).filter(d => d.kind === "videoinput");

      // Build video constraints optimized for mobile phones
      let videoConstraints = {};
      if (this.scannerCurrentDeviceId) {
        videoConstraints.deviceId = { exact: this.scannerCurrentDeviceId };
      } else {
        this.scannerCurrentFacingMode = this.scannerCurrentFacingMode || "environment";
        videoConstraints.facingMode = { ideal: this.scannerCurrentFacingMode };
      }

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      if (isMobile) {
        videoConstraints.width = { ideal: 1280, min: 480 };
        videoConstraints.height = { ideal: 720, min: 480 };
      } else {
        videoConstraints.width = { ideal: 1280 };
        videoConstraints.height = { ideal: 720 };
      }

      // Acquire stream with robust fallback sequence
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch (err1) {
        console.warn("Primary camera constraints failed, attempting fallback:", err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } }
          });
        } catch (err2) {
          console.warn("FacingMode fallback failed, attempting basic video:", err2);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      this.scannerStream = stream;

      // Enable continuous autofocus if supported by camera hardware
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.applyConstraints === "function") {
        try {
          const capabilities = (typeof videoTrack.getCapabilities === "function") ? videoTrack.getCapabilities() : {};
          const advanced = [];
          if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
            advanced.push({ focusMode: "continuous" });
          }
          if (advanced.length > 0) {
            await videoTrack.applyConstraints({ advanced });
          }
        } catch (e) {}
      }

      // Re-enumerate devices now that camera permission has been granted
      try {
        const freshDevices = await navigator.mediaDevices.enumerateDevices();
        this.videoDevices = freshDevices.filter(d => d.kind === "videoinput");
      } catch (e) {}

      if (switchBtn) {
        switchBtn.style.display = (this.videoDevices.length > 1 || isMobile) ? "inline-flex" : "none";
      }

      // Check for torch (flashlight) capability on mobile
      if (videoTrack && torchBtn) {
        try {
          const capabilities = (typeof videoTrack.getCapabilities === "function") ? videoTrack.getCapabilities() : {};
          if (capabilities.torch) {
            torchBtn.style.display = "inline-flex";
          }
        } catch (e) {}
      }

      // Attach stream to video element and ensure playback
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.playsInline = true;

        const playPromise = new Promise((resolve) => {
          let resolved = false;
          const onReady = async () => {
            if (resolved) return;
            try {
              await video.play();
              resolved = true;
              resolve();
            } catch (e) {
              console.warn("video.play() resolution notice:", e);
            }
          };
          video.onloadedmetadata = onReady;
          video.onloadeddata = onReady;
          video.oncanplay = onReady;
          setTimeout(onReady, 250);
          setTimeout(resolve, 800);
        });
        await playPromise;
      }

      this.setScannerMode(this.scannerMode || "all");
      this.startScannerDetectionLoop();
    } catch (err) {
      console.warn("Camera access failed:", err);
      if (video) video.style.display = "none";
      if (notice) {
        notice.style.display = "flex";
        const errMsg = document.getElementById("scannerErrorMessage");
        if (errMsg) errMsg.textContent = err.message || (AppState.lang === "ar" 
          ? "تعذر تشغيل الكاميرا. يرجى التأكد من الصلاحيات أو استخدام الإدخال اليدوي." 
          : "Camera unavailable. Check permissions or enter code manually.");
      }
      if (statusText) {
        statusText.textContent = AppState.lang === "ar" ? "الكاميرا غير متاحة، يرجى استخدام الإدخال اليدوي" : "Camera unavailable, please enter code manually";
        statusText.style.color = "var(--danger-color)";
      }
    }
  }

  closeScannerModal() {
    this.isScanningActive = false;
    this.isProcessingDetection = false;

    if (this.scannerAnimFrame) {
      cancelAnimationFrame(this.scannerAnimFrame);
      this.scannerAnimFrame = null;
    }
    if (this.scannerLoopTimer) {
      clearTimeout(this.scannerLoopTimer);
      this.scannerLoopTimer = null;
    }

    if (this.zxingMultiReader) {
      try { this.zxingMultiReader.reset(); } catch (e) {}
    }
    if (this.zxingQrReader) {
      try { this.zxingQrReader.reset(); } catch (e) {}
    }
    if (this.zxingBarcodeReader) {
      try { this.zxingBarcodeReader.reset(); } catch (e) {}
    }

    if (this.scannerStream) {
      try {
        this.scannerStream.getTracks().forEach(track => {
          if (this.torchActive) {
            try { track.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {}
          }
          track.stop();
        });
      } catch (e) {}
      this.scannerStream = null;
    }

    const video = document.getElementById("scannerVideo");
    if (video) {
      video.srcObject = null;
      video.removeAttribute("src");
    }

    const reticle = document.getElementById("scannerReticle") || document.querySelector(".scanner-reticle");
    if (reticle) reticle.classList.remove("detected");

    this.closeModal("scannerModal");
  }

  async switchCamera() {
    if (!this.videoDevices || this.videoDevices.length <= 1) {
      this.scannerCurrentFacingMode = (this.scannerCurrentFacingMode === "environment") ? "user" : "environment";
      this.scannerCurrentDeviceId = null;
    } else {
      const currentIndex = this.videoDevices.findIndex(d => d.deviceId === this.scannerCurrentDeviceId);
      const nextIndex = (currentIndex + 1) % this.videoDevices.length;
      this.scannerCurrentDeviceId = this.videoDevices[nextIndex].deviceId;
    }

    if (this.scannerStream) {
      try {
        this.scannerStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.scannerStream = null;
    }

    await this.openScannerModal();
  }

  async toggleTorch() {
    const track = this.scannerStream?.getVideoTracks()[0];
    if (!track) return;
    try {
      this.torchActive = !this.torchActive;
      await track.applyConstraints({
        advanced: [{ torch: this.torchActive }]
      });
      const torchBtn = document.getElementById("btnToggleTorch");
      if (torchBtn) {
        torchBtn.classList.toggle("active", this.torchActive);
      }
    } catch (e) {
      console.warn("Torch toggle not supported on this track:", e);
    }
  }

  startScannerDetectionLoop() {
    if (!this.isScanningActive) return;

    if (this.scannerAnimFrame) {
      cancelAnimationFrame(this.scannerAnimFrame);
      this.scannerAnimFrame = null;
    }
    if (this.scannerLoopTimer) {
      clearTimeout(this.scannerLoopTimer);
      this.scannerLoopTimer = null;
    }

    this.initDetectorInstances();

    // Prepare offscreen canvas for center crop & reticle zoom
    if (!this.scanCropCanvas) {
      this.scanCropCanvas = document.createElement("canvas");
      this.scanCropCtx = this.scanCropCanvas.getContext("2d", { willReadFrequently: true });
    }

    let isDecoding = false;

    const scanStep = async () => {
      if (!this.isScanningActive || this.isProcessingDetection) return;

      const video = document.getElementById("scannerVideo");
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        if (this.isScanningActive) {
          this.scannerAnimFrame = requestAnimationFrame(scanStep);
        }
        return;
      }

      if (!isDecoding) {
        isDecoding = true;
        let detected = null;

        // --- Tier 1: Hardware-Accelerated Native BarcodeDetector (Full Frame) ---
        if (this.nativeBarcodeDetector) {
          try {
            const results = await this.nativeBarcodeDetector.detect(video);
            if (results && results.length > 0 && results[0].rawValue) {
              detected = results[0].rawValue;
            }
          } catch (e) {}
        }

        // --- Tier 2: Universal ZXing Multi-Format Reader (Full Frame) ---
        if (!detected && this.zxingMultiReader) {
          try {
            const res = this.zxingMultiReader.decode(video);
            if (res) {
              const str = (typeof res.getText === "function") ? res.getText() : res.text;
              if (str && str.trim()) detected = str.trim();
            }
          } catch (e) {}
        }

        // --- Tier 3: Specialized QR / Barcode Readers if in specific mode ---
        if (!detected && this.scannerMode === "qr" && this.zxingQrReader) {
          try {
            const res = this.zxingQrReader.decode(video);
            if (res) {
              const str = (typeof res.getText === "function") ? res.getText() : res.text;
              if (str && str.trim()) detected = str.trim();
            }
          } catch (e) {}
        }
        if (!detected && this.scannerMode === "barcode" && this.zxingBarcodeReader) {
          try {
            const res = this.zxingBarcodeReader.decode(video);
            if (res) {
              const str = (typeof res.getText === "function") ? res.getText() : res.text;
              if (str && str.trim()) detected = str.trim();
            }
          } catch (e) {}
        }

        // --- Tier 4: Center-Crop Reticle Box (Zoomed on Barcode/QR sticker) ---
        if (!detected && this.scanCropCanvas && this.scanCropCtx) {
          try {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cropW = Math.round(vw * (this.scannerMode === "barcode" ? 0.75 : 0.60));
            const cropH = Math.round(vh * (this.scannerMode === "barcode" ? 0.45 : 0.60));
            const cropX = Math.round((vw - cropW) / 2);
            const cropY = Math.round((vh - cropH) / 2);

            this.scanCropCanvas.width = cropW;
            this.scanCropCanvas.height = cropH;
            this.scanCropCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            // 4a. Detect on cropped canvas with BarcodeDetector
            if (this.nativeBarcodeDetector) {
              try {
                const results = await this.nativeBarcodeDetector.detect(this.scanCropCanvas);
                if (results && results.length > 0 && results[0].rawValue) {
                  detected = results[0].rawValue;
                }
              } catch (e) {}
            }

            // 4b. Detect on cropped canvas with ZXing decodeBitmap
            if (!detected && window.ZXing && window.ZXing.HTMLCanvasElementLuminanceSource) {
              try {
                const lum = new window.ZXing.HTMLCanvasElementLuminanceSource(this.scanCropCanvas);
                const bin = new window.ZXing.HybridBinarizer(lum);
                const bmp = new window.ZXing.BinaryBitmap(bin);
                const res = this.zxingMultiReader.decodeBitmap(bmp);
                if (res) {
                  const str = (typeof res.getText === "function") ? res.getText() : res.text;
                  if (str && str.trim()) detected = str.trim();
                }
              } catch (e) {}
            }
          } catch (e) {}
        }

        if (detected && !this.isProcessingDetection && this.isScanningActive) {
          isDecoding = false;
          await this.handleBarcodeDetected(detected);
          return;
        }

        isDecoding = false;
      }

      if (this.isScanningActive && !this.isProcessingDetection) {
        this.scannerLoopTimer = setTimeout(() => {
          if (this.isScanningActive && !this.isProcessingDetection) {
            this.scannerAnimFrame = requestAnimationFrame(scanStep);
          }
        }, 50);
      }
    };

    this.scannerAnimFrame = requestAnimationFrame(scanStep);
  }

  async handleBarcodeDetected(rawCode) {
    if (!rawCode || this.isProcessingDetection) return;
    this.isProcessingDetection = true;

    let code = String(rawCode).trim();
    if (!code) {
      this.isProcessingDetection = false;
      return;
    }

    // Smart QR payload extraction: if code is a URL or JSON
    if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const parsed = new URL(code);
        const paramId = parsed.searchParams.get("assetId") || parsed.searchParams.get("id") || parsed.searchParams.get("code");
        if (paramId) {
          code = paramId.trim();
        } else {
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length > 0) code = parts[parts.length - 1].trim();
        }
      } catch (e) {}
    } else if (code.startsWith("{") && code.endsWith("}")) {
      try {
        const parsed = JSON.parse(code);
        code = (parsed.assetId || parsed.code || parsed.id || parsed.serial || code).trim();
      } catch (e) {}
    }

    const reticle = document.getElementById("scannerReticle") || document.querySelector(".scanner-reticle");
    if (reticle) reticle.classList.add("detected");

    // Audio & Haptic feedback on detection (native scanner feel)
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try { navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(920, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      }
    } catch (e) {}

    const assets = await db.getAll("assets");
    const codeLower = code.toLowerCase();

    // Priority matching:
    // 1. assetId (AST-000001, PC-00125, etc.)
    // 2. barcodeValue
    // 3. qrCodeValue
    // 4. serial
    // 5. id / assetTag
    let target = assets.find(a => a.assetId && a.assetId.toLowerCase() === codeLower);
    if (!target) {
      target = assets.find(a => a.barcodeValue && a.barcodeValue.toLowerCase() === codeLower);
    }
    if (!target) {
      target = assets.find(a => a.qrCodeValue && a.qrCodeValue.toLowerCase() === codeLower);
    }
    if (!target) {
      target = assets.find(a => a.serial && a.serial.toLowerCase() === codeLower);
    }
    if (!target) {
      target = assets.find(a => (a.id && String(a.id).toLowerCase() === codeLower) || (a.assetTag && a.assetTag.toLowerCase() === codeLower));
    }

    if (target) {
      this.closeScannerModal();
      this.showToast(
        AppState.lang === "ar" ? `تم مسح الرمز والتعرف على الأصل: ${target.assetId} (${target.brand} ${target.model})` : `Found Asset: ${target.assetId} (${target.brand} ${target.model})`,
        "success"
      );
      await AssetManager.openDetailsModal(target.id);
    } else {
      const statusText = document.getElementById("scannerStatusText");
      if (statusText) {
        statusText.textContent = AppState.lang === "ar"
          ? `تم قراءة الرمز: "${code}" ولكن لم يتم العثور على أصل مطابق`
          : `Read code: "${code}" but no matching asset found`;
        statusText.style.color = "var(--danger-color)";
      }
      this.showToast(
        AppState.lang === "ar" ? `تم قراءة: ${code} - لا يوجد أصل مسجل بهذا الرمز` : `Scanned: ${code} - No asset found`,
        "warning"
      );
      setTimeout(() => {
        if (reticle) reticle.classList.remove("detected");
        if (this.isScanningActive) {
          this.isProcessingDetection = false;
          this.setScannerMode(this.scannerMode || "all");
        }
      }, 2000);
    }
  }

  async handleManualScanSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("scannerManualInput");
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    await this.handleBarcodeDetected(val);
  }

  // =========================================================================
  // 4. REPORTS GENERATOR (8 Full Reports + Dynamic Filters + PDF + CSV)
  // =========================================================================
  async handleReportTypeChange() {
    await this.populateReportDropdowns();
    await this.generateSelectedReport();
  }

  async populateReportDropdowns() {
    const lang = AppState.lang;
    const types = await db.getAll("assetTypes");
    const depts = await db.getAll("departments");
    const locs = await db.getAll("locations");
    const emps = await db.getAll("employees");

    // 1. Asset Types Filter
    const typeSelect = document.getElementById("reportFilterType");
    if (typeSelect) {
      const curVal = typeSelect.value;
      typeSelect.innerHTML = `<option value="" data-i18n="filterAllTypes">${I18N[lang].filterAllTypes || "جميع الأنواع"}</option>` +
        types.map(t => `<option value="${t.id}">${lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)}</option>`).join("");
      if (curVal) typeSelect.value = curVal;
    }

    // 2. Departments Filter
    const deptSelect = document.getElementById("reportFilterDept");
    if (deptSelect) {
      const curVal = deptSelect.value;
      deptSelect.innerHTML = `<option value="" data-i18n="filterAllDepts">${I18N[lang].filterAllDepts || "جميع الأقسام"}</option>` +
        depts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
      if (curVal) deptSelect.value = curVal;
    }

    // 3. Locations Filter
    const locSelect = document.getElementById("reportFilterLoc");
    if (locSelect) {
      const curVal = locSelect.value;
      locSelect.innerHTML = `<option value="" data-i18n="filterAllLocs">${I18N[lang].filterAllLocs || "جميع المواقع"}</option>` +
        locs.map(l => `<option value="${l.id}">${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)}</option>`).join("");
      if (curVal) locSelect.value = curVal;
    }

    // 4. Employees Filter
    const empSelect = document.getElementById("reportFilterEmp");
    if (empSelect) {
      const curVal = empSelect.value;
      empSelect.innerHTML = `<option value="" data-i18n="filterAllEmps">${I18N[lang].filterAllEmps || "جميع الموظفين"}</option>` +
        emps.map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)} (${e.employeeNumber})</option>`).join("");
      if (curVal) empSelect.value = curVal;
    }
  }

  async resetReportFilters() {
    const searchInp = document.getElementById("reportSearchInput");
    const typeSel = document.getElementById("reportFilterType");
    const statusSel = document.getElementById("reportFilterStatus");
    const deptSel = document.getElementById("reportFilterDept");
    const locSel = document.getElementById("reportFilterLoc");
    const empSel = document.getElementById("reportFilterEmp");
    const dateFrom = document.getElementById("reportFilterDateFrom");
    const dateTo = document.getElementById("reportFilterDateTo");

    if (searchInp) searchInp.value = "";
    if (typeSel) typeSel.value = "";
    if (statusSel) statusSel.value = "";
    if (deptSel) deptSel.value = "";
    if (locSel) locSel.value = "";
    if (empSel) empSel.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";

    await this.generateSelectedReport();
  }

  async generateSelectedReport() {
    const reportArea = document.getElementById("printableReportArea");
    if (!reportArea) return;

    let reportType = document.getElementById("reportSelect") ? document.getElementById("reportSelect").value : "inventory";
    if (reportType === "allAssets") reportType = "inventory";

    const assets = await db.getAll("assets");
    const employees = await db.getAll("employees");
    const departments = await db.getAll("departments");
    const locations = await db.getAll("locations");
    const types = await db.getAll("assetTypes");
    const maintenance = await db.getAll("maintenance");
    const transactions = await db.getAll("assetTransactions");
    const lang = AppState.lang;

    const empMap = Object.fromEntries(employees.map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries(locations.map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)]));

    let title = "";
    let tableHeader = "";
    let rowsHtml = "";
    let totalsHtml = "";

    // Get Active Filter Values
    const searchVal = (document.getElementById("reportSearchInput")?.value || "").trim().toLowerCase();
    const filterType = document.getElementById("reportFilterType")?.value || "";
    const filterStatus = document.getElementById("reportFilterStatus")?.value || "";
    const filterDept = document.getElementById("reportFilterDept")?.value || "";
    const filterLoc = document.getElementById("reportFilterLoc")?.value || "";
    const filterEmp = document.getElementById("reportFilterEmp")?.value || "";
    const dateFrom = document.getElementById("reportFilterDateFrom")?.value || "";
    const dateTo = document.getElementById("reportFilterDateTo")?.value || "";

    // Build Active Filter Badges
    const activeFiltersList = [];
    if (searchVal) activeFiltersList.push(`${I18N[lang].search || "بحث"}: "${searchVal}"`);
    if (filterType) activeFiltersList.push(`${I18N[lang].assetType || "النوع"}: ${typeMap[filterType] || filterType}`);
    if (filterStatus) activeFiltersList.push(`${I18N[lang].status || "الحالة"}: ${AssetManager.formatStatus(filterStatus)}`);
    if (filterDept) activeFiltersList.push(`${I18N[lang].department || "القسم"}: ${deptMap[filterDept] || filterDept}`);
    if (filterLoc) activeFiltersList.push(`${I18N[lang].location || "الموقع"}: ${locMap[filterLoc] || filterLoc}`);
    if (filterEmp) activeFiltersList.push(`${I18N[lang].employee || "الموظف"}: ${empMap[filterEmp] || filterEmp}`);
    if (dateFrom) activeFiltersList.push(`${I18N[lang].filterDateFrom || "من"}: ${dateFrom}`);
    if (dateTo) activeFiltersList.push(`${I18N[lang].filterDateTo || "إلى"}: ${dateTo}`);

    // Helper filter function for assets
    const filterAssetList = (list) => {
      return list.filter(a => {
        if (filterType && a.assetTypeId !== filterType) return false;
        if (filterStatus && a.status !== filterStatus) return false;
        if (filterDept && a.departmentId !== filterDept) return false;
        if (filterLoc && a.locationId !== filterLoc) return false;
        if (filterEmp && a.currentEmployeeId !== filterEmp) return false;
        if (dateFrom && a.purchaseDate && a.purchaseDate < dateFrom) return false;
        if (dateTo && a.purchaseDate && a.purchaseDate > dateTo) return false;
        if (searchVal) {
          const match = (a.assetId || "").toLowerCase().includes(searchVal) ||
            (a.serial || "").toLowerCase().includes(searchVal) ||
            (a.brand || "").toLowerCase().includes(searchVal) ||
            (a.model || "").toLowerCase().includes(searchVal) ||
            (a.barcodeValue || "").toLowerCase().includes(searchVal) ||
            (a.qrCodeValue || "").toLowerCase().includes(searchVal) ||
            (empMap[a.currentEmployeeId] || "").toLowerCase().includes(searchVal) ||
            (deptMap[a.departmentId] || "").toLowerCase().includes(searchVal) ||
            (locMap[a.locationId] || "").toLowerCase().includes(searchVal);
          if (!match) return false;
        }
        return true;
      });
    };

    // -------------------------------------------------------------
    // 1. Inventory Report (تقرير جرد الأصول - 15 Fields)
    // -------------------------------------------------------------
    if (reportType === "inventory") {
      title = lang === "ar" ? "تقرير جرد الأصول" : "Asset Inventory Report";
      tableHeader = `
        <tr>
          <th>Asset ID</th>
          <th>${I18N[lang].assetType || "النوع"}</th>
          <th>${I18N[lang].brand || "الشركة"}</th>
          <th class="col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th>${I18N[lang].serialNumber || "السيريال"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th>${I18N[lang].department || "القسم"}</th>
          <th>${I18N[lang].location || "الموقع"}</th>
          <th>${I18N[lang].assignedEmployee || "الموظف / العهدة"}</th>
          <th>${I18N[lang].purchaseDate || "تاريخ الشراء"}</th>
          <th>${I18N[lang].warrantyExpiry || "انتهاء الضمان"}</th>
          <th>${I18N[lang].purchaseCost || "تكلفة الشراء (AED)"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      const filtered = filterAssetList(assets);
      const totalCost = filtered.reduce((acc, a) => acc + (parseFloat(a.purchaseCost) || 0), 0);

      rowsHtml = filtered.map(a => `
        <tr>
          <td><strong>${a.assetId}</strong></td>
          <td>${typeMap[a.assetTypeId] || "-"}</td>
          <td>${a.brand || "-"}</td>
          <td class="col-report-model">${a.model || "-"}</td>
          <td><code>${a.serial || "-"}</code></td>
          <td><span class="badge ${AssetManager.getStatusBadgeClass(a.status)}">${AssetManager.formatStatus(a.status)}</span></td>
          <td>${deptMap[a.departmentId] || "-"}</td>
          <td>${locMap[a.locationId] || "-"}</td>
          <td>${empMap[a.currentEmployeeId] || (lang === "ar" ? "غير مسند" : "Unassigned")}</td>
          <td>${a.purchaseDate || "-"}</td>
          <td>${a.warrantyExpiry || "-"}</td>
          <td><strong>${a.purchaseCost ? parseFloat(a.purchaseCost).toLocaleString() : "0"}</strong></td>
          <td class="col-report-notes">${a.notes || "-"}</td>
        </tr>
      `).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي الأصول المسجلة' : 'Total Assets'}:</span> <strong>${filtered.length}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي تكلفة الشراء' : 'Total Purchase Cost'}:</span> <strong class="text-primary">${totalCost.toLocaleString()} AED</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 2. Assets by Department (تقرير الأصول حسب الإدارة - Summary & Details)
    // -------------------------------------------------------------
    } else if (reportType === "byDept") {
      title = lang === "ar" ? "تقرير الأصول وتوزيعها حسب الإدارات والأقسام" : "Assets by Department Report";
      tableHeader = `
        <tr>
          <th>${I18N[lang].department || "اسم الإدارة"}</th>
          <th>${I18N[lang].thDeviceCount || "عدد الأجهزة"}</th>
          <th>${I18N[lang].deviceTypesBreakdown || "أنواع الأجهزة"}</th>
          <th>${I18N[lang].thAssignedCount || "الأجهزة المسندة"}</th>
          <th>${I18N[lang].thAvailableCount || "الأجهزة المتوفرة"}</th>
          <th>${I18N[lang].thUnderMaintCount || "تحت الصيانة"}</th>
          <th>${I18N[lang].valuation || "إجمالي القيمة (AED)"}</th>
        </tr>
      `;

      const filtered = filterAssetList(assets);
      const activeDepts = departments.filter(d => filterDept ? d.id === filterDept : true);

      let totalDevices = 0;
      let totalAssigned = 0;
      let totalAvailable = 0;
      let totalMaint = 0;
      let totalDeptValue = 0;

      rowsHtml = activeDepts.map(d => {
        const deptAssets = filtered.filter(a => a.departmentId === d.id);
        const count = deptAssets.length;
        if (count === 0 && filterDept) return "";

        totalDevices += count;
        const assigned = deptAssets.filter(a => a.status === "Assigned").length;
        const available = deptAssets.filter(a => a.status === "Available").length;
        const maint = deptAssets.filter(a => a.status === "Under Maintenance").length;
        const value = deptAssets.reduce((sum, a) => sum + (parseFloat(a.purchaseCost) || 0), 0);

        totalAssigned += assigned;
        totalAvailable += available;
        totalMaint += maint;
        totalDeptValue += value;

        const typeCounts = {};
        deptAssets.forEach(a => {
          const tName = typeMap[a.assetTypeId] || (lang === "ar" ? "أخرى" : "Other");
          typeCounts[tName] = (typeCounts[tName] || 0) + 1;
        });
        const typesStr = Object.entries(typeCounts).map(([k, v]) => `${k} (${v})`).join(", ") || "-";
        const deptName = lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr);

        return `
          <tr>
            <td><strong><i class="fas fa-building text-primary"></i> ${deptName}</strong></td>
            <td><strong>${count}</strong></td>
            <td style="font-size: 11px;">${typesStr}</td>
            <td><span class="badge badge-success">${assigned}</span></td>
            <td><span class="badge badge-primary">${available}</span></td>
            <td><span class="badge badge-danger">${maint}</span></td>
            <td><strong>${value.toLocaleString()}</strong></td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي الأقسام' : 'Departments'}:</span> <strong>${activeDepts.length}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي الأجهزة' : 'Total Devices'}:</span> <strong>${totalDevices}</strong></div>
          <div><span>${lang === 'ar' ? 'الأجهزة المسندة' : 'Assigned'}:</span> <strong class="text-success">${totalAssigned}</strong></div>
          <div><span>${lang === 'ar' ? 'الأجهزة المتوفرة' : 'Available'}:</span> <strong class="text-primary">${totalAvailable}</strong></div>
          <div><span>${lang === 'ar' ? 'تحت الصيانة' : 'Under Maintenance'}:</span> <strong class="text-danger">${totalMaint}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي القيمة' : 'Total Value'}:</span> <strong class="text-primary">${totalDeptValue.toLocaleString()} AED</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 3. Assets by Employee (تقرير العهد حسب الموظف)
    // -------------------------------------------------------------
    } else if (reportType === "byEmp") {
      title = lang === "ar" ? "تقرير الأصول والعهد المسندة حسب الموظف" : "Assets by Employee Custody Report";
      tableHeader = `
        <tr>
          <th>${I18N[lang].employee || "اسم الموظف"}</th>
          <th>${lang === 'ar' ? 'الرقم الوظيفي' : 'Employee Number'}</th>
          <th>${lang === 'ar' ? 'عدد العهد' : 'Custody Count'}</th>
          <th>Asset ID</th>
          <th>${I18N[lang].assetType || "نوع الجهاز"}</th>
          <th class="col-report-model">${I18N[lang].brand || "الشركة"} & ${I18N[lang].model || "الموديل"}</th>
          <th>${I18N[lang].serialNumber || "الرقم التسلسلي"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th>${I18N[lang].thCustodyDate || "تاريخ الاستلام"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      let filtered = filterAssetList(assets).filter(a => a.currentEmployeeId);
      filtered.sort((a, b) => (empMap[a.currentEmployeeId] || "").localeCompare(empMap[b.currentEmployeeId] || ""));

      const empCustodyCount = {};
      filtered.forEach(a => {
        empCustodyCount[a.currentEmployeeId] = (empCustodyCount[a.currentEmployeeId] || 0) + 1;
      });

      const empObjMap = Object.fromEntries(employees.map(e => [e.id, e]));
      const empsCount = Object.keys(empCustodyCount).length;

      rowsHtml = filtered.map(a => {
        const emp = empObjMap[a.currentEmployeeId];
        const empName = emp ? (lang === "ar" ? emp.nameAr : (emp.nameEn || emp.nameAr)) : "-";
        const empNumber = emp ? (emp.employeeNumber || "-") : "-";
        const totalEmpAssets = empCustodyCount[a.currentEmployeeId] || 1;
        const receiptDate = a.assignedDate || a.purchaseDate || "-";

        return `
          <tr>
            <td><strong><i class="fas fa-user-tie text-primary"></i> ${empName}</strong></td>
            <td><code>${empNumber}</code></td>
            <td><span class="badge badge-secondary">${totalEmpAssets}</span></td>
            <td><strong>${a.assetId}</strong></td>
            <td>${typeMap[a.assetTypeId] || "-"}</td>
            <td class="col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td><code>${a.serial || "-"}</code></td>
            <td><span class="badge ${AssetManager.getStatusBadgeClass(a.status)}">${AssetManager.formatStatus(a.status)}</span></td>
            <td>${receiptDate}</td>
            <td class="col-report-notes">${a.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'عدد الموظفين المستلمين' : 'Employees with Custody'}:</span> <strong>${empsCount}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي الأجهزة المسندة (العهد)' : 'Total Assigned Assets'}:</span> <strong class="text-success">${filtered.length}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 4. Assets by Location (تقرير الأصول حسب الموقع - Integration with Locations Tree)
    // -------------------------------------------------------------
    } else if (reportType === "byLoc") {
      title = lang === "ar" ? "تقرير الأصول وتوزيعها حسب المواقع والفروع" : "Assets by Location Report";
      tableHeader = `
        <tr>
          <th>${I18N[lang].location || "الموقع"}</th>
          <th>${lang === 'ar' ? 'رمز الموقع' : 'Location Code'}</th>
          <th>${I18N[lang].thDeviceCount || "عدد الأصول"}</th>
          <th>${I18N[lang].deviceTypesBreakdown || "أنواع الأصول"}</th>
          <th>${I18N[lang].thAssignedCount || "مسند"}</th>
          <th>${I18N[lang].thAvailableCount || "متوفر"}</th>
          <th>${I18N[lang].thUnderMaintCount || "صيانة"}</th>
          <th>${I18N[lang].thInStoreCount || "مستودع"}</th>
        </tr>
      `;

      const filtered = filterAssetList(assets);
      const activeLocs = locations.filter(l => filterLoc ? l.id === filterLoc : true);

      let totalLocAssets = 0;
      let totalLocAssigned = 0;
      let totalLocAvailable = 0;
      let totalLocMaint = 0;
      let totalLocStore = 0;

      rowsHtml = activeLocs.map(loc => {
        const locAssets = filtered.filter(a => a.locationId === loc.id);
        const count = locAssets.length;
        if (count === 0 && filterLoc) return "";

        totalLocAssets += count;
        const assigned = locAssets.filter(a => a.status === "Assigned").length;
        const available = locAssets.filter(a => a.status === "Available").length;
        const maint = locAssets.filter(a => a.status === "Under Maintenance").length;
        const store = locAssets.filter(a => a.status === "In Store").length;

        totalLocAssigned += assigned;
        totalLocAvailable += available;
        totalLocMaint += maint;
        totalLocStore += store;

        const typeCounts = {};
        locAssets.forEach(a => {
          const tName = typeMap[a.assetTypeId] || (lang === "ar" ? "أخرى" : "Other");
          typeCounts[tName] = (typeCounts[tName] || 0) + 1;
        });
        const typesStr = Object.entries(typeCounts).map(([k, v]) => `${k} (${v})`).join(", ") || "-";
        const locName = lang === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr);

        return `
          <tr>
            <td><strong><i class="fas fa-${loc.icon || 'map-marker-alt'} text-warning"></i> ${locName}</strong></td>
            <td><code>${loc.code || "-"}</code></td>
            <td><strong>${count}</strong></td>
            <td style="font-size: 11px;">${typesStr}</td>
            <td><span class="badge badge-success">${assigned}</span></td>
            <td><span class="badge badge-primary">${available}</span></td>
            <td><span class="badge badge-danger">${maint}</span></td>
            <td><span class="badge badge-warning">${store}</span></td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي المواقع' : 'Total Locations'}:</span> <strong>${activeLocs.length}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي الأصول بالمواقع' : 'Total Assets in Locations'}:</span> <strong>${totalLocAssets}</strong></div>
          <div><span>${lang === 'ar' ? 'الأجهزة المسندة' : 'Assigned'}:</span> <strong class="text-success">${totalLocAssigned}</strong></div>
          <div><span>${lang === 'ar' ? 'المتوفرة' : 'Available'}:</span> <strong class="text-primary">${totalLocAvailable}</strong></div>
          <div><span>${lang === 'ar' ? 'قيد الصيانة' : 'Under Maintenance'}:</span> <strong class="text-danger">${totalLocMaint}</strong></div>
          <div><span>${lang === 'ar' ? 'بالمستودع' : 'In Store'}:</span> <strong class="text-warning">${totalLocStore}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 5. Maintenance Report (تقرير الصيانة - Comprehensive)
    // -------------------------------------------------------------
    } else if (reportType === "maint") {
      title = lang === "ar" ? "تقرير بطاقات الصيانة والإصلاح الفني" : "Maintenance & Repairs Report";
      tableHeader = `
        <tr>
          <th>${I18N[lang].thTicketId || "رقم التذكرة"}</th>
          <th>Asset ID</th>
          <th>${I18N[lang].assetType || "نوع الجهاز"}</th>
          <th class="col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th class="col-report-notes">${I18N[lang].problem || "المشكلة / العطل"}</th>
          <th class="col-report-notes">${I18N[lang].actionTaken || "الإجراء المتخذ"}</th>
          <th>${I18N[lang].technician || "الفني"}</th>
          <th>${I18N[lang].vendor || "المورد / الجهة"}</th>
          <th>${I18N[lang].maintDate || "تاريخ الصيانة"}</th>
          <th>${I18N[lang].lblMaintReturnDate || "تاريخ الإرجاع"}</th>
          <th>${I18N[lang].cost || "التكلفة (AED)"}</th>
          <th>${I18N[lang].status || "حالة التذكرة"}</th>
        </tr>
      `;

      let filteredMaint = maintenance.filter(m => {
        if (filterStatus && m.status !== filterStatus) return false;
        if (dateFrom && m.maintenanceDate && m.maintenanceDate < dateFrom) return false;
        if (dateTo && m.maintenanceDate && m.maintenanceDate > dateTo) return false;
        if (searchVal) {
          const ast = assets.find(a => a.id === m.assetId);
          const astId = ast ? ast.assetId : (m.assetId || "");
          const str = `${m.id || ""} ${astId} ${m.problem || ""} ${m.actionTaken || ""} ${m.technician || ""} ${m.vendor || ""}`.toLowerCase();
          if (!str.includes(searchVal)) return false;
        }
        return true;
      });

      const totalMaintCost = filteredMaint.reduce((acc, m) => acc + (parseFloat(m.cost) || 0), 0);
      const activeTickets = filteredMaint.filter(m => m.status === "Open" || m.status === "In Progress").length;

      rowsHtml = filteredMaint.map(m => {
        const ast = assets.find(a => a.id === m.assetId);
        const assetIdStr = ast ? ast.assetId : m.assetId;
        const typeStr = ast ? (typeMap[ast.assetTypeId] || "-") : "-";
        const modelStr = ast ? `${ast.brand || ""} ${ast.model || ""}`.trim() || "-" : "-";
        const statusBadge = m.status === "Completed" ? "badge-success" : (m.status === "In Progress" ? "badge-warning" : "badge-danger");

        return `
          <tr>
            <td><strong>${m.id}</strong></td>
            <td><strong>${assetIdStr}</strong></td>
            <td>${typeStr}</td>
            <td class="col-report-model">${modelStr}</td>
            <td class="col-report-notes">${m.problem || "-"}</td>
            <td class="col-report-notes">${m.actionTaken || "-"}</td>
            <td>${m.technician || "-"}</td>
            <td>${m.vendor || "-"}</td>
            <td>${m.maintenanceDate || "-"}</td>
            <td>${m.returnDate || "-"}</td>
            <td><strong>${m.cost ? parseFloat(m.cost).toLocaleString() : "0"}</strong></td>
            <td><span class="badge ${statusBadge}">${m.status}</span></td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي تذاكر الصيانة' : 'Total Tickets'}:</span> <strong>${filteredMaint.length}</strong></div>
          <div><span>${lang === 'ar' ? 'البلاغات النشطة' : 'Active Tickets'}:</span> <strong class="text-danger">${activeTickets}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي التكاليف' : 'Total Cost'}:</span> <strong class="text-primary">${totalMaintCost.toLocaleString()} AED</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 6. Asset History Report (تقرير سجل العمليات والتاريخ)
    // -------------------------------------------------------------
    } else if (reportType === "history") {
      title = lang === "ar" ? "تقرير سجل الحركات والعمليات التاريخية للأصول" : "Asset Transactions & Audit History Report";
      tableHeader = `
        <tr>
          <th>${lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}</th>
          <th>Asset ID</th>
          <th class="col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th>${I18N[lang].thActionType || "نوع العملية"}</th>
          <th>${lang === 'ar' ? 'الموظف المرتبط' : 'Associated Employee'}</th>
          <th>${I18N[lang].department || "الإدارة / القسم"}</th>
          <th>${I18N[lang].location || "الموقع"}</th>
          <th>${lang === 'ar' ? 'المنفذ' : 'Performed By'}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "الملاحظات والبيان"}</th>
        </tr>
      `;

      let filteredTx = transactions.filter(tx => {
        if (dateFrom && tx.transactionDate && tx.transactionDate < dateFrom) return false;
        if (dateTo && tx.transactionDate && tx.transactionDate > dateTo) return false;
        if (searchVal) {
          const toEmp = (empMap[tx.toEmployeeId] || "").toLowerCase();
          const str = `${tx.assetId || ""} ${tx.transactionType || ""} ${toEmp} ${tx.performedBy || ""} ${tx.notes || ""}`.toLowerCase();
          if (!str.includes(searchVal)) return false;
        }
        return true;
      });

      filteredTx.sort((a, b) => new Date(b.transactionDate || 0) - new Date(a.transactionDate || 0));

      rowsHtml = filteredTx.map(tx => {
        const ast = assets.find(a => a.id === tx.assetId);
        const astLabel = ast ? ast.assetId : tx.assetId;
        const modelStr = ast ? `${ast.brand || ""} ${ast.model || ""}`.trim() || "-" : "-";
        return `
          <tr>
            <td>${tx.transactionDate || "-"}</td>
            <td><strong>${astLabel}</strong></td>
            <td class="col-report-model">${modelStr}</td>
            <td><span class="badge badge-primary">${AssetManager.formatTxType(tx.transactionType)}</span></td>
            <td>${empMap[tx.toEmployeeId] || "-"}</td>
            <td>${deptMap[tx.toDepartmentId] || "-"}</td>
            <td>${locMap[tx.toLocationId] || "-"}</td>
            <td>${tx.performedBy || "System"}</td>
            <td class="col-report-notes">${tx.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي الحركات المسجلة' : 'Total Transactions'}:</span> <strong>${filteredTx.length}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 7. Warranty Expiry Report (تقرير فترات الضمان - Comprehensive)
    // -------------------------------------------------------------
    } else if (reportType === "warranty") {
      title = lang === "ar" ? "تقرير فترات وضمان الأجهزة والمعدات" : "Warranty Status & Expiry Report";
      tableHeader = `
        <tr>
          <th>Asset ID</th>
          <th>${I18N[lang].brand || "الشركة"}</th>
          <th class="col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th>${I18N[lang].serialNumber || "السيريال"}</th>
          <th>${I18N[lang].purchaseDate || "تاريخ الشراء"}</th>
          <th>${I18N[lang].warrantyExpiry || "انتهاء الضمان"}</th>
          <th>${I18N[lang].thRemainingDays || "الأيام المتبقية"}</th>
          <th>${I18N[lang].warrantyStatus || "حالة الضمان"}</th>
          <th>${I18N[lang].department || "القسم"}</th>
          <th>${I18N[lang].location || "الموقع"}</th>
          <th>${I18N[lang].employee || "الموظف"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      const today = new Date().toISOString().slice(0, 10);
      const filtered = filterAssetList(assets);

      let expiredCount = 0;
      let soonCount = 0;
      let validCount = 0;

      rowsHtml = filtered.map(a => {
        let warrantyStatus = lang === "ar" ? "ساري الضمان" : "Valid Warranty";
        let badgeClass = "badge-success";
        let daysDiff = "-";

        if (!a.warrantyExpiry) {
          warrantyStatus = lang === "ar" ? "غير محدد" : "Not Specified";
          badgeClass = "badge-secondary";
        } else {
          const diffTime = new Date(a.warrantyExpiry) - new Date(today);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            warrantyStatus = lang === "ar" ? "منتهي الضمان" : "Expired Warranty";
            badgeClass = "badge-danger";
            expiredCount++;
            daysDiff = lang === "ar" ? `منتهي (${Math.abs(diffDays)} يوم)` : `Expired (${Math.abs(diffDays)}d)`;
          } else {
            daysDiff = lang === "ar" ? `متبقي ${diffDays} يوم` : `${diffDays} days left`;
            if (diffDays <= 30) {
              badgeClass = "badge-warning";
              warrantyStatus = lang === "ar" ? "ينتهي قريباً (≤ 30 يوم)" : "Expiring Soon (≤ 30d)";
              soonCount++;
            } else {
              validCount++;
            }
          }
        }

        return `
          <tr>
            <td><strong>${a.assetId}</strong></td>
            <td>${a.brand || "-"}</td>
            <td class="col-report-model">${a.model || "-"}</td>
            <td><code>${a.serial || "-"}</code></td>
            <td>${a.purchaseDate || "-"}</td>
            <td><strong>${a.warrantyExpiry || "-"}</strong></td>
            <td>${daysDiff}</td>
            <td><span class="badge ${badgeClass}">${warrantyStatus}</span></td>
            <td>${deptMap[a.departmentId] || "-"}</td>
            <td>${locMap[a.locationId] || "-"}</td>
            <td>${empMap[a.currentEmployeeId] || "-"}</td>
            <td class="col-report-notes">${a.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}:</span> <strong>${filtered.length}</strong></div>
          <div><span>${lang === 'ar' ? 'ساري الضمان' : 'Valid Warranty'}:</span> <strong class="text-success">${validCount}</strong></div>
          <div><span>${lang === 'ar' ? 'ينتهي قريباً (30 يوم)' : 'Expiring Soon'}:</span> <strong class="text-warning">${soonCount}</strong></div>
          <div><span>${lang === 'ar' ? 'منتهي الضمان' : 'Expired Warranty'}:</span> <strong class="text-danger">${expiredCount}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 8. Assets by Status (تقرير الأصول حسب الحالة - All 8 Statuses)
    // -------------------------------------------------------------
    } else if (reportType === "byStatus") {
      title = lang === "ar" ? "تقرير توزيع الأصول والمعدات حسب الحالة التشغيلية" : "Assets Distribution by Operational Status Report";
      tableHeader = `
        <tr>
          <th>#</th>
          <th>${I18N[lang].status || "الحالة التشغيلية"}</th>
          <th>${lang === 'ar' ? 'كود الحالة' : 'Status Code'}</th>
          <th>${I18N[lang].thDeviceCount || "عدد الأجهزة"}</th>
          <th>${I18N[lang].percentage || "النسبة (%)"}</th>
          <th>${I18N[lang].valuation || "إجمالي القيمة التقديرية (AED)"}</th>
        </tr>
      `;

      const allStatuses = [
        "Available",
        "Assigned",
        "In Store",
        "Under Maintenance",
        "Damaged",
        "Lost",
        "Retired",
        "Disposed"
      ];

      const filtered = filterAssetList(assets);
      const grandTotalCount = filtered.length;
      const grandTotalValuation = filtered.reduce((acc, a) => acc + (parseFloat(a.purchaseCost) || 0), 0);

      rowsHtml = allStatuses.map((st, idx) => {
        const inStatus = filtered.filter(a => a.status === st);
        const cnt = inStatus.length;
        const pct = grandTotalCount > 0 ? ((cnt / grandTotalCount) * 100).toFixed(1) : 0;
        const val = inStatus.reduce((acc, a) => acc + (parseFloat(a.purchaseCost) || 0), 0);
        return `
          <tr>
            <td>${idx + 1}</td>
            <td><span class="badge ${AssetManager.getStatusBadgeClass(st)}">${AssetManager.formatStatus(st)}</span></td>
            <td><code>${st}</code></td>
            <td><strong>${cnt}</strong></td>
            <td>${pct}%</td>
            <td>${val.toLocaleString()} AED</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}:</span> <strong>${grandTotalCount}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي القيمة الكلية' : 'Total Valuation'}:</span> <strong class="text-primary">${grandTotalValuation.toLocaleString()} AED</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 9. Helpdesk Requests (تقرير طلبات الدعم الفني)
    // -------------------------------------------------------------
    } else if (reportType === "helpdesk") {
      title = lang === "ar" ? "تقرير طلبات وتذاكر الدعم الفني" : "IT Helpdesk & Support Tickets Report";
      tableHeader = `
        <tr>
          <th>${lang === 'ar' ? 'رقم الطلب' : 'Request #'}</th>
          <th>${I18N[lang].employee || "الموظف"}</th>
          <th class="col-report-model">${lang === 'ar' ? 'الجهاز / الأصل' : 'Device / Asset'}</th>
          <th>${I18N[lang].department || "الإدارة"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th>${lang === 'ar' ? 'نوع الطلب' : 'Request Type'}</th>
          <th class="col-report-notes">${lang === 'ar' ? 'الموضوع' : 'Subject'}</th>
          <th>${lang === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</th>
          <th>${lang === 'ar' ? 'سجل الصيانة' : 'Maintenance ID'}</th>
        </tr>
      `;

      const allReqs = await db.getAll("helpdeskRequests");
      let filteredReqs = allReqs.filter(r => {
        if (filterStatus && r.status !== filterStatus) return false;
        if (filterEmp && r.employeeId !== filterEmp) return false;
        if (dateFrom && r.createdDate && r.createdDate < dateFrom) return false;
        if (dateTo && r.createdDate && r.createdDate > dateTo) return false;
        if (searchVal) {
          const emp = (empMap[r.employeeId] || "").toLowerCase();
          const str = `${r.requestNumber || ""} ${r.subject || ""} ${r.description || ""} ${emp} ${r.status || ""}`.toLowerCase();
          if (!str.includes(searchVal)) return false;
        }
        return true;
      });

      filteredReqs.sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));

      const newCnt = filteredReqs.filter(r => r.status === "New").length;
      const inProgCnt = filteredReqs.filter(r => r.status === "In Progress").length;
      const waitingCnt = filteredReqs.filter(r => r.status === "Waiting for Employee").length;
      const compCnt = filteredReqs.filter(r => r.status === "Completed").length;

      rowsHtml = filteredReqs.map(r => {
        const emp = empMap[r.employeeId] || r.employeeName || "-";
        const ast = assets.find(a => a.id === r.assetId);
        const astLabel = ast ? `${ast.assetId} (${ast.brand} ${ast.model})` : (r.assetId || "-");
        const dept = deptMap[r.departmentId] || "-";

        let stBadge = "badge-secondary";
        if (r.status === "New") stBadge = "badge-danger";
        else if (r.status === "In Progress") stBadge = "badge-primary";
        else if (r.status === "Waiting for Employee") stBadge = "badge-warning";
        else if (r.status === "Completed") stBadge = "badge-success";

        return `
          <tr>
            <td><strong><code>${r.requestNumber}</code></strong></td>
            <td><strong>${emp}</strong></td>
            <td class="col-report-model">${astLabel}</td>
            <td>${dept}</td>
            <td><span class="badge ${stBadge}">${r.status}</span></td>
            <td>${r.requestType || "-"}</td>
            <td class="col-report-notes">${r.subject || "-"}</td>
            <td>${r.createdDate ? r.createdDate.slice(0, 16).replace("T", " ") : "-"}</td>
            <td>${r.maintenanceId ? `<code>${r.maintenanceId}</code>` : "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي الطلبات' : 'Total Requests'}:</span> <strong>${filteredReqs.length}</strong></div>
          <div><span>${lang === 'ar' ? 'جديد' : 'New'}:</span> <strong class="text-danger">${newCnt}</strong></div>
          <div><span>${lang === 'ar' ? 'قيد المعالجة' : 'In Progress'}:</span> <strong class="text-primary">${inProgCnt}</strong></div>
          <div><span>${lang === 'ar' ? 'بانتظار الموظف' : 'Waiting'}:</span> <strong class="text-warning">${waitingCnt}</strong></div>
          <div><span>${lang === 'ar' ? 'مكتمل' : 'Completed'}:</span> <strong class="text-success">${compCnt}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 10. Warehouse Assets (تقرير أصول المستودع)
    // -------------------------------------------------------------
    } else if (reportType === "warehouse") {
      title = lang === "ar" ? "تقرير الأصول الموجودة بالمستودع" : "Assets Currently in Warehouse Report";
      tableHeader = `
        <tr>
          <th>Asset ID</th>
          <th>${I18N[lang].assetType || "النوع"}</th>
          <th>${I18N[lang].brand || "الشركة"}</th>
          <th class="col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th>${I18N[lang].serialNumber || "السيريال"}</th>
          <th>${I18N[lang].warehouseLocation || "المستودع"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th>${I18N[lang].purchaseCost || "التكلفة"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      const warehouseLocIds = new Set(locations.filter(l => l.type === "store").map(l => l.id));
      let warehouseAssets = assets.filter(a => a.status === "In Store" || warehouseLocIds.has(a.locationId));
      warehouseAssets = filterAssetList(warehouseAssets);

      let totalVal = 0;
      rowsHtml = warehouseAssets.map(a => {
        totalVal += (Number(a.purchaseCost) || 0);
        return `
          <tr>
            <td><strong><code>${a.assetId}</code></strong></td>
            <td>${typeMap[a.assetTypeId] || "-"}</td>
            <td>${a.brand || "-"}</td>
            <td class="col-report-model">${a.model || "-"}</td>
            <td><code>${a.serial || "-"}</code></td>
            <td><i class="fas fa-warehouse text-warning"></i> ${locMap[a.locationId] || "-"}</td>
            <td><span class="badge badge-warning">${AssetManager.formatStatus(a.status)}</span></td>
            <td>${a.purchaseCost ? a.purchaseCost + " AED" : "-"}</td>
            <td class="col-report-notes">${a.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي أصول المستودع' : 'Total Warehouse Assets'}:</span> <strong>${warehouseAssets.length}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي القيمة التقديرية' : 'Total Valuation'}:</span> <strong class="text-primary">${totalVal.toLocaleString()} AED</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 11. Assets Awaiting Installation (تقرير الأصول بانتظار التركيب)
    // -------------------------------------------------------------
    } else if (reportType === "awaitingInstall") {
      title = lang === "ar" ? "تقرير الأصول المصروفة لفريق التقنية (بانتظار التركيب)" : "Assets Issued to IT Technicians (Awaiting Installation)";
      tableHeader = `
        <tr>
          <th>Asset ID</th>
          <th>${I18N[lang].assetType || "النوع"}</th>
          <th class="col-report-model">${I18N[lang].brand || "الجهاز والموديل"}</th>
          <th>${I18N[lang].serialNumber || "السيريال"}</th>
          <th>${I18N[lang].fromWarehouse || "المستودع المصدر"}</th>
          <th>${I18N[lang].itTechnician || "فني التقنية المستلم"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th>${I18N[lang].issueDate || "تاريخ الصرف"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      let inTransitAssets = assets.filter(a => a.status === "In Transit");
      inTransitAssets = filterAssetList(inTransitAssets);

      const allIssues = await db.getAll("warehouseIssues");
      const issueMap = {};
      allIssues.filter(i => i.status === "In Transit").forEach(i => { issueMap[i.assetId] = i; });

      rowsHtml = inTransitAssets.map(a => {
        const issue = issueMap[a.id] || {};
        return `
          <tr>
            <td><strong><code>${a.assetId}</code></strong></td>
            <td>${typeMap[a.assetTypeId] || "-"}</td>
            <td class="col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td><code>${a.serial || "-"}</code></td>
            <td>${locMap[issue.warehouseLocationId || a.locationId] || "-"}</td>
            <td><i class="fas fa-user-cog text-primary"></i> ${empMap[a.currentEmployeeId || issue.itEmployeeId] || "-"}</td>
            <td><span class="badge badge-warning">${AssetManager.formatStatus(a.status)}</span></td>
            <td>${issue.issueDate || a.assignmentDate || "-"}</td>
            <td class="col-report-notes">${issue.notes || a.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'أصول بانتظار التركيب' : 'Awaiting Installation'}:</span> <strong class="text-warning">${inTransitAssets.length}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 12. Asset Location Transfers (تقرير نقل الأصول - مطابق لجدول إكسل)
    // -------------------------------------------------------------
    } else if (reportType === "transfers") {
      title = lang === "ar" ? "سجل حركات ونقل الأصول بين المواقع (Excel Format)" : "Asset Location Transfers Report (Excel Format)";
      tableHeader = `
        <tr>
          <th>SL No.</th>
          <th>${I18N[lang].transferDate || "تاريخ النقل"}</th>
          <th>ASSETS CODE</th>
          <th class="col-report-model">PRODUCTS DETAILS</th>
          <th>QTY</th>
          <th>Transfer From</th>
          <th>Transfer To</th>
          <th class="col-report-notes">REMARKS</th>
          <th>STATUS</th>
        </tr>
      `;

      const allTransfers = await db.getAll("assetTransfers");
      const assetObjMap = Object.fromEntries(assets.map(a => [a.id, a]));

      let filteredTransfers = allTransfers.filter(t => {
        if (dateFrom && t.transferDate && t.transferDate < dateFrom) return false;
        if (dateTo && t.transferDate && t.transferDate > dateTo) return false;
        if (filterLoc && t.fromLocationId !== filterLoc && t.toLocationId !== filterLoc) return false;
        if (searchVal) {
          const a = assetObjMap[t.assetId] || {};
          const str = `${t.transferNo || ""} ${a.assetId || ""} ${a.brand || ""} ${a.model || ""} ${locMap[t.fromLocationId] || ""} ${locMap[t.toLocationId] || ""} ${t.notes || ""}`.toLowerCase();
          if (!str.includes(searchVal)) return false;
        }
        return true;
      });

      filteredTransfers.sort((a, b) => (b.transferDate || "").localeCompare(a.transferDate || ""));

      rowsHtml = filteredTransfers.map((t, idx) => {
        const a = assetObjMap[t.assetId] || {};
        const cond = t.condition === "Working" ? (lang === "ar" ? "سليم" : "Working") : (lang === "ar" ? "معطل" : "Not Working");
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${t.transferDate || "-"}</td>
            <td><strong><code>${a.assetId || "-"}</code></strong></td>
            <td class="col-report-model">${a.brand || ""} ${a.model || ""} (SN: ${a.serial || "-"})</td>
            <td>1</td>
            <td>${locMap[t.fromLocationId] || "-"}</td>
            <td><strong class="text-primary">${locMap[t.toLocationId] || "-"}</strong></td>
            <td class="col-report-notes">${t.notes || "-"}</td>
            <td><span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${t.status || 'Completed'}</span> <small>(${cond})</small></td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي حركات النقل' : 'Total Transfers'}:</span> <strong>${filteredTransfers.length}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 13. IT Projects & Tasks Report (تقرير المشاريع والمهام)
    // -------------------------------------------------------------
    } else if (reportType === "projects") {
      title = lang === "ar" ? "تقرير المشاريع التقنية والمهام ونسب الإنجاز" : "IT Projects, Tasks & Progress Report";
      tableHeader = `
        <tr>
          <th>${I18N[lang].projectNo || "رقم المشروع"}</th>
          <th>${I18N[lang].projectName || "اسم المشروع"}</th>
          <th>${I18N[lang].contractor || "المقاول"}</th>
          <th>${I18N[lang].location || "الموقع"}</th>
          <th>${I18N[lang].startDate || "تاريخ البدء"}</th>
          <th>${I18N[lang].plannedEndDate || "تاريخ الانتهاء"}</th>
          <th>${I18N[lang].progressPct || "نسبة الإنجاز"}</th>
          <th>${I18N[lang].projectStatus || "الحالة"}</th>
        </tr>
      `;

      const allProjects = await db.getAll("projects");
      const allContractors = await db.getAll("contractors");
      const contractorMap = Object.fromEntries(allContractors.map(c => [c.id, lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)]));

      let filteredProjects = allProjects.filter(p => {
        if (filterStatus && p.status !== filterStatus) return false;
        if (filterLoc && p.locationId !== filterLoc) return false;
        if (searchVal) {
          const str = `${p.projectNo || ""} ${p.nameAr || ""} ${p.nameEn || ""} ${contractorMap[p.contractorId] || ""} ${locMap[p.locationId] || ""}`.toLowerCase();
          if (!str.includes(searchVal)) return false;
        }
        return true;
      });

      const today = new Date().toISOString().slice(0, 10);

      rowsHtml = filteredProjects.map(p => {
        const name = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
        const overdue = p.status !== "Completed" && p.status !== "Cancelled" && p.plannedEndDate && p.plannedEndDate < today;
        return `
          <tr>
            <td><strong><code>${p.projectNo}</code></strong></td>
            <td><strong>${name}</strong><br><small class="text-muted">${p.projectType || ""}</small></td>
            <td>${contractorMap[p.contractorId] || "-"}</td>
            <td>${locMap[p.locationId] || "-"}</td>
            <td>${p.startDate || "-"}</td>
            <td>${p.plannedEndDate || "-"}</td>
            <td>${p.progress || 0}%</td>
            <td>
              <span class="badge ${p.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${p.status}</span>
              ${overdue ? ` <span class="badge badge-danger">${I18N[lang].badgeOverdue || 'متأخر'}</span>` : ''}
            </td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'}:</span> <strong>${filteredProjects.length}</strong></div>
          <div><span>${lang === 'ar' ? 'مكتمل' : 'Completed'}:</span> <strong class="text-success">${filteredProjects.filter(p => p.status === 'Completed').length}</strong></div>
          <div><span>${lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}:</span> <strong class="text-warning">${filteredProjects.filter(p => p.status === 'In Progress').length}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 14. Warehouse Issue Records Report (تقرير سجلات صرف المستودع)
    // -------------------------------------------------------------
    } else if (reportType === "warehouseIssues") {
      title = lang === "ar" ? "تقرير سجلات صرف المستودع للفنيين" : "Warehouse Issue Records Report";
      tableHeader = `
        <tr>
          <th>${I18N[lang].issueNo || "رقم الصرف"}</th>
          <th>${I18N[lang].issueDate || "تاريخ الصرف"}</th>
          <th>Asset ID</th>
          <th class="col-report-model">${I18N[lang].brand || "الجهاز والموديل"}</th>
          <th>${I18N[lang].serialNumber || "السيريال"}</th>
          <th>${I18N[lang].fromWarehouse || "المستودع المصدر"}</th>
          <th>${I18N[lang].itTechnician || "فني التقنية المستلم"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      const allIssues = await db.getAll("warehouseIssues");
      const assetObjMap = Object.fromEntries(assets.map(a => [a.id, a]));

      let filteredIssues = allIssues.filter(i => {
        if (filterStatus && i.status !== filterStatus) return false;
        if (filterLoc && i.warehouseLocationId !== filterLoc) return false;
        if (filterEmp && i.itEmployeeId !== filterEmp) return false;
        if (dateFrom && i.issueDate && i.issueDate < dateFrom) return false;
        if (dateTo && i.issueDate && i.issueDate > dateTo) return false;
        if (searchVal) {
          const a = assetObjMap[i.assetId] || {};
          const str = `${i.issueNo || ""} ${a.assetId || ""} ${a.brand || ""} ${a.model || ""} ${a.serial || ""} ${locMap[i.warehouseLocationId] || ""} ${empMap[i.itEmployeeId] || ""}`.toLowerCase();
          if (!str.includes(searchVal)) return false;
        }
        return true;
      });

      filteredIssues.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      rowsHtml = filteredIssues.map(i => {
        const a = assetObjMap[i.assetId] || {};
        const isInstalled = i.status === "Installed";
        const statusBadge = isInstalled ? "badge-success" : "badge-warning";
        const statusText = isInstalled ? (lang === "ar" ? "تم التركيب" : "Installed") : (lang === "ar" ? "قيد النقل / بانتظار التركيب" : "In Transit");
        return `
          <tr>
            <td><strong><code>${i.issueNo || "-"}</code></strong></td>
            <td>${i.issueDate || "-"}</td>
            <td><code>${a.assetId || "-"}</code></td>
            <td class="col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td><code>${a.serial || "-"}</code></td>
            <td>${locMap[i.warehouseLocationId] || "-"}</td>
            <td><i class="fas fa-user-cog text-primary"></i> ${empMap[i.itEmployeeId] || "-"}</td>
            <td><span class="badge ${statusBadge}">${statusText}</span></td>
            <td class="col-report-notes">${i.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي سجلات الصرف' : 'Total Issue Records'}:</span> <strong>${filteredIssues.length}</strong></div>
          <div><span>${lang === 'ar' ? 'تم التركيب' : 'Installed'}:</span> <strong class="text-success">${filteredIssues.filter(i => i.status === 'Installed').length}</strong></div>
          <div><span>${lang === 'ar' ? 'بانتظار التركيب' : 'In Transit'}:</span> <strong class="text-warning">${filteredIssues.filter(i => i.status === 'In Transit').length}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 15. Completed Installations Report (تقرير عمليات التركيب المكتملة)
    // -------------------------------------------------------------
    } else if (reportType === "installations") {
      title = lang === "ar" ? "تقرير عمليات التركيب والتثبيت المكتملة للأصول" : "Completed Asset Installations Report";
      tableHeader = `
        <tr>
          <th>Asset ID</th>
          <th class="col-report-model">${I18N[lang].brand || "الجهاز والموديل"}</th>
          <th>${I18N[lang].serialNumber || "السيريال"}</th>
          <th>${I18N[lang].installLocation || "موقع التركيب"}</th>
          <th>${I18N[lang].department || "القسم"}</th>
          <th>${I18N[lang].endUser || "المستخدم النهائي"}</th>
          <th>${I18N[lang].installDate || "تاريخ التركيب"}</th>
          <th>${I18N[lang].status || "الحالة"}</th>
          <th class="col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      const allIssues = await db.getAll("warehouseIssues");
      const assetObjMap = Object.fromEntries(assets.map(a => [a.id, a]));

      let completedIssues = allIssues.filter(i => i.status === "Installed");
      if (filterLoc) completedIssues = completedIssues.filter(i => i.installedLocationId === filterLoc);
      if (filterDept) completedIssues = completedIssues.filter(i => i.installedDepartmentId === filterDept);
      if (filterEmp) completedIssues = completedIssues.filter(i => i.endUserId === filterEmp);
      if (dateFrom) completedIssues = completedIssues.filter(i => i.installationDate && i.installationDate >= dateFrom);
      if (dateTo) completedIssues = completedIssues.filter(i => i.installationDate && i.installationDate <= dateTo);
      if (searchVal) {
        completedIssues = completedIssues.filter(i => {
          const a = assetObjMap[i.assetId] || {};
          const str = `${a.assetId || ""} ${a.brand || ""} ${a.model || ""} ${a.serial || ""} ${locMap[i.installedLocationId] || ""} ${deptMap[i.installedDepartmentId] || ""} ${empMap[i.endUserId] || ""}`.toLowerCase();
          return str.includes(searchVal);
        });
      }

      completedIssues.sort((a, b) => (b.installationDate || "").localeCompare(a.installationDate || ""));

      rowsHtml = completedIssues.map(i => {
        const a = assetObjMap[i.assetId] || {};
        return `
          <tr>
            <td><strong><code>${a.assetId || "-"}</code></strong></td>
            <td class="col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td><code>${a.serial || "-"}</code></td>
            <td><i class="fas fa-map-marker-alt text-success"></i> ${locMap[i.installedLocationId] || "-"}</td>
            <td>${deptMap[i.installedDepartmentId] || "-"}</td>
            <td>${i.endUserId ? `<i class="fas fa-user text-primary"></i> ${empMap[i.endUserId]}` : `<span class="text-muted">${lang === 'ar' ? 'بدون موظف (موقع عام)' : 'Shared / Unassigned'}</span>`}</td>
            <td>${i.installationDate || "-"}</td>
            <td><span class="badge badge-success">${lang === 'ar' ? 'مكتمل التركيب' : 'Installed'}</span></td>
            <td class="col-report-notes">${i.notes || "-"}</td>
          </tr>
        `;
      }).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي التركيبات المكتملة' : 'Total Completed Installations'}:</span> <strong class="text-success">${completedIssues.length}</strong></div>
        </div>
      `;
    }

    // Build Unified Institutional Report Header (Logo, Institution, Title, Meta)
    const settings = await db.getSystemSettings();
    const headerHtml = this.buildUnifiedReportHeader({
      title,
      activeFiltersList,
      lang,
      settings
    });

    const repOrgName = (lang === 'ar' ? settings.systemNameAr : settings.systemNameEn) || settings.systemNameAr || settings.orgNameAr || (lang === 'ar' ? "معهد الشارقة للسياقة" : "Sharjah Driving Institute");

    if (!rowsHtml) {
      rowsHtml = `<tr><td colspan="15" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج مطابقة"}</td></tr>`;
    }

    const dateFormatted = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
    const timeFormatted = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const footerOrgName = settings.orgNameEn || "Sharjah Driving Institute";
    const colCount = (tableHeader.match(/<th\b/gi) || []).length || 12;

    reportArea.innerHTML = `
      <div class="table-responsive report-table-wrap">
        <table class="custom-table print-table">
          <thead>
            <tr class="report-print-header-tr">
              <th colspan="${colCount}" class="report-print-header-th">
                ${headerHtml}
              </th>
            </tr>
            ${tableHeader}
          </thead>
          <tbody>
            ${rowsHtml}
            ${totalsHtml ? `<tr class="report-totals-tr"><td colspan="${colCount}" class="report-totals-td">${totalsHtml}</td></tr>` : ''}
          </tbody>
          <tfoot class="report-print-footer">
            <tr class="report-print-footer-tr">
              <td colspan="${colCount}" class="report-print-footer-td">
                <div class="report-footer-row">
                  <div class="report-footer-timestamp">${dateFormatted}, ${timeFormatted}</div>
                  <div class="report-footer-brand">SDI IT Asset Hub - ${footerOrgName}</div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Ensure orientation class is applied to printable area
    if (this.currentReportOrientation) {
      reportArea.classList.remove("report-portrait", "report-landscape");
      reportArea.classList.add(`report-${this.currentReportOrientation}`);
    } else {
      this.setReportOrientation("landscape");
    }
  }

  /**
   * Reusable Unified Institutional Report Header Component
   * Strictly replicates the reference layout:
   * 1. Top-Right: Report Date & Generated Time (orange icons, middle dot, bold values)
   * 2. Main Row:
   *    - Left: Official SDI circular emblem + Bilingual Institutional Branding
   *    - Center: Boxed Title Pill (Asset Inventory Report)
   *    - Right: Symmetric Grid Spacer
   */
  buildUnifiedReportHeader({ title, activeFiltersList = [], lang = "ar", settings = {} }) {
    const orgNameAr = settings.orgNameAr || settings.systemNameAr || "معهد الشارقة للسياقة";
    const orgNameEn = settings.orgNameEn || settings.systemNameEn || "Sharjah Driving Institute";

    const logoHtml = settings.logoDataUrl 
      ? `<img src="${settings.logoDataUrl}" class="report-header-logo report-header-logo-img" alt="${orgNameEn}">`
      : `<svg class="report-header-logo report-header-logo-svg" viewBox="0 0 120 120" width="58" height="58" xmlns="http://www.w3.org/2000/svg" aria-label="SDI Logo">
          <defs>
            <linearGradient id="sdiGradBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#145da0"/>
              <stop offset="60%" stop-color="#0b3c68"/>
              <stop offset="100%" stop-color="#06223e"/>
            </linearGradient>
            <linearGradient id="sdiGradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f97316"/>
              <stop offset="100%" stop-color="#ea580c"/>
            </linearGradient>
            <filter id="sdiDropShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#06223e" flood-opacity="0.25"/>
            </filter>
          </defs>
          <circle cx="60" cy="60" r="56" fill="url(#sdiGradBg)" filter="url(#sdiDropShadow)"/>
          <path d="M 22,86 C 38,103 82,103 98,86 C 102,81 99,78 95,81 C 81,95 39,95 25,81 C 21,78 18,81 22,86 Z" fill="url(#sdiGradOrange)"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
          <text x="59" y="69" font-family="'Segoe UI', Roboto, 'Arial Black', sans-serif" font-size="33" font-weight="900" font-style="italic" fill="#ffffff" text-anchor="middle" letter-spacing="-1">
            <tspan fill="#f97316">S</tspan><tspan fill="#ffffff">D</tspan><tspan fill="#38bdf8">I</tspan>
          </text>
          <path d="M 34,75 Q 60,81 86,75" fill="none" stroke="url(#sdiGradOrange)" stroke-width="3" stroke-linecap="round"/>
        </svg>`;

    const dateStr = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
    const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

    const activeFilterBadge = (activeFiltersList && activeFiltersList.length > 0)
      ? `<div class="report-filter-badge"><strong>${(window.I18N && window.I18N[lang] && window.I18N[lang].reportActiveFilters) || (lang === 'ar' ? "الفلاتر النشطة" : "Active Filters")}:</strong> ${activeFiltersList.join(" | ")}</div>`
      : "";

    return `
      <div class="unified-report-header">
        <!-- Top-Right Metadata Bar -->
        <div class="report-header-meta-row">
          <span class="report-meta-item">
            <i class="far fa-calendar-alt report-meta-icon" style="color: #f97316;"></i>
            <span class="report-meta-label">${(window.I18N && window.I18N[lang] && window.I18N[lang].reportDate) || "Report Date"}:</span>
            <strong class="report-meta-value">${dateStr}</strong>
          </span>
          <span class="report-meta-dot">&middot;</span>
          <span class="report-meta-item">
            <i class="far fa-clock report-meta-icon" style="color: #f97316;"></i>
            <span class="report-meta-label">${(window.I18N && window.I18N[lang] && window.I18N[lang].reportTime) || "Generated Time"}:</span>
            <strong class="report-meta-value">${timeStr}</strong>
          </span>
        </div>

        <!-- Main Header Row: Left Brand, Center Boxed Pill, Right Spacer -->
        <div class="report-header-main-row">
          <div class="report-header-brand">
            ${logoHtml}
            <div class="report-brand-text">
              <div class="report-brand-en">${orgNameEn}</div>
              <div class="report-brand-ar">${orgNameAr}</div>
            </div>
          </div>

          <div class="report-header-center">
            <div class="report-title-pill">${title}</div>
            ${activeFilterBadge ? `<div class="report-active-filters-wrap">${activeFilterBadge}</div>` : ""}
          </div>

          <div class="report-header-spacer"></div>
        </div>
      </div>
    `;
  }

  currentReportOrientation = "landscape";

  /**
   * Switches report orientation between Landscape and Portrait
   * Updates CSS classes, button highlights, and print @page rules
   */
  setReportOrientation(orientation) {
    this.currentReportOrientation = orientation === "portrait" ? "portrait" : "landscape";
    const reportArea = document.getElementById("printableReportArea");
    if (reportArea) {
      reportArea.classList.remove("report-portrait", "report-landscape");
      reportArea.classList.add(`report-${this.currentReportOrientation}`);
    }

    const btnLandscape = document.getElementById("btnReportOrientationLandscape");
    const btnPortrait = document.getElementById("btnReportOrientationPortrait");
    if (btnLandscape && btnPortrait) {
      if (this.currentReportOrientation === "landscape") {
        btnLandscape.classList.add("btn-primary", "active");
        btnLandscape.classList.remove("btn-light");
        btnPortrait.classList.add("btn-light");
        btnPortrait.classList.remove("btn-primary", "active");
      } else {
        btnPortrait.classList.add("btn-primary", "active");
        btnPortrait.classList.remove("btn-light");
        btnLandscape.classList.add("btn-light");
        btnLandscape.classList.remove("btn-primary", "active");
      }
    }

    let styleEl = document.getElementById("dynamicPageOrientationStyle");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamicPageOrientationStyle";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `@page { size: A4 ${this.currentReportOrientation}; margin: 8mm 10mm; }`;
  }

  printCurrentReport() {
    this.setReportOrientation(this.currentReportOrientation || "landscape");
    window.print();
  }

  exportReportPDF() {
    this.setReportOrientation(this.currentReportOrientation || "landscape");
    window.print();
  }

  async exportReportCSV() {
    const reportArea = document.getElementById("printableReportArea");
    if (!reportArea) return;
    const table = reportArea.querySelector("table");
    if (!table) {
      this.showToast(AppState.lang === "ar" ? "لا توجد بيانات للتصدير" : "No data to export", "warning");
      return;
    }

    const rows = [];
    // 1. Extract headers (exclude the decorative institutional header in thead)
    const ths = Array.from(table.querySelectorAll("thead th:not(.report-print-header-th)"));
    if (ths.length > 0) {
      const headerRow = ths.map(th => `"${th.innerText.replace(/"/g, '""').trim()}"`);
      rows.push(headerRow.join(","));
    }

    // 2. Extract body rows (exclude totals row in tbody)
    const trs = Array.from(table.querySelectorAll("tbody tr:not(.report-totals-tr)"));
    trs.forEach(tr => {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (tds.length > 0) {
        const rowData = tds.map(td => `"${td.innerText.replace(/"/g, '""').trim()}"`);
        rows.push(rowData.join(","));
      }
    });

    // Prepend UTF-8 BOM so Excel opens Arabic correctly
    const csvContent = "﻿" + rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const reportType = document.getElementById("reportSelect") ? document.getElementById("reportSelect").value : "inventory";
    a.href = url;
    a.download = `sdi_${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast(AppState.lang === "ar" ? "تم تصدير ملف Excel (CSV) بنجاح" : "Excel (CSV) exported successfully", "success");
  }

  // =========================================================================
  // 5. DATABASE CONNECTION TEST TOOL
  // =========================================================================
  // Cloud Realtime Listener & Database Diagnostics
  // =========================================================================
  onCloudDataChange(payload) {
    console.log("SDI IT Asset Hub: Live Cloud Event:", payload);
    const lang = AppState.lang;

    // Realtime can emit several related rows for one operation. Coalesce them
    // so every browser refreshes from the cloud once, after the write commits.
    clearTimeout(this.cloudRefreshTimer);
    this.cloudRefreshTimer = setTimeout(async () => {
      try {
        const table = payload.table;
        if (table === "assets" || table === "employees" || table === "departments" ||
            table === "locations" || table === "asset_types" || table === "maintenance" ||
            table === "asset_transactions" || table === "system_settings" ||
            table === "warehouse_issues" || table === "asset_transfers" ||
            table === "projects" || table === "project_tasks" || table === "users") {
          await this.updateDashboard();
        }

        if (table === "assets" && typeof AssetManager !== "undefined") {
          await AssetManager.render();
        }
        if ((table === "employees" || table === "departments" || table === "locations" ||
             table === "asset_types") && typeof AssetManager !== "undefined") {
          await AssetManager.populateDropdowns();
          await AssetManager.render();
        }
        if (typeof OpsManager !== "undefined" &&
            (table === "assets" || table === "locations" || table === "departments" ||
             table === "employees" || table === "warehouse_issues" || table === "asset_transfers")) {
          await OpsManager.renderWarehouseIssues();
          await OpsManager.renderAwaitingInstall();
          await OpsManager.renderInstalledDevices();
          await OpsManager.renderTransfers();
        }
        if (table === "maintenance" && typeof MaintManager !== "undefined") {
          await MaintManager.render();
        }
        if (table === "system_settings") await this.applyBranding();
        if (table === "users") {
          await UserManager.renderUsers();
          await this.updateNotificationBadge();
        }
        if (["assets", "employees", "departments", "locations", "asset_types",
             "maintenance", "asset_transactions", "warehouse_issues",
             "asset_transfers", "projects", "project_tasks"].includes(table)) {
          await this.generateSelectedReport();
        }
        this.updateCloudStatus();
      } catch (error) {
        console.warn("Realtime refresh warning:", error);
      }
    }, 150);

    if (payload.table === "maintenance") {
      this.showToast(
        lang === "ar" ? "تم تحديث بيانات الصيانة عبر السحابة" : "Maintenance data updated from cloud",
        "info"
      );
    }
  }

  async testDatabaseConnection() {
    const container = document.getElementById("dbTestResultContainer");
    if (!container) return;

    container.style.display = "block";
    container.innerHTML = `
      <div class="p-3 border rounded" style="background: rgba(6, 182, 212, 0.08); border-color: var(--accent-cyan);">
        <i class="fas fa-spinner fa-spin text-primary"></i> ${AppState.lang === "ar" ? "جاري فحص الاتصال وقراءة الجداول السحابية والمحلية..." : "Checking connection and reading cloud and local tables..."}
      </div>
    `;

    const res = await db.testConnection();

    if (res.success) {
      const st = res.details.storage || {};
      const cloudSt = st.cloud || {};
      const browserSt = st.browser || {};
      const isAr = AppState.lang === "ar";

      container.innerHTML = `
        <div class="p-4 border rounded" style="background: rgba(16, 185, 129, 0.08); border-color: var(--accent-emerald);">
          <div class="d-flex items-center gap-2 mb-2">
            <i class="fas fa-check-circle text-success fa-2x"></i>
            <div>
              <h4 class="text-success font-bold" style="margin: 0; font-size: 16px;">${isAr ? res.messageAr : res.message}</h4>
              ${isAr ? `<p class="text-sm text-muted" style="margin: 2px 0 0;">${res.message}</p>` : ''}
            </div>
          </div>

          <!-- Cloud Database Storage Metrics Card -->
          <div class="mt-3 p-3 rounded" style="background: #ffffff; border: 1px solid #e2e8f0;">
            <div class="d-flex justify-between items-center mb-1">
              <strong style="color: var(--sdi-blue); font-size: 13px;">
                <i class="fas fa-cloud text-primary"></i> ${isAr ? 'مساحة وسعة قاعدة البيانات السحابية (Supabase PostgreSQL)' : 'Cloud Database Storage (Supabase PostgreSQL)'}
              </strong>
              <span class="badge badge-success" style="font-size: 11px;">${isAr ? 'الخطة السحابية المجانية' : 'Free Cloud Quota'}</span>
            </div>

            <!-- Visual Capacity Progress Bar -->
            <div style="background: #e2e8f0; border-radius: 6px; height: 10px; width: 100%; overflow: hidden; margin: 8px 0;">
              <div style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: ${cloudSt.usedPct || 1}%; border-radius: 6px; transition: width 0.5s ease;"></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; font-size: 12px; margin-top: 8px;">
              <div class="p-2 rounded" style="background: #f8fafc; border: 1px solid #edf2f7;">
                <span class="text-muted block">${isAr ? 'السعة الكلية الممنوحة:' : 'Total Quota:'}</span>
                <strong style="color: var(--sdi-blue); font-size: 13px;">${cloudSt.quotaPretty || '500 MB'}</strong>
              </div>
              <div class="p-2 rounded" style="background: #f8fafc; border: 1px solid #edf2f7;">
                <span class="text-muted block">${isAr ? 'المساحة المستخدمة:' : 'Used Space:'}</span>
                <strong class="text-primary" style="font-size: 13px;">${cloudSt.usedPretty || '0 MB'} (${cloudSt.usedPct || '0'}%)</strong>
              </div>
              <div class="p-2 rounded" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
                <span class="text-muted block">${isAr ? 'المساحة الخالية المتبقية:' : 'Free Available Space:'}</span>
                <strong class="text-success" style="font-size: 13px;">${cloudSt.freePretty || '500 MB'} (${cloudSt.freePct || '100'}%)</strong>
              </div>
              <div class="p-2 rounded" style="background: #f8fafc; border: 1px solid #edf2f7;">
                <span class="text-muted block">${isAr ? 'حالة السعة والمخزن:' : 'Storage Health:'}</span>
                <strong class="text-success" style="font-size: 12px;"><i class="fas fa-check-circle"></i> ${isAr ? 'مساحة وفيرة جداً' : 'Optimal Capacity'}</strong>
              </div>
            </div>
          </div>

          <!-- Browser Local Storage Metrics Card -->
          <div class="mt-2 p-3 rounded" style="background: #ffffff; border: 1px solid #e2e8f0;">
            <div class="d-flex justify-between items-center mb-1">
              <strong style="color: var(--sdi-blue); font-size: 13px;">
                <i class="fas fa-hdd text-warning"></i> ${isAr ? 'التخزين المحلي بالمتصفح (IndexedDB Offline Cache)' : 'Browser Local Storage (IndexedDB Cache)'}
              </strong>
              <span class="badge badge-info" style="font-size: 11px;">${isAr ? 'ذاكرة محلية سريعة' : 'Local Fast Cache'}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; font-size: 12px; margin-top: 6px;">
              <div class="p-2 rounded" style="background: #f8fafc; border: 1px solid #edf2f7;">
                <span class="text-muted block">${isAr ? 'المستخدم محلياً:' : 'Local Used:'}</span>
                <strong style="color: var(--sdi-blue);">${browserSt.usedPretty || '2 MB'}</strong>
              </div>
              <div class="p-2 rounded" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
                <span class="text-muted block">${isAr ? 'المتاح بالجهاز:' : 'Device Free:'}</span>
                <strong class="text-success">${browserSt.freePretty || (isAr ? 'وفير' : 'Ample')}</strong>
              </div>
              <div class="p-2 rounded" style="background: #f8fafc; border: 1px solid #edf2f7;">
                <span class="text-muted block">${isAr ? 'المزامنة السحابية:' : 'Cloud Realtime:'}</span>
                <strong class="text-success"><i class="fas fa-wifi"></i> ${isAr ? 'مباشرة ونشطة' : 'Live Active'}</strong>
              </div>
            </div>
          </div>

          <div class="text-xs text-muted mt-3" style="line-height: 1.8;">
            <div>• ${isAr ? 'مزود السحابة:' : 'Cloud Engine:'} <strong class="text-primary">${res.details.cloudEngine || "Supabase Cloud PostgreSQL"}</strong></div>
            <div>• ${isAr ? 'عنوان الخادم:' : 'Endpoint:'} <code>${res.details.cloudUrl || "https://xzfudqyctujxlhbgpdbs.supabase.co"}</code></div>
            <div>• ${isAr ? 'الأصول المسجلة بالسحابة:' : 'Cloud Assets Count:'} <strong>${res.details.cloudAssets !== undefined ? res.details.cloudAssets : res.details.totalAssets}</strong> ${isAr ? 'أصل مسجل' : 'Assets registered'}</div>
          </div>
        </div>
      `;
      this.showToast(isAr ? res.messageAr : res.message, "success");
    } else {
      const isAr = AppState.lang === "ar";
      container.innerHTML = `
        <div class="p-4 border rounded" style="background: rgba(239, 68, 68, 0.1); border-color: var(--accent-rose);">
          <div class="d-flex items-center gap-2 mb-2">
            <i class="fas fa-times-circle text-danger fa-2x"></i>
            <h4 class="text-danger font-bold" style="margin: 0;">${isAr ? res.messageAr : res.message}</h4>
          </div>
          ${isAr ? `<p class="text-sm">${res.message}</p>` : ''}
          <div class="text-xs text-danger mt-2">${isAr ? 'سبب الخطأ:' : 'Error details:'} ${res.error}</div>
        </div>
      `;
      this.showToast(isAr ? res.messageAr : res.message, "error");
    }
  }

  // Backup file upload handler
  async handleBackupUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await db.importBackup(json);
      this.showToast(AppState.lang === "ar" ? "تمت استعادة قاعدة البيانات بنجاح!" : "Database restored successfully!", "success");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      this.showToast((AppState.lang === "ar" ? "فشل استعادة النسخة: " : "Failed to restore backup: ") + err.message, "error");
    }
  }

  // =========================================================================
  // 6. LOGIN, LOGOUT & ROLE MANAGEMENT (REQ-25, 27, 28, 29, 30, 31, 32)
  // =========================================================================
  async openLoginModal() {
    if (document.getElementById("loginEmail")) {
        document.getElementById("loginEmail").value = "";
    }
    if (document.getElementById("loginPassword")) {
        document.getElementById("loginPassword").value = "";
    }
    this.openModal("loginModal");
  }

  async handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPassword").value;
    const lang = AppState.lang;

    if (!db.supabase) {
        this.showToast(lang === "ar" ? "قاعدة البيانات السحابية غير متصلة" : "Cloud database not connected", "error");
        return;
    }

    try {
        const { data: authData, error: authError } = await db.supabase.auth.signInWithPassword({
            email: email,
            password: pass
        });

        if (authError || !authData.user) {
            this.showToast(lang === "ar" ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password", "error");
            return;
        }

        // Fetch corresponding profile from users table using the Supabase auth user ID
        const { data: profile, error: profileError } = await db.supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

        if (profileError || !profile) {
            this.showToast(lang === "ar" ? "تم الدخول ولكن لم يتم العثور على ملف المستخدم" : "Logged in but profile not found", "error");
            // If we don't have a profile, we should probably sign out again
            await db.supabase.auth.signOut();
            return;
        }

        if (profile.active === false) {
            this.showToast(lang === "ar" ? "الحساب معطل. يرجى مراجعة إدارة النظام." : "Account is disabled. Please contact the administrator.", "error");
            await db.supabase.auth.signOut();
            return;
        }

        // Clear sensitive cache to ensure clean state for the new user, preventing cross-user data leakage offline
        if (typeof db !== "undefined" && db.clear) {
            const sensitiveStores = ["assets", "employees", "maintenance", "assetTransactions", "warehouseIssues", "assetTransfers", "helpdeskRequests", "notifications", "users"];
            for (const store of sensitiveStores) {
                try { await db.clear(store); } catch(err) {}
            }
        }

        AppState.currentUser = {
            id: profile.id,
            username: profile.username || authData.user.email,
            email: authData.user.email,
            fullName: profile.fullName || profile.username || authData.user.email,
            fullNameAr: profile.fullNameAr || profile.fullName || profile.username,
            fullNameEn: profile.fullNameEn || profile.username,
            role: profile.role || "IT User",
            employeeId: profile.employeeId || null
        };

        // REQ-31: Session & Storage - used for UI state only, not auth boundary
        localStorage.setItem("sdi_user", JSON.stringify(AppState.currentUser));
        sessionStorage.setItem("sdi_user", JSON.stringify(AppState.currentUser));

        this.applyUserRolePermissions();
        this.closeModal("loginModal");

        const welcomeName = getUserDisplayName(AppState.currentUser, lang);
        this.showToast(`${lang === "ar" ? "مرحباً بك:" : "Welcome:"} ${welcomeName} (${AppState.currentUser.role})`, "success");

        // Auto route based on role (REQ-55)
        if (AppState.currentUser.role === "Employee") {
            await this.switchTab("employeePortal", true);
        } else {
            await this.switchTab("dashboard", true);
        }

        await AssetManager.render();
        await UserManager.renderEmployees();
        await UserManager.renderDepartments();
        await UserManager.renderLocations();
        await MaintManager.render();
        await this.updateNotificationBadge();

    } catch (e) {
        console.warn("Login error:", e);
        this.showToast(lang === "ar" ? "حدث خطأ أثناء تسجيل الدخول" : "An error occurred during login", "error");
    }
  }

  // REQ-30 & REQ-31: Logout & Session Cleanup
  async logout() {
    if (db.supabase) {
        try {
            await db.supabase.auth.signOut();
        } catch (e) {
            console.warn("Supabase signout warning:", e);
        }
    }
    
    // Clear sensitive user-specific cache to prevent offline exposure to next user
    if (typeof db !== "undefined" && db.clear) {
        const sensitiveStores = ["assets", "employees", "maintenance", "assetTransactions", "warehouseIssues", "assetTransfers", "helpdeskRequests", "notifications", "users"];
        for (const store of sensitiveStores) {
            try { await db.clear(store); } catch(err) {}
        }
    }

    AppState.currentUser = null;
    localStorage.removeItem("sdi_user");
    sessionStorage.removeItem("sdi_user");
    this.navHistory = [];
    this.hasUnsavedChanges = false;
    this.closeModal("userProfileModal");
    this.closeModal("changePasswordModal");
    this.closeModal("notificationsModal");
    this.applyUserRolePermissions();
    this.openLoginModal();
    this.showToast(AppState.lang === "ar" ? "تم تسجيل الخروج بنجاح" : "Logged out successfully", "info");
  }

  applyUserRolePermissions() {
    const user = AppState.currentUser || { username: "guest", role: "Viewer", fullName: "Guest" };
    const nameEl = document.getElementById("currentUserName");
    const roleEl = document.getElementById("currentUserRole");
    const lang = AppState.lang;

    if (nameEl) {
      if (typeof getUserDisplayName === "function") {
        nameEl.textContent = getUserDisplayName(user, lang);
      } else {
        nameEl.textContent = lang === "ar" ? (user.fullNameAr || user.fullName || user.username) : (user.fullNameEn || user.username);
      }
    }
    if (roleEl) {
      let roleLabel = user.role;
      if (user.role === "Administrator") roleLabel = lang === "ar" ? "مدير النظام" : "Administrator";
      else if (user.role === "IT User") roleLabel = lang === "ar" ? "مسؤول تقنية المعلومات" : "IT User";
      else if (user.role === "Employee") roleLabel = lang === "ar" ? "موظف" : "Employee";
      roleEl.textContent = roleLabel;
    }

    const isAdmin = user.role === "Administrator";
    const isEmployee = user.role === "Employee";

    // Sidebar items control (REQ-32, REQ-55)
    const itNavItems = [
      "navDashboard",
      "navAssets",
      "navEmployees",
      "navDepartments",
      "navLocations",
      "navMaintenance",
      "navHelpdesk",
      "navReports"
    ];

    itNavItems.forEach(id => {
      const el = document.getElementById(id) || document.getElementById("navItem" + id.replace("nav", ""));
      if (el) el.style.display = isEmployee ? "none" : "flex";
    });

    const settingsNav = document.getElementById("navSettings") || document.getElementById("navItemSettings");
    if (settingsNav) settingsNav.style.display = isAdmin ? "flex" : "none";

    const empPortalNav = document.getElementById("navEmployeePortal") || document.getElementById("navItemEmployeePortal");
    if (empPortalNav) empPortalNav.style.display = isEmployee ? "flex" : "none";

    // Action buttons across views
    document.querySelectorAll(".user-write-action").forEach(btn => {
      btn.style.display = isEmployee ? "none" : "";
    });

    document.querySelectorAll(".user-admin-action").forEach(btn => {
      btn.style.display = isAdmin ? "" : "none";
    });

    this.updateNotificationBadge();
  }

  // REQ-23 & REQ-24: Notification Badge & Modal
  async updateNotificationBadge() {
    const badge = document.getElementById("headerNotificationBadge");
    const countSpan = document.getElementById("notificationCountText");
    if (!badge && !countSpan) return;

    let unread = 0;
    if (AppState.currentUser) {
      const all = await db.getAll("notifications");
      if (AppState.currentUser.role === "Employee") {
        unread = all.filter(n => n.employeeId === AppState.currentUser.employeeId && !n.read).length;
      } else {
        unread = all.filter(n => !n.read).length;
      }
    }

    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 99 ? "99+" : unread;
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }
    if (countSpan) {
      countSpan.textContent = unread;
    }
  }

  async openNotificationsModal() {
    const listEl = document.getElementById("notificationsListContainer");
    if (!listEl) return;

    const lang = AppState.lang;
    let notifs = await db.getAll("notifications");

    if (AppState.currentUser && AppState.currentUser.role === "Employee") {
      notifs = notifs.filter(n => n.employeeId === AppState.currentUser.employeeId);
    }
    notifs.sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));

    if (notifs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state py-4 text-center">
          <i class="fas fa-bell-slash text-muted" style="font-size: 32px; margin-bottom: 8px;"></i>
          <p class="text-muted">${lang === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}</p>
        </div>
      `;
    } else {
      listEl.innerHTML = notifs.map(n => `
        <div class="notification-item ${n.read ? 'read' : 'unread'}" style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; gap: 12px; align-items: flex-start; background: ${n.read ? 'transparent' : 'rgba(59, 130, 246, 0.08)'};">
          <div style="margin-top: 2px;">
            <i class="fas ${n.type === 'handover' ? 'fa-laptop-medical text-primary' : (n.type === 'helpdesk' ? 'fa-headset text-warning' : 'fa-info-circle text-info')}"></i>
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 13px;">${lang === 'ar' ? n.titleAr : (n.titleEn || n.titleAr)}</strong>
              <small class="text-muted text-xs">${n.createdDate ? n.createdDate.slice(0, 16).replace("T", " ") : ""}</small>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 12px;" class="text-muted">${lang === 'ar' ? n.messageAr : (n.messageEn || n.messageAr)}</p>
            <div style="margin-top: 6px; display: flex; gap: 8px;">
              ${!n.read ? `
                <button class="btn btn-xs btn-secondary" onclick="App.markNotificationAsRead('${n.id}')">
                  <i class="fas fa-check"></i> ${lang === 'ar' ? 'تحديد كمقروء' : 'Mark as Read'}
                </button>
              ` : ''}
              ${n.type === 'handover' ? `
                <button class="btn btn-xs btn-primary" onclick="App.closeModal('notificationsModal'); App.switchTab('employeePortal');">
                  ${lang === 'ar' ? 'بوابة الموظف' : 'Employee Portal'}
                </button>
              ` : ''}
              ${n.type === 'helpdesk' && n.relatedId ? `
                <button class="btn btn-xs btn-primary" onclick="App.closeModal('notificationsModal'); HelpdeskController.viewRequestDetails('${n.relatedId}');">
                  ${lang === 'ar' ? 'عرض الطلب' : 'View Request'}
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join("");
    }

    this.openModal("notificationsModal");
  }

  async markNotificationAsRead(id) {
    await db.markNotificationRead(id);
    await this.updateNotificationBadge();
    await this.openNotificationsModal();
  }

  async markAllNotificationsAsRead() {
    const notifs = await db.getAll("notifications");
    for (const n of notifs) {
      if (!n.read) {
        if (!AppState.currentUser || AppState.currentUser.role !== "Employee" || n.employeeId === AppState.currentUser.employeeId) {
          n.read = true;
          await db.put("notifications", n);
        }
      }
    }
    await this.updateNotificationBadge();
    await this.openNotificationsModal();
  }

  // REQ-25 & REQ-26: User Profile & Password Change Modals
  openUserProfileModal() {
    const user = AppState.currentUser;
    if (!user) return;
    const lang = AppState.lang;

    document.getElementById("profileUsername").textContent = user.username || "-";
    document.getElementById("profileFullName").textContent = getUserDisplayName ? getUserDisplayName(user, lang) : (lang === "ar" ? (user.fullNameAr || user.fullName) : (user.fullNameEn || user.fullName));
    document.getElementById("profileRole").textContent = formatRole ? formatRole(user.role, lang) : user.role;

    this.openModal("userProfileModal");
  }

  openChangePasswordModal() {
    const form = document.getElementById("changePasswordForm");
    if (form) form.reset();
    this.closeModal("userProfileModal");
    this.openModal("changePasswordModal");
  }

  // =========================================================================
  // 7. GLOBAL MODAL & TOAST HELPERS
  // =========================================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      this.modalZIndex = (this.modalZIndex || 100000) + 10;
      modal.style.zIndex = this.modalZIndex;
      modal.classList.add("active");
      modal.classList.add("show");
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      // Auto-enhance all select elements within the modal with live search comboboxes
      setTimeout(() => {
        try { this.enhanceAllSelects(modal); } catch (e) {}
      }, 20);

      // Auto-focus first input for fast and smooth data entry
      setTimeout(() => {
        try {
          const firstInput = modal.querySelector("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])");
          if (firstInput && typeof firstInput.focus === "function") {
            firstInput.focus();
          }
        } catch (e) {
          // safe guard
        }
      }, 60);

      // Auto-synchronize and wire the Form Info Banner with live inputs
      setTimeout(() => {
        try { this.syncModalBanner(modalId); } catch (e) {}
      }, 50);
    } else {
      console.warn("openModal: Element not found:", modalId);
    }
  }

  syncModalBanner(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const banner = modal.querySelector(".form-info-banner");
    if (!banner) return;

    const getText = (el) => {
      if (!el) return "-";
      if (el.tagName === "SELECT") {
        const opt = el.options[el.selectedIndex];
        return (opt && opt.value) ? (opt.textContent.trim() || "-") : "-";
      }
      return (el.value !== undefined && el.value !== null && el.value.toString().trim() !== "") ? el.value.toString().trim() : "-";
    };

    const updateMap = {
      assetModal: () => {
        const id = document.getElementById("bannerAssetId");
        const type = document.getElementById("bannerAssetType");
        const model = document.getElementById("bannerAssetModel");
        const status = document.getElementById("bannerAssetStatus");
        const loc = document.getElementById("bannerAssetLocation");
        if (id) id.textContent = getText(document.getElementById("formAssetId"));
        if (type) type.textContent = getText(document.getElementById("formAssetType"));
        if (model) {
          const b = getText(document.getElementById("formAssetBrand"));
          const m = getText(document.getElementById("formAssetModel"));
          model.textContent = (b !== "-" || m !== "-") ? `${b !== "-" ? b : ""} ${m !== "-" ? m : ""}`.trim() : "-";
        }
        if (status) status.textContent = getText(document.getElementById("formAssetStatus"));
        if (loc) loc.textContent = getText(document.getElementById("formAssetLocation"));
      },
      assignModal: () => {
        const a = document.getElementById("bannerAssignAsset");
        const e = document.getElementById("bannerAssignEmployee");
        const d = document.getElementById("bannerAssignDate");
        const s = document.getElementById("bannerAssignStatus");
        if (a) a.textContent = getText(document.getElementById("formAssignAssetSummary")) || getText(document.getElementById("formAssignAssetId"));
        if (e) e.textContent = getText(document.getElementById("formAssignEmployee"));
        if (d) d.textContent = getText(document.getElementById("formAssignDate"));
        if (s) s.textContent = (typeof formatStatus === "function") ? formatStatus("Assigned", AppState.lang) : "Assigned";
      },
      returnModal: () => {
        const a = document.getElementById("bannerReturnAsset");
        const d = document.getElementById("bannerReturnDate");
        const c = document.getElementById("bannerReturnCondition");
        const l = document.getElementById("bannerReturnLocation");
        if (a) a.textContent = getText(document.getElementById("formReturnAssetSummary")) || getText(document.getElementById("formReturnAssetId"));
        if (d) d.textContent = getText(document.getElementById("formReturnDate"));
        if (c) c.textContent = getText(document.getElementById("formReturnCondition"));
        if (l) l.textContent = getText(document.getElementById("formReturnLocation"));
      },
      transferModal: () => {
        const a = document.getElementById("bannerTransferAsset");
        const tt = document.getElementById("bannerTransferType");
        const l = document.getElementById("bannerTransferLocation");
        const e = document.getElementById("bannerTransferEmployee");
        if (a) a.textContent = getText(document.getElementById("formTransferAssetSummary")) || getText(document.getElementById("formTransferAssetId"));
        if (tt) tt.textContent = getText(document.getElementById("formTransferType"));
        if (l) l.textContent = getText(document.getElementById("formTransferLocation"));
        if (e) e.textContent = getText(document.getElementById("formTransferEmployee"));
      },
      warehouseIssueModal: () => {
        const v = document.getElementById("bannerWiVoucher");
        const w = document.getElementById("bannerWiWarehouse");
        const t = document.getElementById("bannerWiTech");
        const d = document.getElementById("bannerWiDate");
        if (v) v.textContent = getText(document.getElementById("formWiIssueNo"));
        if (w) w.textContent = getText(document.getElementById("formWiWarehouse"));
        if (t) t.textContent = getText(document.getElementById("formWiTechnician"));
        if (d) d.textContent = getText(document.getElementById("formWiDate"));
      },
      installationModal: () => {
        const i = document.getElementById("bannerInstIssue");
        const a = document.getElementById("bannerInstAsset");
        const l = document.getElementById("bannerInstLoc");
        const d = document.getElementById("bannerInstDate");
        if (i) i.textContent = getText(document.getElementById("formInstIssueNoDisplay"));
        if (a) a.textContent = getText(document.getElementById("formInstAssetDisplay"));
        if (l) l.textContent = getText(document.getElementById("formInstLocation"));
        if (d) d.textContent = getText(document.getElementById("formInstDate"));
      },
      removeFromInstallationModal: () => {
        const a = document.getElementById("bannerRemoveAsset");
        const d = document.getElementById("bannerRemoveDate");
        const dest = document.getElementById("bannerRemoveDest");
        const t = document.getElementById("bannerRemoveTech");
        if (a) a.textContent = getText(document.getElementById("removeAssetSummaryDisplay")) || getText(document.getElementById("formRemoveAssetId"));
        if (d) d.textContent = getText(document.getElementById("formRemovalDate"));
        if (dest) dest.textContent = getText(document.getElementById("formRemovalDestination"));
        if (t) t.textContent = getText(document.getElementById("formRemovalTech"));
      },
      projectModal: () => {
        const n = document.getElementById("bannerPrjNo");
        const nm = document.getElementById("bannerPrjName");
        const s = document.getElementById("bannerPrjStatus");
        const l = document.getElementById("bannerPrjLead");
        const b = document.getElementById("bannerPrjBudget");
        if (n) n.textContent = getText(document.getElementById("formProjectNumber"));
        if (nm) nm.textContent = getText(document.getElementById("formProjectName"));
        if (s) s.textContent = getText(document.getElementById("formProjectStatus"));
        if (l) l.textContent = getText(document.getElementById("formProjectManager"));
        if (b) {
          const val = getText(document.getElementById("formProjectBudget"));
          b.textContent = val !== "-" ? `${val} SAR` : "-";
        }
      },
      projectTaskModal: () => {
        const tn = document.getElementById("bannerTaskName");
        const ta = document.getElementById("bannerTaskAssignee");
        const tp = document.getElementById("bannerTaskPriority");
        const td = document.getElementById("bannerTaskDueDate");
        const pr = document.getElementById("bannerTaskProgress");
        if (tn) tn.textContent = getText(document.getElementById("formTaskName"));
        if (ta) ta.textContent = getText(document.getElementById("formTaskAssignee"));
        if (tp) tp.textContent = getText(document.getElementById("formTaskPriority"));
        if (td) td.textContent = getText(document.getElementById("formTaskDueDate"));
        if (pr) {
          const val = getText(document.getElementById("formTaskProgress"));
          pr.textContent = val !== "-" ? `${val}%` : "-";
        }
      },
      contractorModal: () => {
        const c = document.getElementById("bannerContractorCode");
        const comp = document.getElementById("bannerContractorCompany");
        const cont = document.getElementById("bannerContractorContact");
        const p = document.getElementById("bannerContractorPhone");
        const s = document.getElementById("bannerContractorStatus");
        if (c) c.textContent = getText(document.getElementById("formContractorCode"));
        if (comp) comp.textContent = getText(document.getElementById("formContractorCompany"));
        if (cont) cont.textContent = getText(document.getElementById("formContractorContact"));
        if (p) p.textContent = getText(document.getElementById("formContractorPhone"));
        if (s) s.textContent = getText(document.getElementById("formContractorStatus"));
      },
      maintenanceModal: () => {
        const a = document.getElementById("bannerMaintAsset");
        const ty = document.getElementById("bannerMaintType");
        const pr = document.getElementById("bannerMaintPriority");
        const te = document.getElementById("bannerMaintTech");
        const st = document.getElementById("bannerMaintStatus");
        if (a) a.textContent = getText(document.getElementById("formMaintAsset"));
        if (ty) ty.textContent = getText(document.getElementById("formMaintType"));
        if (pr) pr.textContent = getText(document.getElementById("formMaintPriority"));
        if (te) te.textContent = getText(document.getElementById("formMaintTechnician"));
        if (st) st.textContent = getText(document.getElementById("formMaintStatus"));
      },
      employeeModal: () => {
        const id = document.getElementById("bannerEmpId");
        const nm = document.getElementById("bannerEmpName");
        const dp = document.getElementById("bannerEmpDept");
        const lc = document.getElementById("bannerEmpLoc");
        const st = document.getElementById("bannerEmpStatus");
        if (id) id.textContent = getText(document.getElementById("formEmpCode"));
        if (nm) nm.textContent = getText(document.getElementById("formEmpName"));
        if (dp) dp.textContent = getText(document.getElementById("formEmpDepartment"));
        if (lc) lc.textContent = getText(document.getElementById("formEmpLocation"));
        if (st) st.textContent = getText(document.getElementById("formEmpStatus"));
      },
      departmentModal: () => {
        const cd = document.getElementById("bannerDeptCode");
        const ar = document.getElementById("bannerDeptNameAr");
        const en = document.getElementById("bannerDeptNameEn");
        const lc = document.getElementById("bannerDeptLoc");
        if (cd) cd.textContent = getText(document.getElementById("formDeptCode"));
        if (ar) ar.textContent = getText(document.getElementById("formDeptNameAr"));
        if (en) en.textContent = getText(document.getElementById("formDeptNameEn"));
        if (lc) lc.textContent = getText(document.getElementById("formDeptLocation"));
      },
      locationModal: () => {
        const nm = document.getElementById("bannerLocName");
        const bg = document.getElementById("bannerLocBuilding");
        const fl = document.getElementById("bannerLocFloor");
        const ty = document.getElementById("bannerLocType");
        if (nm) nm.textContent = getText(document.getElementById("formLocName"));
        if (bg) bg.textContent = getText(document.getElementById("formLocBuilding"));
        if (fl) fl.textContent = getText(document.getElementById("formLocFloor"));
        if (ty) ty.textContent = getText(document.getElementById("formLocType"));
      },
      assetTypeModal: () => {
        const cd = document.getElementById("bannerTypeCode");
        const ar = document.getElementById("bannerTypeNameAr");
        const en = document.getElementById("bannerTypeNameEn");
        const ct = document.getElementById("bannerTypeCategory");
        if (cd) cd.textContent = getText(document.getElementById("formTypeCode"));
        if (ar) ar.textContent = getText(document.getElementById("formTypeNameAr"));
        if (en) en.textContent = getText(document.getElementById("formTypeNameEn"));
        if (ct) ct.textContent = getText(document.getElementById("formTypeCategory"));
      },
      userModal: () => {
        const un = document.getElementById("bannerUsername");
        const fn = document.getElementById("bannerUserFullname");
        const rl = document.getElementById("bannerUserRole");
        const st = document.getElementById("bannerUserStatus");
        if (un) un.textContent = getText(document.getElementById("formUserUsername"));
        if (fn) fn.textContent = getText(document.getElementById("formUserFullName"));
        if (rl) rl.textContent = getText(document.getElementById("formUserRole"));
        if (st) st.textContent = getText(document.getElementById("formUserStatus"));
      },
      licenseModal: () => {
        const nm = document.getElementById("bannerLicName");
        const pb = document.getElementById("bannerLicPublisher");
        const st = document.getElementById("bannerLicSeats");
        const ex = document.getElementById("bannerLicExpiry");
        if (nm) nm.textContent = getText(document.getElementById("formLicSoftwareName"));
        if (pb) pb.textContent = getText(document.getElementById("formLicPublisher"));
        if (st) st.textContent = getText(document.getElementById("formLicSeatsTotal"));
        if (ex) ex.textContent = getText(document.getElementById("formLicExpiryDate"));
      },
      newSupportRequestModal: () => {
        const dv = document.getElementById("bannerNsrDevice");
        const pr = document.getElementById("bannerNsrPriority");
        const tl = document.getElementById("bannerNsrTitle");
        const st = document.getElementById("bannerNsrStatus");
        if (dv) dv.textContent = getText(document.getElementById("formNsrAssetId"));
        if (pr) pr.textContent = getText(document.getElementById("formNsrPriority"));
        if (tl) tl.textContent = getText(document.getElementById("formNsrSubject"));
        if (st) st.textContent = (typeof t === "function") ? t("statusNew", "New") : "New";
      }
    };

    if (updateMap[modalId]) {
      updateMap[modalId]();
    }

    // Attach listeners once to update banner dynamically on change/input
    if (!modal.dataset.bannerListenerBound) {
      modal.dataset.bannerListenerBound = "true";
      modal.addEventListener("input", () => {
        if (updateMap[modalId]) updateMap[modalId]();
      });
      modal.addEventListener("change", () => {
        if (updateMap[modalId]) updateMap[modalId]();
      });
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      modal.classList.remove("show");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      if (!document.querySelector(".modal-container.active, .modal-container.show")) {
        document.body.classList.remove("modal-open");
      }
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    let icon = "fa-info-circle";
    let bg = "var(--bg-card)";
    let border = "var(--border-color)";

    if (type === "success") {
      icon = "fa-check-circle text-success";
      border = "var(--accent-emerald)";
    } else if (type === "error") {
      icon = "fa-exclamation-circle text-danger";
      border = "var(--accent-rose)";
    }

    container.innerHTML = `
      <div class="toast-item" style="background: ${bg}; border: 1px solid ${border}; padding: 12px 20px; border-radius: 8px; box-shadow: var(--shadow-lg); display: flex; align-items: center; gap: 10px;">
        <i class="fas ${icon}"></i>
        <span>${message}</span>
      </div>
    `;

    this.toastTimeout = setTimeout(() => {
      container.innerHTML = "";
    }, 3500);
  }

  // =========================================================================
  // 7.1 UNIVERSAL SEARCHABLE COMBOBOX CONTROLLER (SYSTEM-WIDE)
  // =========================================================================
  normalizeComboboxText(str) {
    if (!str) return "";
    return str
      .toString()
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u0652]/g, "") // remove Arabic tashkeel/diacritics
      .trim();
  }

  /**
   * Universal Searchable Select Engine
   * Converts any standard HTML <select> into a high-performance, accessible combobox
   * with live instant search filtering, keyboard shortcuts, Arabic normalization,
   * and complete 2-way synchronization with native DOM events.
   */
  enhanceSelectWithSearch(selectInput, defaultPlaceholder, searchPlaceholder) {
    const select = typeof selectInput === "string" ? document.getElementById(selectInput) : selectInput;
    if (!select || !select.tagName || select.tagName.toLowerCase() !== "select") return;
    if (select.getAttribute("data-no-combobox") === "true") return;

    let wrapper = select.closest(".combobox-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "combobox-wrapper";
      if (select.id) wrapper.setAttribute("data-combobox-for", select.id);
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
    }

    // Hide native select visually while keeping it fully functioning for required checks, value extraction, and form submission
    select.style.position = "absolute";
    select.style.opacity = "0";
    select.style.height = "1px";
    select.style.width = "1px";
    select.style.pointerEvents = "none";
    select.style.zIndex = "-1";
    select.tabIndex = -1;

    const lang = (window.AppState && window.AppState.lang) || "ar";
    const searchPh = searchPlaceholder || (lang === "ar" ? "ابحث هنا..." : "Search here...");
    const emptyText = lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching results";

    // Clean up previous elements if already exists in wrapper
    const oldTrigger = wrapper.querySelector(".combobox-trigger");
    if (oldTrigger) oldTrigger.remove();
    const oldDropdown = wrapper.querySelector(".combobox-dropdown");
    if (oldDropdown) oldDropdown.remove();

    // Trigger button
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "form-control combobox-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
      <span class="combobox-trigger-text"></span>
      <i class="fas fa-chevron-down combobox-trigger-icon"></i>
    `;

    // Dropdown container
    const dropdown = document.createElement("div");
    dropdown.className = "combobox-dropdown";
    dropdown.style.display = "none";

    // Search box
    const searchBox = document.createElement("div");
    searchBox.className = "combobox-search-box";
    searchBox.innerHTML = `
      <i class="fas fa-search combobox-search-icon"></i>
      <input type="text" class="combobox-search-input" placeholder="${searchPh}" autocomplete="off" spellcheck="false">
      <button type="button" class="combobox-search-clear" title="${lang === 'ar' ? 'مسح' : 'Clear'}" style="display: none;">&times;</button>
    `;

    const searchInput = searchBox.querySelector(".combobox-search-input");
    const clearBtn = searchBox.querySelector(".combobox-search-clear");

    const optionsList = document.createElement("ul");
    optionsList.className = "combobox-options-list";
    optionsList.setAttribute("role", "listbox");

    const syncTriggerText = () => {
      const triggerTextEl = trigger.querySelector(".combobox-trigger-text");
      if (!triggerTextEl) return;
      const selectedOpt = select.options[select.selectedIndex];
      if (selectedOpt && (selectedOpt.value || selectedOpt.textContent.trim())) {
        triggerTextEl.textContent = selectedOpt.textContent.trim();
      } else {
        triggerTextEl.textContent = defaultPlaceholder || (selectedOpt ? selectedOpt.textContent.trim() : (lang === "ar" ? "اختر..." : "Select..."));
      }
    };

    const populateOptions = (filterQuery = "") => {
      optionsList.innerHTML = "";
      const rawQuery = filterQuery.trim();
      const normalizedQ = this.normalizeComboboxText(rawQuery);
      let matchCount = 0;

      Array.from(select.options).forEach((opt, idx) => {
        const text = (opt.textContent || "").trim();
        const val = opt.value;
        const normalizedText = this.normalizeComboboxText(text);

        if (normalizedQ && !normalizedText.includes(normalizedQ) && !this.normalizeComboboxText(val).includes(normalizedQ)) {
          return;
        }

        matchCount++;
        const li = document.createElement("li");
        li.className = "combobox-option" + (opt.selected ? " selected" : "");
        li.setAttribute("data-value", val);
        li.setAttribute("data-index", idx);
        li.setAttribute("role", "option");

        if (rawQuery && normalizedQ) {
          try {
            const escQ = rawQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const reg = new RegExp(`(${escQ})`, 'gi');
            li.innerHTML = text.replace(reg, '<span class="combobox-highlight">$1</span>');
          } catch(e) {
            li.textContent = text;
          }
        } else {
          li.textContent = text;
        }

        li.addEventListener("click", (e) => {
          e.stopPropagation();
          select.value = val;
          select.selectedIndex = idx;
          syncTriggerText();
          dropdown.style.display = "none";
          trigger.classList.remove("open");
          trigger.setAttribute("aria-expanded", "false");

          // Dispatch standard events for reactive forms
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });

        optionsList.appendChild(li);
      });

      if (matchCount === 0) {
        const emptyLi = document.createElement("li");
        emptyLi.className = "combobox-empty";
        emptyLi.innerHTML = `<i class="fas fa-search-minus" style="opacity: 0.6;"></i> <span>${emptyText}</span>`;
        optionsList.appendChild(emptyLi);
      }
    };

    // Instant search input listener
    searchInput.addEventListener("input", (e) => {
      e.stopPropagation();
      const val = searchInput.value;
      clearBtn.style.display = val.length > 0 ? "flex" : "none";
      populateOptions(val);
    });

    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      searchInput.value = "";
      clearBtn.style.display = "none";
      populateOptions("");
      searchInput.focus();
    });

    searchBox.addEventListener("click", (e) => e.stopPropagation());

    // Toggle dropdown open / close
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".combobox-dropdown").forEach(d => {
        if (d !== dropdown) {
          d.style.display = "none";
          const t = d.parentElement && d.parentElement.querySelector(".combobox-trigger");
          if (t) {
            t.classList.remove("open");
            t.setAttribute("aria-expanded", "false");
          }
        }
      });

      const isOpen = dropdown.style.display === "flex" || dropdown.style.display === "block";
      if (isOpen) {
        dropdown.style.display = "none";
        trigger.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      } else {
        dropdown.style.display = "flex";
        trigger.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        searchInput.value = "";
        clearBtn.style.display = "none";
        populateOptions("");
        setTimeout(() => searchInput.focus(), 30);
      }
    });

    // Keyboard support on search box
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.style.display = "none";
        trigger.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const firstOpt = optionsList.querySelector(".combobox-option");
        if (firstOpt) firstOpt.click();
      }
    });

    select.addEventListener("change", syncTriggerText);
    select.addEventListener("input", syncTriggerText);

    // Intercept select.value setter so programmatic changes update the trigger
    const protoDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (protoDesc && !select._comboboxIntercepted) {
      select._comboboxIntercepted = true;
      Object.defineProperty(select, "value", {
        get() { return protoDesc.get.call(this); },
        set(newVal) {
          protoDesc.set.call(this, newVal);
          syncTriggerText();
        },
        configurable: true
      });
    }

    // MutationObserver to observe dynamically added or changed options
    if (window.MutationObserver && !select._comboboxObserver) {
      select._comboboxObserver = new MutationObserver(() => {
        syncTriggerText();
        if (dropdown.style.display === "flex" || dropdown.style.display === "block") {
          populateOptions(searchInput.value);
        }
      });
      select._comboboxObserver.observe(select, { childList: true, subtree: true, characterData: true });
    }

    select._syncComboboxTrigger = syncTriggerText;
    select._populateComboboxOptions = populateOptions;

    syncTriggerText();
    populateOptions();

    dropdown.appendChild(searchBox);
    dropdown.appendChild(optionsList);
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
  }

  enhanceAllSelects(container = document) {
    if (!container || !container.querySelectorAll) return;
    const selects = container.querySelectorAll("select");
    selects.forEach(select => {
      try {
        this.enhanceSelectWithSearch(select);
      } catch(err) {
        console.warn("enhanceSelectWithSearch warning:", err);
      }
    });
  }

  // =========================================================================
  // 8. THEME & LANGUAGE CONTROLLER
  // =========================================================================
  async toggleLanguage() {
    const newLang = AppState.lang === "ar" ? "en" : "ar";
    AppState.lang = newLang;
    localStorage.setItem("sdi_lang", newLang);
    this.applyLanguage(newLang);

    // Refresh all rendered views and dropdowns
    await this.updateDashboard();
    if (window.AssetManager) {
      await AssetManager.populateDropdowns();
      await AssetManager.render();
    }
    if (window.UserManager) {
      await UserManager.renderEmployees();
      await UserManager.renderDepartments();
      await UserManager.renderLocations();
      await UserManager.renderAssetTypes();
      await UserManager.renderUsers();
    }
    if (window.TreeManager) {
      await TreeManager.render();
    }
    if (window.MaintManager) {
      await MaintManager.render();
    }
    if (window.Helpdesk) {
      await Helpdesk.render();
    }
    await this.populateReportDropdowns();
    await this.generateSelectedReport();
    await this.updateNotificationBadge();
    this.applyUserRolePermissions();
  }

  applyLanguage(lang) {
    if (document.documentElement) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }

    document.title = lang === "ar" ? "SDI IT Asset Hub | نظام إدارة وحصر أصول تقنية المعلومات" : "SDI IT Asset Hub | IT Asset Management System";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = lang === "ar" 
        ? "نظام إدارة وحصر أجهزة وأصول تقنية المعلومات - معهد الشارقة للسياقة" 
        : "SDI IT Asset Hub - IT Asset Management System - Sharjah Driving Institute";
    }

    const label = document.getElementById("langToggleLabel");
    if (label) label.textContent = lang === "ar" ? "English" : "Arabic";

    const statusText = document.getElementById("sidebarStatusText");
    if (statusText) statusText.textContent = lang === 'ar' ? "قاعدة بيانات محلية متصلة" : "Local Database Connected";

    // Translate all [data-i18n]
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (I18N[lang] && I18N[lang][key]) {
        el.textContent = I18N[lang][key];
      }
    });

    // Translate all [data-i18n-placeholder]
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (I18N[lang] && I18N[lang][key]) {
        el.placeholder = I18N[lang][key];
      }
    });

    // Translate all [data-i18n-title]
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (I18N[lang] && I18N[lang][key]) {
        el.title = I18N[lang][key];
      }
    });

    // Translate all <option data-i18n>
    document.querySelectorAll("option[data-i18n]").forEach(opt => {
      const key = opt.getAttribute("data-i18n");
      if (I18N[lang] && I18N[lang][key]) {
        opt.textContent = I18N[lang][key];
      }
    });

    // Translate current user role pill & name
    this.applyUserRolePermissions();

    // Re-apply database institutional branding
    this.applyBranding();
  }

  toggleThemePaletteDropdown(forceState) {
    const dropdown = document.getElementById("themePaletteDropdown");
    if (!dropdown) return;
    const isVisible = dropdown.style.display === "block";
    const nextState = typeof forceState === "boolean" ? forceState : !isVisible;
    dropdown.style.display = nextState ? "block" : "none";
    if (nextState) {
      this.updateThemePaletteUI();
    }
  }

  setColorTheme(colorName) {
    AppState.colorTheme = colorName;
    localStorage.setItem("sdi_color_theme", colorName);
    document.body.setAttribute("data-color-theme", colorName);
    this.updateThemePaletteUI();
  }

  setThemeMode(mode) {
    AppState.theme = mode;
    localStorage.setItem("sdi_theme", mode);
    this.applyTheme(mode);
  }

  updateThemePaletteUI() {
    const currentTheme = AppState.theme || "dark";
    const currentColor = AppState.colorTheme || localStorage.getItem("sdi_color_theme") || "orange";

    const lightBtn = document.getElementById("btnModeLight");
    const darkBtn = document.getElementById("btnModeDark");
    if (lightBtn && darkBtn) {
      lightBtn.classList.toggle("active", currentTheme === "light");
      darkBtn.classList.toggle("active", currentTheme === "dark");
    }

    const swatches = ["orange", "blue", "emerald", "purple", "teal", "rose"];
    swatches.forEach(c => {
      const btn = document.getElementById(`swatch-${c}`);
      if (btn) {
        const isActive = c === currentColor;
        btn.classList.toggle("active", isActive);
        const icon = btn.querySelector("i");
        if (icon) icon.style.display = isActive ? "block" : "none";
      }
    });
  }

  toggleTheme() {
    const newTheme = AppState.theme === "dark" ? "light" : "dark";
    this.setThemeMode(newTheme);
  }

  applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    const icon = document.getElementById("themeToggleIcon");
    if (icon) {
      icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
    this.updateThemePaletteUI();
  }
}

// Global Application Singleton
const App = new Application();
window.App = App;

// Global Searchable Combobox Exports & Event Listeners
window.enhanceSelectWithSearch = (sel, def, ph) => App.enhanceSelectWithSearch(sel, def, ph);
window.enhanceAllSelects = (container) => App.enhanceAllSelects(container);

if (typeof window !== "undefined" && typeof document !== "undefined" && !window._comboboxGlobalListenersAdded) {
  window._comboboxGlobalListenersAdded = true;
  document.addEventListener("click", () => {
    document.querySelectorAll(".combobox-dropdown").forEach(d => {
      d.style.display = "none";
      const t = d.parentElement && d.parentElement.querySelector(".combobox-trigger");
      if (t) {
        t.classList.remove("open");
        t.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".combobox-dropdown").forEach(d => {
        d.style.display = "none";
        const t = d.parentElement && d.parentElement.querySelector(".combobox-trigger");
        if (t) {
          t.classList.remove("open");
          t.setAttribute("aria-expanded", "false");
        }
      });
    }
  });
}

// Bootstrap on DOM Ready or immediately if document is already loaded
if (typeof window !== "undefined" && typeof document !== "undefined" && !window.__SDI_TEST_ENV__) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      App.init();
    });
  } else if (document.body) {
    App.init();
  }
}
