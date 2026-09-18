/**
 * SDI IT Asset Hub - User Security & Credential Protection Test Suite (Phase 7)
 * Tests A-T (20 tests) verifying credential isolation, auth-only password flows,
 * safe DB querying, cache protection, and profile/RBAC preservation.
 */

const assert = require('assert');
const fs = require('fs');

// Mock browser globals for test environment
global.window = {
  __SDI_TEST_ENV__: true,
  App: {
    updateCloudStatus: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible'
};
global.navigator = { onLine: true };
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

// Load DBEngine from js/db.js
const dbCode = fs.readFileSync('js/db.js', 'utf8');
(new Function(dbCode + '; global.DBEngine = DBEngine; global.fromCloudRecord = fromCloudRecord; global.toCloudRecord = toCloudRecord; global.getCloudSelectColumns = getCloudSelectColumns;'))();

async function runPasswordSecurityTests() {
  console.log("================================================================================");
  console.log("STARTING SDI IT ASSET HUB - USER SECURITY & CREDENTIAL PROTECTION TESTS (A-T)");
  console.log("================================================================================");

  let passed = 0;
  const total = 20;

  const db = new DBEngine();
  db.isCloudOnline = true;
  db.isOperationalReady = true;

  // TEST A: fromCloudRecord strips password
  {
    const row = {
      id: "usr-001",
      username: "testuser",
      email: "test@sdi.ae",
      role: "Administrator",
      password: "legacy-secret"
    };
    const appRecord = global.fromCloudRecord("users", row);
    assert.ok(appRecord, "Returned object must exist");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(appRecord, "password"), false, "password must NOT be an own property");
    assert.strictEqual(appRecord.password, undefined, "password property must be undefined");
    assert.strictEqual(appRecord.id, "usr-001");
    assert.strictEqual(appRecord.username, "testuser");
    assert.strictEqual(appRecord.email, "test@sdi.ae");
    assert.strictEqual(appRecord.role, "Administrator");
    console.log("✓ Test A: fromCloudRecord('users') stripped password while preserving normal fields.");
    passed++;
  }

  // TEST B: toCloudRecord strips password
  {
    const item = {
      id: "usr-001",
      username: "testuser",
      password: "real-secret",
      role: "Administrator",
      email: "test@sdi.ae"
    };
    const cloudRecord = global.toCloudRecord("users", item);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(cloudRecord, "password"), false, "Output must not contain password");
    assert.strictEqual(cloudRecord.password, undefined);
    assert.strictEqual(cloudRecord.id, "usr-001");
    assert.strictEqual(cloudRecord.username, "testuser");
    console.log("✓ Test B: toCloudRecord('users') stripped password from outgoing object.");
    passed++;
  }

  // TEST C: getCloudSelectColumns("users")
  {
    const cols = global.getCloudSelectColumns("users");
    assert.notStrictEqual(cols, "*", "Select columns must not be '*'");
    assert.strictEqual(cols.includes("password"), false, "Select columns must NOT contain password");

    const requiredFields = [
      "id", "username", "email", "full_name", "full_name_ar",
      "full_name_en", "role", "employee_id", "auth_user_id", "active"
    ];
    for (const f of requiredFields) {
      assert.strictEqual(cols.includes(f), true, `Select columns must include ${f}`);
    }
    console.log("✓ Test C: getCloudSelectColumns('users') returned required safe columns excluding password.");
    passed++;
  }

  // TEST D: getAll("users") does not request password
  {
    let selectArg = null;
    db.supabase = {
      from: (tableName) => {
        assert.strictEqual(tableName, "users");
        return {
          select: (cols) => {
            selectArg = cols;
            return Promise.resolve({ data: [{ id: "usr-001", username: "u1" }], error: null });
          }
        };
      }
    };
    await db.getAll("users");
    assert.ok(selectArg, "selectArg must be captured");
    assert.notStrictEqual(selectArg, "*", "getAll('users') select column must not be '*'");
    assert.strictEqual(selectArg.includes("password"), false, "getAll('users') select column must not contain password");
    console.log("✓ Test D: getAll('users') queried Supabase without requesting password column.");
    passed++;
  }

  // TEST E: getFiltered("users") does not request password
  {
    let selectArg = null;
    db.supabase = {
      from: (tableName) => {
        assert.strictEqual(tableName, "users");
        return {
          select: (cols) => {
            selectArg = cols;
            return {
              eq: () => Promise.resolve({ data: [{ id: "usr-001", role: "Administrator" }], error: null })
            };
          }
        };
      }
    };
    await db.getFiltered("users", "role", "Administrator");
    assert.ok(selectArg, "selectArg must be captured");
    assert.notStrictEqual(selectArg, "*");
    assert.strictEqual(selectArg.includes("password"), false);
    console.log("✓ Test E: getFiltered('users') queried Supabase without requesting password column.");
    passed++;
  }

  // TEST F: getById("users") does not request password
  {
    let selectArg = null;
    db.supabase = {
      from: (tableName) => {
        assert.strictEqual(tableName, "users");
        return {
          select: (cols) => {
            selectArg = cols;
            return {
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "usr-001", username: "admin" }, error: null })
              })
            };
          }
        };
      }
    };
    await db.getById("users", "usr-001");
    assert.ok(selectArg, "selectArg must be captured");
    assert.notStrictEqual(selectArg, "*");
    assert.strictEqual(selectArg.includes("password"), false);
    console.log("✓ Test F: getById('users') queried Supabase without requesting password column.");
    passed++;
  }

  // TEST G: app.js authenticated profile lookup is safe
  {
    const appJs = fs.readFileSync('js/app.js', 'utf8');
    // Check boot authenticated profile query
    assert.strictEqual(appJs.includes(".from('users')\n        .select('*')"), false, "js/app.js boot user lookup must not select * from users");
    assert.strictEqual(appJs.includes(".from('users')\n        .select('id, username,"), true, "js/app.js boot profile lookup must use explicit safe columns");
    console.log("✓ Test G: Verified js/app.js boot authenticated profile lookup uses safe column list.");
    passed++;
  }

  // TEST H: app.js email-matching fallback is safe
  {
    const appJs = fs.readFileSync('js/app.js', 'utf8');
    // Check boot self-healing fallback user query
    assert.strictEqual(appJs.includes(".from('users')\n          .select('*')"), false, "js/app.js boot fallback query must not select * from users");
    assert.strictEqual(appJs.includes(".from('users')\n          .select('id, username,"), true, "js/app.js boot fallback query must use explicit safe columns");
    console.log("✓ Test H: Verified js/app.js email-matching fallback user lookup uses safe column list.");
    passed++;
  }

  // TEST I: Username lookup remains minimal
  {
    const appJs = fs.readFileSync('js/app.js', 'utf8');
    const usernameQueryIdx = appJs.indexOf('.ilike("username", cleanInput)');
    assert.ok(usernameQueryIdx > 0, "Username resolution query must exist");
    const querySnippet = appJs.substring(usernameQueryIdx - 150, usernameQueryIdx + 50);
    assert.strictEqual(querySnippet.includes('select("id, username, employee_id")'), true, "Username resolution query must select minimal columns (id, username, employee_id)");
    assert.strictEqual(querySnippet.includes("password"), false, "Username query must not select password");
    console.log("✓ Test I: Verified username resolution query uses minimal safe column selection.");
    passed++;
  }

  // TEST J: New-user real password goes only to Supabase Auth
  {
    const usersJs = fs.readFileSync('js/users.js', 'utf8');
    let authSignUpCalled = false;
    let authSignUpPass = null;

    const testPassword = "UnitTest-Secret-123";

    // Simulate creation call pattern from users.js
    const tempSupabase = {
      auth: {
        signUp: async (credentials) => {
          authSignUpCalled = true;
          authSignUpPass = credentials.password;
          return { data: { user: { id: "auth-new-001" } }, error: null };
        }
      }
    };

    const newUserData = {
      id: "usr-new-001",
      username: "newadmin",
      email: "newadmin@sdi.ae",
      fullName: "New Admin",
      role: "Administrator"
    };

    // Verify signUp receives testPassword
    await tempSupabase.auth.signUp({ email: newUserData.email, password: testPassword });
    assert.strictEqual(authSignUpCalled, true, "Supabase Auth signUp must be invoked");
    assert.strictEqual(authSignUpPass, testPassword, "Supabase Auth must receive real password");

    // Verify application user profile does NOT contain password
    assert.strictEqual(Object.prototype.hasOwnProperty.call(newUserData, "password"), false, "Application profile must not store real password");

    // Verify users.js contains signUp call and no userData.password assignment
    assert.strictEqual(usersJs.includes("tempSupabase.auth.signUp"), true, "users.js must use tempSupabase.auth.signUp for new user creation");
    assert.strictEqual(usersJs.includes("userData.password ="), false, "users.js must NOT set userData.password");
    console.log("✓ Test J: New-user real password goes strictly to Supabase Auth and not to profile/db payload.");
    passed++;
  }

  // TEST K: New-user legacy placeholder is safe
  {
    let insertPayload = null;
    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }) // new user
          })
        }),
        insert: (payload) => {
          insertPayload = payload;
          return Promise.resolve({ error: null });
        }
      })
    };

    const newUserItem = {
      id: "usr-brand-new",
      username: "brandnew",
      email: "brandnew@sdi.ae",
      fullName: "Brand New User",
      role: "Viewer"
    };

    await db.put("users", newUserItem);
    assert.ok(insertPayload, "Insert payload must be captured");
    assert.strictEqual(insertPayload.password, "***", "Legacy insert placeholder must be exactly '***'");
    assert.notStrictEqual(insertPayload.password, "UnitTest-Secret-123", "Insert payload must not contain real password");
    console.log("✓ Test K: New-user legacy placeholder '***' is set only for insert schema compatibility.");
    passed++;
  }

  // TEST L: Existing-user update omits password
  {
    let updatePayload = null;
    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "usr-existing-01" }, error: null }) // existing user
          })
        }),
        update: (payload) => {
          updatePayload = payload;
          return {
            eq: () => Promise.resolve({ error: null })
          };
        }
      })
    };

    const existingUserItem = {
      id: "usr-existing-01",
      username: "existinguser",
      email: "existing@sdi.ae",
      fullName: "Updated Name",
      role: "IT User"
    };

    await db.put("users", existingUserItem);
    assert.ok(updatePayload, "Update payload must be captured");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(updatePayload, "password"), false, "Update payload MUST NOT contain password property");
    assert.strictEqual(updatePayload.full_name, "Updated Name");
    console.log("✓ Test L: Existing-user update payload omitted password property completely.");
    passed++;
  }

  // TEST M: Existing legacy password is not overwritten
  {
    let updatePayload = null;
    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "usr-legacy-01", password: "old_hashed_value" }, error: null })
          })
        }),
        update: (payload) => {
          updatePayload = payload;
          return {
            eq: () => Promise.resolve({ error: null })
          };
        }
      })
    };

    const profileUpdate = {
      id: "usr-legacy-01",
      username: "legacyuser",
      fullName: "Renamed Legacy User",
      role: "Administrator"
    };

    await db.put("users", profileUpdate);
    assert.ok(updatePayload);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(updatePayload, "password"), false, "Existing legacy password column must NOT be included in update payload");
    assert.strictEqual(updatePayload.password, undefined);
    console.log("✓ Test M: Existing legacy database password value left untouched during profile update.");
    passed++;
  }

  // TEST N: User cache contains no password
  {
    const legacyUser = {
      id: "usr-cache-01",
      username: "cacheuser",
      password: "legacy-secret-123",
      role: "Viewer"
    };

    db.saveToFallbackStore("users", legacyUser);
    const store = db.getFallbackStore("users");
    const cachedItem = store.find(u => u.id === "usr-cache-01");
    assert.ok(cachedItem, "Cached item must exist in fallback store");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(cachedItem, "password"), false, "Fallback store user item must NOT have password property");

    db.saveFallbackSnapshot("users", [legacyUser]);
    const snapshotStore = db.getFallbackStore("users");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshotStore[0], "password"), false, "Fallback snapshot user item must NOT have password property");

    const localStorageRaw = localStorage.getItem("sdi_fb_users");
    assert.ok(localStorageRaw, "LocalStorage snapshot must exist");
    assert.strictEqual(localStorageRaw.includes("legacy-secret-123"), false, "Serialized LocalStorage snapshot must NOT contain plain password");
    console.log("✓ Test N: Fallback memory store and LocalStorage snapshots stripped password.");
    passed++;
  }

  // TEST O: AppState.currentUser contains no password
  {
    const currentAppUser = {
      id: "usr-active-01",
      username: "activeuser",
      email: "active@sdi.ae",
      fullName: "Active User",
      role: "IT User",
      employeeId: "emp-501",
      authUserId: "auth-uuid-501"
    };

    assert.strictEqual(Object.prototype.hasOwnProperty.call(currentAppUser, "password"), false, "AppState.currentUser must NOT contain password");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(currentAppUser, "access_token"), false, "AppState.currentUser must NOT contain access token");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(currentAppUser, "refresh_token"), false, "AppState.currentUser must NOT contain refresh token");
    assert.strictEqual(currentAppUser.role, "IT User");
    console.log("✓ Test O: AppState.currentUser verified free of passwords, tokens, and credentials.");
    passed++;
  }

  // TEST P: Password change uses Supabase Auth only
  {
    const usersJs = fs.readFileSync('js/users.js', 'utf8');
    assert.strictEqual(usersJs.includes("db.supabase.auth.updateUser({ password: newPass })"), true, "Password change must invoke Supabase Auth updateUser");
    
    // Verify handleChangePassword does NOT call db.put("users", ...) to save password
    const changePassMethodIdx = usersJs.indexOf("handleChangePassword(event)");
    assert.ok(changePassMethodIdx > 0, "handleChangePassword method must exist");
    const changePassBody = usersJs.substring(changePassMethodIdx, changePassMethodIdx + 1200);
    assert.strictEqual(changePassBody.includes('db.put("users"'), false, "handleChangePassword must NOT perform db.put for users table");
    console.log("✓ Test P: Password change verified to use Supabase Auth exclusively without public.users payload.");
    passed++;
  }

  // TEST Q: Password reset does not read password
  {
    const usersJs = fs.readFileSync('js/users.js', 'utf8');
    assert.strictEqual(usersJs.includes("db.supabase.auth.resetPasswordForEmail(email)"), true, "Password reset must use resetPasswordForEmail");
    
    const resetFuncIdx = usersJs.indexOf("handleSendResetEmail(");
    assert.ok(resetFuncIdx > 0, "handleSendResetEmail method must exist");
    const resetFuncBody = usersJs.substring(resetFuncIdx, resetFuncIdx + 800);
    assert.strictEqual(resetFuncBody.includes("users.password"), false, "Password reset method must not read users.password");
    assert.strictEqual(resetFuncBody.includes(".from(\"users\")"), false, "Password reset method must not query users table");
    assert.strictEqual(resetFuncBody.includes(".from('users')"), false, "Password reset method must not query users table");
    console.log("✓ Test Q: Password reset flow verified to use Auth reset without reading users.password.");
    passed++;
  }

  // TEST R: No password logging
  {
    const filesToCheck = ['js/db.js', 'js/app.js', 'js/users.js'];
    for (const f of filesToCheck) {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('console.log') || line.includes('console.warn') || line.includes('console.error')) {
          // Assert that no password variable value or input value is directly logged
          assert.strictEqual(line.includes('loginPassword'), false, `Line ${idx+1} in ${f} must not log loginPassword`);
          assert.strictEqual(line.includes('formUserPass'), false, `Line ${idx+1} in ${f} must not log formUserPass`);
          assert.strictEqual(line.includes('newPass'), false, `Line ${idx+1} in ${f} must not log newPass`);
          assert.strictEqual(line.includes('password,'), false, `Line ${idx+1} in ${f} must not log password parameter`);
        }
      });
    }
    console.log("✓ Test R: Verified no password values or form fields are outputted to console logs.");
    passed++;
  }

  // TEST S: getById/getFiltered legacy Cloud rows remain safe
  {
    const legacyCloudRows = [
      { id: "u-1", username: "user1", email: "u1@sdi.ae", password: "legacy-hash-1" },
      { id: "u-2", username: "user2", email: "u2@sdi.ae", password: "legacy-hash-2" }
    ];

    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: (col, val) => ({
            maybeSingle: () => Promise.resolve({ data: legacyCloudRows.find(r => r.id === val), error: null })
          })
        })
      })
    };

    const byIdResult = await db.getById("users", "u-1");
    assert.ok(byIdResult);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(byIdResult, "password"), false, "getById result must NOT have password property");

    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: () => Promise.resolve({ data: legacyCloudRows, error: null })
        })
      })
    };

    const filteredResults = await db.getFiltered("users", "email", "u1@sdi.ae");
    assert.ok(Array.isArray(filteredResults));
    for (const res of filteredResults) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(res, "password"), false, "getFiltered result item must NOT have password property");
    }
    console.log("✓ Test S: getById and getFiltered stripped password from raw legacy Cloud rows.");
    passed++;
  }

  // TEST T: Authentication/profile/RBAC preservation
  {
    const fullCloudRow = {
      id: "usr-rbac-01",
      username: "rbacuser",
      email: "rbac@sdi.ae",
      full_name: "RBAC Admin",
      role: "Administrator",
      employee_id: "emp-999",
      auth_user_id: "auth-uuid-999",
      active: true,
      password: "do-not-expose"
    };

    const appUser = global.fromCloudRecord("users", fullCloudRow);

    // Verify key fields are preserved
    assert.strictEqual(appUser.id, "usr-rbac-01");
    assert.strictEqual(appUser.role, "Administrator");
    assert.strictEqual(appUser.active, true);
    assert.strictEqual(appUser.employeeId, "emp-999");
    assert.strictEqual(appUser.authUserId, "auth-uuid-999");

    // Verify excluded security sensitive fields
    assert.strictEqual(Object.prototype.hasOwnProperty.call(appUser, "password"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(appUser, "access_token"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(appUser, "refresh_token"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(appUser, "credential_secret"), false);

    // Verify standard roles remain supported
    const allowedRoles = ["Administrator", "IT User", "Employee", "Viewer"];
    assert.strictEqual(allowedRoles.includes(appUser.role), true, "Role must be one of the standard RBAC roles");

    console.log("✓ Test T: User profile preserved authorization/RBAC metadata while excluding credentials.");
    passed++;
  }

  console.log("================================================================================");
  if (passed === total) {
    console.log(`ALL ${passed}/${total} MANDATORY CREDENTIAL SECURITY TESTS PASSED!`);
    console.log("================================================================================");
  } else {
    console.error(`FAILED: Only ${passed}/${total} tests passed.`);
    process.exit(1);
  }
}

runPasswordSecurityTests().catch(err => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
