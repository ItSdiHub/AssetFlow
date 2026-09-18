/**
 * SDI IT Asset Hub - Cloud Read Integrity Unit Tests
 * Tests Part 11: Verification of Cloud-As-Source-Of-Truth Read & Error Semantics
 */

const assert = require('assert');

// Mock browser globals for test environment
global.window = {
  __SDI_TEST_ENV__: true,
  App: {
    updateCloudStatus: () => {}
  }
};
global.navigator = { onLine: true };
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

// Load DBEngine
const fs = require('fs');
const dbCode = fs.readFileSync('js/db.js', 'utf8');
(new Function(dbCode + '; global.DBEngine = DBEngine;'))();

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING SDI IT ASSET HUB - CLOUD READ INTEGRITY TESTS");
  console.log("================================================================================");

  let passed = 0;
  let total = 9;

  // Setup DBEngine instance
  const db = new DBEngine();
  db.isCloudOnline = true;
  db.isOperationalReady = true;

  // Helper mock client
  function setMockSupabase(mockMethod) {
    db.supabase = {
      from: (tableName) => mockMethod(tableName)
    };
  }

  // TEST A: getAll Cloud success
  {
    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "AST-001", brand: "Dell" }],
        error: null
      })
    }));
    const res = await db.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "AST-001");
    console.log("✓ Test A: getAll Cloud success returned authoritative data.");
    passed++;
  }

  // TEST B: getAll legitimate empty
  {
    setMockSupabase(() => ({
      select: async () => ({
        data: [],
        error: null
      })
    }));
    const res = await db.getAll("assets");
    assert.strictEqual(Array.isArray(res), true);
    assert.strictEqual(res.length, 0);
    console.log("✓ Test B: getAll legitimate empty returned empty array [].");
    passed++;
  }

  // TEST C: getAll permission/query failure
  {
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "STALE-001", brand: "StaleDell" });

    const queryErr = { message: "PGRST301: Permission denied on table assets", code: "42501" };
    setMockSupabase(() => ({
      select: async () => ({
        data: null,
        error: queryErr
      })
    }));

    let threw = false;
    try {
      await db.getAll("assets");
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, queryErr.message);
    }
    assert.strictEqual(threw, true, "getAll MUST throw on query error");
    assert.strictEqual(db.getLastError("assets").message, queryErr.message);
    console.log("✓ Test C: getAll permission/query failure threw real error and blocked stale cache fallback.");
    passed++;
  }

  // TEST D: getFiltered Cloud success
  {
    setMockSupabase(() => ({
      select: () => ({
        eq: async (col, val) => ({
          data: [{ id: "AST-002", status: val }],
          error: null
        })
      })
    }));
    const res = await db.getFiltered("assets", "status", "Available");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "AST-002");
    console.log("✓ Test D: getFiltered Cloud success returned filtered records.");
    passed++;
  }

  // TEST E: getFiltered query failure
  {
    const queryErr = { message: "PGRST204: Column 'nonexistent_col' does not exist", code: "42703" };
    setMockSupabase(() => ({
      select: () => ({
        eq: async () => ({
          data: null,
          error: queryErr
        })
      })
    }));

    let threw = false;
    try {
      await db.getFiltered("assets", "nonexistentCol", "val");
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, queryErr.message);
    }
    assert.strictEqual(threw, true, "getFiltered MUST throw on query error");
    console.log("✓ Test E: getFiltered query failure threw real error and was NOT converted to [].");
    passed++;
  }

  // TEST F: getById Cloud success
  {
    setMockSupabase(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "AST-003", brand: "HP" },
            error: null
          })
        })
      })
    }));
    const res = await db.getById("assets", "AST-003");
    assert.strictEqual(res.id, "AST-003");
    console.log("✓ Test F: getById Cloud success returned single record.");
    passed++;
  }

  // TEST G: getById legitimate not-found
  {
    setMockSupabase(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: null
          })
        })
      })
    }));
    const res = await db.getById("assets", "NON-EXISTENT");
    assert.strictEqual(res, null);
    console.log("✓ Test G: getById legitimate not-found returned null without error.");
    passed++;
  }

  // TEST H: getById query failure
  {
    const queryErr = { message: "PGRST301: Permission denied", code: "42501" };
    setMockSupabase(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: queryErr
          })
        })
      })
    }));

    let threw = false;
    try {
      await db.getById("assets", "AST-003");
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, queryErr.message);
    }
    assert.strictEqual(threw, true, "getById MUST throw on query error");
    console.log("✓ Test H: getById query failure threw real error and was NOT converted to null.");
    passed++;
  }

  // TEST I: offline/cache mode
  {
    db.isCloudOnline = false;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "OFFLINE-001", brand: "Lenovo" });

    const res = await db.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "OFFLINE-001");
    console.log("✓ Test I: Offline mode safely returned read-only local display cache.");
    passed++;
  }

  console.log("================================================================================");
  console.log(`ALL ${passed}/${total} CLOUD READ INTEGRITY TESTS PASSED SUCCESSFULLY!`);
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
