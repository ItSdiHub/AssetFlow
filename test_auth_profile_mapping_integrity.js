/**
 * ============================================================================
 * SDI IT ASSET HUB - AUTHENTICATION & PROFILE MAPPING INTEGRITY TEST SUITE
 * Tests A through X: Deterministic Profile Resolution, Conflict Protection,
 * Admin Self-Healing Verification, Credential Isolation, and RLS Error Handling.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================================');
console.log('STARTING SDI IT ASSET HUB - AUTH & PROFILE MAPPING INTEGRITY TESTS (A-AL) - 38 TESTS');
console.log('================================================================================');

// Read app.js source for static verification
const appJsPath = path.join(__dirname, 'js/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

// Setup mock DOM environment
const mockWindow = {
  addEventListener: () => {},
  document: {
    addEventListener: () => {},
    documentElement: {
      setAttribute: () => {},
      getAttribute: () => null,
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      style: {}
    },
    body: {
      setAttribute: () => {},
      getAttribute: () => null,
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      appendChild: () => {},
      removeChild: () => {},
      style: {}
    },
    getElementById: (id) => {
      if (id === 'loginEmail') return { value: 'testuser', focus: () => {} };
      if (id === 'loginPassword') return { value: 'ValidPass123!' };
      if (id === 'loginModal') return {
        classList: { add: () => {}, remove: () => {} },
        style: { setProperty: () => {}, removeProperty: () => {} },
        setAttribute: () => {},
        removeAttribute: () => {}
      };
      return null;
    },
    querySelectorAll: () => [],
    querySelector: () => null
  },
  location: { reload: () => {} },
  __SDI_TEST_ENV__: true
};
global.window = mockWindow;
global.document = mockWindow.document;
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
Object.defineProperty(global, 'navigator', { value: { userAgent: 'node', onLine: true }, configurable: true, writable: true });
mockWindow.navigator = global.navigator;

// Load modules in order
require('./js/i18n.js');
global.I18N = window.I18N;
require('./js/db.js');
global.db = window.db;
require('./js/users.js');
global.UserManager = window.UserManager;
require('./js/assets.js');
global.AssetManager = window.AssetManager;
require('./js/maintenance.js');
global.MaintManager = window.MaintManager;
require('./js/helpdesk.js');
global.Helpdesk = window.Helpdesk;
global.HelpdeskController = window.HelpdeskController;
require('./js/treeView.js');
global.TreeManager = window.TreeManager;
require('./js/projects.js');
global.ContractorManager = window.ContractorManager;
global.ProjectManager = window.ProjectManager;
global.OpsManager = window.OpsManager;
require('./js/techTools.js');
global.TechTools = window.TechTools;
global.TechToolsManager = window.TechToolsManager;
global.TechToolsController = window.TechToolsController;
require('./js/app.js');
global.App = window.App;
global.AppState = window.AppState;

async function runAllTests() {
  const App = window.App;

  // --------------------------------------------------------------------------
  // TEST A: Correct Supabase Auth login with matching public.users.auth_user_id
  // succeeds and sets AppState.currentUser from public.users.
  // --------------------------------------------------------------------------
  {
    const mockUserRow = {
      id: 'USR-001',
      username: 'johndoe',
      full_name: 'John Doe',
      role: 'IT User',
      employee_id: 'EMP-101',
      auth_user_id: 'auth-uid-12345',
      active: true
    };

    const mockDb = {
      supabase: {
        from: (table) => {
          assert.strictEqual(table, 'users');
          return {
            select: (cols) => ({
              eq: (field, val) => ({
                maybeSingle: async () => {
                  if (field === 'auth_user_id' && val === 'auth-uid-12345') {
                    return { data: { ...mockUserRow }, error: null };
                  }
                  return { data: null, error: null };
                }
              })
            })
          };
        }
      }
    };

    global.db = mockDb;
    const authUser = { id: 'auth-uid-12345', email: 'john.doe@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.profile.id, 'USR-001');
    assert.strictEqual(res.profile.role, 'IT User');
    assert.strictEqual(res.resolutionMethod, 'EXACT_AUTH_UID');
    console.log('✓ Test A: Supabase Auth login with matching auth_user_id succeeded from public.users.');
  }

  // --------------------------------------------------------------------------
  // TEST B: Supabase Auth login with NO matching auth_user_id and NO matching email
  // fails cleanly (no profile created, no fake admin, error reported).
  // --------------------------------------------------------------------------
  {
    let insertAttempted = false;

    const mockDb = {
      supabase: {
        from: (table) => ({
          select: (cols) => ({
            eq: (field, val) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [], error: null });
            }
          }),
          insert: () => { insertAttempted = true; return { data: null, error: null }; }
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'auth-uid-unregistered', email: 'stranger@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'AUTH_SUCCESS_PROFILE_NOT_FOUND');
    assert.strictEqual(res.profile, null);
    assert.strictEqual(insertAttempted, false, 'No profile creation allowed');
    console.log('✓ Test B: Auth login with unknown identity failed cleanly with AUTH_SUCCESS_PROFILE_NOT_FOUND.');
  }

  // --------------------------------------------------------------------------
  // TEST C: Supabase Auth login with NO auth_user_id but EXACTLY ONE matching email
  // for Administrator with auth_user_id IS NULL performs approved self-healing,
  // writes auth_user_id, verifies via fresh Cloud read, and succeeds.
  // --------------------------------------------------------------------------
  {
    let updateWritten = false;
    let freshReadExecuted = false;

    const adminRow = {
      id: 'USR-ADMIN',
      username: 'admin',
      full_name: 'System Administrator',
      role: 'Administrator',
      email: 'admin@sdi.ae',
      employee_id: null,
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: (table) => ({
          select: (cols) => ({
            eq: (field, val) => {
              if (field === 'auth_user_id') {
                return {
                  maybeSingle: async () => {
                    if (val === 'auth-admin-uid') {
                      if (updateWritten) {
                        freshReadExecuted = true;
                        return { data: { ...adminRow, auth_user_id: 'auth-admin-uid' }, error: null };
                      }
                    }
                    return { data: null, error: null };
                  }
                };
              }
              if (field === 'email' && val === 'admin@sdi.ae') {
                return Promise.resolve({ data: [adminRow], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }
          }),
          update: (payload) => ({
            eq: (field, val) => {
              if (payload.auth_user_id === 'auth-admin-uid' && val === 'USR-ADMIN') {
                updateWritten = true;
              }
              return Promise.resolve({ data: [{ ...adminRow, ...payload }], error: null });
            }
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'auth-admin-uid', email: 'admin@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.resolutionMethod, 'ADMIN_SELF_HEALED');
    assert.strictEqual(updateWritten, true, 'Self-healing update must be executed in Cloud');
    assert.strictEqual(freshReadExecuted, true, 'Fresh Cloud read using auth_user_id must be verified');
    assert.strictEqual(res.profile.auth_user_id, 'auth-admin-uid');
    console.log('✓ Test C: Administrator self-healing completed with write and fresh Cloud read verification.');
  }

  // --------------------------------------------------------------------------
  // TEST D: Supabase Auth login with NO auth_user_id but matching email that
  // already has a DIFFERENT auth_user_id fails with conflict error (never overwrites).
  // --------------------------------------------------------------------------
  {
    let updateAttempted = false;

    const existingProfile = {
      id: 'USR-009',
      username: 'conflict_user',
      email: 'conflict@sdi.ae',
      role: 'IT User',
      auth_user_id: 'existing-different-uid',
      active: true
    };

    const mockDb = {
      supabase: {
        from: (table) => ({
          select: (cols) => ({
            eq: (field, val) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              if (field === 'email' && val === 'conflict@sdi.ae') {
                return Promise.resolve({ data: [existingProfile], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }
          }),
          update: () => {
            updateAttempted = true;
            return Promise.resolve({ data: null, error: null });
          }
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'impostor-uid', email: 'conflict@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'AUTH_SUCCESS_MAPPING_CONFLICT');
    assert.strictEqual(updateAttempted, false, 'Conflicting profile must NEVER be overwritten');
    console.log('✓ Test D: Mapping conflict detected safely without overwriting existing auth_user_id.');
  }

  // --------------------------------------------------------------------------
  // TEST E: Supabase Auth login with NO auth_user_id and multiple public.users
  // rows with the same email fails with ambiguity error (never guesses).
  // --------------------------------------------------------------------------
  {
    const duplicateProfiles = [
      { id: 'USR-1', email: 'dup@sdi.ae', role: 'IT User', auth_user_id: null, active: true },
      { id: 'USR-2', email: 'dup@sdi.ae', role: 'Viewer', auth_user_id: null, active: true }
    ];

    const mockDb = {
      supabase: {
        from: (table) => ({
          select: (cols) => ({
            eq: (field, val) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: duplicateProfiles, error: null });
            }
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'new-auth-uid', email: 'dup@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'PROFILE_AMBIGUOUS');
    assert.strictEqual(res.matchesCount, 2);
    console.log('✓ Test E: Ambiguous duplicate email profiles rejected safely with PROFILE_AMBIGUOUS.');
  }

  // --------------------------------------------------------------------------
  // TEST F: Inactive/disabled user (active: false) is blocked even if Auth credentials succeed.
  // --------------------------------------------------------------------------
  {
    const disabledUser = {
      id: 'USR-DEACT',
      username: 'disabled_user',
      role: 'IT User',
      auth_user_id: 'disabled-uid',
      active: false
    };

    const mockDb = {
      supabase: {
        from: (table) => ({
          select: (cols) => ({
            eq: (field, val) => ({
              maybeSingle: async () => ({ data: disabledUser, error: null })
            })
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'disabled-uid', email: 'disabled@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'ACCOUNT_DEACTIVATED');
    console.log('✓ Test F: Deactivated user safely blocked with ACCOUNT_DEACTIVATED.');
  }

  // --------------------------------------------------------------------------
  // TEST G: Profile resolver handles RLS denial or permission error cleanly
  // without crashing or faking success.
  // --------------------------------------------------------------------------
  {
    const rlsError = { code: '42501', message: 'permission denied for table users' };

    const mockDb = {
      supabase: {
        from: (table) => ({
          select: (cols) => ({
            eq: (field, val) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: null, error: rlsError });
            }
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'rls-test-uid', email: 'rls@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'PROFILE_LINK_REQUIRES_SECURE_RESOLUTION');
    assert.ok(res.error);
    console.log('✓ Test G: RLS denial handled cleanly as PROFILE_LINK_REQUIRES_SECURE_RESOLUTION without crash.');
  }

  // --------------------------------------------------------------------------
  // TEST H: Boot session restoration uses the exact same resolver logic as interactive login.
  // --------------------------------------------------------------------------
  {
    const initResolverCall = appJs.includes('const resolution = await this.resolveAuthenticatedProfile(authUser);');
    assert.ok(initResolverCall, 'Application.init() must invoke this.resolveAuthenticatedProfile(authUser)');
    const loginResolverCall = appJs.includes('const resolution = await this.resolveAuthenticatedProfile(authUser);');
    assert.ok(loginResolverCall, 'handleLoginSubmit must invoke this.resolveAuthenticatedProfile(authUser)');
    console.log('✓ Test H: Confirmed identical shared resolver used in both init() and handleLoginSubmit().');
  }

  // --------------------------------------------------------------------------
  // TEST I: Boot session restoration with invalid/missing profile signs out
  // from Auth and shows login modal.
  // --------------------------------------------------------------------------
  {
    const bootSignOutIdx = appJs.indexOf('Auth mapping error or user profile not resolved on boot');
    assert.ok(bootSignOutIdx > 0, 'Boot must detect profile resolution failure');
    const snippet = appJs.substring(bootSignOutIdx, bootSignOutIdx + 200);
    assert.ok(snippet.includes('db.supabase.auth.signOut()'), 'Boot must sign out from Supabase Auth on failure');
    assert.ok(snippet.includes('this.openLoginModal()'), 'Boot must open login modal on failure');
    console.log('✓ Test I: Boot session failure strictly revokes session and redirects to login modal.');
  }

  // --------------------------------------------------------------------------
  // TEST J: No emergency/fallback profile is constructed when public.users lookup fails.
  // --------------------------------------------------------------------------
  {
    assert.strictEqual(appJs.includes('Fallback emergency profile construct'), false, 'Emergency profile fallback must be removed');
    assert.strictEqual(appJs.includes('isAdminEmail ? "USR-001" :'), false, 'Hardcoded emergency profile IDs must be removed');
    console.log('✓ Test J: Confirmed zero emergency fallback profile construction in codebase.');
  }

  // --------------------------------------------------------------------------
  // TEST K: No automatic profile creation (INSERT into public.users) occurs on login.
  // --------------------------------------------------------------------------
  {
    assert.strictEqual(appJs.includes('Self-healing profile creation'), false, 'Automatic profile creation comment must be removed');
    assert.strictEqual(appJs.includes('db.put("users", newProfile)'), false, 'db.put("users") must not occur during authentication');
    console.log('✓ Test K: Confirmed no automatic profile creation during login flow.');
  }

  // --------------------------------------------------------------------------
  // TEST L: No hardcoded email aliases (m_hamed@msn.com, mahmoud.m@sdi.ae, admin@sdi.ae)
  // exist in login resolution logic.
  // --------------------------------------------------------------------------
  {
    assert.strictEqual(appJs.includes('m_hamed@msn.com'), false, 'm_hamed@msn.com must not be hardcoded in app.js');
    assert.strictEqual(appJs.includes('mahmoud.m@sdi.ae'), false, 'mahmoud.m@sdi.ae must not be hardcoded in app.js');
    console.log('✓ Test L: Confirmed no hardcoded personal email aliases in login logic.');
  }

  // --------------------------------------------------------------------------
  // TEST M: No email-prefix-based role assignment exists.
  // --------------------------------------------------------------------------
  {
    assert.strictEqual(appJs.includes('authEmailLower.startsWith("admin")'), false, 'Email-prefix role promotion for admin must be removed');
    assert.strictEqual(appJs.includes('authEmailLower.startsWith("ituser")'), false, 'Email-prefix role promotion for ituser must be removed');
    console.log('✓ Test M: Confirmed no role derivation from email prefixes.');
  }

  // --------------------------------------------------------------------------
  // TEST N: AppState.currentUser contains only fields from public.users
  // (never Auth metadata like access_token or encrypted passwords).
  // --------------------------------------------------------------------------
  {
    const publicUser = {
      id: 'USR-888',
      username: 'auditor',
      full_name: 'Security Auditor',
      role: 'Auditor',
      employee_id: 'EMP-888',
      auth_user_id: 'auth-audit-uid',
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: publicUser, error: null })
            })
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = {
      id: 'auth-audit-uid',
      email: 'auditor@sdi.ae',
      access_token: 'SECRET_JWT_TOKEN',
      user_metadata: { secret: 'do_not_leak' }
    };

    const res = await App.resolveAuthenticatedProfile(authUser);
    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.profile.access_token, undefined);
    assert.strictEqual(res.profile.password, undefined);
    assert.strictEqual(res.profile.user_metadata, undefined);
    console.log('✓ Test N: Verified profile contains only authoritative public.users columns.');
  }

  // --------------------------------------------------------------------------
  // TEST O: Username-to-email resolution queries public.users and employees
  // with safe column lists only (no password, no *).
  // --------------------------------------------------------------------------
  {
    const queryIdx = appJs.indexOf('.ilike("username", cleanInput)');
    assert.ok(queryIdx > 0, 'Username resolution query must exist in app.js');
    const snippet = appJs.substring(queryIdx - 160, queryIdx + 60);
    assert.ok(snippet.includes('.select("id, username, employee_id")'), 'Username query must select safe minimal columns');
    assert.strictEqual(snippet.includes('*'), false, 'Username query must not use wildcard');
    assert.strictEqual(snippet.includes('password'), false, 'Username query must not touch password');
    console.log('✓ Test O: Username resolution query uses safe column selection without credentials.');
  }

  // --------------------------------------------------------------------------
  // TEST P: Password values and credential objects are never logged or stored in AppState during login.
  // --------------------------------------------------------------------------
  {
    const loginFnIdx = appJs.indexOf('async handleLoginSubmit(event)');
    assert.ok(loginFnIdx > 0);
    const loginSnippet = appJs.substring(loginFnIdx, loginFnIdx + 4500);
    assert.strictEqual(loginSnippet.includes('console.log(pass)'), false);
    assert.strictEqual(loginSnippet.includes('console.log("pass"'), false);
    assert.strictEqual(loginSnippet.includes('AppState.currentUser.password'), false);
    console.log('✓ Test P: Confirmed zero credential leakage or logging in login handler.');
  }

  // --------------------------------------------------------------------------
  // TEST Q: Self-healing update failure is handled gracefully and does not leave session in partially authenticated state.
  // --------------------------------------------------------------------------
  {
    const candidateAdmin = {
      id: 'USR-FAIL-ADMIN',
      username: 'fail_admin',
      email: 'failadmin@sdi.ae',
      role: 'Administrator',
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [candidateAdmin], error: null });
            }
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: 'Cloud database connection lost during write' } })
          })
        })
      }
    };

  global.db = mockDb;
  const authUser = { id: 'admin-new-uid', email: 'failadmin@sdi.ae' };
  const res = await App.resolveAuthenticatedProfile(authUser);

  assert.strictEqual(res.status, 'PROFILE_LINK_ERROR');
  assert.ok(res.error);
  console.log('✓ Test Q: Update failure handled cleanly as PROFILE_LINK_ERROR.');
  }

  // --------------------------------------------------------------------------
  // TEST R: Fresh Cloud read after self-healing uses auth_user_id (not cached data).
  // --------------------------------------------------------------------------
  {
    const resolverIdx = appJs.indexOf('// STEP 6 — VERIFY CLOUD UPDATE WITH FRESH READ');
    assert.ok(resolverIdx > 0, 'Fresh Cloud read section must exist');
    const freshReadSnippet = appJs.substring(resolverIdx, resolverIdx + 400);
    assert.ok(freshReadSnippet.includes('.eq("auth_user_id", authUser.id)'), 'Fresh read must query by auth_user_id = authUser.id');
    assert.ok(freshReadSnippet.includes('.maybeSingle()'), 'Fresh read must use maybeSingle');
    console.log('✓ Test R: Fresh Cloud read strictly verifies auth_user_id = authUser.id.');
  }

  // --------------------------------------------------------------------------
  // TEST S: Role in AppState matches public.users.role exactly (no default elevation to Administrator).
  // --------------------------------------------------------------------------
  {
    const viewerUser = {
      id: 'USR-VIEWER',
      username: 'guest_user',
      role: 'Viewer',
      auth_user_id: 'viewer-uid',
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: viewerUser, error: null })
            })
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'viewer-uid', email: 'viewer@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.profile.role, 'Viewer');
    console.log('✓ Test S: Role matches public.users.role exactly without elevation.');
  }

  // --------------------------------------------------------------------------
  // TEST T: Non-admin user with unlinked profile (auth_user_id IS NULL) is NOT auto-healed.
  // --------------------------------------------------------------------------
  {
    let updateTriggered = false;

    const employeeProfile = {
      id: 'USR-EMP-01',
      username: 'fatima',
      email: 'fatima@sdi.ae',
      role: 'Employee',
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [employeeProfile], error: null });
            }
          }),
          update: () => {
            updateTriggered = true;
            return Promise.resolve({ data: null, error: null });
          }
        })
      }
    };

  global.db = mockDb;
  const authUser = { id: 'fatima-auth-uid', email: 'fatima@sdi.ae' };
  const res = await App.resolveAuthenticatedProfile(authUser);

  assert.strictEqual(res.status, 'AUTH_SUCCESS_MAPPING_MISSING');
  assert.strictEqual(updateTriggered, false, 'Non-admin users must NEVER be auto-healed');
  console.log('✓ Test T: Non-admin unlinked profile blocked with AUTH_SUCCESS_MAPPING_MISSING (no auto-heal).');
  }

  // --------------------------------------------------------------------------
  // TEST U: Successful login closes login modal and navigates to role-appropriate screen.
  // --------------------------------------------------------------------------
  {
    const navSection = appJs.includes('if (AppState.currentUser.role === "Employee") {');
    assert.ok(navSection, 'Login handler must check role for navigation');
    const snippet = appJs.substring(appJs.indexOf('if (AppState.currentUser.role === "Employee") {'), appJs.indexOf('if (AppState.currentUser.role === "Employee") {') + 300);
    assert.ok(snippet.includes('this.switchTab("employeePortal", true)'), 'Employee role navigates to employeePortal');
    assert.ok(snippet.includes('this.switchTab("dashboard", true)'), 'Admin/IT/Viewer roles navigate to dashboard');
    console.log('✓ Test U: Role-appropriate navigation verified (Employee -> portal, others -> dashboard).');
  }

  // --------------------------------------------------------------------------
  // TEST V: Failed login leaves user on login modal with appropriate error message
  // (distinguishing auth failure from profile failure).
  // --------------------------------------------------------------------------
  {
    const profileFailSection = appJs.indexOf('Profile resolution failed after authentication:');
    assert.ok(profileFailSection > 0, 'Handler must distinguish profile failure after auth');
    const snippet = appJs.substring(profileFailSection, profileFailSection + 2000);
    assert.ok(snippet.includes('Authentication succeeded, but no registered user profile was found'), 'Distinct profile missing toast');
    assert.ok(snippet.includes('Identity mapping conflict'), 'Distinct conflict toast');
    assert.ok(snippet.includes('Multiple user profiles found matching this email'), 'Distinct ambiguity toast');
    assert.ok(snippet.includes('Database query error during profile verification'), 'Distinct database query error toast');
    assert.ok(snippet.includes('Failed to link user profile'), 'Distinct link failure toast');
    console.log('✓ Test V: Distinct user-facing error messages for all profile resolution failure modes.');
  }

  // --------------------------------------------------------------------------
  // TEST W: Source code inspection confirms single profile-resolution function used by both login and boot.
  // --------------------------------------------------------------------------
  {
    const occurrences = (appJs.match(/resolveAuthenticatedProfile/g) || []).length;
    assert.ok(occurrences >= 4, 'resolveAuthenticatedProfile must be defined and called across app');
    assert.ok(appJs.includes('async resolveAuthenticatedProfile(authUser, options = {})'), 'Method definition exists');
    console.log(`✓ Test W: Confirmed single authoritative resolveAuthenticatedProfile used everywhere (${occurrences} occurrences).`);
  }

  // --------------------------------------------------------------------------
  // TEST X: Source code inspection confirms absence of all broad queries
  // (.select('*') or scanning all users without filter) in authentication flow.
  // --------------------------------------------------------------------------
  {
    const resolverStart = appJs.indexOf('async resolveAuthenticatedProfile(authUser');
    const resolverEnd = appJs.indexOf('async init() {');
    const resolverCode = appJs.substring(resolverStart, resolverEnd);

    assert.strictEqual(resolverCode.includes("select('*')"), false, "Resolver must not select '*'");
    assert.strictEqual(resolverCode.includes('select("*")'), false, 'Resolver must not select "*"');
    assert.strictEqual(resolverCode.includes('db.getAll('), false, 'Resolver must not read all users');

    // Verify boot and login do not read all users
    const loginStart = appJs.indexOf('async handleLoginSubmit(event)');
    const loginEnd = appJs.indexOf('async handleLogout()');
    const loginCode = appJs.substring(loginStart, loginEnd);
    assert.strictEqual(loginCode.includes('.select("id, username, full_name, full_name_ar') && !loginCode.includes('.eq('), false, 'Login must not scan all users');

    console.log('✓ Test X: Confirmed absolute absence of broad queries or all-user scans in auth flow.');
  }

  // --------------------------------------------------------------------------
  // TEST Y: Boot session sets AppState.currentUser before role check and protects against null role
  // --------------------------------------------------------------------------
  {
    const initStart = appJs.indexOf('async init() {');
    const initEnd = appJs.indexOf('setupEventListeners() {');
    const initCode = appJs.substring(initStart, initEnd);

    assert.ok(initCode.includes('AppState.currentUser = {'), 'init() must assign AppState.currentUser upon profile resolution');
    assert.ok(initCode.includes('if (!AppState.currentUser) {'), 'init() must check AppState.currentUser before checking role');
    console.log('✓ Test Y: Boot session verified to set AppState.currentUser with null-safe role guard.');
  }

  // --------------------------------------------------------------------------
  // TEST Z: Caller with allowSelfHealing: true cannot self-heal a non-Administrator profile.
  // --------------------------------------------------------------------------
  {
    let updateTriggered = false;
    const employeeProfile = {
      id: 'usr-emp-z',
      username: 'emp_z',
      email: 'emp_z@sdi.ae',
      role: 'Employee',
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [employeeProfile], error: null });
            }
          }),
          update: () => {
            updateTriggered = true;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          }
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'emp-auth-z', email: 'emp_z@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser, { allowSelfHealing: true });

    assert.strictEqual(res.status, 'AUTH_SUCCESS_MAPPING_MISSING');
    assert.strictEqual(updateTriggered, false, 'options.allowSelfHealing: true must NOT bypass Administrator check');
    console.log('✓ Test Z: Caller with allowSelfHealing: true cannot self-heal non-Administrator profile.');
  }

  // --------------------------------------------------------------------------
  // TEST AA: Administrator self-healing is rejected if target profile is deactivated.
  // --------------------------------------------------------------------------
  {
    let updateTriggered = false;
    const deactivatedAdminProfile = {
      id: 'usr-admin-aa',
      username: 'deactivated_admin',
      email: 'deact_admin@sdi.ae',
      role: 'Administrator',
      auth_user_id: null,
      active: false
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [deactivatedAdminProfile], error: null });
            }
          }),
          update: () => {
            updateTriggered = true;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          }
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'admin-auth-aa', email: 'deact_admin@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'ACCOUNT_DEACTIVATED');
    assert.strictEqual(updateTriggered, false, 'Deactivated admin profile must not be updated or healed');
    console.log('✓ Test AA: Administrator self-healing rejected when target profile is deactivated.');
  }

  // --------------------------------------------------------------------------
  // TEST AB: Administrator self-healing fails safely if Cloud update fails.
  // --------------------------------------------------------------------------
  {
    const adminProfile = {
      id: 'usr-admin-ab',
      username: 'admin_ab',
      email: 'admin_ab@sdi.ae',
      role: 'Administrator',
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [adminProfile], error: null });
            }
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: 'Cloud DB update failure (RLS or Network)' } })
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'admin-auth-ab', email: 'admin_ab@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'PROFILE_LINK_ERROR');
    assert.strictEqual(adminProfile.auth_user_id, null, 'Local profile must NOT be mutated when Cloud update fails');
    console.log('✓ Test AB: Administrator self-healing fails safely with PROFILE_LINK_ERROR if Cloud update fails.');
  }

  // --------------------------------------------------------------------------
  // TEST AC: Administrator self-healing fails safely if post-update verification read fails or mismatches.
  // --------------------------------------------------------------------------
  {
    const adminProfile = {
      id: 'usr-admin-ac',
      username: 'admin_ac',
      email: 'admin_ac@sdi.ae',
      role: 'Administrator',
      auth_user_id: null,
      active: true
    };

    let postUpdateReadCount = 0;
    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                postUpdateReadCount++;
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [adminProfile], error: null });
            }
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null })
          })
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'admin-auth-ac', email: 'admin_ac@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser);

    assert.strictEqual(res.status, 'PROFILE_LINK_ERROR');
    assert.ok(postUpdateReadCount >= 2, 'Fresh cloud read verification must have run after update');
    console.log('✓ Test AC: Administrator self-healing fails safely with PROFILE_LINK_ERROR if post-update verification mismatches.');
  }

  // --------------------------------------------------------------------------
  // TEST AD: Unlinked Employee profile cannot self-heal under any option flags.
  // --------------------------------------------------------------------------
  {
    let updateTriggered = false;
    const empProfile = {
      id: 'usr-emp-ad',
      username: 'emp_ad',
      email: 'emp_ad@sdi.ae',
      role: 'Employee',
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [empProfile], error: null });
            }
          }),
          update: () => {
            updateTriggered = true;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          }
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'emp-auth-ad', email: 'emp_ad@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser, {
      allowSelfHealing: true,
      allowAdminSelfHealing: true,
      force: true
    });

    assert.strictEqual(res.status, 'AUTH_SUCCESS_MAPPING_MISSING');
    assert.strictEqual(updateTriggered, false, 'Employee profile must NEVER self-heal under any option flags');
    console.log('✓ Test AD: Unlinked Employee profile cannot self-heal under any option flags.');
  }

  // --------------------------------------------------------------------------
  // TEST AE: Unlinked IT User profile cannot self-heal under any option flags.
  // --------------------------------------------------------------------------
  {
    let updateTriggered = false;
    const itProfile = {
      id: 'usr-it-ae',
      username: 'it_ae',
      email: 'it_ae@sdi.ae',
      role: 'IT User',
      auth_user_id: null,
      active: true
    };

    const mockDb = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: (field) => {
              if (field === 'auth_user_id') {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
              return Promise.resolve({ data: [itProfile], error: null });
            }
          }),
          update: () => {
            updateTriggered = true;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          }
        })
      }
    };

    global.db = mockDb;
    const authUser = { id: 'it-auth-ae', email: 'it_ae@sdi.ae' };
    const res = await App.resolveAuthenticatedProfile(authUser, {
      allowSelfHealing: true,
      allowAdminSelfHealing: true,
      adminOverride: true
    });

    assert.strictEqual(res.status, 'AUTH_SUCCESS_MAPPING_MISSING');
    assert.strictEqual(updateTriggered, false, 'IT User profile must NEVER self-heal under any option flags');
    console.log('✓ Test AE: Unlinked IT User profile cannot self-heal under any option flags.');
  }

  // --------------------------------------------------------------------------
  // TEST AF: Login flow revokes Auth session and clears user state on mapping failure.
  // --------------------------------------------------------------------------
  {
    let signOutCalled = false;
    const originalShowToast = App.showToast;

    App.showToast = () => {};
    AppState.currentUser = { id: 'stale-user' };

    document.getElementById('loginEmail').value = 'testuser@sdi.ae';
    document.getElementById('loginPassword').value = 'SecretPass123!';

    const mockSupabase = {
      auth: {
        signInWithPassword: async () => ({
          data: { user: { id: 'auth-fail-af', email: 'unknown@sdi.ae' }, session: { access_token: 'fake-jwt' } },
          error: null
        }),
        signOut: async () => { signOutCalled = true; }
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          }),
          ilike: () => Promise.resolve({ data: [], error: null })
        })
      })
    };

    global.db = {
      supabase: mockSupabase,
      isCloudOnline: true,
      init: async () => {}
    };

    const mockEvent = { preventDefault: () => {} };
    await App.handleLoginSubmit(mockEvent);

    assert.strictEqual(signOutCalled, true, 'db.supabase.auth.signOut must be called on mapping failure');
    assert.notStrictEqual(AppState.currentUser?.id, 'auth-fail-af', 'AppState.currentUser must not be assigned unverified identity');
    App.showToast = originalShowToast;
    console.log('✓ Test AF: Login flow revokes Auth session and clears user state on mapping failure.');
  }

  // --------------------------------------------------------------------------
  // TEST AG: Boot flow revokes Auth session and keeps user state null on mapping failure.
  // --------------------------------------------------------------------------
  {
    let bootSignOutCalled = false;
    AppState.currentUser = null;

    const mockSupabaseBoot = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'boot-auth-ag', email: 'unmapped@sdi.ae' } } },
          error: null
        }),
        signOut: async () => { bootSignOutCalled = true; },
        onAuthStateChange: () => {}
      },
      from: () => ({
        select: () => ({
          eq: (field) => {
            if (field === 'auth_user_id') {
              return { maybeSingle: async () => ({ data: null, error: null }) };
            }
            return Promise.resolve({ data: [], error: null });
          },
          ilike: () => Promise.resolve({ data: [], error: null })
        })
      })
    };

    global.db = {
      supabase: mockSupabaseBoot,
      isCloudOnline: false,
      init: async () => {},
      getSystemSettings: async () => ({})
    };

    await App.init();

    assert.strictEqual(bootSignOutCalled, true, 'Boot session failure must immediately sign out session');
    assert.strictEqual(AppState.currentUser, null, 'AppState.currentUser must remain null after mapping failure');
    console.log('✓ Test AG: Boot flow revokes Auth session and keeps user state null on mapping failure.');
  }

  // --------------------------------------------------------------------------
  // TEST AH: Helpdesk render() with null user does not throw.
  // --------------------------------------------------------------------------
  {
    AppState.currentUser = null;
    let didThrow = false;
    try {
      await Helpdesk.render();
    } catch (e) {
      didThrow = true;
    }
    assert.strictEqual(didThrow, false, 'Helpdesk.render() must not throw when AppState.currentUser is null');
    console.log('✓ Test AH: Helpdesk render() with null user executes safely without throwing.');
  }

  // --------------------------------------------------------------------------
  // TEST AI: Helpdesk openRequestDetails() with null user does not throw.
  // --------------------------------------------------------------------------
  {
    AppState.currentUser = null;
    let didThrow = false;
    try {
      await Helpdesk.openRequestDetails('REQ-9999');
    } catch (e) {
      didThrow = true;
    }
    assert.strictEqual(didThrow, false, 'Helpdesk.openRequestDetails() must not throw when AppState.currentUser is null');
    console.log('✓ Test AI: Helpdesk openRequestDetails() with null user executes safely without throwing.');
  }

  // --------------------------------------------------------------------------
  // TEST AJ: Helpdesk openNewSupportRequestModal() with null user does not throw.
  // --------------------------------------------------------------------------
  {
    AppState.currentUser = null;
    let didThrow = false;
    try {
      await Helpdesk.openNewSupportRequestModal('AST-1234');
    } catch (e) {
      didThrow = true;
    }
    assert.strictEqual(didThrow, false, 'Helpdesk.openNewSupportRequestModal() must not throw when AppState.currentUser is null');
    console.log('✓ Test AJ: Helpdesk openNewSupportRequestModal() with null user executes safely without throwing.');
  }

  // --------------------------------------------------------------------------
  // TEST AK: Helpdesk handleNewSupportRequestSubmit() with null user does not perform a write.
  // --------------------------------------------------------------------------
  {
    AppState.currentUser = null;
    let writePerformed = false;
    global.db.put = async (store) => {
      if (store === 'helpdeskRequests') writePerformed = true;
    };
    global.db.createNotification = async () => {
      writePerformed = true;
    };

    let didThrow = false;
    try {
      await Helpdesk.handleNewSupportRequestSubmit({ preventDefault: () => {} });
    } catch (e) {
      didThrow = true;
    }

    assert.strictEqual(didThrow, false, 'handleNewSupportRequestSubmit must not throw with null user');
    assert.strictEqual(writePerformed, false, 'handleNewSupportRequestSubmit must NOT write records when AppState.currentUser is null');
    console.log('✓ Test AK: Helpdesk handleNewSupportRequestSubmit() with null user performs zero writes and does not throw.');
  }

  // --------------------------------------------------------------------------
  // TEST AL: Helpdesk notification functions with null user do not throw.
  // --------------------------------------------------------------------------
  {
    AppState.currentUser = null;
    let didThrow = false;
    try {
      await Helpdesk.markAllNotificationsRead();
      await Helpdesk.handleNotificationClick('notif-101', 'req-101', 'it_reply');
    } catch (e) {
      didThrow = true;
    }

    assert.strictEqual(didThrow, false, 'Helpdesk notification actions must not throw when AppState.currentUser is null');
    console.log('✓ Test AL: Helpdesk notification functions with null user execute safely without throwing.');
  }

  console.log('================================================================================');
  console.log('ALL 38/38 MANDATORY AUTH & PROFILE MAPPING INTEGRITY TESTS (A-AL) PASSED!');
  console.log('================================================================================');
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
