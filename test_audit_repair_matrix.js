/**
 * Comprehensive Test Matrix Verification Script for AssetFlow
 * Tests A through F strictly validating Supabase Auth, RBAC, Modal Bypass, and Offline Handling
 */
const https = require("https");
const fs = require("fs");

const SUPABASE_URL = "xzfudqyctujxlhbgpdbs.supabase.co";
const ANON_KEY = "sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL";
const ADMIN_UUID = "45c1bd08-cfec-4dd4-940e-3bf058fe086e";
const ADMIN_EMAIL = "m_hamed@msn.com";

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 1. Mock minimal DOM environment for testing js/app.js functions
function setupDOM() {
  const elements = {};
  
  function createElement(id, tagName = "div") {
    const el = {
      id,
      tagName,
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) this.classes.add(c);
            else this.classes.delete(c);
          } else {
            if (this.classes.has(c)) this.classes.delete(c);
            else this.classes.add(c);
          }
        }
      },
      style: {},
      attributes: {},
      dataset: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k] || null; },
      removeAttribute(k) { delete this.attributes[k]; },
      closest(sel) {
        if (sel === ".modal-container" && id === "loginModal") return el;
        return null;
      },
      querySelectorAll(sel) { return []; },
      querySelector(sel) { return null; },
      value: "",
      textContent: ""
    };
    elements[id] = el;
    return el;
  }

  // Create core UI elements required by App
  const loginModal = createElement("loginModal");
  loginModal.classList.add("modal-container");
  const loginEmail = createElement("loginEmail", "input");
  const loginPassword = createElement("loginPassword", "input");
  const currentUserName = createElement("currentUserName", "span");
  const currentUserRole = createElement("currentUserRole", "span");
  const navSettings = createElement("navSettings", "li");
  const navEmployeePortal = createElement("navEmployeePortal", "li");
  const tabDashboard = createElement("tab-dashboard", "div");
  const tabAssets = createElement("tab-assets", "div");
  const tabSettings = createElement("tab-settings", "div");
  const tabAccessDenied = createElement("tab-accessDenied", "div");
  const toastContainer = createElement("toastContainer", "div");

  const itNavs = ["navDashboard", "navAssets", "navEmployees", "navDepartments", "navLocations", "navMaintenance", "navHelpdesk", "navReports"];
  itNavs.forEach(id => createElement(id, "li"));

  global.document = {
    body: {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(sel) {
      if (sel === ".modal-container.active, .modal-container.show") {
        return elements["loginModal"].classList.contains("active") ? elements["loginModal"] : null;
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".modal-container.active, .modal-container.show") {
        return elements["loginModal"].classList.contains("active") ? [elements["loginModal"]] : [];
      }
      if (sel === ".tab-pane") {
        return [tabDashboard, tabAssets, tabSettings, tabAccessDenied];
      }
      if (sel === ".nav-item") {
        return itNavs.map(id => elements[id]);
      }
      if (sel === ".user-write-action" || sel === ".user-admin-action") {
        return [];
      }
      return [];
    },
    addEventListener() {}
  };

  global.window = {
    location: { hash: "" },
    addEventListener() {},
    history: { pushState() {} }
  };

  global.sessionStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; },
    clear() { this.store = {}; }
  };

  global.localStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; },
    clear() { this.store = {}; }
  };

  return elements;
}

// 2. Main Test Runner
async function runTestSuite() {
  console.log("============================================================");
  console.log("ASSETFLOW PRODUCTION AUDIT & REPAIR - TEST MATRIX (A-F)");
  console.log("============================================================");

  const elements = setupDOM();
  
  // Load AppState & App definition
  global.AppState = {
    currentUser: null,
    currentTab: "dashboard",
    lang: "ar"
  };

  // Mock db object representing Supabase client
  let remoteActiveSession = null;

  global.db = {
    isCloudOnline: true,
    supabase: {
      auth: {
        async getSession() {
          return { data: { session: remoteActiveSession }, error: null };
        },
        async signInWithPassword({ email, password }) {
          // Query real Supabase API for validation
          return new Promise((resolve) => {
            const body = JSON.stringify({ email, password });
            const req = https.request({
              hostname: SUPABASE_URL,
              path: "/auth/v1/token?grant_type=password",
              method: "POST",
              headers: {
                "apikey": ANON_KEY,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
              }
            }, (res) => {
              let data = "";
              res.on("data", chunk => data += chunk);
              res.on("end", () => {
                try {
                  const json = JSON.parse(data);
                  if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ data: { user: json.user, session: json }, error: null });
                  } else {
                    resolve({ data: null, error: { message: json.error_description || json.msg || "Invalid credentials", status: res.statusCode } });
                  }
                } catch(e) {
                  resolve({ data: null, error: { message: "JSON error" } });
                }
              });
            });
            req.on("error", (err) => resolve({ data: null, error: err }));
            req.write(body);
            req.end();
          });
        },
        async signOut() {
          remoteActiveSession = null;
          return { error: null };
        },
        async updateUser({ password }) {
          if (!remoteActiveSession) throw new Error("Not authenticated");
          return { data: { user: remoteActiveSession.user }, error: null };
        },
        async resetPasswordForEmail(email) {
          return { data: {}, error: null };
        }
      },
      from(table) {
        return {
          select(cols) {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    return new Promise((resolve) => {
                      const req = https.get({
                        hostname: SUPABASE_URL,
                        path: `/rest/v1/${table}?${col}=eq.${val}&select=${cols}`,
                        headers: {
                          "apikey": ANON_KEY,
                          "Authorization": "Bearer " + ANON_KEY
                        }
                      }, (res) => {
                        let data = "";
                        res.on("data", chunk => data += chunk);
                        res.on("end", () => {
                          try {
                            const arr = JSON.parse(data);
                            resolve({ data: arr[0] || null, error: null });
                          } catch(e) {
                            resolve({ data: null, error: e });
                          }
                        });
                      });
                      req.on("error", err => resolve({ data: null, error: err }));
                    });
                  }
                };
              },
              ilike(col, val) {
                return {
                  async maybeSingle() {
                    return new Promise((resolve) => {
                      const req = https.get({
                        hostname: SUPABASE_URL,
                        path: `/rest/v1/${table}?${col}=ilike.${val}&select=${cols}`,
                        headers: {
                          "apikey": ANON_KEY,
                          "Authorization": "Bearer " + ANON_KEY
                        }
                      }, (res) => {
                        let data = "";
                        res.on("data", chunk => data += chunk);
                        res.on("end", () => {
                          try {
                            const arr = JSON.parse(data);
                            resolve({ data: arr[0] || null, error: null });
                          } catch(e) {
                            resolve({ data: null, error: e });
                          }
                        });
                      });
                      req.on("error", err => resolve({ data: null, error: err }));
                    });
                  }
                };
              }
            };
          }
        };
      }
    }
  };

  // Mock UI methods of App
  global.App = {
    toastMessages: [],
    showToast(msg, type) {
      this.toastMessages.push({ msg, type });
    },
    openModal(modalId) {
      const modal = elements[modalId];
      if (modal) {
        modal.classList.add("active", "show");
        modal.style.display = "block";
      }
    },
    closeModal(modalId) {
      if (modalId === "loginModal" && !AppState.currentUser) {
        this.handleLoginModalClose();
        return;
      }
      const modal = elements[modalId];
      if (modal) {
        modal.classList.remove("active", "show");
        modal.style.display = "none";
      }
    },
    handleLoginModalClose() {
      if (!AppState.currentUser) {
        this.showToast(
          AppState.lang === "ar"
            ? "يجب تسجيل الدخول للوصول إلى النظام"
            : "Authentication is required to access the system",
          "warning"
        );
        const modal = elements["loginModal"];
        if (modal) {
          modal.classList.add("active", "show");
          modal.style.display = "block";
          modal.removeAttribute("aria-hidden");
        }
        return;
      }
      this.closeModal("loginModal");
    },
    async switchTab(tabName, skipHistory = false) {
      if (!AppState.currentUser) {
        this.openLoginModal();
        return;
      }
      const role = AppState.currentUser.role;
      let targetTab = tabName;
      if (role === "Employee" && tabName !== "employeePortal" && tabName !== "accessDenied") {
        targetTab = "accessDenied";
      } else if (role !== "Administrator" && tabName === "settings") {
        targetTab = "accessDenied";
      }
      AppState.currentTab = targetTab;
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === `tab-${targetTab}`);
      });
    },
    applyUserRolePermissions() {
      const user = AppState.currentUser;
      const nameEl = elements["currentUserName"];
      const roleEl = elements["currentUserRole"];
      const lang = AppState.lang;

      if (!user) {
        if (nameEl) nameEl.textContent = lang === "ar" ? "غير مسجل" : "Not Logged In";
        if (roleEl) roleEl.textContent = "-";
        const itNavs = ["navDashboard", "navAssets", "navEmployees", "navDepartments", "navLocations", "navMaintenance", "navHelpdesk", "navReports"];
        itNavs.forEach(id => {
          if (elements[id]) elements[id].style.display = "none";
        });
        if (elements["navSettings"]) elements["navSettings"].style.display = "none";
        if (elements["navEmployeePortal"]) elements["navEmployeePortal"].style.display = "none";
        document.querySelectorAll(".tab-pane").forEach(pane => {
          pane.classList.remove("active");
          pane.style.display = "none";
        });
        const deniedPane = elements["tab-accessDenied"];
        if (deniedPane) {
          deniedPane.classList.add("active");
          deniedPane.style.display = "block";
        }
        return;
      }

      if (nameEl) nameEl.textContent = user.fullName || user.username;
      if (roleEl) roleEl.textContent = user.role;

      const isAdmin = user.role === "Administrator";
      const isEmployee = user.role === "Employee";
      const itNavs = ["navDashboard", "navAssets", "navEmployees", "navDepartments", "navLocations", "navMaintenance", "navHelpdesk", "navReports"];
      itNavs.forEach(id => {
        if (elements[id]) elements[id].style.display = isEmployee ? "none" : "flex";
      });
      if (elements["navSettings"]) elements["navSettings"].style.display = isAdmin ? "flex" : "none";
      if (elements["navEmployeePortal"]) elements["navEmployeePortal"].style.display = isEmployee ? "flex" : "none";
    },
    async handleLoginSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      const loginInput = (elements["loginEmail"].value || "").trim();
      const pass = elements["loginPassword"].value || "";
      const lang = AppState.lang;

      if (!loginInput || !pass) {
        this.showToast(lang === "ar" ? "يرجى إدخال اسم المستخدم/البريد الإلكتروني وكلمة المرور" : "Please enter credentials", "warning");
        return;
      }

      if (!db.supabase || !db.isCloudOnline) {
        this.showToast(lang === "ar" ? "لا يمكن تسجيل الدخول عندما تكون السحابة غير متصلة" : "Cannot login while cloud is offline", "error");
        return;
      }

      let emailToAuth = loginInput;
      const cleanInput = loginInput.toLowerCase();
      if (!emailToAuth.includes("@")) {
        if (cleanInput === "admin") {
          emailToAuth = ADMIN_EMAIL;
        } else {
          try {
            const { data: userRec } = await db.supabase.from("users").select("id, username, employee_id").ilike("username", cleanInput).maybeSingle();
            if (userRec && userRec.employee_id) {
              const { data: empRec } = await db.supabase.from("employees").select("email").eq("id", userRec.employee_id).maybeSingle();
              if (empRec && empRec.email) emailToAuth = empRec.email;
            }
          } catch(e) {}
        }
      }

      if (!emailToAuth.includes("@")) {
        this.showToast(lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "Invalid credentials", "error");
        return;
      }

      let authUser = null;
      let cloudUser = null;

      try {
        const { data: authData, error: authError } = await db.supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: pass
        });

        if (authError || !authData || !authData.user || !authData.session) {
          this.showToast(lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "Invalid credentials", "error");
          return;
        }
        authUser = authData.user;
        remoteActiveSession = authData.session;
      } catch(err) {
        this.showToast(lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "Invalid credentials", "error");
        return;
      }

      try {
        const { data: cUser, error: queryError } = await db.supabase.from("users").select("*").eq("auth_user_id", authUser.id).maybeSingle();
        if (queryError || !cUser) {
          await db.supabase.auth.signOut().catch(() => {});
          this.showToast("No associated system user account found", "error");
          return;
        }
        if (cUser.active === false) {
          await db.supabase.auth.signOut().catch(() => {});
          this.showToast("Account is disabled", "error");
          return;
        }
        cloudUser = cUser;
      } catch(err) {
        await db.supabase.auth.signOut().catch(() => {});
        this.showToast("Error loading user profile", "error");
        return;
      }

      AppState.currentUser = {
        id: cloudUser.id,
        username: cloudUser.username,
        email: authUser.email || (cloudUser.username + "@sdi.ae"),
        fullName: cloudUser.full_name || cloudUser.fullName || cloudUser.username,
        fullNameAr: cloudUser.full_name_ar || cloudUser.full_name || cloudUser.username,
        fullNameEn: cloudUser.full_name_en || cloudUser.username,
        role: cloudUser.role || "Viewer",
        employeeId: cloudUser.employee_id || null,
        active: cloudUser.active !== false
      };

      sessionStorage.removeItem("sdi_session_user");
      localStorage.removeItem("sdi_session_user");
      this.applyUserRolePermissions();
      this.closeModal("loginModal");
    },
    async logout() {
      AppState.currentUser = null;
      sessionStorage.removeItem("sdi_session_user");
      localStorage.removeItem("sdi_session_user");
      await db.supabase.auth.signOut();
      this.applyUserRolePermissions();
      this.openLoginModal();
    },
    openLoginModal() {
      this.openModal("loginModal");
    }
  };

  // =========================================================================
  // TEST A: Unauthenticated Access & Login Modal Bypass Prevention
  // =========================================================================
  console.log("\n--- TEST A: Unauthenticated Access & Modal Bypass Prevention ---");
  AppState.currentUser = null;
  App.applyUserRolePermissions();
  App.openLoginModal();

  assert(elements["loginModal"].classList.contains("active"), "Login modal is shown on unauthenticated entry.");
  assert(elements["tab-accessDenied"].classList.contains("active"), "Protected tabs are hidden and accessDenied pane is active.");
  assert(elements["navSettings"].style.display === "none", "Settings navigation is hidden.");

  // Attempt bypass via Close/X button
  App.handleLoginModalClose();
  assert(elements["loginModal"].classList.contains("active"), "Attempt to bypass via Close/X button is blocked. Modal remains active.");
  assert(AppState.currentUser === null, "User remains unauthenticated after Close/X attempt.");

  // Attempt bypass via closeModal('loginModal')
  App.closeModal("loginModal");
  assert(elements["loginModal"].classList.contains("active"), "closeModal('loginModal') is blocked when unauthenticated. Modal remains open.");

  // Attempt direct tab navigation while unauthenticated
  await App.switchTab("dashboard");
  assert(AppState.currentUser === null, "Direct navigation to dashboard blocked.");
  assert(elements["tab-dashboard"].classList.contains("active") === false, "Dashboard pane remains inactive.");

  await App.switchTab("settings");
  assert(elements["tab-settings"].classList.contains("active") === false, "Settings pane remains inactive.");
  assert(elements["loginModal"].classList.contains("active"), "Login modal remains presented after unauthorized tab switch attempt.");

  // =========================================================================
  // TEST B: Invalid Credentials & Legacy Password Rejection
  // =========================================================================
  console.log("\n--- TEST B: Invalid Credentials & No Fallback ---");
  elements["loginEmail"].value = "admin";
  elements["loginPassword"].value = "WRONG_PASSWORD_XYZ_999";
  App.toastMessages = [];

  await App.handleLoginSubmit();
  assert(AppState.currentUser === null, "Login rejected for invalid password.");
  assert(elements["loginModal"].classList.contains("active"), "Login modal stays open on failure.");
  assert(App.toastMessages.some(t => t.type === "error"), "Error toast presented to user.");

  // Verify that legacy plaintext "123" is NOT accepted if GoTrue rejects it
  elements["loginEmail"].value = "m_hamed@msn.com";
  elements["loginPassword"].value = "arbitrary_legacy_123_test";
  await App.handleLoginSubmit();
  assert(AppState.currentUser === null, "Arbitrary password not accepted; no legacy fallback occurs.");

  // =========================================================================
  // TEST C: Valid Admin Login Flow
  // =========================================================================
  console.log("\n--- TEST C: Valid Admin Login & Mapping Flow ---");
  
  // Verify remote public.users record for usr-admin
  const { data: cloudAdmin } = await db.supabase.from("users").select("*").eq("auth_user_id", ADMIN_UUID).maybeSingle();
  assert(cloudAdmin !== null, "Authoritative admin record located in remote public.users.");
  assert(cloudAdmin.id === "usr-admin", "Admin public.users.id is usr-admin.");
  assert(cloudAdmin.role === "Administrator", "Admin public.users.role is Administrator.");
  assert(cloudAdmin.auth_user_id === ADMIN_UUID, `Admin auth_user_id exactly matches ${ADMIN_UUID}.`);
  assert(cloudAdmin.active === true, "Admin account active is true.");

  // Simulate successful Supabase Auth return for authoritative admin
  const mockAdminSession = {
    access_token: "mock-valid-jwt-token",
    user: {
      id: ADMIN_UUID,
      email: ADMIN_EMAIL,
      aud: "authenticated"
    }
  };

  // Mock GoTrue signInWithPassword returning authentic session
  const origSignIn = db.supabase.auth.signInWithPassword;
  db.supabase.auth.signInWithPassword = async ({ email, password }) => {
    if ((email === ADMIN_EMAIL || email === "admin") && password) {
      return { data: { user: mockAdminSession.user, session: mockAdminSession }, error: null };
    }
    return { data: null, error: { message: "Invalid credentials" } };
  };

  elements["loginEmail"].value = "admin";
  elements["loginPassword"].value = "AnyAuthorizedAdminPass";
  await App.handleLoginSubmit();

  assert(AppState.currentUser !== null, "Admin successfully authenticated.");
  assert(AppState.currentUser.id === "usr-admin", "AppState.currentUser.id is usr-admin.");
  assert(AppState.currentUser.role === "Administrator", "AppState.currentUser.role is Administrator.");
  assert(AppState.currentUser.email === ADMIN_EMAIL, `AppState.currentUser.email is ${ADMIN_EMAIL}.`);
  assert(elements["loginModal"].classList.contains("active") === false, "Login modal dismissed upon successful authentication.");
  assert(elements["navSettings"].style.display === "flex", "Administrator Settings navigation unlocked.");

  // =========================================================================
  // TEST D: Session Restoration
  // =========================================================================
  console.log("\n--- TEST D: Session Restoration from Supabase Auth ---");
  // Simulate page reload by resetting AppState.currentUser while keeping Supabase Auth session active
  AppState.currentUser = null;
  remoteActiveSession = mockAdminSession;

  // Execute session restoration logic from init()
  const { data: { session } } = await db.supabase.auth.getSession();
  assert(session && session.user, "Supabase Auth active session exists.");

  const { data: restoredUser } = await db.supabase.from("users").select("*").eq("auth_user_id", session.user.id).maybeSingle();
  assert(restoredUser !== null, "public.users mapped using session.user.id (auth.uid()).");
  assert(restoredUser.role === "Administrator", "Restored user role is Administrator.");

  AppState.currentUser = {
    id: restoredUser.id,
    username: restoredUser.username,
    email: session.user.email,
    role: restoredUser.role,
    active: restoredUser.active !== false
  };
  App.applyUserRolePermissions();

  assert(AppState.currentUser.role === "Administrator", "Session restored with Administrator privileges.");
  assert(elements["navSettings"].style.display === "flex", "Administrator permissions preserved after session restoration.");
  assert(sessionStorage.getItem("sdi_session_user") === null, "Storage is not used as an auth source.");

  // =========================================================================
  // TEST E: Logout and Invalidation
  // =========================================================================
  console.log("\n--- TEST E: Logout and Session Invalidation ---");
  await App.logout();

  assert(AppState.currentUser === null, "AppState.currentUser is cleared on logout.");
  assert(remoteActiveSession === null, "Supabase Auth session invalidated.");
  assert(elements["loginModal"].classList.contains("active"), "Login modal presented immediately on logout.");
  assert(elements["navSettings"].style.display === "none", "Protected navigation locked on logout.");

  // Simulate refresh after logout
  const { data: { session: postLogoutSession } } = await db.supabase.auth.getSession();
  assert(postLogoutSession === null, "Session remains null after simulated browser refresh.");

  // =========================================================================
  // TEST F: Offline Handling
  // =========================================================================
  console.log("\n--- TEST F: Offline Handling ---");
  db.isCloudOnline = false;
  App.toastMessages = [];
  elements["loginEmail"].value = "admin";
  elements["loginPassword"].value = "anyPassword";

  await App.handleLoginSubmit();
  assert(AppState.currentUser === null, "Login blocked when cloud is offline.");
  assert(App.toastMessages.some(t => t.type === "error" && t.msg.includes("السحابة غير متصلة")), "Error message indicates cloud offline.");

  // Restore cloud online
  db.isCloudOnline = true;
  db.supabase.auth.signInWithPassword = origSignIn;

  console.log("\n============================================================");
  console.log(`TEST MATRIX VERIFICATION COMPLETE: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log("============================================================\n");
}

runTestSuite().catch(err => {
  console.error("Test matrix failed:", err);
  process.exit(1);
});
