/**
 * SDI IT Asset Hub - User Security & Password Protection Tests
 * Verifies strict elimination of password exposure across read, write, fallback, and auth flows.
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

// Load DBEngine
const dbCode = fs.readFileSync('js/db.js', 'utf8');
(new Function(dbCode + '; global.DBEngine = DBEngine; global.fromCloudRecord = fromCloudRecord; global.toCloudRecord = toCloudRecord; global.getCloudSelectColumns = getCloudSelectColumns;'))();

async function runPasswordSecurityTests() {
  console.log("================================================================================");
  console.log("STARTING SDI IT ASSET HUB - USER SECURITY & PASSWORD PROTECTION TESTS");
  console.log("================================================================================");

  let passed = 0;
  let total = 8;

  const db = new DBEngine();
  db.isCloudOnline = true;
  db.isOperationalReady = true;

  // TEST 1: fromCloudRecord("users") MUST strip password property completely
  {
    const cloudRaw = {
      id: "usr-001",
      username: "testuser",
      email: "test@sdi.ae",
      full_name: "Test User",
      role: "Administrator",
      password: "super_secret_hashed_password"
    };
    const appRecord = global.fromCloudRecord("users", cloudRaw);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(appRecord, "password"), false, "fromCloudRecord('users') must NOT have own property 'password'");
    assert.strictEqual(appRecord.password, undefined, "password property must be undefined");
    assert.strictEqual(appRecord.username, "testuser");
    console.log("✓ Test 1: fromCloudRecord('users') completely stripped password property.");
    passed++;
  }

  // TEST 2: toCloudRecord("users") MUST NOT include password property
  {
    const appUser = {
      id: "usr-001",
      username: "testuser",
      email: "test@sdi.ae",
      fullName: "Test User",
      role: "Administrator",
      password: "my_plain_text_pass"
    };
    const cloudRecord = global.toCloudRecord("users", appUser);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(cloudRecord, "password"), false, "toCloudRecord('users') must NOT contain password property");
    assert.strictEqual(cloudRecord.password, undefined);
    assert.strictEqual(cloudRecord.username, "testuser");
    console.log("✓ Test 2: toCloudRecord('users') omitted password property from output object.");
    passed++;
  }

  // TEST 3: getCloudSelectColumns("users") MUST specify explicit safe columns (NO password column)
  {
    const cols = global.getCloudSelectColumns("users");
    assert.notStrictEqual(cols, "*", "getCloudSelectColumns('users') must not be '*'");
    assert.strictEqual(cols.includes("password"), false, "getCloudSelectColumns('users') must NOT include password column");
    assert.strictEqual(cols.includes("email"), true);
    assert.strictEqual(cols.includes("role"), true);
    console.log("✓ Test 3: getCloudSelectColumns('users') returned safe columns excluding password.");
    passed++;
  }

  // TEST 4: saveToFallbackStore("users") MUST strip password before saving
  {
    const userWithPass = {
      id: "usr-002",
      username: "fallbackuser",
      password: "secret_pass_123"
    };
    db.saveToFallbackStore("users", userWithPass);
    const storeItems = db.getFallbackStore("users");
    const savedUser = storeItems.find(u => u.id === "usr-002");
    assert.ok(savedUser, "Saved user must exist in fallback store");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(savedUser, "password"), false, "Saved fallback user must NOT have password property");
    console.log("✓ Test 4: saveToFallbackStore('users') stripped password before storing in memory and localStorage.");
    passed++;
  }

  // TEST 5: saveFallbackSnapshot("users") MUST strip password from all records
  {
    const userList = [
      { id: "usr-10", username: "u10", password: "p10" },
      { id: "usr-11", username: "u11", password: "p11" }
    ];
    db.saveFallbackSnapshot("users", userList);
    const storeItems = db.getFallbackStore("users");
    assert.strictEqual(storeItems.length, 2);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(storeItems[0], "password"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(storeItems[1], "password"), false);
    console.log("✓ Test 5: saveFallbackSnapshot('users') stripped password from array snapshot.");
    passed++;
  }

  // TEST 6: db.put("users") EXISTING user update MUST NOT include password or placeholder
  {
    let updatePayload = null;
    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "usr-001" }, // existing user
              error: null
            })
          })
        }),
        update: (payload) => {
          updatePayload = payload;
          return {
            eq: async () => ({ error: null })
          };
        }
      })
    };

    const existingUserObj = {
      id: "usr-001",
      username: "admin",
      email: "admin@sdi.ae",
      fullName: "System Administrator",
      role: "Administrator"
    };

    await db.put("users", existingUserObj);
    assert.ok(updatePayload, "Update payload must be generated");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(updatePayload, "password"), false, "Existing user update payload MUST NOT contain password key");
    console.log("✓ Test 6: db.put('users') EXISTING user update emitted payload without password property.");
    passed++;
  }

  // TEST 7: db.put("users") NEW user insert sets placeholder "***" ONLY for insert schema constraint
  {
    let insertPayload = null;
    db.supabase = {
      from: (tableName) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null, // new user (does not exist in DB yet)
              error: null
            })
          })
        }),
        insert: async (payload) => {
          insertPayload = payload;
          return { error: null };
        }
      })
    };

    const newUserObj = {
      id: "usr-999",
      username: "newuser",
      email: "newuser@sdi.ae",
      fullName: "New User",
      role: "Viewer"
    };

    await db.put("users", newUserObj);
    assert.ok(insertPayload, "Insert payload must be generated");
    assert.strictEqual(insertPayload.password, "***", "New user insert payload must set placeholder '***' for schema constraint");
    console.log("✓ Test 7: db.put('users') NEW user insert correctly set placeholder '***' for legacy column constraint.");
    passed++;
  }

  // TEST 8: Verify users.js does NOT contain existing.password
  {
    const usersJs = fs.readFileSync('js/users.js', 'utf8');
    assert.strictEqual(usersJs.includes("existing.password"), false, "js/users.js must NOT contain existing.password");
    console.log("✓ Test 8: Verified js/users.js contains no references to existing.password.");
    passed++;
  }

  console.log("================================================================================");
  console.log(`ALL ${passed}/${total} USER SECURITY & PASSWORD PROTECTION TESTS PASSED!`);
  console.log("================================================================================");
}

runPasswordSecurityTests().catch(err => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
