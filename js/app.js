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
  theme: safeGetStorage("sdi_theme", "light"),
  currentTab: "dashboard",
  currentSettingsSubTab: "dbTest",
  currentUser: null
};
var AppState = window.AppState;

class Application {
  constructor() {
    this.toastTimeout = null;
    this.navHistory = [];
    this.hasUnsavedChanges = false;
    this.pendingNavTarget = null;
  }

  /**
   * SHARED DETERMINISTIC AUTHENTICATED PROFILE RESOLVER
   * Used identically for interactive login and boot session restoration.
   * Resolves Supabase Auth identity strictly to authoritative public.users profile.
   *
   * @param {Object} authUser - Supabase Auth User object
   * @param {Object} options - Resolution options (e.g. allowAdminSelfHealing)
   * @returns {Promise<{status: string, profile: Object|null, error: Error|null, resolutionMethod?: string}>}
   */
  async resolveAuthenticatedProfile(authUser, options = {}) {
    if (!authUser || !authUser.id) {
      return {
        status: "AUTH_INVALID_CREDENTIALS",
        profile: null,
        error: new Error("No authenticated user identity provided")
      };
    }

    if (!db || !db.supabase) {
      return {
        status: "PROFILE_QUERY_ERROR",
        profile: null,
        error: new Error("Database client not available")
      };
    }

    const safeColumns = "id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active";

    // STEP 1 — EXACT AUTH UID LOOKUP
    try {
      const { data: directUser, error: queryError } = await db.supabase
        .from('users')
        .select('id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (queryError) {
        console.error("Direct auth_user_id lookup query error:", queryError);
        return {
          status: "PROFILE_QUERY_ERROR",
          profile: null,
          error: queryError
        };
      }

      if (directUser) {
        if (directUser.active === false) {
          return {
            status: "ACCOUNT_DEACTIVATED",
            profile: directUser,
            error: new Error("User account is deactivated")
          };
        }
        return {
          status: "SUCCESS",
          profile: directUser,
          resolutionMethod: "EXACT_AUTH_UID"
        };
      }
    } catch (err) {
      console.error("Exception during direct auth_user_id query:", err);
      return {
        status: "PROFILE_QUERY_ERROR",
        profile: null,
        error: err
      };
    }

    // STEP 2 — VERIFIED AUTH EMAIL LOOKUP
    const authEmail = (authUser.email || "").trim().toLowerCase();
    if (!authEmail) {
      return {
        status: "AUTH_SUCCESS_PROFILE_NOT_FOUND",
        profile: null,
        error: new Error("Authenticated identity has no verified email")
      };
    }

    let emailMatches = null;
    try {
      const { data: matchedUsers, error: emailError } = await db.supabase
          .from('users')
          .select('id, username, full_name, full_name_ar, full_name_en, role, employee_id, auth_user_id, active')
          .eq('email', authEmail);

      if (emailError) {
        console.error("Email-based profile lookup error:", emailError);
        const isRls = emailError.code === "42501" || 
                      emailError.code === "PGRST301" || 
                      String(emailError.message || "").toLowerCase().includes("policy") ||
                      String(emailError.message || "").toLowerCase().includes("permission");
        if (isRls) {
          return {
            status: "PROFILE_LINK_REQUIRES_SECURE_RESOLUTION",
            profile: null,
            error: emailError
          };
        }
        return {
          status: "PROFILE_QUERY_ERROR",
          profile: null,
          error: emailError
        };
      }
      emailMatches = matchedUsers;
    } catch (err) {
      console.error("Exception during email profile query:", err);
      return {
        status: "PROFILE_QUERY_ERROR",
        profile: null,
        error: err
      };
    }

    if (!emailMatches || emailMatches.length === 0) {
      return {
        status: "AUTH_SUCCESS_PROFILE_NOT_FOUND",
        profile: null,
        error: new Error("No registered application profile found for verified email")
      };
    }

    // STEP 3 — AMBIGUITY CHECK
    if (emailMatches.length > 1) {
      return {
        status: "PROFILE_AMBIGUOUS",
        profile: null,
        error: new Error("Multiple user profiles found matching this email"),
        matchesCount: emailMatches.length
      };
    }

    const candidate = emailMatches[0];

    // Check if candidate is active
    if (candidate.active === false) {
      return {
        status: "ACCOUNT_DEACTIVATED",
        profile: candidate,
        error: new Error("User account is deactivated")
      };
    }

    // STEP 4 — IDENTITY CONFLICT PROTECTION
    if (candidate.auth_user_id && candidate.auth_user_id !== authUser.id) {
      return {
        status: "AUTH_SUCCESS_MAPPING_CONFLICT",
        profile: candidate,
        error: new Error("Profile is already linked to a different authentication identity")
      };
    }

    // If candidate is already linked to this authUser.id
    if (candidate.auth_user_id === authUser.id) {
      return {
        status: "SUCCESS",
        profile: candidate,
        resolutionMethod: "VERIFIED_EMAIL_MATCH"
      };
    }

    // STEP 5 — SAFE ADMIN SELF-HEALING
    // Strict conditions:
    // 1. Auth succeeded (authUser.id exists)
    // 2. authUser.email exists
    // 3. Exactly one profile matches the Auth email
    // 4. Profile is active
    // 5. Profile auth_user_id is NULL
    // 6. Profile is not already associated with another Auth UID
    // 7. Approved admin self-healing: candidate role is strictly "Administrator" and allowAdminSelfHealing !== false
    // Note: Generic callers must NOT be able to set allowSelfHealing: true to bypass Administrator check.
    if (candidate.auth_user_id != null && candidate.auth_user_id !== "") {
      return {
        status: "AUTH_SUCCESS_MAPPING_CONFLICT",
        profile: candidate,
        error: new Error("Profile already has an associated auth_user_id")
      };
    }

    const isCandidateAdmin = String(candidate.role || "").trim() === "Administrator";
    const isCandidateActive = candidate.active !== false;
    const approvedSelfHealing = options.allowAdminSelfHealing !== false && isCandidateAdmin && isCandidateActive;

    if (!approvedSelfHealing) {
      return {
        status: "AUTH_SUCCESS_MAPPING_MISSING",
        profile: candidate,
        error: new Error("User profile exists but auth_user_id mapping is unlinked")
      };
    }

    // Execute Cloud update
    try {
      const { data: updateRes, error: updateError } = await db.supabase
        .from("users")
        .update({ auth_user_id: authUser.id })
        .eq("id", candidate.id);

      if (updateError) {
        console.error("Admin self-healing update failed:", updateError);
        return {
          status: "PROFILE_LINK_ERROR",
          profile: candidate,
          error: updateError
        };
      }

      // STEP 6 — VERIFY CLOUD UPDATE WITH FRESH READ
      const { data: freshProfile, error: freshError } = await db.supabase
        .from("users")
        .select(safeColumns)
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (freshError) {
        console.error("Fresh profile read after link failed:", freshError);
        return {
          status: "PROFILE_LINK_ERROR",
          profile: candidate,
          error: freshError
        };
      }

      if (!freshProfile || freshProfile.auth_user_id !== authUser.id) {
        return {
          status: "PROFILE_LINK_ERROR",
          profile: candidate,
          error: new Error("Profile auth_user_id link verification mismatch")
        };
      }

      if (freshProfile.active === false) {
        return {
          status: "ACCOUNT_DEACTIVATED",
          profile: freshProfile,
          error: new Error("User account is deactivated")
        };
      }

      return {
        status: "SUCCESS",
        profile: freshProfile,
        resolutionMethod: "ADMIN_SELF_HEALED"
      };
    } catch (e) {
      console.error("Exception during profile link update:", e);
      return {
        status: "PROFILE_LINK_ERROR",
        profile: candidate,
        error: e
      };
    }
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

    // 3. SECURE BOOT: Verify Session BEFORE Database Initialization
    AppState.currentUser = null;
    this.applyUserRolePermissions();

    if (!db.supabase) {
      console.error("Supabase client not initialized.");
      this.openLoginModal();
      return;
    }
    try {
      const { data: { session }, error: sessionError } = await db.supabase.auth.getSession();
      
      if (!session || !session.user) {
        console.log("No active session found. Redirecting to login...");
        this.openLoginModal();
        return;
      }

      // Session exists - Verify Authoritative Profile via Shared Resolver
      const authUser = session.user;
      const resolution = await this.resolveAuthenticatedProfile(authUser);

      if (resolution.status !== "SUCCESS" || !resolution.profile) {
        console.error("Auth mapping error or user profile not resolved on boot:", resolution.status, resolution.error);
        await db.supabase.auth.signOut().catch(() => {});
        this.openLoginModal();
        if (resolution.status === "ACCOUNT_DEACTIVATED") {
          this.showToast(
            AppState.lang === "ar" ? "حساب المستخدم معطل" : "User account is deactivated",
            "error"
          );
        } else if (resolution.status === "AUTH_SUCCESS_PROFILE_NOT_FOUND") {
          this.showToast(
            AppState.lang === "ar"
              ? "تمت المصادقة بنجاح، ولكن لم يتم العثور على ملف تعريف للمستخدم."
              : "Authentication succeeded, but no registered user profile was found.",
            "error"
          );
        } else if (resolution.status === "AUTH_SUCCESS_MAPPING_CONFLICT") {
          this.showToast(
            AppState.lang === "ar"
              ? "تعارض في ربط الحساب: الحساب مرتبط بهوية أخرى."
              : "Identity mapping conflict: account is linked to a different identity.",
            "error"
          );
        } else if (resolution.status === "PROFILE_QUERY_ERROR") {
          this.showToast(
            AppState.lang === "ar"
              ? "خطأ في الاتصال بقاعدة البيانات أثناء التحقق من الملف الشخصي."
              : "Database query error during profile verification.",
            "error"
          );
        } else if (resolution.status === "PROFILE_LINK_ERROR") {
          this.showToast(
            AppState.lang === "ar"
              ? "فشل ربط ملف تعريف المستخدم. يرجى مراجعة مسؤول النظام."
              : "Failed to link user profile. Please contact administrator.",
            "error"
          );
        }
        return;
      }

      const cloudUser = resolution.profile;

      // Authoritative Profile Mapping to AppState
      AppState.currentUser = {
        id: cloudUser.id,
        username: cloudUser.username,
        email: authUser.email || (cloudUser.username + "@sdi.ae"),
        fullName: cloudUser.full_name || cloudUser.fullName || cloudUser.username,
        fullNameAr: cloudUser.full_name_ar || cloudUser.fullNameAr || cloudUser.full_name || cloudUser.fullName || cloudUser.username,
        fullNameEn: cloudUser.full_name_en || cloudUser.fullNameEn || cloudUser.username,
        role: String(cloudUser.role || "Viewer").trim(),
        employeeId: cloudUser.employee_id || cloudUser.employeeId || null,
        active: cloudUser.active !== false
      };

      // Initialize Database only after successful Auth
      await db.init();
      this.updateCloudStatus();
      if (!db.isCloudOnline) {
        this.showCloudUnavailableScreen("cloud");
        return;
      }
      this.hideCloudUnavailableScreen();

      // Institutional Branding (Logo & System Name)
      try { await this.applyBranding(); } catch (e) { console.warn("applyBranding warning:", e); }

      // Cleanup legacy storage
      localStorage.removeItem("sdi_user");
      sessionStorage.removeItem("sdi_user");
      sessionStorage.removeItem("sdi_session_user");
      localStorage.removeItem("sdi_session_user");

      // Set up auth state change listener
      if (db.supabase && !window.__SDI_AUTH_LISTENER_BOUND__) {
        window.__SDI_AUTH_LISTENER_BOUND__ = true;
        db.supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
             this.logout();
          }
        });
      }

      console.log("SDI IT Asset Hub Initialized & Authenticated.");

      // Apply permissions and navigate to initial view
      this.applyUserRolePermissions();
      if (!AppState.currentUser) {
        this.openLoginModal();
        return;
      }
      if (AppState.currentUser.role === "Employee") {
        await this.switchTab("employeePortal", true);
      } else {
        await this.switchTab("dashboard", true);
      }
      await this.renderAuthenticatedViews();

    } catch (e) {
      console.error("Critical Auth/Boot error:", e);
      this.openLoginModal();
      return;
    }
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
      headerSearch.addEventListener("keydown", (e) => {
        const dropdown = document.getElementById("headerSearchResults");
        if (!dropdown || dropdown.style.display === "none") return;
        const items = dropdown.querySelectorAll(".search-item");
        if (!items.length) return;

        let currentIndex = -1;
        items.forEach((item, index) => {
          if (item.classList.contains("active")) currentIndex = index;
        });

        if (e.key === "ArrowDown") {
          e.preventDefault();
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          items.forEach(it => it.classList.remove("active"));
          items[nextIndex].classList.add("active");
          items[nextIndex].scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          items.forEach(it => it.classList.remove("active"));
          items[prevIndex].classList.add("active");
          items[prevIndex].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          if (currentIndex >= 0 && items[currentIndex]) {
            e.preventDefault();
            items[currentIndex].click();
          } else if (items.length > 0) {
            e.preventDefault();
            items[0].click();
          }
        } else if (e.key === "Escape") {
          dropdown.style.display = "none";
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

    // Browser back button & hash navigation handlers (REQ-46)
    window.addEventListener("popstate", (e) => {
      if (!AppState.currentUser) {
        this.openLoginModal();
        return;
      }
      if (e.state && e.state.tab) {
        this.switchTab(e.state.tab, true);
      } else {
        this.navigateBack();
      }
    });

    window.addEventListener("hashchange", () => {
      if (!AppState.currentUser) {
        this.openLoginModal();
        return;
      }
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        this.switchTab(hash, true);
      }
    });
  }

  // =========================================================================
  // 1. NAVIGATION & TAB SWITCHING (With Authorization & Unsaved Changes Guard)
  // =========================================================================
  async switchTab(tabName, skipHistory = false) {
    if (!AppState.currentUser) {
      this.openLoginModal();
      return;
    }

    if (this.hasUnsavedChanges) {
      this.pendingNavTarget = { type: 'tab', tab: tabName, skipHistory };
      this.openModal("unsavedChangesModal");
      return;
    }

    // REQ-32: Authorization Enforcement
    let targetTab = tabName;

    // Diagnostic logging for development
    console.log("[AUTH DIAGNOSTIC] switchTab requested:", tabName, "| User:", AppState.currentUser ? AppState.currentUser.username : "Unauthenticated");

    if (!AppState.currentUser) {
      console.warn("[AUTH DIAGNOSTIC] Unauthenticated switchTab attempted:", tabName);
      if (tabName !== "accessDenied") {
        targetTab = "accessDenied";
        this.openLoginModal();
      }
    } else {
      const role = AppState.currentUser.role;
      if (role === "Employee") {
        // Employee can ONLY access employeePortal or accessDenied
        if (tabName !== "employeePortal" && tabName !== "accessDenied") {
          console.warn("[AUTH DIAGNOSTIC] Employee attempted restricted tab:", tabName);
          targetTab = "accessDenied";
        }
      } else if (String(role).trim() !== "Administrator") {
        // Non-administrators cannot access settings
        if (tabName === "settings") {
          console.warn("[AUTH DIAGNOSTIC] Non-Admin attempted restricted tab:", tabName);
          targetTab = "accessDenied";
        }
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

    // Update Panes (REQ-32: Ensure inline styles from applyUserRolePermissions don't override active class)
    document.querySelectorAll(".tab-pane").forEach(pane => {
      const isActive = pane.id === `tab-${targetTab}`;
      pane.classList.toggle("active", isActive);
      // Reset inline style to allow CSS class to control visibility
      pane.style.display = ""; 
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
    else if (targetTab === "reports") {
      await this.populateReportDropdowns();
      await this.generateSelectedReport();
    }
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
    if (subTabName === "dataIntegrity") {
      await this.runDataIntegrityCheck();
    }
  }

  // =========================================================================
  // 2. DASHBOARD KPI COUNTERS & SUMMARIES
  // =========================================================================
  async updateDashboard() {
    const [assets, employees, departments, locations, assetTypes, maintenance, projects] = await Promise.all([
      db.getAll("assets"),
      db.getAll("employees"),
      db.getAll("departments"),
      db.getAll("locations"),
      db.getAll("assetTypes"),
      db.getAll("maintenance"),
      db.getAll("projects")
    ]);
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
    let countInstalled = 0;
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
      else if (st === "Installed") countInstalled++;
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

    // Error-to-Zero protection: distinguish between true zero and query failure
    const hasAssetsErr = Boolean(db.getLastError && db.getLastError("assets") && assets.length === 0);
    const hasEmpErr = Boolean(db.getLastError && db.getLastError("employees") && employees.length === 0);
    const hasDeptErr = Boolean(db.getLastError && db.getLastError("departments") && departments.length === 0);
    const hasLocErr = Boolean(db.getLastError && db.getLastError("locations") && locations.length === 0);
    const hasMaintErr = Boolean(db.getLastError && db.getLastError("maintenance") && maintenance.length === 0);

    // Set 4 Institutional Overview Indicators
    setElem("dashCountEmployees", hasEmpErr ? "—" : countEmployees);
    setElem("dashCountDepartments", hasDeptErr ? "—" : countDepartments);
    setElem("dashCountLocations", hasLocErr ? "—" : countLocations);
    setElem("dashCountActiveMaint", hasMaintErr ? "—" : countActiveMaint);

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

    this.dashboardWarrantyAssets = [];
    this.dashboardEmpMap = empMap;
    this.dashboardDeptMap = deptMap;
    this.dashboardLocMap = locMap;
    this.dashboardTypeMap = typeMap;

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

      const item = {
        asset: a,
        diffDays,
        isCritical: diffDays <= 7,
        isToday: diffDays === 0
      };

      this.dashboardWarrantyAssets.push(item);

      if (diffDays < 0) {
        countWarrantyExpired++;
      } else if (diffDays <= 30) {
        countWarrantyExpiring30d++;
        if (diffDays <= 7) {
          countWarrantyExpiring7d++;
        }
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

    // Render active local filter
    this.renderDashboardWarrantyAlerts();

    // Set Operational Status Indicators
    setElem("dashCountTotal", hasAssetsErr ? "—" : countTotal);
    setElem("dashCountAssigned", hasAssetsErr ? "—" : countAssigned);
    setElem("dashCountAvailable", hasAssetsErr ? "—" : countAvailable);
    setElem("dashCountInStore", hasAssetsErr ? "—" : countInStore);
    setElem("dashCountPendingInstall", hasAssetsErr ? "—" : countInTransit);
    setElem("dashCountInTransit", hasAssetsErr ? "—" : countInTransit);
    setElem("dashCountInstalled", hasAssetsErr ? "—" : countInstalled);
    setElem("dashCountMaintenance", hasAssetsErr ? "—" : countMaintenance);
    setElem("dashCountDamaged", hasAssetsErr ? "—" : countDamaged);
    setElem("dashCountLost", hasAssetsErr ? "—" : countLost);
    setElem("dashCountRetired", hasAssetsErr ? "—" : countRetired);
    setElem("dashCountDisposed", hasAssetsErr ? "—" : countDisposed);

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

  renderDashboardWarrantyAlerts() {
    const lang = AppState.lang;
    const filter = this.currentDashboardWarrantyFilter || "expiring_30d";
    const warrantyAlertsBox = document.getElementById("dashWarrantyAlertsContainer");
    if (!warrantyAlertsBox) return;

    if (!this.dashboardWarrantyAssets) {
      this.dashboardWarrantyAssets = [];
    }

    // Filter items based on active local filter
    const filteredItems = this.dashboardWarrantyAssets.filter(item => {
      const diff = item.diffDays;
      if (filter === "expiring_30d") {
        return diff >= 0 && diff <= 30;
      } else if (filter === "expiring_7d") {
        return diff >= 0 && diff <= 7;
      } else if (filter === "expired") {
        return diff < 0;
      } else if (filter === "valid") {
        return diff > 30;
      }
      return true;
    });

    // Update active highlight class or style on the boxes
    const boxes = {
      expiring_30d: "dashWarrantyBox30d",
      expiring_7d: "dashWarrantyBox7d",
      expired: "dashWarrantyBoxExpired",
      valid: "dashWarrantyBoxValid"
    };

    Object.entries(boxes).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) {
        if (key === filter) {
          // Highlight active box
          if (key === "expiring_7d") {
            el.style.borderColor = "var(--accent-red)";
            el.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.25)";
          } else if (key === "expiring_30d") {
            el.style.borderColor = "#f97316";
            el.style.boxShadow = "0 0 0 3px rgba(249, 115, 22, 0.25)";
          } else if (key === "expired") {
            el.style.borderColor = "var(--text-secondary)";
            el.style.boxShadow = "0 0 0 3px rgba(148, 163, 184, 0.25)";
          } else {
            el.style.borderColor = "#0284c7";
            el.style.boxShadow = "0 0 0 3px rgba(14, 165, 233, 0.25)";
          }
        } else {
          // Reset inactive box
          el.style.borderColor = key === "expiring_30d" ? "#fed7aa" : (key === "valid" ? "#bae6fd" : (key === "expiring_7d" ? "#fecaca" : "#e2e8f0"));
          el.style.boxShadow = "0 2px 6px rgba(14, 165, 233, 0.06)";
        }
      }
    });

    if (filteredItems.length === 0) {
      warrantyAlertsBox.innerHTML = `
        <div class="text-xs p-3 text-center rounded border" style="background: #ffffff; border-color: #bae6fd; box-shadow: 0 2px 6px rgba(14, 165, 233, 0.06);">
          <i class="fas fa-check-circle me-1" style="font-size: 15px; color: #0284c7;"></i>
          <span class="font-bold" style="color: #0369a1;">${lang === 'ar' ? 'لا توجد تنبيهات لهذه الفئة' : 'No alerts in this category'}</span>
        </div>
      `;
    } else {
      // Sort nearest expiration first (if expiring or expired), or newest for valid
      if (filter === "expired") {
        // Most recently expired first (e.g. diff -1 before -10)
        filteredItems.sort((a, b) => b.diffDays - a.diffDays);
      } else {
        filteredItems.sort((a, b) => a.diffDays - b.diffDays);
      }

      const empMap = this.dashboardEmpMap || {};
      const deptMap = this.dashboardDeptMap || {};
      const locMap = this.dashboardLocMap || {};
      const typeMap = this.dashboardTypeMap || {};

      let wHtml = "";
      filteredItems.forEach(item => {
        const a = item.asset;
        const diffDays = item.diffDays;
        const isCritical = item.isCritical;
        const isToday = item.isToday;

        let badgeText = "";
        let badgeStyle = "";
        let isExpired = diffDays < 0;

        if (isExpired) {
          const absDays = Math.abs(diffDays);
          if (absDays === 1) {
            badgeText = lang === "ar" ? "منتهي منذ يوم" : "Expired 1 day ago";
          } else if (absDays === 2) {
            badgeText = lang === "ar" ? "منتهي منذ يومين" : "Expired 2 days ago";
          } else if (absDays >= 3 && absDays <= 10) {
            badgeText = lang === "ar" ? `منتهي منذ ${absDays} أيام` : `Expired ${absDays} days ago`;
          } else {
            badgeText = lang === "ar" ? `منتهي منذ ${absDays} يوم` : `Expired ${absDays} days ago`;
          }
          badgeStyle = "background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;";
        } else if (filter === "valid") {
          badgeText = lang === "ar" ? `ساري المفعول (${diffDays} يوم متبقي)` : `Active (${diffDays} days left)`;
          badgeStyle = "background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd;";
        } else {
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
          badgeStyle = isCritical
            ? "background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;"
            : "background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;";
        }

        const borderStyle = isExpired
          ? "background: #ffffff; border-color: rgba(239, 68, 68, 0.3); box-shadow: 0 2px 8px rgba(239, 68, 68, 0.06);"
          : (filter === "valid"
            ? "background: #ffffff; border-color: #bae6fd; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.08);"
            : (isCritical
              ? "background: #ffffff; border-color: rgba(239, 68, 68, 0.35); box-shadow: 0 2px 8px rgba(239, 68, 68, 0.08);"
              : "background: #ffffff; border-color: #fed7aa; box-shadow: 0 2px 8px rgba(249, 115, 22, 0.08);"));

        const iconBg = isExpired
          ? "#fef2f2"
          : (filter === "valid"
            ? "#f0f9ff"
            : (isCritical ? "#fef2f2" : "#fff7ed"));

        const iconBorder = isExpired
          ? "#fecaca"
          : (filter === "valid"
            ? "#bae6fd"
            : (isCritical ? "#fecaca" : "#fed7aa"));

        const iconColor = isExpired
          ? "#dc2626"
          : (filter === "valid"
            ? "#0284c7"
            : (isCritical ? "#dc2626" : "#ea580c"));

        const iconClass = isExpired
          ? "fa-calendar-times"
          : (filter === "valid"
            ? "fa-shield-alt"
            : (isCritical ? "fa-exclamation-triangle" : "fa-hourglass-half"));

        const typeName = typeMap[a.assetTypeId] || "";
        const deptName = deptMap[a.departmentId] || "";
        const locName = locMap[a.locationId] || "";
        const empName = empMap[a.currentEmployeeId] || "";

        wHtml += `
          <div class="d-flex justify-between items-center p-3 rounded border warranty-alert-item" style="${borderStyle} flex-wrap: wrap; gap: 12px; transition: all 0.2s ease;">
            <div style="flex: 1; min-width: 260px;">
              <div class="d-flex items-center gap-2 flex-wrap">
                <strong class="text-sm font-bold" style="cursor: pointer; color: #0284c7;" onclick="AssetManager.openDetailsModal('${a.id}')" title="${lang === 'ar' ? 'عرض تفاصيل الأصل' : 'View asset details'}">${a.assetId}</strong>
                <span class="text-xs text-muted">&bull;</span>
                <span class="text-xs font-bold" style="color: #1e293b;">${a.brand || ""} ${a.model || ""}</span>
                ${typeName ? `<span class="badge text-xs" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">${typeName}</span>` : ""}
                <span class="badge text-xs font-bold" style="${badgeStyle}">${badgeText}</span>
              </div>
              <div class="text-xs text-muted d-flex items-center gap-3 flex-wrap mt-1">
                <span><i class="far fa-calendar-alt" style="color: #ea580c;"></i> <strong>${lang === 'ar' ? 'تاريخ الانتهاء:' : 'Expiry Date:'}</strong> ${a.warrantyExpiry}</span>
                ${a.serial ? `<span><i class="fas fa-hashtag"></i> S/N: <code>${a.serial}</code></span>` : ""}
                ${locName ? `<span><i class="fas fa-map-marker-alt"></i> ${locName}</span>` : ""}
                ${deptName ? `<span><i class="fas fa-building"></i> ${deptName}</span>` : ""}
                ${empName ? `<span><i class="fas fa-user"></i> ${empName}</span>` : ""}
                ${a.supplier ? `<span><i class="fas fa-truck"></i> ${a.supplier}</span>` : ""}
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

  filterDashboardWarrantyList(category) {
    this.currentDashboardWarrantyFilter = category;
    this.renderDashboardWarrantyAlerts();
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
  getAssetTypeIcon(asset, assetTypes = []) {
    const typeObj = (assetTypes || []).find(t => t.id === asset.assetTypeId);
    const typeName = ((typeObj ? (typeObj.nameEn || typeObj.nameAr) : "") + " " + (asset.category || asset.type || "")).toLowerCase();
    const brandModel = `${asset.brand || ""} ${asset.model || ""}`.toLowerCase();

    if (typeName.includes("laptop") || brandModel.includes("latitude") || brandModel.includes("thinkpad") || brandModel.includes("macbook") || brandModel.includes("elitebook")) {
      return "fa-laptop";
    }
    if (typeName.includes("desktop") || typeName.includes("pc") || typeName.includes("workstation") || brandModel.includes("optiplex") || brandModel.includes("prodesk")) {
      return "fa-desktop";
    }
    if (typeName.includes("server") || brandModel.includes("poweredge") || brandModel.includes("proliant")) {
      return "fa-server";
    }
    if (typeName.includes("printer") || typeName.includes("print") || brandModel.includes("laserjet") || brandModel.includes("epson")) {
      return "fa-print";
    }
    if (typeName.includes("switch") || typeName.includes("router") || typeName.includes("network") || typeName.includes("cisco") || typeName.includes("fortinet") || typeName.includes("firewall")) {
      return "fa-network-wired";
    }
    if (typeName.includes("monitor") || typeName.includes("screen") || typeName.includes("display")) {
      return "fa-display";
    }
    if (typeName.includes("tablet") || typeName.includes("ipad") || typeName.includes("tab")) {
      return "fa-tablet-screen-button";
    }
    if (typeName.includes("phone") || typeName.includes("mobile") || typeName.includes("iphone")) {
      return "fa-mobile-screen-button";
    }
    if (typeName.includes("scanner") || typeName.includes("barcode")) {
      return "fa-barcode";
    }
    if (typeName.includes("camera") || typeName.includes("cctv")) {
      return "fa-video";
    }
    return "fa-laptop";
  }

  getProjectStatusBadge(status) {
    const lang = AppState.lang;
    let badgeClass = "badge-secondary";
    let text = status || "-";
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
        badgeClass = "badge-danger";
        text = lang === "ar" ? "ملغى" : "Cancelled";
        break;
    }
    return `<span class="badge ${badgeClass}">${text}</span>`;
  }

  async handleHeaderSearch(query) {
    const dropdown = document.getElementById("headerSearchResults");
    if (!dropdown) return;

    if (!query) {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
      return;
    }

    const q = query.toLowerCase();

    const [assets, employees, departments, locations, assetTypes, projects, contractors] = await Promise.all([
      db.getAll("assets").catch(() => []),
      db.getAll("employees").catch(() => []),
      db.getAll("departments").catch(() => []),
      db.getAll("locations").catch(() => []),
      db.getAll("assetTypes").catch(() => []),
      db.getAll("projects").catch(() => []),
      db.getAll("contractors").catch(() => [])
    ]);

    // Check if query has changed in the meantime
    const currentInput = document.getElementById("headerQuickSearch");
    if (currentInput && currentInput.value.trim().toLowerCase() !== q) return;

    const lang = AppState.lang;

    // Assigned assets count per employee
    const assignedMap = {};
    (assets || []).forEach(a => {
      if (a.currentEmployeeId) {
        assignedMap[a.currentEmployeeId] = (assignedMap[a.currentEmployeeId] || 0) + 1;
      }
    });

    const empMap = Object.fromEntries((employees || []).map(e => [e.id, lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)]));
    const deptMap = Object.fromEntries((departments || []).map(d => [d.id, lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)]));
    const locMap = Object.fromEntries((locations || []).map(l => [l.id, lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)]));
    const contractorMap = Object.fromEntries((contractors || []).map(c => [c.id, lang === "ar" ? (c.companyNameAr || c.companyNameEn) : (c.companyNameEn || c.companyNameAr)]));

    // 1. Match Assets
    const assetMatches = (assets || []).filter(a => {
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
    }).slice(0, 5);

    // 2. Match Employees
    const employeeMatches = (employees || []).filter(e => {
      const nameAr = (e.nameAr || "").toLowerCase();
      const nameEn = (e.nameEn || "").toLowerCase();
      const empNo = (e.employeeNumber || "").toLowerCase();
      const empId = (e.id || "").toLowerCase();
      const email = (e.email || "").toLowerCase();
      const phone = (e.phone || "").toLowerCase();
      const title = (e.jobTitle || "").toLowerCase();
      const deptName = (deptMap[e.departmentId] || "").toLowerCase();
      const locName = (locMap[e.locationId] || "").toLowerCase();
      return (
        nameAr.includes(q) ||
        nameEn.includes(q) ||
        empNo.includes(q) ||
        empId.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        title.includes(q) ||
        deptName.includes(q) ||
        locName.includes(q)
      );
    }).slice(0, 4);

    // 3. Match Projects
    const projectMatches = (projects || []).filter(p => {
      const pNo = (p.projectNo || "").toLowerCase();
      const nameAr = (p.nameAr || "").toLowerCase();
      const nameEn = (p.nameEn || "").toLowerCase();
      const pType = (p.projectType || "").toLowerCase();
      const contractor = (contractorMap[p.contractorId] || "").toLowerCase();
      const locName = (locMap[p.locationId] || "").toLowerCase();
      const status = (p.status || "").toLowerCase();
      const remarks = (p.remarks || "").toLowerCase();
      return (
        pNo.includes(q) ||
        nameAr.includes(q) ||
        nameEn.includes(q) ||
        pType.includes(q) ||
        contractor.includes(q) ||
        locName.includes(q) ||
        status.includes(q) ||
        remarks.includes(q)
      );
    }).slice(0, 4);

    const totalMatches = assetMatches.length + employeeMatches.length + projectMatches.length;

    if (totalMatches === 0) {
      dropdown.innerHTML = `
        <div class="search-drop-empty">
          <i class="fas fa-search"></i>
          <div>${lang === "ar" ? "لا توجد نتائج مطابقة في الأصول أو الموظفين أو المشاريع" : "No matching assets, employees, or projects found"}</div>
        </div>
      `;
      dropdown.style.display = "block";
      return;
    }

    let html = "";

    // 1. Assets Group
    if (assetMatches.length > 0) {
      html += `
        <div class="search-group-title">
          <span class="search-group-label">
            <i class="fas fa-laptop text-primary"></i>
            <span>${lang === "ar" ? "الأصول التقنية" : "IT Assets"}</span>
          </span>
          <span class="search-group-count">${assetMatches.length}</span>
        </div>
      `;

      assetMatches.forEach(a => {
        const empName = empMap[a.currentEmployeeId] || (lang === "ar" ? "غير مسند" : "Unassigned");
        const deptName = deptMap[a.departmentId] || "";
        const locName = locMap[a.locationId] || "";
        const assetIcon = this.getAssetTypeIcon(a, assetTypes);

        html += `
          <div class="search-item" data-type="asset" data-id="${a.id}" onclick="App.selectSearchResult('${a.id}')">
            <div class="search-item-icon entity-asset" title="${lang === "ar" ? "أصل تقني" : "IT Asset"}">
              <i class="fas ${assetIcon}"></i>
            </div>
            <div class="search-item-info">
              <div class="search-item-top">
                <div class="search-item-title-wrap">
                  <span class="search-entity-badge badge-asset"><i class="fas ${assetIcon}"></i> ${lang === "ar" ? "أصل" : "Asset"}</span>
                  <span class="search-item-title">${a.assetId} - ${a.brand || ""} ${a.model || ""}</span>
                </div>
                <span class="badge ${AssetManager.getStatusBadgeClass(a.status)}">${AssetManager.formatStatus(a.status)}</span>
              </div>
              <div class="search-item-sub">
                <span>${lang === "ar" ? "سيريال:" : "SN:"} <code>${a.serial || "-"}</code></span>
                ${a.qrCodeValue && a.qrCodeValue !== a.assetId ? `&bull; <span>QR: <code style="color: var(--sdi-orange);">${a.qrCodeValue}</code></span>` : ""}
                &bull; <span><i class="fas fa-user text-xs"></i> <strong>${empName}</strong></span>
                ${deptName ? `&bull; <span>${deptName}</span>` : ""}
                ${locName ? `&bull; <span><i class="fas fa-map-marker-alt text-xs"></i> ${locName}</span>` : ""}
              </div>
            </div>
          </div>
        `;
      });
    }

    // 2. Employees Group
    if (employeeMatches.length > 0) {
      html += `
        <div class="search-group-title">
          <span class="search-group-label">
            <i class="fas fa-user-tie text-success"></i>
            <span>${lang === "ar" ? "الموظفون" : "Employees"}</span>
          </span>
          <span class="search-group-count">${employeeMatches.length}</span>
        </div>
      `;

      employeeMatches.forEach(e => {
        const empName = lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr);
        const deptName = deptMap[e.departmentId] || "";
        const locName = locMap[e.locationId] || "";
        const assignedCount = assignedMap[e.id] || 0;

        html += `
          <div class="search-item" data-type="employee" data-id="${e.id}" onclick="App.selectEmployeeSearchResult('${e.id}')">
            <div class="search-item-icon entity-employee" title="${lang === "ar" ? "موظف" : "Employee"}">
              <i class="fas fa-user-tie"></i>
            </div>
            <div class="search-item-info">
              <div class="search-item-top">
                <div class="search-item-title-wrap">
                  <span class="search-entity-badge badge-employee"><i class="fas fa-user"></i> ${lang === "ar" ? "موظف" : "Employee"}</span>
                  <span class="search-item-title">${empName}</span>
                  ${e.jobTitle ? `<span class="text-xs text-muted">(${e.jobTitle})</span>` : ""}
                </div>
                <span class="badge ${e.status === "Active" ? "badge-success" : "badge-danger"}">${e.status === "Active" ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "غير نشط" : "Inactive")}</span>
              </div>
              <div class="search-item-sub">
                <span>${lang === "ar" ? "الرقم الوظيفي:" : "ID:"} <code>${e.employeeNumber || e.id}</code></span>
                ${deptName ? `&bull; <span><i class="fas fa-building text-xs"></i> ${deptName}</span>` : ""}
                ${locName ? `&bull; <span><i class="fas fa-map-marker-alt text-xs"></i> ${locName}</span>` : ""}
                &bull; <span class="text-primary font-medium"><i class="fas fa-laptop text-xs"></i> ${assignedCount} ${lang === "ar" ? "عهد مسندة" : "assets"}</span>
              </div>
            </div>
          </div>
        `;
      });
    }

    // 3. Projects Group
    if (projectMatches.length > 0) {
      html += `
        <div class="search-group-title">
          <span class="search-group-label">
            <i class="fas fa-diagram-project text-warning"></i>
            <span>${lang === "ar" ? "المشاريع" : "Projects"}</span>
          </span>
          <span class="search-group-count">${projectMatches.length}</span>
        </div>
      `;

      projectMatches.forEach(p => {
        const projectName = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
        const contractorName = contractorMap[p.contractorId] || "";
        const locName = locMap[p.locationId] || "";

        html += `
          <div class="search-item" data-type="project" data-id="${p.id}" onclick="App.selectProjectSearchResult('${p.id}')">
            <div class="search-item-icon entity-project" title="${lang === "ar" ? "مشروع" : "Project"}">
              <i class="fas fa-diagram-project"></i>
            </div>
            <div class="search-item-info">
              <div class="search-item-top">
                <div class="search-item-title-wrap">
                  <span class="search-entity-badge badge-project"><i class="fas fa-diagram-project"></i> ${lang === "ar" ? "مشروع" : "Project"}</span>
                  <span class="search-item-title">${p.projectNo || ""} - ${projectName}</span>
                </div>
                ${this.getProjectStatusBadge(p.status)}
              </div>
              <div class="search-item-sub">
                <span><i class="fas fa-tag text-xs"></i> ${p.projectType || "-"}</span>
                ${contractorName ? `&bull; <span><i class="fas fa-handshake text-xs"></i> ${contractorName}</span>` : ""}
                ${locName ? `&bull; <span><i class="fas fa-map-marker-alt text-xs"></i> ${locName}</span>` : ""}
                &bull; <span class="font-medium" style="color: var(--sdi-orange);"><i class="fas fa-chart-line text-xs"></i> ${p.progress || 0}%</span>
              </div>
            </div>
          </div>
        `;
      });
    }

    dropdown.innerHTML = html;
    dropdown.style.display = "block";
  }

  selectSearchResult(assetId) {
    const dropdown = document.getElementById("headerSearchResults");
    if (dropdown) dropdown.style.display = "none";
    document.getElementById("headerQuickSearch").value = "";
    this.openAssetQuickView(assetId);
  }

  async selectEmployeeSearchResult(empId) {
    const dropdown = document.getElementById("headerSearchResults");
    if (dropdown) dropdown.style.display = "none";
    document.getElementById("headerQuickSearch").value = "";

    const isEmployee = AppState.currentUser && AppState.currentUser.role === "Employee";
    if (isEmployee) {
      const emp = await db.getById("employees", empId);
      if (emp) {
        this.showToast(`${AppState.lang === "ar" ? "الموظف:" : "Employee:"} ${emp.nameAr || emp.nameEn}`, "info");
      }
      return;
    }

    await this.switchTab("employees");
    const emp = await db.getById("employees", empId);
    const searchInput = document.getElementById("empSearchInput");
    if (searchInput && emp) {
      searchInput.value = emp.employeeNumber || emp.nameAr || emp.nameEn || "";
    }
    if (window.UserManager && typeof UserManager.renderEmployees === "function") {
      await UserManager.renderEmployees();
    }
  }

  async selectProjectSearchResult(projectId) {
    const dropdown = document.getElementById("headerSearchResults");
    if (dropdown) dropdown.style.display = "none";
    document.getElementById("headerQuickSearch").value = "";

    const isEmployee = AppState.currentUser && AppState.currentUser.role === "Employee";
    if (isEmployee) {
      if (window.ProjectManager && typeof ProjectManager.viewProjectDetails === "function") {
        await ProjectManager.viewProjectDetails(projectId);
      }
      return;
    }

    await this.switchTab("projects");
    if (window.ProjectManager && typeof ProjectManager.viewProjectDetails === "function") {
      await ProjectManager.viewProjectDetails(projectId);
    }
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
    const reportType = document.getElementById("reportSelect")?.value || "inventory";

    const [typesRes, deptsRes, locsRes, empsRes] = await Promise.allSettled([
      db.getAll("assetTypes"),
      db.getAll("departments"),
      db.getAll("locations"),
      db.getAll("employees")
    ]);

    const types = (typesRes.status === "fulfilled" && Array.isArray(typesRes.value)) ? typesRes.value : [];
    const depts = (deptsRes.status === "fulfilled" && Array.isArray(deptsRes.value)) ? deptsRes.value : [];
    const locs = (locsRes.status === "fulfilled" && Array.isArray(locsRes.value)) ? locsRes.value : [];
    const emps = (empsRes.status === "fulfilled" && Array.isArray(empsRes.value)) ? empsRes.value : [];

    // 1. Asset Types Filter
    const typeSelect = document.getElementById("reportFilterType");
    if (typeSelect) {
      const curVal = typeSelect.value;
      typeSelect.innerHTML = `<option value="" data-i18n="filterAllTypes">${I18N[lang].filterAllTypes || "جميع الأنواع"}</option>` +
        types.map(t => `<option value="${t.id}">${lang === "ar" ? t.nameAr : (t.nameEn || t.nameAr)}</option>`).join("");
      if (curVal && [...typeSelect.options].some(o => o.value === curVal)) {
        typeSelect.value = curVal;
      }
    }

    // 2. Status Filter dynamically adapted to report type
    const statusSelect = document.getElementById("reportFilterStatus");
    if (statusSelect) {
      const curVal = statusSelect.value;
      if (reportType === "projects") {
        statusSelect.innerHTML = `
          <option value="">${lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
          <option value="Planning">${lang === "ar" ? "تخطيط" : "Planning"}</option>
          <option value="Approved">${lang === "ar" ? "معتمد" : "Approved"}</option>
          <option value="In Progress">${lang === "ar" ? "قيد التنفيذ" : "In Progress"}</option>
          <option value="On Hold">${lang === "ar" ? "معلق" : "On Hold"}</option>
          <option value="Completed">${lang === "ar" ? "مكتمل" : "Completed"}</option>
          <option value="Cancelled">${lang === "ar" ? "ملغي" : "Cancelled"}</option>
        `;
      } else if (reportType === "helpdesk") {
        statusSelect.innerHTML = `
          <option value="">${lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
          <option value="New">${lang === "ar" ? "جديد" : "New"}</option>
          <option value="In Progress">${lang === "ar" ? "قيد المعالجة" : "In Progress"}</option>
          <option value="Waiting for Employee">${lang === "ar" ? "بانتظار الموظف" : "Waiting for Employee"}</option>
          <option value="Completed">${lang === "ar" ? "مكتمل" : "Completed"}</option>
        `;
      } else if (reportType === "maint") {
        statusSelect.innerHTML = `
          <option value="">${lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
          <option value="Open">${lang === "ar" ? "مفتوح" : "Open"}</option>
          <option value="In Progress">${lang === "ar" ? "قيد الإصلاح" : "In Progress"}</option>
          <option value="Completed">${lang === "ar" ? "تم الإصلاح" : "Completed"}</option>
        `;
      } else {
        statusSelect.innerHTML = `
          <option value="" data-i18n="filterAllStatuses">${I18N[lang].filterAllStatuses || "جميع الحالات"}</option>
          <option value="Available" data-i18n="statusAvailable">${I18N[lang].statusAvailable || "متاح"}</option>
          <option value="Assigned" data-i18n="statusAssigned">${I18N[lang].statusAssigned || "مسند"}</option>
          <option value="Installed" data-i18n="statusInstalled">${I18N[lang].statusInstalled || "مركب / مثبت"}</option>
          <option value="In Transit" data-i18n="statusInTransit">${I18N[lang].statusInTransit || "قيد النقل / بانتظار التركيب"}</option>
          <option value="In Store" data-i18n="statusInStore">${I18N[lang].statusInStore || "في المستودع"}</option>
          <option value="Under Maintenance" data-i18n="statusUnderMaint">${I18N[lang].statusUnderMaint || "تحت الصيانة"}</option>
          <option value="Damaged" data-i18n="statusDamaged">${I18N[lang].statusDamaged || "تالف"}</option>
          <option value="Lost" data-i18n="statusLost">${I18N[lang].statusLost || "مفقود"}</option>
          <option value="Retired" data-i18n="statusRetired">${I18N[lang].statusRetired || "مكهن"}</option>
          <option value="Disposed" data-i18n="statusDisposed">${I18N[lang].statusDisposed || "تم التخلص منه"}</option>
        `;
      }
      if (curVal && [...statusSelect.options].some(o => o.value === curVal)) {
        statusSelect.value = curVal;
      }
    }

    // 3. Departments Filter
    const deptSelect = document.getElementById("reportFilterDept");
    if (deptSelect) {
      const curVal = deptSelect.value;
      deptSelect.innerHTML = `<option value="" data-i18n="filterAllDepts">${I18N[lang].filterAllDepts || "جميع الأقسام"}</option>` +
        depts.map(d => `<option value="${d.id}">${lang === "ar" ? d.nameAr : (d.nameEn || d.nameAr)}</option>`).join("");
      if (curVal && [...deptSelect.options].some(o => o.value === curVal)) {
        deptSelect.value = curVal;
      }
    }

    // 4. Locations Filter
    const locSelect = document.getElementById("reportFilterLoc");
    if (locSelect) {
      const curVal = locSelect.value;
      locSelect.innerHTML = `<option value="" data-i18n="filterAllLocs">${I18N[lang].filterAllLocs || "جميع المواقع"}</option>` +
        locs.map(l => `<option value="${l.id}">${lang === "ar" ? l.nameAr : (l.nameEn || l.nameAr)}</option>`).join("");
      if (curVal && [...locSelect.options].some(o => o.value === curVal)) {
        locSelect.value = curVal;
      }
    }

    // 5. Employees Filter
    const empSelect = document.getElementById("reportFilterEmp");
    if (empSelect) {
      const curVal = empSelect.value;
      empSelect.innerHTML = `<option value="" data-i18n="filterAllEmps">${I18N[lang].filterAllEmps || "جميع الموظفين"}</option>` +
        emps.map(e => `<option value="${e.id}">${lang === "ar" ? e.nameAr : (e.nameEn || e.nameAr)}${e.employeeNumber ? ` (${e.employeeNumber})` : ''}</option>`).join("");
      if (curVal && [...empSelect.options].some(o => o.value === curVal)) {
        empSelect.value = curVal;
      }
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
    // 1. Inventory Report (تقرير جرد الأصول - 13 Fields)
    // -------------------------------------------------------------
    if (reportType === "inventory") {
      title = lang === "ar" ? "تقرير جرد الأصول" : "Asset Inventory Report";
      tableHeader = `
        <tr>
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-compact col-report-type">${I18N[lang].assetType || "النوع"}</th>
          <th class="report-col-compact col-report-brand">${I18N[lang].brand || "الشركة"}</th>
          <th class="report-col-medium col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "السيريال"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-wide col-report-dept">${I18N[lang].department || "القسم"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].location || "الموقع"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].assignedEmployee || "الموظف / العهدة"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].purchaseDate || "تاريخ الشراء"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].warrantyExpiry || "انتهاء الضمان"}</th>
          <th class="report-col-compact col-report-cost report-number">${I18N[lang].purchaseCost || "تكلفة الشراء (AED)"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
        </tr>
      `;

      const filtered = filterAssetList(assets);
      const totalCost = filtered.reduce((acc, a) => acc + (parseFloat(a.purchaseCost) || 0), 0);

      // Data consistency check: verify rendered row count against fresh DB count query
      let dbConsistencyBadge = "";
      if (!filterType && !filterStatus && !filterDept && !filterLoc && !filterEmp && !dateFrom && !dateTo && !searchVal) {
        try {
          const freshDbAssets = await db.getAll("assets");
          const freshDbCount = Array.isArray(freshDbAssets) ? freshDbAssets.length : assets.length;
          if (filtered.length === freshDbCount) {
            dbConsistencyBadge = `<div style="font-size: 11px; color: #16a34a; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px;"><i class="fas fa-check-circle"></i> <span>${lang === 'ar' ? 'متطابق مع قاعدة البيانات' : 'Verified with DB'} (${freshDbCount})</span></div>`;
          } else {
            dbConsistencyBadge = `<div style="font-size: 11px; color: #eab308; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px;"><i class="fas fa-sync fa-spin"></i> <span>${lang === 'ar' ? 'جاري التحقق...' : 'Syncing...'}</span></div>`;
          }
        } catch (e) {
          console.warn("Report #1 DB consistency check error:", e);
        }
      }

      rowsHtml = filtered.map(a => `
        <tr>
          <td class="report-col-compact col-report-id"><strong>${a.assetId}</strong></td>
          <td class="report-col-compact col-report-type">${typeMap[a.assetTypeId] || "-"}</td>
          <td class="report-col-compact col-report-brand">${a.brand || "-"}</td>
          <td class="report-col-medium col-report-model">${a.model || "-"}</td>
          <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
          <td class="report-col-compact col-report-status"><span class="badge ${AssetManager.getStatusBadgeClass(a.status)}">${AssetManager.formatStatus(a.status)}</span></td>
          <td class="report-col-wide col-report-dept">${deptMap[a.departmentId] || "-"}</td>
          <td class="report-col-wide col-report-loc">${locMap[a.locationId] || "-"}</td>
          <td class="report-col-medium col-report-emp">${empMap[a.currentEmployeeId] || (lang === "ar" ? "غير مسند" : "Unassigned")}</td>
          <td class="report-col-compact col-report-date">${a.purchaseDate || "-"}</td>
          <td class="report-col-compact col-report-date">${a.warrantyExpiry || "-"}</td>
          <td class="report-col-compact col-report-cost report-number"><strong>${a.purchaseCost ? parseFloat(a.purchaseCost).toLocaleString() : "0"}</strong></td>
          <td class="report-col-wide col-report-notes">${a.notes || "-"}</td>
        </tr>
      `).join("");

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px; align-items: center;">
          <div><span>${lang === 'ar' ? 'إجمالي الأصول المسجلة' : 'Total Assets'}:</span> <strong>${filtered.length}</strong>${dbConsistencyBadge}</div>
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
          <th class="report-col-wide col-report-dept">${I18N[lang].department || "اسم الإدارة"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thDeviceCount || "عدد الأجهزة"}</th>
          <th class="report-col-wide col-report-desc">${I18N[lang].deviceTypesBreakdown || "أنواع الأجهزة"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thAssignedCount || "الأجهزة المسندة"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thAvailableCount || "الأجهزة المتوفرة"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thUnderMaintCount || "تحت الصيانة"}</th>
          <th class="report-col-medium col-report-cost report-number">${I18N[lang].valuation || "إجمالي القيمة (AED)"}</th>
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
            <td class="report-col-wide col-report-dept"><strong><i class="fas fa-building text-primary"></i> ${deptName}</strong></td>
            <td class="report-col-compact col-report-number report-number"><strong>${count}</strong></td>
            <td class="report-col-wide col-report-desc" style="font-size: 11px;">${typesStr}</td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-success">${assigned}</span></td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-primary">${available}</span></td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-danger">${maint}</span></td>
            <td class="report-col-medium col-report-cost report-number"><strong>${value.toLocaleString()}</strong></td>
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
          <th class="report-col-medium col-report-emp">${I18N[lang].employee || "اسم الموظف"}</th>
          <th class="report-col-compact col-report-id">${lang === 'ar' ? 'الرقم الوظيفي' : 'Employee Number'}</th>
          <th class="report-col-compact col-report-number report-number">${lang === 'ar' ? 'عدد العهد' : 'Custody Count'}</th>
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-compact col-report-type">${I18N[lang].assetType || "نوع الجهاز"}</th>
          <th class="report-col-medium col-report-model">${I18N[lang].brand || "الشركة"} & ${I18N[lang].model || "الموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "الرقم التسلسلي"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].thCustodyDate || "تاريخ الاستلام"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
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
            <td class="report-col-medium col-report-emp"><strong><i class="fas fa-user-tie text-primary"></i> ${empName}</strong></td>
            <td class="report-col-compact col-report-id"><code>${empNumber}</code></td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-secondary">${totalEmpAssets}</span></td>
            <td class="report-col-compact col-report-id"><strong>${a.assetId}</strong></td>
            <td class="report-col-compact col-report-type">${typeMap[a.assetTypeId] || "-"}</td>
            <td class="report-col-medium col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
            <td class="report-col-compact col-report-status"><span class="badge ${AssetManager.getStatusBadgeClass(a.status)}">${AssetManager.formatStatus(a.status)}</span></td>
            <td class="report-col-compact col-report-date">${receiptDate}</td>
            <td class="report-col-wide col-report-notes">${a.notes || "-"}</td>
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
          <th class="report-col-wide col-report-loc">${I18N[lang].location || "الموقع"}</th>
          <th class="report-col-compact col-report-id">${lang === 'ar' ? 'رمز الموقع' : 'Location Code'}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thDeviceCount || "عدد الأصول"}</th>
          <th class="report-col-wide col-report-desc">${I18N[lang].deviceTypesBreakdown || "أنواع الأصول"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thAssignedCount || "مسند"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thAvailableCount || "متوفر"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thUnderMaintCount || "صيانة"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thInStoreCount || "مستودع"}</th>
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
            <td class="report-col-wide col-report-loc"><strong><i class="fas fa-${loc.icon || 'map-marker-alt'} text-warning"></i> ${locName}</strong></td>
            <td class="report-col-compact col-report-id"><code>${loc.code || "-"}</code></td>
            <td class="report-col-compact col-report-number report-number"><strong>${count}</strong></td>
            <td class="report-col-wide col-report-desc" style="font-size: 11px;">${typesStr}</td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-success">${assigned}</span></td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-primary">${available}</span></td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-danger">${maint}</span></td>
            <td class="report-col-compact col-report-number report-number"><span class="badge badge-warning">${store}</span></td>
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
          <th class="report-col-compact col-report-id">${I18N[lang].thTicketId || "رقم التذكرة"}</th>
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-compact col-report-type">${I18N[lang].assetType || "نوع الجهاز"}</th>
          <th class="report-col-medium col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th class="report-col-wide col-report-problem">${I18N[lang].problem || "المشكلة / العطل"}</th>
          <th class="report-col-wide col-report-resolution">${I18N[lang].actionTaken || "الإجراء المتخذ"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].technician || "الفني"}</th>
          <th class="report-col-medium col-report-vendor">${I18N[lang].vendor || "المورد / الجهة"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].maintDate || "تاريخ الصيانة"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].lblMaintReturnDate || "تاريخ الإرجاع"}</th>
          <th class="report-col-compact col-report-cost report-number">${I18N[lang].cost || "التكلفة (AED)"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "حالة التذكرة"}</th>
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
            <td class="report-col-compact col-report-id"><strong>${m.id}</strong></td>
            <td class="report-col-compact col-report-id"><strong>${assetIdStr}</strong></td>
            <td class="report-col-compact col-report-type">${typeStr}</td>
            <td class="report-col-medium col-report-model">${modelStr}</td>
            <td class="report-col-wide col-report-problem">${m.problem || "-"}</td>
            <td class="report-col-wide col-report-resolution">${m.actionTaken || "-"}</td>
            <td class="report-col-medium col-report-emp">${m.technician || "-"}</td>
            <td class="report-col-medium col-report-vendor">${m.vendor || "-"}</td>
            <td class="report-col-compact col-report-date">${m.maintenanceDate || "-"}</td>
            <td class="report-col-compact col-report-date">${m.returnDate || "-"}</td>
            <td class="report-col-compact col-report-cost report-number"><strong>${m.cost ? parseFloat(m.cost).toLocaleString() : "0"}</strong></td>
            <td class="report-col-compact col-report-status"><span class="badge ${statusBadge}">${m.status}</span></td>
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
          <th class="report-col-compact col-report-date">${lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}</th>
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-medium col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].thActionType || "نوع العملية"}</th>
          <th class="report-col-medium col-report-emp">${lang === 'ar' ? 'الموظف المرتبط' : 'Associated Employee'}</th>
          <th class="report-col-wide col-report-dept">${I18N[lang].department || "الإدارة / القسم"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].location || "الموقع"}</th>
          <th class="report-col-compact col-report-emp">${lang === 'ar' ? 'المنفذ' : 'Performed By'}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "الملاحظات والبيان"}</th>
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
            <td class="report-col-compact col-report-date">${tx.transactionDate || "-"}</td>
            <td class="report-col-compact col-report-id"><strong>${astLabel}</strong></td>
            <td class="report-col-medium col-report-model">${modelStr}</td>
            <td class="report-col-compact col-report-status"><span class="badge badge-primary">${AssetManager.formatTxType(tx.transactionType)}</span></td>
            <td class="report-col-medium col-report-emp">${empMap[tx.toEmployeeId] || "-"}</td>
            <td class="report-col-wide col-report-dept">${deptMap[tx.toDepartmentId] || "-"}</td>
            <td class="report-col-wide col-report-loc">${locMap[tx.toLocationId] || "-"}</td>
            <td class="report-col-compact col-report-emp">${tx.performedBy || "System"}</td>
            <td class="report-col-wide col-report-notes">${tx.notes || "-"}</td>
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
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-compact col-report-brand">${I18N[lang].brand || "الشركة"}</th>
          <th class="report-col-medium col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "السيريال"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].purchaseDate || "تاريخ الشراء"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].warrantyExpiry || "انتهاء الضمان"}</th>
          <th class="report-col-compact col-report-compact report-number">${I18N[lang].thRemainingDays || "الأيام المتبقية"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].warrantyStatus || "حالة الضمان"}</th>
          <th class="report-col-wide col-report-dept">${I18N[lang].department || "القسم"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].location || "الموقع"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].employee || "الموظف"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
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
            <td class="report-col-compact col-report-id"><strong>${a.assetId}</strong></td>
            <td class="report-col-compact col-report-brand">${a.brand || "-"}</td>
            <td class="report-col-medium col-report-model">${a.model || "-"}</td>
            <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
            <td class="report-col-compact col-report-date">${a.purchaseDate || "-"}</td>
            <td class="report-col-compact col-report-date"><strong>${a.warrantyExpiry || "-"}</strong></td>
            <td class="report-col-compact col-report-compact report-number">${daysDiff}</td>
            <td class="report-col-compact col-report-status"><span class="badge ${badgeClass}">${warrantyStatus}</span></td>
            <td class="report-col-wide col-report-dept">${deptMap[a.departmentId] || "-"}</td>
            <td class="report-col-wide col-report-loc">${locMap[a.locationId] || "-"}</td>
            <td class="report-col-medium col-report-emp">${empMap[a.currentEmployeeId] || "-"}</td>
            <td class="report-col-wide col-report-notes">${a.notes || "-"}</td>
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
          <th class="report-col-compact col-report-id report-number">#</th>
          <th class="report-col-medium col-report-status">${I18N[lang].status || "الحالة التشغيلية"}</th>
          <th class="report-col-compact col-report-id">${lang === 'ar' ? 'كود الحالة' : 'Status Code'}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].thDeviceCount || "عدد الأجهزة"}</th>
          <th class="report-col-compact col-report-compact report-number">${I18N[lang].percentage || "النسبة (%)"}</th>
          <th class="report-col-wide col-report-cost report-number">${I18N[lang].valuation || "إجمالي القيمة التقديرية (AED)"}</th>
        </tr>
      `;

      const allStatuses = [
        "Available",
        "Assigned",
        "Installed",
        "In Store",
        "In Transit",
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
            <td class="report-col-compact col-report-id report-number">${idx + 1}</td>
            <td class="report-col-medium col-report-status"><span class="badge ${AssetManager.getStatusBadgeClass(st)}">${AssetManager.formatStatus(st)}</span></td>
            <td class="report-col-compact col-report-id"><code>${st}</code></td>
            <td class="report-col-compact col-report-number report-number"><strong>${cnt}</strong></td>
            <td class="report-col-compact col-report-compact report-number">${pct}%</td>
            <td class="report-col-wide col-report-cost report-number">${val.toLocaleString()} AED</td>
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
          <th class="report-col-compact col-report-id">${lang === 'ar' ? 'رقم الطلب' : 'Request #'}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].employee || "الموظف"}</th>
          <th class="report-col-medium col-report-model">${lang === 'ar' ? 'الجهاز / الأصل' : 'Device / Asset'}</th>
          <th class="report-col-wide col-report-dept">${I18N[lang].department || "الإدارة"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-compact col-report-type">${lang === 'ar' ? 'نوع الطلب' : 'Request Type'}</th>
          <th class="report-col-wide col-report-notes">${lang === 'ar' ? 'الموضوع' : 'Subject'}</th>
          <th class="report-col-compact col-report-date">${lang === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</th>
          <th class="report-col-compact col-report-id">${lang === 'ar' ? 'سجل الصيانة' : 'Maintenance ID'}</th>
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
            <td class="report-col-compact col-report-id"><strong><code>${r.requestNumber}</code></strong></td>
            <td class="report-col-medium col-report-emp"><strong>${emp}</strong></td>
            <td class="report-col-medium col-report-model">${astLabel}</td>
            <td class="report-col-wide col-report-dept">${dept}</td>
            <td class="report-col-compact col-report-status"><span class="badge ${stBadge}">${r.status}</span></td>
            <td class="report-col-compact col-report-type">${r.requestType || "-"}</td>
            <td class="report-col-wide col-report-notes">${r.subject || "-"}</td>
            <td class="report-col-compact col-report-date">${r.createdDate ? r.createdDate.slice(0, 16).replace("T", " ") : "-"}</td>
            <td class="report-col-compact col-report-id">${r.maintenanceId ? `<code>${r.maintenanceId}</code>` : "-"}</td>
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
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-compact col-report-type">${I18N[lang].assetType || "النوع"}</th>
          <th class="report-col-compact col-report-brand">${I18N[lang].brand || "الشركة"}</th>
          <th class="report-col-medium col-report-model">${I18N[lang].model || "الموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "السيريال"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].warehouseLocation || "المستودع"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-compact col-report-cost report-number">${I18N[lang].purchaseCost || "التكلفة"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
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
            <td class="report-col-compact col-report-id"><strong><code>${a.assetId}</code></strong></td>
            <td class="report-col-compact col-report-type">${typeMap[a.assetTypeId] || "-"}</td>
            <td class="report-col-compact col-report-brand">${a.brand || "-"}</td>
            <td class="report-col-medium col-report-model">${a.model || "-"}</td>
            <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
            <td class="report-col-wide col-report-loc"><i class="fas fa-warehouse text-warning"></i> ${locMap[a.locationId] || "-"}</td>
            <td class="report-col-compact col-report-status"><span class="badge badge-warning">${AssetManager.formatStatus(a.status)}</span></td>
            <td class="report-col-compact col-report-cost report-number">${a.purchaseCost ? a.purchaseCost + " AED" : "-"}</td>
            <td class="report-col-wide col-report-notes">${a.notes || "-"}</td>
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
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-compact col-report-type">${I18N[lang].assetType || "النوع"}</th>
          <th class="report-col-medium col-report-model">${I18N[lang].brand || "الجهاز والموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "السيريال"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].fromWarehouse || "المستودع المصدر"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].itTechnician || "فني التقنية المستلم"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].issueDate || "تاريخ الصرف"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
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
            <td class="report-col-compact col-report-id"><strong><code>${a.assetId}</code></strong></td>
            <td class="report-col-compact col-report-type">${typeMap[a.assetTypeId] || "-"}</td>
            <td class="report-col-medium col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
            <td class="report-col-wide col-report-loc">${locMap[issue.warehouseLocationId || a.locationId] || "-"}</td>
            <td class="report-col-medium col-report-emp"><i class="fas fa-user-cog text-primary"></i> ${empMap[a.currentEmployeeId || issue.itEmployeeId] || "-"}</td>
            <td class="report-col-compact col-report-status"><span class="badge badge-warning">${AssetManager.formatStatus(a.status)}</span></td>
            <td class="report-col-compact col-report-date">${issue.issueDate || a.assignmentDate || "-"}</td>
            <td class="report-col-wide col-report-notes">${issue.notes || a.notes || "-"}</td>
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
          <th class="report-col-compact col-report-id report-number">SL No.</th>
          <th class="report-col-compact col-report-date">${I18N[lang].transferDate || "تاريخ النقل"}</th>
          <th class="report-col-compact col-report-id">ASSETS CODE</th>
          <th class="report-col-medium col-report-model">PRODUCTS DETAILS</th>
          <th class="report-col-compact col-report-number report-number">QTY</th>
          <th class="report-col-wide col-report-loc">Transfer From</th>
          <th class="report-col-wide col-report-loc">Transfer To</th>
          <th class="report-col-wide col-report-notes">REMARKS</th>
          <th class="report-col-compact col-report-status">STATUS</th>
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
            <td class="report-col-compact col-report-id report-number">${idx + 1}</td>
            <td class="report-col-compact col-report-date">${t.transferDate || "-"}</td>
            <td class="report-col-compact col-report-id"><strong><code>${a.assetId || "-"}</code></strong></td>
            <td class="report-col-medium col-report-model">${a.brand || ""} ${a.model || ""} (SN: ${a.serial || "-"})</td>
            <td class="report-col-compact col-report-number report-number">1</td>
            <td class="report-col-wide col-report-loc">${locMap[t.fromLocationId] || "-"}</td>
            <td class="report-col-wide col-report-loc"><strong class="text-primary">${locMap[t.toLocationId] || "-"}</strong></td>
            <td class="report-col-wide col-report-notes">${t.notes || "-"}</td>
            <td class="report-col-compact col-report-status"><span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${t.status || 'Completed'}</span> <small>(${cond})</small></td>
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
          <th class="report-col-compact col-report-id">${I18N[lang].projectNo || "رقم المشروع"}</th>
          <th class="report-col-wide col-report-desc">${I18N[lang].projectName || "اسم المشروع"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].contractor || "المقاول"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].location || "الموقع"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].startDate || "تاريخ البدء"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].plannedEndDate || "تاريخ الانتهاء"}</th>
          <th class="report-col-compact col-report-number report-number">${I18N[lang].progressPct || "نسبة الإنجاز"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].projectStatus || "الحالة"}</th>
        </tr>
      `;

      let allProjects = [];
      let allTasks = [];
      let allContractors = [];
      try {
        [allProjects, allTasks, allContractors] = await Promise.all([
          db.getAll("projects"),
          db.getAll("projectTasks"),
          db.getAll("contractors")
        ]);
      } catch (err) {
        console.error("Error loading project report data from database:", err);
      }

      allProjects = Array.isArray(allProjects) ? allProjects : [];
      allTasks = Array.isArray(allTasks) ? allTasks : [];
      allContractors = Array.isArray(allContractors) ? allContractors : [];
      const contractorMap = Object.fromEntries(allContractors.map(c => [c.id, lang === "ar" ? c.companyNameAr : (c.companyNameEn || c.companyNameAr)]));

      // Group tasks by project id (handling both projectId and project_id)
      const tasksByProjectId = {};
      allTasks.forEach(t => {
        const pId = t.projectId || t.project_id;
        if (pId) {
          if (!tasksByProjectId[pId]) tasksByProjectId[pId] = [];
          tasksByProjectId[pId].push(t);
        }
      });

      let filteredProjects = allProjects.filter(p => {
        if (filterStatus && p.status !== filterStatus) return false;
        if (filterLoc && p.locationId !== filterLoc) return false;
        if (filterDept && p.departmentId !== filterDept) return false;
        if (dateFrom && p.startDate && p.startDate < dateFrom) return false;
        if (dateTo && p.plannedEndDate && p.plannedEndDate > dateTo) return false;
        if (searchVal) {
          const prjTasks = tasksByProjectId[p.id] || [];
          let taskMatches = false;
          for (const t of prjTasks) {
            const taskText = `${t.taskNameAr || t.nameAr || t.task_name_ar || ""} ${t.taskNameEn || t.nameEn || t.task_name_en || ""} ${t.description || ""} ${t.notes || ""}`.toLowerCase();
            if (taskText.includes(searchVal)) {
              taskMatches = true;
              break;
            }
          }
          const prjStr = `${p.projectNo || ""} ${p.id || ""} ${p.nameAr || ""} ${p.nameEn || ""} ${contractorMap[p.contractorId] || ""} ${locMap[p.locationId] || ""} ${deptMap[p.departmentId] || ""} ${p.projectType || ""}`.toLowerCase();
          if (!prjStr.includes(searchVal) && !taskMatches) return false;
        }
        return true;
      });

      const today = new Date().toISOString().slice(0, 10);

      rowsHtml = filteredProjects.map(p => {
        const name = lang === "ar" ? p.nameAr : (p.nameEn || p.nameAr);
        const overdue = p.status !== "Completed" && p.status !== "Cancelled" && p.plannedEndDate && p.plannedEndDate < today;
        const prjIdentifier = p.projectNo || p.id || "-";
        const projectTasks = tasksByProjectId[p.id] || [];

        let tasksSectionHtml = "";
        if (projectTasks.length === 0) {
          tasksSectionHtml = `
            <div style="padding: 8px 12px; color: var(--text-muted, #64748b); font-size: 12px; font-style: italic; background: rgba(0,0,0,0.02); border-radius: 4px; border: 1px dashed var(--border-color, #cbd5e1); display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-info-circle" style="color: var(--text-muted, #64748b);"></i>
              <span>${lang === 'ar' ? 'لا توجد مهام مسجلة لهذا المشروع' : 'No tasks recorded for this project'}</span>
            </div>
          `;
        } else {
          const taskRows = projectTasks.map((t, idx) => {
            const tName = lang === "ar" ? (t.taskNameAr || t.nameAr || t.task_name_ar || (lang === 'ar' ? 'مهمة بدون اسم' : 'Untitled Task')) : (t.taskNameEn || t.nameEn || t.task_name_en || t.taskNameAr || t.nameAr || 'Untitled Task');
            const desc = t.description || "-";
            const assignee = empMap[t.responsibleEmployeeId || t.responsible_employee_id] || "-";
            const contractor = contractorMap[t.contractorId || t.contractor_id] || "-";
            const startDate = t.startDate || t.start_date || "-";
            const dueDate = t.dueDate || t.due_date || "-";
            const progress = t.progress !== undefined && t.progress !== null ? t.progress : 0;
            const status = t.status || "Pending";
            const priority = t.priority || "-";
            const notes = t.notes ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;"><i class="far fa-sticky-note"></i> ${t.notes}</div>` : "";

            let statusBadgeClass = "badge-secondary";
            if (status === "Completed") statusBadgeClass = "badge-success";
            else if (status === "In Progress") statusBadgeClass = "badge-primary";
            else if (status === "Overdue") statusBadgeClass = "badge-danger";
            else if (status === "On Hold") statusBadgeClass = "badge-warning";
            else if (status === "Cancelled") statusBadgeClass = "badge-danger";

            let priorityBadge = "-";
            if (priority && priority !== "-") {
              let priClass = "badge-secondary";
              if (priority === "Critical") priClass = "badge-danger";
              else if (priority === "High") priClass = "badge-warning";
              else if (priority === "Medium") priClass = "badge-info";
              priorityBadge = `<span class="badge ${priClass}">${priority}</span>`;
            }

            return `
              <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top;">
                  <strong>${tName}</strong>
                  ${notes}
                </td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top; max-width: 200px; word-break: break-word;">${desc}</td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top;">${assignee}</td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top;">${contractor}</td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top; text-align: center;">${startDate}</td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top; text-align: center;">${dueDate}</td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top; text-align: center;">${priorityBadge}</td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top; text-align: center;"><strong>${progress}%</strong></td>
                <td style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: top; text-align: center;"><span class="badge ${statusBadgeClass}">${status}</span></td>
              </tr>
            `;
          }).join("");

          tasksSectionHtml = `
            <div style="margin: 4px 0 6px 0;">
              <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary, #334155); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-tasks text-primary" style="font-size: 11px;"></i>
                <span>${lang === 'ar' ? 'المهام المسندة للمشروع' : 'Project Tasks'} (${projectTasks.length})</span>
              </div>
              <div class="table-responsive" style="overflow-x: auto; margin: 0; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;">
                <table class="custom-table" style="width: 100%; font-size: 12px; margin: 0; border-collapse: collapse; background: #ffffff;">
                  <thead>
                    <tr style="background: var(--bg-surface-hover, #f1f5f9); font-size: 11px; color: var(--text-secondary, #475569);">
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0);">${lang === 'ar' ? 'المهمة' : 'Task'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0);">${lang === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0);">${lang === 'ar' ? 'المسؤول' : 'Responsible'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0);">${lang === 'ar' ? 'المقاول' : 'Contractor'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); text-align: center;">${lang === 'ar' ? 'تاريخ البدء' : 'Start'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); text-align: center;">${lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); text-align: center;">${lang === 'ar' ? 'الأولوية' : 'Priority'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); text-align: center;">${lang === 'ar' ? 'نسبة الإنجاز' : 'Progress'}</th>
                      <th style="padding: 6px 8px; border: 1px solid var(--border-color, #e2e8f0); text-align: center;">${lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${taskRows}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }

        return `
          <tr class="report-project-header-row" style="background-color: var(--bg-surface-hover, #f1f5f9); font-weight: 600; border-top: 2px solid var(--border-color, #cbd5e1);">
            <td class="report-col-compact col-report-id"><strong><code>${prjIdentifier}</code></strong></td>
            <td class="report-col-wide col-report-desc"><strong>${name}</strong><br><small class="text-muted">${p.projectType || ""}</small></td>
            <td class="report-col-medium col-report-emp">${contractorMap[p.contractorId] || "-"}</td>
            <td class="report-col-wide col-report-loc">${locMap[p.locationId] || "-"}</td>
            <td class="report-col-compact col-report-date">${p.startDate || "-"}</td>
            <td class="report-col-compact col-report-date">${p.plannedEndDate || "-"}</td>
            <td class="report-col-compact col-report-number report-number"><strong>${p.progress !== undefined && p.progress !== null ? p.progress : 0}%</strong></td>
            <td class="report-col-compact col-report-status">
              <span class="badge ${p.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${p.status || '-'}</span>
              ${overdue ? ` <span class="badge badge-danger">${I18N[lang].badgeOverdue || 'متأخر'}</span>` : ''}
            </td>
          </tr>
          <tr class="report-project-tasks-row" style="border-bottom: 2px solid var(--border-color, #cbd5e1);">
            <td colspan="8" style="padding: 6px 12px 14px 12px; background: #ffffff;">
              ${tasksSectionHtml}
            </td>
          </tr>
        `;
      }).join("");

      let totalProjectsCount = filteredProjects.length;
      let totalTasksCount = 0;
      let completedTasksCount = 0;
      let inProgressTasksCount = 0;

      filteredProjects.forEach(p => {
        const pTasks = tasksByProjectId[p.id] || [];
        totalTasksCount += pTasks.length;
        pTasks.forEach(t => {
          if (t.status === "Completed") completedTasksCount++;
          else if (t.status === "In Progress") inProgressTasksCount++;
        });
      });

      totalsHtml = `
        <div class="report-totals-card" style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
          <div><span>${lang === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'}:</span> <strong>${totalProjectsCount}</strong></div>
          <div><span>${lang === 'ar' ? 'إجمالي المهام' : 'Total Tasks'}:</span> <strong style="color: var(--sdi-blue);">${totalTasksCount}</strong></div>
          <div><span>${lang === 'ar' ? 'مهام مكتملة' : 'Completed Tasks'}:</span> <strong class="text-success">${completedTasksCount}</strong></div>
          <div><span>${lang === 'ar' ? 'مهام قيد التنفيذ' : 'In Progress Tasks'}:</span> <strong class="text-warning">${inProgressTasksCount}</strong></div>
        </div>
      `;

    // -------------------------------------------------------------
    // 14. Warehouse Issue Records Report (تقرير سجلات صرف المستودع)
    // -------------------------------------------------------------
    } else if (reportType === "warehouseIssues") {
      title = lang === "ar" ? "تقرير سجلات صرف المستودع للفنيين" : "Warehouse Issue Records Report";
      tableHeader = `
        <tr>
          <th class="report-col-compact col-report-id">${I18N[lang].issueNo || "رقم الصرف"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].issueDate || "تاريخ الصرف"}</th>
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-medium col-report-model">${I18N[lang].brand || "الجهاز والموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "السيريال"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].fromWarehouse || "المستودع المصدر"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].itTechnician || "فني التقنية المستلم"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
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
            <td class="report-col-compact col-report-id"><strong><code>${i.issueNo || "-"}</code></strong></td>
            <td class="report-col-compact col-report-date">${i.issueDate || "-"}</td>
            <td class="report-col-compact col-report-id"><code>${a.assetId || "-"}</code></td>
            <td class="report-col-medium col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
            <td class="report-col-wide col-report-loc">${locMap[i.warehouseLocationId] || "-"}</td>
            <td class="report-col-medium col-report-emp"><i class="fas fa-user-cog text-primary"></i> ${empMap[i.itEmployeeId] || "-"}</td>
            <td class="report-col-compact col-report-status"><span class="badge ${statusBadge}">${statusText}</span></td>
            <td class="report-col-wide col-report-notes">${i.notes || "-"}</td>
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
          <th class="report-col-compact col-report-id">Asset ID</th>
          <th class="report-col-medium col-report-model">${I18N[lang].brand || "الجهاز والموديل"}</th>
          <th class="report-col-compact col-report-serial">${I18N[lang].serialNumber || "السيريال"}</th>
          <th class="report-col-wide col-report-loc">${I18N[lang].installLocation || "موقع التركيب"}</th>
          <th class="report-col-wide col-report-dept">${I18N[lang].department || "القسم"}</th>
          <th class="report-col-medium col-report-emp">${I18N[lang].endUser || "المستخدم النهائي"}</th>
          <th class="report-col-compact col-report-date">${I18N[lang].installDate || "تاريخ التركيب"}</th>
          <th class="report-col-compact col-report-status">${I18N[lang].status || "الحالة"}</th>
          <th class="report-col-wide col-report-notes">${I18N[lang].thNotes || "ملاحظات"}</th>
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
            <td class="report-col-compact col-report-id"><strong><code>${a.assetId || "-"}</code></strong></td>
            <td class="report-col-medium col-report-model">${a.brand || ""} ${a.model || ""}</td>
            <td class="report-col-compact col-report-serial"><code>${a.serial || "-"}</code></td>
            <td class="report-col-wide col-report-loc"><i class="fas fa-map-marker-alt text-success"></i> ${locMap[i.installedLocationId] || "-"}</td>
            <td class="report-col-wide col-report-dept">${deptMap[i.installedDepartmentId] || "-"}</td>
            <td class="report-col-medium col-report-emp">${i.endUserId ? `<i class="fas fa-user text-primary"></i> ${empMap[i.endUserId]}` : `<span class="text-muted">${lang === 'ar' ? 'بدون موظف (موقع عام)' : 'Shared / Unassigned'}</span>`}</td>
            <td class="report-col-compact col-report-date">${i.installationDate || "-"}</td>
            <td class="report-col-compact col-report-status"><span class="badge badge-success">${lang === 'ar' ? 'مكتمل التركيب' : 'Installed'}</span></td>
            <td class="report-col-wide col-report-notes">${i.notes || "-"}</td>
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

    const colCount = (tableHeader.match(/<th\b/gi) || []).length || 12;

    if (!rowsHtml) {
      const primaryStore = (reportType === "helpdesk") ? "helpdeskRequests" 
        : (reportType === "maint") ? "maintenance"
        : (reportType === "history") ? "assetTransactions"
        : (reportType === "transfers") ? "assetTransfers"
        : (reportType === "projects") ? "projects"
        : (reportType === "warehouseIssues" || reportType === "installations") ? "warehouseIssues"
        : "assets";
      const qErr = (typeof db !== "undefined" && db.getLastError) ? db.getLastError(primaryStore) : null;
      if (qErr) {
        rowsHtml = `<tr><td colspan="${colCount}" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle"></i> ${lang === 'ar' ? 'تعذر جلب بيانات التقرير من الخادم السحابي' : 'Failed to retrieve report data from cloud server'} (${qErr.message || ''})</td></tr>`;
      } else {
        rowsHtml = `<tr><td colspan="${colCount}" class="text-center py-4 text-muted">${I18N[lang].noResultsFound || "لا توجد نتائج مطابقة"}</td></tr>`;
      }
    }

    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const dateFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const timeFormatted = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const footerOrgName = settings.orgNameEn || "Sharjah Driving Institute";

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
          <tfoot class="report-table-print-spacer">
            <tr class="report-spacer-tr">
              <td colspan="${colCount}" class="report-spacer-td"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="report-print-bottom-footer print-only" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
        <div class="report-footer-timestamp">${dateFormatted}, ${timeFormatted}</div>
        <div class="report-footer-brand">SDI IT Asset Hub - ${footerOrgName}</div>
      </div>
    `;

    // Apply report type class for targeted print column allocation
    const prevTypeClasses = Array.from(reportArea.classList).filter(c => c.startsWith("report-type-"));
    prevTypeClasses.forEach(c => reportArea.classList.remove(c));
    reportArea.classList.add(`report-type-${reportType}`);

    // Apply dynamic report density class based on colCount
    reportArea.classList.remove("report-density-normal", "report-density-compact", "report-density-dense");
    if (colCount <= 8) {
      reportArea.classList.add("report-density-normal");
    } else if (colCount <= 11) {
      reportArea.classList.add("report-density-compact");
    } else {
      reportArea.classList.add("report-density-dense");
    }

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
      <div class="unified-report-header" dir="ltr">
        <!-- Top-Right Metadata Bar -->
        <div class="report-header-meta-row" dir="ltr">
          <span class="report-meta-item">
            <i class="far fa-calendar-alt report-meta-icon" style="color: #f97316;"></i>
            <span class="report-meta-label">${(window.I18N && window.I18N[lang] && window.I18N[lang].reportDate) || (lang === 'ar' ? "تاريخ التقرير" : "Report Date")}:</span>
            <strong class="report-meta-value">${dateStr}</strong>
          </span>
          <span class="report-meta-dot">&middot;</span>
          <span class="report-meta-item">
            <i class="far fa-clock report-meta-icon" style="color: #f97316;"></i>
            <span class="report-meta-label">${(window.I18N && window.I18N[lang] && window.I18N[lang].reportTime) || (lang === 'ar' ? "وقت الإصدار" : "Generated Time")}:</span>
            <strong class="report-meta-value">${timeStr}</strong>
          </span>
        </div>

        <!-- Main Header Row: Left Brand, Center Boxed Pill, Right Spacer -->
        <div class="report-header-main-row" dir="ltr">
          <div class="report-header-brand" dir="ltr">
            ${logoHtml}
            <div class="report-brand-text" dir="ltr">
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
    styleEl.innerHTML = `@page { size: A4 ${this.currentReportOrientation}; margin: 8mm 10mm 10mm 10mm; }`;
  }

  printCurrentReport() {
    this.setReportOrientation(this.currentReportOrientation || "landscape");
    window.print();
  }

  async exportReportPDF() {
    const reportArea = document.getElementById("printableReportArea");
    if (!reportArea || !reportArea.querySelector("table")) {
      this.showToast(
        AppState.lang === "ar" ? "لا توجد بيانات متاحة لتصدير تقرير PDF" : "No report data available to export as PDF",
        "warning"
      );
      return;
    }

    const reportSelect = document.getElementById("reportSelect");
    const reportType = reportSelect ? reportSelect.value : "report";
    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const filename = `SDI_${reportType}_Report_${dateStr}.pdf`;

    const orientation = this.currentReportOrientation || (['byDept', 'byStatus'].includes(reportType) ? 'portrait' : 'landscape');
    const isLandscape = orientation === "landscape";

    // Set UI loading state on the button
    const btnPdf = document.getElementById("btnExportPdfAction") || document.querySelector("button[onclick*='exportReportPDF']");
    const originalBtnHtml = btnPdf ? btnPdf.innerHTML : null;
    if (btnPdf) {
      btnPdf.disabled = true;
      btnPdf.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${AppState.lang === "ar" ? "جاري تجهيز PDF..." : "Generating PDF..."}</span>`;
    }

    this.showToast(
      AppState.lang === "ar" ? "جاري إنشاء ملف PDF وتنزيله مباشرة..." : "Generating and downloading PDF file...",
      "info"
    );

    // Ensure html2pdf is available
    if (typeof html2pdf === "undefined") {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "js/html2pdf.bundle.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (err) {
        console.warn("Could not load html2pdf dynamically", err);
      }
    }

    if (typeof html2pdf === "undefined") {
      if (btnPdf && originalBtnHtml) {
        btnPdf.disabled = false;
        btnPdf.innerHTML = originalBtnHtml;
      }
      this.showToast(
        AppState.lang === "ar" ? "تعذر تحميل مكتبة PDF. يرجى استخدام زر طباعة التقرير واختيار حفظ بتنسيق PDF." : "PDF engine could not be loaded. Please use Print Report and select Save as PDF.",
        "warning"
      );
      this.printCurrentReport();
      return;
    }

    // Target width matching standard A4 printable area at 96 DPI
    // A4 Landscape: 297mm x 210mm -> content width ~ 1060px
    // A4 Portrait: 210mm x 297mm -> content width ~ 760px
    const targetWidth = isLandscape ? 1060 : 760;

    const pdfContainer = document.createElement("div");
    pdfContainer.id = "pdfExportIsolatedContainer";
    pdfContainer.style.position = "fixed";
    pdfContainer.style.left = "-9999px";
    pdfContainer.style.top = "0";
    pdfContainer.style.width = `${targetWidth}px`;
    pdfContainer.style.minWidth = `${targetWidth}px`;
    pdfContainer.style.maxWidth = `${targetWidth}px`;
    pdfContainer.style.background = "#ffffff";
    pdfContainer.style.color = "#0f172a";
    pdfContainer.style.padding = "14px 18px";
    pdfContainer.style.boxSizing = "border-box";
    pdfContainer.style.direction = AppState.lang === "ar" ? "rtl" : "ltr";
    pdfContainer.style.fontFamily = "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    pdfContainer.style.zIndex = "-9999";

    // Clone report content into isolated container
    const clone = reportArea.cloneNode(true);
    clone.style.width = "100%";
    clone.style.margin = "0";
    clone.style.padding = "0";
    clone.style.background = "#ffffff";
    clone.style.boxShadow = "none";
    clone.style.border = "none";

    // Ensure all table wrappers are unclipped
    const tableWraps = clone.querySelectorAll(".table-responsive, .report-table-wrap");
    tableWraps.forEach(w => {
      w.style.overflow = "visible";
      w.style.width = "100%";
      w.style.maxWidth = "100%";
    });

    const table = clone.querySelector("table");
    if (table) {
      table.style.width = "100%";
      table.style.tableLayout = "fixed";
    }

    // Ensure unified report header has brand and logo pinned to the far left in the PDF
    const headerInClone = clone.querySelector(".unified-report-header");
    if (headerInClone) {
      headerInClone.setAttribute("dir", "ltr");
      headerInClone.style.direction = "ltr";
      headerInClone.style.textAlign = "left";
      headerInClone.style.width = "100%";
      headerInClone.style.boxSizing = "border-box";
      const mainRowInClone = headerInClone.querySelector(".report-header-main-row");
      if (mainRowInClone) {
        mainRowInClone.setAttribute("dir", "ltr");
        mainRowInClone.style.direction = "ltr";
        mainRowInClone.style.display = "grid";
        mainRowInClone.style.gridTemplateColumns = "1fr auto 1fr";
        mainRowInClone.style.alignItems = "center";
        mainRowInClone.style.width = "100%";
      }
      const brandInClone = headerInClone.querySelector(".report-header-brand");
      if (brandInClone) {
        brandInClone.setAttribute("dir", "ltr");
        brandInClone.style.direction = "ltr";
        brandInClone.style.justifySelf = "start";
        brandInClone.style.marginRight = "auto";
        brandInClone.style.marginLeft = "0";
        brandInClone.style.display = "flex";
        brandInClone.style.alignItems = "center";
      }
      const brandTextInClone = headerInClone.querySelector(".report-brand-text");
      if (brandTextInClone) {
        brandTextInClone.setAttribute("dir", "ltr");
        brandTextInClone.style.direction = "ltr";
        brandTextInClone.style.textAlign = "left";
      }
      const metaRowInClone = headerInClone.querySelector(".report-header-meta-row");
      if (metaRowInClone) {
        metaRowInClone.setAttribute("dir", "ltr");
        metaRowInClone.style.direction = "ltr";
        metaRowInClone.style.justifyContent = "flex-end";
      }
    }

    // Format and display the bottom institutional footer in the exported PDF
    const printFooter = clone.querySelector(".report-print-bottom-footer");
    if (printFooter) {
      printFooter.style.display = "flex";
      printFooter.style.position = "static";
      printFooter.style.marginTop = "20px";
      printFooter.style.paddingTop = "8px";
      printFooter.style.borderTop = "1px solid #cbd5e1";
      printFooter.style.fontSize = "10px";
      printFooter.style.color = "#475569";
      printFooter.style.width = "100%";
      printFooter.style.boxSizing = "border-box";
      printFooter.style.justifyContent = "space-between";
      printFooter.style.alignItems = "center";
      printFooter.classList.remove("print-only");
    }

    // Hide print-specific spacer tfoot in HTML-to-PDF export
    const spacerTfoot = clone.querySelector(".report-table-print-spacer");
    if (spacerTfoot) {
      spacerTfoot.style.display = "none";
    }

    pdfContainer.appendChild(clone);
    document.body.appendChild(pdfContainer);

    const opt = {
      margin: isLandscape ? [6, 8, 6, 8] : [8, 8, 8, 8],
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollY: 0,
        scrollX: 0,
        windowWidth: targetWidth + 40,
        logging: false
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: orientation
      },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };

    try {
      await html2pdf().set(opt).from(pdfContainer).save();
      this.showToast(
        AppState.lang === "ar" ? "تم حفظ وتنزيل تقرير PDF بنجاح" : "PDF report saved and downloaded successfully",
        "success"
      );
    } catch (err) {
      console.error("PDF export failed:", err);
      this.showToast(
        AppState.lang === "ar" ? "تعذر إنشاء ملف PDF تلقائياً، جاري فتح نافذة الطباعة كبديل." : "Automatic PDF creation failed, opening print dialog as fallback.",
        "warning"
      );
      this.printCurrentReport();
    } finally {
      if (pdfContainer.parentNode) {
        pdfContainer.parentNode.removeChild(pdfContainer);
      }
      if (btnPdf && originalBtnHtml) {
        btnPdf.disabled = false;
        btnPdf.innerHTML = originalBtnHtml;
      }
    }
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

          <div class="text-xs text-muted mt-3" style="line-height: 1.8; border-top: 1px dashed #e2e8f0; pt-2;">
            <div style="margin-bottom: 4px; font-weight: 600; color: var(--sdi-blue); text-transform: uppercase; letter-spacing: 0.5px;">
              <i class="fas fa-shield-alt"></i> ${isAr ? 'بيانات المحرك الموثقة:' : 'Verified Engine Details:'}
            </div>
            <div>• ${isAr ? 'مزود السحابة:' : 'Cloud Engine:'} <strong class="text-primary">Supabase Cloud PostgreSQL (Realtime Live Active)</strong></div>
            <div>• ${isAr ? 'عنوان الخادم:' : 'Endpoint:'} <code>https://xzfudqyctujxlhbgpdbs.supabase.co</code></div>
            <div>• ${isAr ? 'الأصول المسجلة بالسحابة:' : 'Cloud Assets Count:'} <strong class="text-success">${res.details.cloudAssets !== undefined ? res.details.cloudAssets : res.details.totalAssets}</strong> ${isAr ? 'أصل مسجل' : 'Assets registered'}</div>
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
  
  async runDataIntegrityCheck() {
    try {
      const isAr = AppState.lang === "ar";
      const [locations, departments, offices, assets, employees] = await Promise.all([
        db.getAll("locations"),
        db.getAll("departments"),
        db.getAll("offices"),
        db.getAll("assets"),
        db.getAll("employees")
      ]);

      // Count stats
      const locTotal = locations.length;
      const deptTotal = departments.length;
      const officeTotal = offices.length;
      const assetTotal = assets.length;

      // Update basic cards
      const elCountLoc = document.getElementById("diCountLocations");
      if (elCountLoc) elCountLoc.textContent = locTotal;
      const elCountDept = document.getElementById("diCountDepartments");
      if (elCountDept) elCountDept.textContent = deptTotal;
      const elCountOff = document.getElementById("diCountOffices");
      if (elCountOff) elCountOff.textContent = officeTotal;
      const elCountAss = document.getElementById("diCountAssets");
      if (elCountAss) elCountAss.textContent = assetTotal;

      // 1. Locations Integrity Check
      const locOrphans = locations.filter(l => l.parentId && !locations.some(parent => parent.id === l.parentId)).length;
      
      // 2. Departments Integrity Check
      const deptOrphans = departments.filter(d => d.locationId && !locations.some(l => l.id === d.locationId)).length;
      const deptUnassigned = departments.filter(d => !d.locationId).length;

      // 3. Offices Integrity Check
      const offLocOrphans = offices.filter(o => {
        const locId = o.location_id || o.locationId;
        return locId && !locations.some(l => l.id === locId);
      }).length;
      const offDeptOrphans = offices.filter(o => {
        const deptId = o.department_id || o.departmentId;
        return deptId && !departments.some(d => d.id === deptId);
      }).length;
      const offUnassignedLoc = offices.filter(o => !(o.location_id || o.locationId)).length;
      const offUnassignedDept = offices.filter(o => !(o.department_id || o.departmentId)).length;

      // 4. Assets Integrity Check
      const assetLocOrphans = assets.filter(a => a.locationId && !locations.some(l => l.id === a.locationId)).length;
      const assetEmpOrphans = assets.filter(a => a.currentEmployeeId && !employees.some(e => e.id === a.currentEmployeeId)).length;
      const assetOffOrphans = assets.filter(a => a.officeId && !offices.some(o => o.id === a.officeId)).length;
      const assetDeptOrphans = assets.filter(a => a.departmentId && !departments.some(d => d.id === a.departmentId)).length;

      const totalOffOrphans = offLocOrphans + offDeptOrphans;
      const totalAssetOrphans = assetLocOrphans + assetEmpOrphans + assetOffOrphans + assetDeptOrphans;

      // Populate Table Values
      const elLocTotal = document.getElementById("diLocTotal");
      if (elLocTotal) elLocTotal.textContent = locTotal;
      const elLocOrphans = document.getElementById("diLocOrphans");
      if (elLocOrphans) {
        if (locOrphans === 0) {
          elLocOrphans.innerHTML = `<span class="text-success"><i class="fas fa-check"></i> ${isAr ? '0 (روابط سليمة)' : '0 (Stable references)'}</span>`;
        } else {
          elLocOrphans.innerHTML = `<span class="text-danger font-bold"><i class="fas fa-exclamation-triangle"></i> ${locOrphans} ${isAr ? 'مراجع مفقودة' : 'missing parents'}</span>`;
        }
      }

      const elDeptTotal = document.getElementById("diDeptTotal");
      if (elDeptTotal) elDeptTotal.textContent = deptTotal;
      const elDeptOrphans = document.getElementById("diDeptOrphans");
      if (elDeptOrphans) {
        let text = "";
        if (deptOrphans > 0) {
          text += `<span class="text-danger font-bold"><i class="fas fa-exclamation-triangle"></i> ${deptOrphans} ${isAr ? 'روابط مواقع غير صالحة' : 'invalid locations'}</span>`;
        } else {
          text += `<span class="text-success"><i class="fas fa-check"></i> ${isAr ? 'جميع المواقع صالحة' : 'All locations valid'}</span>`;
        }
        text += ` <span class="text-xs text-muted">(${deptUnassigned} ${isAr ? 'بدون موقع/اختياري' : 'unassigned/optional'})</span>`;
        elDeptOrphans.innerHTML = text;
      }

      const elOfficeTotal = document.getElementById("diOfficeTotal");
      if (elOfficeTotal) elOfficeTotal.textContent = officeTotal;
      const elOfficeOrphans = document.getElementById("diOfficeOrphans");
      if (elOfficeOrphans) {
        let text = [];
        if (offLocOrphans > 0) {
          text.push(`<span class="text-danger font-bold">${offLocOrphans} ${isAr ? 'مواقع غير صالحة' : 'invalid locations'}</span>`);
        }
        if (offDeptOrphans > 0) {
          text.push(`<span class="text-danger font-bold">${offDeptOrphans} ${isAr ? 'أقسام غير صالحة' : 'invalid departments'}</span>`);
        }
        if (text.length === 0) {
          text.push(`<span class="text-success"><i class="fas fa-check"></i> ${isAr ? 'العلاقات سليمة' : 'All relations valid'}</span>`);
        }
        let unassignedText = ` <span class="text-xs text-muted">(${offUnassignedLoc} ${isAr ? 'بدون موقع' : 'unassigned loc'} / ${offUnassignedDept} ${isAr ? 'بدون قسم' : 'unassigned dept'})</span>`;
        elOfficeOrphans.innerHTML = text.join(" + ") + unassignedText;
      }

      const elAssetTotal = document.getElementById("diAssetTotal");
      if (elAssetTotal) elAssetTotal.textContent = assetTotal;
      const elAssetOrphans = document.getElementById("diAssetOrphans");
      if (elAssetOrphans) {
        let parts = [];
        if (assetLocOrphans > 0) parts.push(`<span class="text-danger font-bold">${assetLocOrphans} ${isAr ? 'موقع خطأ' : 'invalid loc'}</span>`);
        if (assetEmpOrphans > 0) parts.push(`<span class="text-danger font-bold">${assetEmpOrphans} ${isAr ? 'عهدة موظف خطأ' : 'invalid emp'}</span>`);
        if (assetOffOrphans > 0) parts.push(`<span class="text-danger font-bold">${assetOffOrphans} ${isAr ? 'مكتب خطأ' : 'invalid office'}</span>`);
        if (assetDeptOrphans > 0) parts.push(`<span class="text-danger font-bold">${assetDeptOrphans} ${isAr ? 'قسم خطأ' : 'invalid dept'}</span>`);
        if (parts.length === 0) {
          parts.push(`<span class="text-success"><i class="fas fa-check"></i> ${isAr ? 'سليم تماماً' : 'All references valid'}</span>`);
        }
        elAssetOrphans.innerHTML = parts.join(" / ");
      }

      // Update Health Status Badges
      const elLocStatus = document.getElementById("diLocStatus");
      if (elLocStatus) {
        if (locOrphans === 0) {
          elLocStatus.className = "badge badge-success";
          elLocStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${isAr ? 'مستقر' : 'Stable'}`;
        } else {
          elLocStatus.className = "badge badge-danger";
          elLocStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${isAr ? 'روابط تالفة' : 'Broken Links'}`;
        }
      }

      const elDeptStatus = document.getElementById("diDeptStatus");
      if (elDeptStatus) {
        if (deptOrphans === 0) {
          elDeptStatus.className = "badge badge-success";
          elDeptStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${isAr ? 'مستقر' : 'Stable'}`;
        } else {
          elDeptStatus.className = "badge badge-danger";
          elDeptStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${isAr ? 'مرجع غير صالح' : 'Invalid Link'}`;
        }
      }

      const elOfficeStatus = document.getElementById("diOfficeStatus");
      if (elOfficeStatus) {
        if (totalOffOrphans === 0) {
          elOfficeStatus.className = "badge badge-success";
          elOfficeStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${isAr ? 'مستقر' : 'Stable'}`;
        } else {
          elOfficeStatus.className = "badge badge-danger";
          elOfficeStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${isAr ? 'روابط تالفة' : 'Broken Links'}`;
        }
      }

      const elAssetStatus = document.getElementById("diAssetStatus");
      if (elAssetStatus) {
        if (totalAssetOrphans === 0) {
          elAssetStatus.className = "badge badge-success";
          elAssetStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${isAr ? 'مستقر' : 'Stable'}`;
        } else {
          elAssetStatus.className = "badge badge-danger";
          elAssetStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${isAr ? 'روابط مفقودة' : 'Broken Refs'}`;
        }
      }

    } catch (e) {
      console.error("[runDataIntegrityCheck] error:", e);
      this.showToast(AppState.lang === "ar" ? "فشل إجراء فحص سلامة البيانات" : "Failed to execute data integrity verification", "error");
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

  handleLoginModalClose() {
    if (!AppState.currentUser) {
      this.showToast(
        AppState.lang === "ar"
          ? "يجب تسجيل الدخول للوصول إلى النظام"
          : "Authentication is required to access the system",
        "warning"
      );
      const modal = document.getElementById("loginModal");
      if (modal) {
        modal.classList.add("active", "show");
        modal.style.display = "block";
        modal.removeAttribute("aria-hidden");
      }
      return;
    }
    this.closeModal("loginModal");
  }

  async handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const loginInput = (document.getElementById("loginEmail")?.value || "").trim();
    const pass = document.getElementById("loginPassword")?.value || "";
    const lang = AppState.lang;

    if (!loginInput || !pass) {
      this.showToast(
        lang === "ar"
          ? "يرجى إدخال اسم المستخدم/البريد الإلكتروني وكلمة المرور"
          : "Please enter username/email and password",
        "warning"
      );
      return;
    }

    if (!db.supabase) {
      this.showToast(
        lang === "ar"
          ? "خدمة قاعدة البيانات غير متوفرة"
          : "Database service unavailable",
        "error"
      );
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.showToast(
        lang === "ar"
          ? "لا يمكن تسجيل الدخول عندما تكون غير متصل بالإنترنت"
          : "Cannot login while offline",
        "error"
      );
      return;
    }

    let authenticatedUser = null;

    // 1. Resolve username to authoritative email
    let emailToAuth = loginInput;
    const cleanInput = loginInput.trim().toLowerCase();
    if (!emailToAuth.includes("@")) {
      try {
        const { data: userRec } = await db.supabase
          .from("users")
          .select("id, username, employee_id")
          .ilike("username", cleanInput)
          .maybeSingle();

        if (userRec && userRec.employee_id) {
          const { data: empRec } = await db.supabase
            .from("employees")
            .select("email")
            .eq("id", userRec.employee_id)
            .maybeSingle();
          if (empRec && empRec.email) {
            emailToAuth = empRec.email;
          }
        }
      } catch (e) {
        console.warn("Username to email resolution warning:", e);
      }
      if (!emailToAuth.includes("@")) {
        emailToAuth = cleanInput + "@sdi.ae";
      }
    }

    // 2. Execute Supabase GoTrue Authentication to acquire valid JWT session for RLS
    let authUser = null;
    let authData = null;
    let authError = null;

    try {
      const res = await db.supabase.auth.signInWithPassword({
        email: emailToAuth,
        password: pass
      });
      authData = res.data;
      authError = res.error;

      if ((authError || !authData || !authData.user) && cleanInput !== emailToAuth && cleanInput.includes("@")) {
        const fallbackRes = await db.supabase.auth.signInWithPassword({
          email: cleanInput,
          password: pass
        });
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.user) {
          authData = fallbackRes.data;
          authError = null;
        }
      }
    } catch (err) {
      authError = err;
    }

    if (authError || !authData || !authData.user || !authData.session) {
      console.warn("Authentication failed:", authError);
      this.showToast(
        lang === "ar"
          ? "اسم المستخدم أو كلمة المرور غير صحيحة"
          : "Invalid username or password",
        "error"
      );
      return;
    }

    authUser = authData.user;

    // 3. Resolve Application Profile via Shared Deterministic Resolver
    const resolution = await this.resolveAuthenticatedProfile(authUser);

    if (resolution.status !== "SUCCESS" || !resolution.profile) {
      console.error("Profile resolution failed after authentication:", resolution.status, resolution.error);
      // Revoke authenticated Supabase session immediately
      await db.supabase.auth.signOut().catch(() => {});

      let errorMsg = lang === "ar"
        ? "تمت المصادقة بنجاح، ولكن لم يتم العثور على ملف تعريف للمستخدم."
        : "Authentication succeeded, but no registered user profile was found.";

      if (resolution.status === "ACCOUNT_DEACTIVATED") {
        errorMsg = lang === "ar" ? "حساب المستخدم معطل" : "User account is deactivated";
      } else if (resolution.status === "AUTH_SUCCESS_MAPPING_CONFLICT") {
        errorMsg = lang === "ar"
          ? "تعارض في ربط الحساب: الحساب مرتبط بهوية أخرى."
          : "Identity mapping conflict: account is linked to a different identity.";
      } else if (resolution.status === "PROFILE_AMBIGUOUS") {
        errorMsg = lang === "ar"
          ? "تم العثور على عدة ملفات تعريف مطابقة لهذا البريد الإلكتروني."
          : "Multiple user profiles found matching this email.";
      } else if (resolution.status === "PROFILE_QUERY_ERROR") {
        errorMsg = lang === "ar"
          ? "خطأ في الاتصال بقاعدة البيانات أثناء التحقق من الملف الشخصي."
          : "Database query error during profile verification.";
      } else if (resolution.status === "PROFILE_LINK_ERROR") {
        errorMsg = lang === "ar"
          ? "فشل ربط ملف تعريف المستخدم. يرجى مراجعة مسؤول النظام."
          : "Failed to link user profile. Please contact administrator.";
      } else if (resolution.status === "AUTH_SUCCESS_MAPPING_MISSING") {
        errorMsg = lang === "ar"
          ? "الملف الشخصي غير مرتبط بحساب الدخول. يرجى مراجعة مسؤول النظام."
          : "User profile exists but is not linked to this login account. Please contact administrator.";
      }

      this.showToast(errorMsg, "error");
      return;
    }

    const cloudUser = resolution.profile;

    // 4. Derive AppState.currentUser strictly from Authoritative Cloud Profile
    authenticatedUser = {
      id: cloudUser.id,
      username: cloudUser.username,
      email: authUser.email || (cloudUser.username + "@sdi.ae"),
      fullName: cloudUser.full_name || cloudUser.fullName || cloudUser.username,
      fullNameAr: cloudUser.full_name_ar || cloudUser.fullNameAr || cloudUser.full_name || cloudUser.fullName || cloudUser.username,
      fullNameEn: cloudUser.full_name_en || cloudUser.fullNameEn || cloudUser.username,
      role: String(cloudUser.role || "Viewer").trim(),
      employeeId: cloudUser.employee_id || cloudUser.employeeId || null,
      active: cloudUser.active !== false
    };

    AppState.currentUser = authenticatedUser;
    sessionStorage.setItem("sdi_session_user", JSON.stringify(authenticatedUser));
    sessionStorage.removeItem("sdi_user");
    localStorage.removeItem("sdi_session_user");
    localStorage.removeItem("sdi_user");

    if (document.getElementById("loginPassword")) {
      document.getElementById("loginPassword").value = "";
    }

    this.applyUserRolePermissions();
    
    // Initialize Database after successful login
    try {
      await db.init();
      this.updateCloudStatus();
      if (!db.isCloudOnline) {
        this.showCloudUnavailableScreen("cloud");
      } else {
        this.hideCloudUnavailableScreen();
      }
    } catch (e) {
      console.warn("Post-login DB init warning:", e);
    }

    // Close login modal immediately after successful authentication and DB initialization
    this.closeModal("loginModal");

    // Final navigation and view rendering
    try {
      if (!AppState.currentUser) {
        this.openLoginModal();
        return;
      }
      if (AppState.currentUser.role === "Employee") {
        await this.switchTab("employeePortal", true);
      } else {
        await this.switchTab("dashboard", true);
      }
      await this.renderAuthenticatedViews();
    } catch (renderError) {
      console.error("Authenticated view rendering error:", renderError);
    }

    const welcomeName = typeof getUserDisplayName === "function"
      ? getUserDisplayName(AppState.currentUser, lang)
      : (AppState.currentUser ? (AppState.currentUser.fullName || AppState.currentUser.username) : "");
    this.showToast(`${lang === "ar" ? "مرحباً بك:" : "Welcome:"} ${welcomeName} (${AppState.currentUser ? AppState.currentUser.role : ""})`, "success");
  }

  async handleForgotPassword(event) {
    if (event) event.preventDefault();
    const lang = AppState.lang;
    let email = (document.getElementById("loginEmail")?.value || "").trim();

    if (!email) {
      this.showToast(
        lang === "ar"
          ? "يرجى إدخال البريد الإلكتروني أو اسم المستخدم أولاً لاستعادة كلمة المرور"
          : "Please enter email or username first to recover password",
        "warning"
      );
      document.getElementById("loginEmail")?.focus();
      return;
    }

    if (!email.includes("@")) {
      const cleanUsername = email.toLowerCase();
      try {
        const { data: userRec } = await db.supabase
          .from("users")
          .select("id, employee_id")
          .ilike("username", cleanUsername)
          .maybeSingle();
        if (userRec && userRec.employee_id) {
          const { data: empRec } = await db.supabase
            .from("employees")
            .select("email")
            .eq("id", userRec.employee_id)
            .maybeSingle();
          if (empRec && empRec.email) email = empRec.email;
        }
      } catch (e) {}
    }

    if (!email.includes("@")) {
      this.showToast(
        lang === "ar"
          ? "يرجى إدخال بريد إلكتروني صالح لاستعادة كلمة المرور"
          : "Please enter a valid email address to reset password",
        "error"
      );
      return;
    }

    if (!db.supabase || !db.isCloudOnline) {
      this.showToast(
        lang === "ar"
          ? "الخدمة السحابية غير متوفرة حالياً"
          : "Cloud service is currently unavailable",
        "error"
      );
      return;
    }

    try {
      await db.supabase.auth.resetPasswordForEmail(email);
    } catch (err) {
      console.warn("Password recovery request note:", err);
    }

    const msg = lang === "ar"
      ? "إذا كان الحساب مسجلاً في النظام، فقد تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني."
      : "If the account exists in the system, password reset instructions have been sent to your email.";
    this.showToast(msg, "info");
  }

  // REQ-30 & REQ-31: Logout & Session Cleanup
  async logout() {
    AppState.currentUser = null;
    sessionStorage.clear();
    localStorage.clear();
    
    // Securely wipe local IndexedDB to prevent data leakage
    if (db && typeof db.clearLocalData === "function") {
      try {
        await db.clearLocalData();
      } catch (e) {
        console.error("Failed to clear local database:", e);
      }
    }

    if (db.supabase) {
      try {
        await db.supabase.auth.signOut();
      } catch (e) {
        console.warn("Sign out note:", e);
      }
    }
    
    this.navHistory = [];
    this.hasUnsavedChanges = false;
    this.closeModal("userProfileModal");
    this.closeModal("changePasswordModal");
    this.closeModal("notificationsModal");
    this.applyUserRolePermissions();
    
    // Full page reload to ensure all memory state is destroyed
    window.location.reload();
  }

  async renderAuthenticatedViews() {
    if (!AppState.currentUser) return;
    try {
      if (typeof AssetManager !== "undefined") {
        AssetManager.populateDropdowns().catch(e => console.warn("populateDropdowns background error:", e));
      }
      await this.updateNotificationBadge();
    } catch (e) {
      console.warn("renderAuthenticatedViews warning:", e);
    }
  }

  applyUserRolePermissions() {
    const user = AppState.currentUser;
    const nameEl = document.getElementById("currentUserName");
    const roleEl = document.getElementById("currentUserRole");
    const lang = AppState.lang;

    // Diagnostic logging
    console.log("[AUTH DIAGNOSTIC] applyUserRolePermissions | User:", user ? user.username : "None", "| Role:", user ? user.role : "None");

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

    const settingsNav = document.getElementById("navSettings") || document.getElementById("navItemSettings");
    const empPortalNav = document.getElementById("navEmployeePortal") || document.getElementById("navItemEmployeePortal");

    if (!user) {
      if (nameEl) nameEl.textContent = lang === "ar" ? "غير مسجل" : "Not Logged In";
      if (roleEl) roleEl.textContent = "-";
      itNavItems.forEach(id => {
        const el = document.getElementById(id) || document.getElementById("navItem" + id.replace("nav", ""));
        if (el) el.style.display = "none";
      });
      if (settingsNav) settingsNav.style.display = "none";
      if (empPortalNav) empPortalNav.style.display = "none";
      document.querySelectorAll(".user-write-action").forEach(btn => btn.style.display = "none");
      document.querySelectorAll(".user-admin-action").forEach(btn => btn.style.display = "none");
      
      // Unauthenticated state: Hide all panes and show Access Denied as landing
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.remove("active");
        pane.style.display = "none";
      });
      const deniedPane = document.getElementById("tab-accessDenied");
      if (deniedPane) {
        deniedPane.classList.add("active");
        deniedPane.style.display = "block";
      }
      return;
    }

    // Authenticated state: Clear any previously set inline display styles for panes
    document.querySelectorAll(".tab-pane").forEach(pane => {
      pane.style.display = ""; 
    });

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

    const isAdmin = String(user.role).trim() === "Administrator";
    const isEmployee = String(user.role).trim() === "Employee";
    const isViewer = String(user.role).trim() === "Viewer";

    // Sidebar items control (REQ-32, REQ-55)
    itNavItems.forEach(id => {
      const el = document.getElementById(id) || document.getElementById("navItem" + id.replace("nav", ""));
      if (el) el.style.display = isEmployee ? "none" : "flex";
    });

    if (settingsNav) settingsNav.style.display = isAdmin ? "flex" : "none";
    if (empPortalNav) empPortalNav.style.display = isEmployee ? "flex" : "none";

    // Action buttons across views
    document.querySelectorAll(".user-write-action").forEach(btn => {
      btn.style.display = (isEmployee || isViewer) ? "none" : "";
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
      // Ensure the opened modal is always appended to the top of the DOM stacking context
      try {
        if (modal.parentElement) {
          modal.parentElement.appendChild(modal);
        } else {
          document.body.appendChild(modal);
        }
      } catch (domErr) {
        console.warn("[App.openModal] DOM append error:", domErr);
      }

      // Dynamically calculate the highest z-index among all currently active modals
      // to ensure the most recently opened modal always appears at the top
      let highestZ = 100000;
      const activeModals = document.querySelectorAll(".modal-container.active, .modal-container.show");
      activeModals.forEach((activeModal) => {
        if (activeModal !== modal) {
          const styleZ = parseInt(activeModal.style.zIndex, 10);
          const computedZ = parseInt(window.getComputedStyle(activeModal).zIndex, 10);
          const currentZ = Math.max(
            !isNaN(styleZ) ? styleZ : 0,
            !isNaN(computedZ) ? computedZ : 0
          );
          if (currentZ > highestZ) {
            highestZ = currentZ;
          }
        }
      });

      this.modalZIndex = Math.max(this.modalZIndex || 100000, highestZ) + 10;
      modal.style.setProperty("z-index", String(this.modalZIndex), "important");
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
        if (tn) {
          const val = getText(document.getElementById("formTaskNameAr")) || getText(document.getElementById("formTaskNameEn")) || getText(document.getElementById("formTaskName"));
          tn.textContent = val !== "-" ? val : "-";
        }
        if (ta) {
          const val = getText(document.getElementById("formTaskResponsible")) || getText(document.getElementById("formTaskAssignee"));
          ta.textContent = val !== "-" ? val : "-";
        }
        if (tp) {
          const val = getText(document.getElementById("formTaskPriority"));
          tp.textContent = val !== "-" ? val : "-";
        }
        if (td) {
          const val = getText(document.getElementById("formTaskDueDate"));
          td.textContent = val !== "-" ? val : "-";
        }
        if (pr) {
          const val = getText(document.getElementById("formTaskProgress"));
          pr.textContent = val !== "-" ? `${val}%` : "0%";
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
    if (modalId === "loginModal" && !AppState.currentUser) {
      this.handleLoginModalClose();
      return;
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      modal.classList.remove("show");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      modal.style.removeProperty("z-index");
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
    await this.setLanguage(newLang);
  }

  async setLanguage(newLang) {
    AppState.lang = newLang;
    localStorage.setItem("sdi_lang", newLang);
    this.applyLanguage(newLang);

    // Refresh all rendered views, dropdowns, and data objects in the new language
    await this.updateDashboard();
    if (window.AssetManager) {
      await AssetManager.populateDropdowns();
      await AssetManager.render();
    }
    if (window.UserManager) {
      await UserManager.renderEmployees();
      await UserManager.renderDepartments();
      await UserManager.renderLocations();
      await UserManager.renderOffices();
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
    if (window.ProjectManager) {
      await ProjectManager.render();
    }
    if (window.ContractorManager) {
      await ContractorManager.render();
    }
    if (window.OpsManager) {
      await OpsManager.render();
    }
    if (window.TechTools) {
      await TechTools.render();
    }
    await this.populateReportDropdowns();
    await this.generateSelectedReport();
    await this.updateNotificationBadge();
    this.applyUserRolePermissions();
    if (this.currentTab === "settings" && this.currentSettingsSubTab === "dataIntegrity") {
      await this.runDataIntegrityCheck();
    }
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

    // Dynamic Cloud connection status update
    this.updateCloudStatus();
  }

  updateCloudStatus() {
    const statusText = document.getElementById("sidebarStatusText");
    const statusDot = document.querySelector(".status-dot");
    const lang = (window.AppState && window.AppState.lang) || localStorage.getItem("sdi_lang") || "ar";

    if (statusText) {
      const isOnline = !!(window.db && window.db.isCloudOnline);
      const key = isOnline ? "connectedStatus" : "offlineStatus";
      if (window.I18N && window.I18N[lang] && window.I18N[lang][key]) {
        statusText.textContent = window.I18N[lang][key];
      } else {
        statusText.textContent = isOnline
          ? (lang === "ar" ? "متصل بسحابة Supabase" : "Supabase Cloud Connected")
          : (lang === "ar" ? "قاعدة بيانات محلية (غير متصل)" : "Local Database (Offline)");
      }
    }

    if (statusDot) {
      if (window.db && window.db.isCloudOnline) {
        statusDot.classList.remove("offline");
      } else {
        statusDot.classList.add("offline");
      }
    }
  }

  showCloudUnavailableScreen(reason) {
    const screen = document.getElementById("cloudUnavailableScreen");
    if (screen) {
      screen.style.display = "flex";
    } else {
      const lang = (window.AppState && window.AppState.lang) || localStorage.getItem("sdi_lang") || "ar";
      if (typeof this.showToast === "function") {
        this.showToast(
          lang === "ar"
            ? "تعذر الاتصال بالخادم السحابي. يرجى التحقق من الاتصال."
            : "Could not connect to the cloud server. Please check your connection.",
          "error"
        );
      }
    }
  }

  hideCloudUnavailableScreen() {
    const screen = document.getElementById("cloudUnavailableScreen");
    if (screen) {
      screen.style.display = "none";
    }
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
    AppState.theme = "light";
    localStorage.setItem("sdi_theme", "light");
    this.applyTheme("light");
  }

  updateThemePaletteUI() {
    const currentTheme = "light";
    const currentColor = AppState.colorTheme || localStorage.getItem("sdi_color_theme") || "orange";

    const lightBtn = document.getElementById("btnModeLight");
    const darkBtn = document.getElementById("btnModeDark");
    if (lightBtn) {
      lightBtn.classList.add("active");
    }
    if (darkBtn) {
      darkBtn.classList.remove("active");
      darkBtn.style.display = "none";
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
    this.setThemeMode("light");
  }

  applyTheme(theme) {
    AppState.theme = "light";
    localStorage.setItem("sdi_theme", "light");
    document.body.setAttribute("data-theme", "light");
    const icon = document.getElementById("themeToggleIcon");
    if (icon) {
      icon.className = "fas fa-sun";
    }
    this.updateThemePaletteUI();
  }
}

/**
 * Unified Relational Helper for Dynamic Location -> Department -> Office -> Employee -> Asset Cascading
 */
class RelationalCascadeHelper {
  async getAllHierarchyData() {
    const [locations, departments, offices, employees, assets] = await Promise.all([
      db.getAll("locations").catch(() => []),
      db.getAll("departments").catch(() => []),
      db.getAll("offices").catch(() => []),
      db.getAll("employees").catch(() => []),
      db.getAll("assets").catch(() => [])
    ]);

    const activeLocs = (locations || []).filter(l => l && l.active !== false);
    const activeDepts = (departments || []).filter(d => d && d.active !== false);
    const activeOffices = (offices || []).filter(o => o && o.status !== "Inactive");
    const activeEmps = (employees || []).filter(e => e && (e.status === "Active" || !e.status));
    const allAssets = (assets || []);

    const locMap = Object.fromEntries(activeLocs.map(l => [l.id, l]));
    const deptMap = Object.fromEntries(activeDepts.map(d => [d.id, d]));
    const officeMap = Object.fromEntries(activeOffices.map(o => [o.id, o]));
    const empMap = Object.fromEntries(activeEmps.map(e => [e.id, e]));
    const assetMap = Object.fromEntries(allAssets.map(a => [a.id, a]));

    return {
      locations: activeLocs,
      departments: activeDepts,
      offices: activeOffices,
      employees: activeEmps,
      assets: allAssets,
      locMap,
      deptMap,
      officeMap,
      empMap,
      assetMap
    };
  }

  getDepartmentLocationId(dept) {
    if (!dept) return null;
    return dept.locationId || dept.location_id || null;
  }

  getOfficeLocationId(office) {
    if (!office) return null;
    return office.location_id || office.locationId || null;
  }

  getOfficeDepartmentId(office) {
    if (!office) return null;
    return office.department_id || office.departmentId || null;
  }

  getEmployeeLocationId(emp, deptMap = {}, officeMap = {}) {
    if (!emp) return null;
    if (emp.locationId || emp.location_id) return emp.locationId || emp.location_id;
    if (emp.officeId && officeMap[emp.officeId]) {
      const offLoc = this.getOfficeLocationId(officeMap[emp.officeId]);
      if (offLoc) return offLoc;
    }
    const deptId = emp.departmentId || emp.department_id;
    if (deptId && deptMap[deptId]) {
      return this.getDepartmentLocationId(deptMap[deptId]);
    }
    return null;
  }

  getEmployeeDepartmentId(emp, officeMap = {}) {
    if (!emp) return null;
    if (emp.departmentId || emp.department_id) return emp.departmentId || emp.department_id;
    if (emp.officeId && officeMap[emp.officeId]) {
      return this.getOfficeDepartmentId(officeMap[emp.officeId]);
    }
    return null;
  }
}

const RelationalHelper = new RelationalCascadeHelper();
window.RelationalHelper = RelationalHelper;

// Global Application Singleton
const App = new Application();
App.RelationalHelper = RelationalHelper;
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

if (typeof window !== "undefined") {
  window.resolveAuthenticatedProfile = (authUser, options) => App.resolveAuthenticatedProfile(authUser, options);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Application, App, resolveAuthenticatedProfile: (authUser, options) => App.resolveAuthenticatedProfile(authUser, options) };
}

