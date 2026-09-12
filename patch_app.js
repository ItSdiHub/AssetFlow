const fs = require('fs');

let content = fs.readFileSync('js/app.js', 'utf8');

// Patch 1: Replace init() verification block
const initBlockRegex = /\/\/ 6\. Verify User Session[\s\S]*?\/\/ Apply permissions derived from authoritative database state/m;
const newInitBlock = `// 6. Verify User Session & Authoritative Role from Cloud Database (Single Source of Truth)
    AppState.currentUser = null;
    if (db.supabase) {
      try {
        const { data: { session }, error: sessionError } = await db.supabase.auth.getSession();
        if (session && session.user) {
          const authUser = session.user;
          const { data: cloudUser, error: queryError } = await db.supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .maybeSingle();

          if (!queryError && cloudUser) {
            if (cloudUser.active === false) {
              console.warn("User account is deactivated in cloud database.");
              await db.supabase.auth.signOut();
            } else {
              // Role and access are strictly DERIVED from Cloud Database mapping
              AppState.currentUser = {
                id: cloudUser.id,
                username: cloudUser.username,
                email: authUser.email || (cloudUser.username + "@sdi.ae"),
                fullName: cloudUser.full_name || cloudUser.fullName || cloudUser.username,
                fullNameAr: cloudUser.full_name_ar || cloudUser.fullNameAr || cloudUser.full_name,
                fullNameEn: cloudUser.full_name_en || cloudUser.fullNameEn || cloudUser.username,
                role: cloudUser.role || "Viewer",
                employeeId: cloudUser.employee_id || cloudUser.employeeId || null,
                active: cloudUser.active !== false
              };
            }
          } else {
             // Authenticated but no public.users mapping
             await db.supabase.auth.signOut();
          }
        }
      } catch (authErr) {
        console.warn("Cloud authorization verification error:", authErr);
      }
    }

    // Set up auth state change listener
    if (db.supabase && !window.__SDI_AUTH_LISTENER_BOUND__) {
      window.__SDI_AUTH_LISTENER_BOUND__ = true;
      db.supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
           AppState.currentUser = null;
           this.applyUserRolePermissions();
           if (!document.getElementById("loginModal") || document.getElementById("loginModal").style.display !== "block") {
              this.openLoginModal();
           }
        }
      });
    }

    // Remove legacy local storage usage
    localStorage.removeItem("sdi_user");
    sessionStorage.removeItem("sdi_user");

    // Apply permissions derived from authoritative database state`;

content = content.replace(initBlockRegex, newInitBlock);

// Patch 2: Replace handleLoginSubmit
const loginBlockRegex = /async handleLoginSubmit\(event\) {[\s\S]*?this\.closeModal\("loginModal"\);/m;
const newLoginBlock = `async handleLoginSubmit(event) {
    event.preventDefault();
    const loginInput = (document.getElementById("loginEmail")?.value || "").trim();
    const pass = document.getElementById("loginPassword")?.value || "";
    const lang = AppState.lang;

    if (!loginInput || !pass) {
      this.showToast(lang === "ar" ? "يرجى إدخال البريد الإلكتروني وكلمة المرور" : "Please enter email and password", "error");
      return;
    }

    let authenticatedUser = null;

    // 1. Authenticate against Cloud Database via REAL Supabase Auth
    if (db.supabase && db.isCloudOnline) {
      try {
        const { data: authData, error: authError } = await db.supabase.auth.signInWithPassword({
          email: loginInput,
          password: pass
        });

        if (authError) {
          this.showToast(lang === "ar" ? "كلمة المرور غير صحيحة أو الحساب غير موجود" : "Invalid email or password", "error");
          return;
        }

        if (authData && authData.session && authData.user) {
          const authUser = authData.user;
          const { data: cloudUser, error: queryError } = await db.supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .maybeSingle();

          if (queryError || !cloudUser) {
             await db.supabase.auth.signOut();
             this.showToast(lang === "ar" ? "لا يوجد حساب متطابق في النظام" : "No matching account found in system", "error");
             return;
          }

          if (cloudUser.active === false) {
             await db.supabase.auth.signOut();
             this.showToast(lang === "ar" ? "الحساب معطل. يرجى مراجعة إدارة النظام." : "Account is disabled. Please contact the administrator.", "error");
             return;
          }

          authenticatedUser = {
            id: cloudUser.id,
            username: cloudUser.username,
            email: authUser.email || (cloudUser.username + "@sdi.ae"),
            fullName: cloudUser.full_name || cloudUser.fullName || cloudUser.username,
            fullNameAr: cloudUser.full_name_ar || cloudUser.fullNameAr || cloudUser.full_name,
            fullNameEn: cloudUser.full_name_en || cloudUser.fullNameEn || cloudUser.username,
            role: cloudUser.role || "Viewer",
            employeeId: cloudUser.employee_id || cloudUser.employeeId || null,
            active: cloudUser.active !== false
          };
        }
      } catch (err) {
        console.warn("Cloud auth error:", err);
        this.showToast("Cloud authentication failed.", "error");
        return;
      }
    } else {
        // Offline / No Supabase
        this.showToast(lang === "ar" ? "لا يمكن تسجيل الدخول عندما تكون السحابة غير متصلة" : "Cannot login while cloud is offline", "error");
        return;
    }

    if (!authenticatedUser) {
      this.showToast(lang === "ar" ? "فشل تسجيل الدخول" : "Login failed", "error");
      return;
    }

    // Set session state exclusively from REAL Supabase Auth
    AppState.currentUser = authenticatedUser;
    
    // NO LOCAL STORAGE SAVING
    localStorage.removeItem("sdi_user");
    sessionStorage.removeItem("sdi_user");

    this.applyUserRolePermissions();
    this.closeModal("loginModal");`;

content = content.replace(loginBlockRegex, newLoginBlock);

// Patch 3: Replace logout
const logoutRegex = /async logout\(\) {[\s\S]*?this\.showToast[^\n]*\n  }/m;
const newLogoutBlock = `async logout() {
    AppState.currentUser = null;
    localStorage.removeItem("sdi_user");
    sessionStorage.removeItem("sdi_user");
    
    if (db.supabase) {
      await db.supabase.auth.signOut();
    }
    
    this.navHistory = [];
    this.hasUnsavedChanges = false;
    this.closeModal("userProfileModal");
    this.closeModal("changePasswordModal");
    this.closeModal("notificationsModal");
    this.applyUserRolePermissions();
    this.openLoginModal();
    this.showToast(AppState.lang === "ar" ? "تم تسجيل الخروج بنجاح" : "Logged out successfully", "info");
  }`;

content = content.replace(logoutRegex, newLogoutBlock);

fs.writeFileSync('js/app.js', content, 'utf8');
console.log("Patched js/app.js successfully!");
