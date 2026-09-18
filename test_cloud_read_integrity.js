/**
 * SDI IT Asset Hub - Cloud Read Integrity Unit Tests
 * Mandatory Tests A through P
 */

const assert = require('assert');

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
const fs = require('fs');
const dbCode = fs.readFileSync('js/db.js', 'utf8');
(new Function(dbCode + '; global.DBEngine = DBEngine;'))();

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING SDI IT ASSET HUB - CLOUD READ INTEGRITY MANDATORY TESTS A-X");
  console.log("================================================================================");

  let passed = 0;
  let total = 24;

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
    db.isCloudOnline = true;
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

  // TEST B: getAll Cloud legitimate empty
  {
    db.isCloudOnline = true;
    setMockSupabase(() => ({
      select: async () => ({
        data: [],
        error: null
      })
    }));
    const res = await db.getAll("assets");
    assert.strictEqual(Array.isArray(res), true);
    assert.strictEqual(res.length, 0);
    console.log("✓ Test B: getAll Cloud legitimate empty returned empty array [].");
    passed++;
  }

  // TEST C: getAll RLS/query failure
  {
    db.isCloudOnline = true;
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
    console.log("✓ Test C: getAll RLS/query failure threw real error and blocked stale cache fallback.");
    passed++;
  }

  // TEST D: getAll transport failure
  {
    db.isCloudOnline = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "CACHE-001", brand: "OfflineDell" });

    const transportErr = new TypeError("Failed to fetch");
    setMockSupabase(() => ({
      select: async () => { throw transportErr; }
    }));

    const res = await db.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "CACHE-001");
    console.log("✓ Test D: getAll transport failure safely used read-only local display cache.");
    passed++;
  }

  // TEST E: getFiltered Cloud success
  {
    db.isCloudOnline = true;
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
    console.log("✓ Test E: getFiltered Cloud success returned filtered records.");
    passed++;
  }

  // TEST F: getFiltered legitimate zero matches
  {
    db.isCloudOnline = true;
    setMockSupabase(() => ({
      select: () => ({
        eq: async () => ({
          data: [],
          error: null
        })
      })
    }));
    const res = await db.getFiltered("assets", "status", "NonExistentStatus");
    assert.strictEqual(Array.isArray(res), true);
    assert.strictEqual(res.length, 0);
    console.log("✓ Test F: getFiltered legitimate zero matches returned empty array [].");
    passed++;
  }

  // TEST G: getFiltered query failure
  {
    db.isCloudOnline = true;
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
    console.log("✓ Test G: getFiltered query failure threw real error and was NOT converted to [].");
    passed++;
  }

  // TEST H: getById Cloud success
  {
    db.isCloudOnline = true;
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
    console.log("✓ Test H: getById Cloud success returned single record.");
    passed++;
  }

  // TEST I: getById legitimate not found
  {
    db.isCloudOnline = true;
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
    console.log("✓ Test I: getById legitimate not found returned null without error.");
    passed++;
  }

  // TEST J: getById query failure
  {
    db.isCloudOnline = true;
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
    console.log("✓ Test J: getById query failure threw real error and was NOT converted to null.");
    passed++;
  }

  // TEST K: getById transport failure
  {
    db.isCloudOnline = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "AST-TRANS-001", brand: "Lenovo" });

    const transportErr = new TypeError("Failed to fetch");
    setMockSupabase(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => { throw transportErr; }
        })
      })
    }));

    const res = await db.getById("assets", "AST-TRANS-001");
    assert.strictEqual(res.id, "AST-TRANS-001");
    console.log("✓ Test K: getById transport failure searched local cache.");
    passed++;
  }

  // TEST L: Cloud success replaces cache snapshot
  {
    db.isCloudOnline = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "RECORD-A", brand: "Dell" });
    db.saveToFallbackStore("assets", { id: "RECORD-B", brand: "HP" });

    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "RECORD-A", brand: "Dell" }],
        error: null
      })
    }));

    await db.getAll("assets");
    const local = db.getFallbackStore("assets");
    assert.strictEqual(local.length, 1);
    assert.strictEqual(local[0].id, "RECORD-A");
    console.log("✓ Test L: Cloud success replaced cache snapshot (RECORD-B removed).");
    passed++;
  }

  // TEST M: Cloud success returns empty
  {
    db.isCloudOnline = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "RECORD-A", brand: "Dell" });

    setMockSupabase(() => ({
      select: async () => ({
        data: [],
        error: null
      })
    }));

    await db.getAll("assets");
    const local = db.getFallbackStore("assets");
    assert.strictEqual(local.length, 0);
    console.log("✓ Test M: Cloud success empty result cleared local snapshot.");
    passed++;
  }

  // TEST N: lastQueryErrors
  {
    db.isCloudOnline = true;
    const queryErr = { message: "PGRST301: Permission denied", code: "42501" };
    setMockSupabase(() => ({
      select: async () => ({
        data: null,
        error: queryErr
      })
    }));

    try { await db.getAll("assets"); } catch (e) {}
    assert.notStrictEqual(db.getLastError("assets"), null);

    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "AST-OK", brand: "Dell" }],
        error: null
      })
    }));

    await db.getAll("assets");
    assert.strictEqual(db.getLastError("assets"), null);
    console.log("✓ Test N: lastQueryErrors recorded on failure and cleared on subsequent Cloud success.");
    passed++;
  }

  // TEST O: put safety regression
  {
    db.isCloudOnline = true;
    const writeErr = new Error("PGRST301: RLS insert denied");
    setMockSupabase(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      }),
      insert: async () => ({ data: null, error: writeErr })
    }));

    let threw = false;
    try {
      await db.put("assets", { id: "AST-NEW-01", brand: "Test" });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, writeErr.message);
    }
    assert.strictEqual(threw, true, "put MUST throw on Cloud write failure");
    console.log("✓ Test O: put safety preserved (Cloud write failure threw real error).");
    passed++;
  }

  // TEST P: delete safety regression
  {
    db.isCloudOnline = true;
    const deleteErr = new Error("PGRST301: RLS delete denied");
    setMockSupabase(() => ({
      delete: () => ({
        eq: async () => ({ data: null, error: deleteErr })
      })
    }));

    let threw = false;
    try {
      await db.delete("assets", "AST-DEL-01");
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, deleteErr.message);
    }
    assert.strictEqual(threw, true, "delete MUST throw on Cloud delete failure");
    console.log("✓ Test P: delete safety preserved (Cloud delete failure threw real error).");
    passed++;
  }

  // TEST Q: Online + isCloudOnline=false must still attempt Cloud
  {
    global.navigator.onLine = true;
    db.isCloudOnline = false;
    db.isOperationalReady = false;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "STALE-Q", brand: "StaleQ" });

    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "CLOUD-Q", brand: "CloudQ" }],
        error: null
      })
    }));

    const res = await db.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "CLOUD-Q");
    console.log("✓ Test Q: Online + isCloudOnline=false attempted Cloud and returned Cloud data (stale cache ignored).");
    passed++;
  }

  // TEST R: Online + RLS health-check failure must NOT activate cache mode
  {
    global.navigator.onLine = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "STALE-R", brand: "StaleR" });

    const rlsErr = { message: "PGRST301: RLS policy violation on health check", code: "42501" };
    setMockSupabase(() => ({
      select: () => ({
        limit: async () => ({ data: null, error: rlsErr })
      })
    }));

    const checkRes = await db.checkRequiredCloudTables(true);
    assert.strictEqual(checkRes.success, false);
    assert.strictEqual(checkRes.transport, false);

    await db.checkCloudConnection(true);

    // Mock query error on actual read
    setMockSupabase(() => ({
      select: async () => ({ data: null, error: rlsErr })
    }));

    let threw = false;
    try {
      await db.getAll("assets");
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, rlsErr.message);
    }
    assert.strictEqual(threw, true, "getAll MUST throw on RLS error even after health check failure");
    console.log("✓ Test R: Online + RLS health-check failure did NOT activate cache mode (real error thrown).");
    passed++;
  }

  // TEST S: Online + schema failure must NOT activate cache mode
  {
    global.navigator.onLine = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "STALE-S", brand: "StaleS" });

    const schemaErr = { message: "PGRST204: Column 'nonexistent' does not exist", code: "42703" };
    setMockSupabase(() => ({
      select: () => ({
        limit: async () => ({ data: null, error: schemaErr })
      })
    }));

    const checkRes = await db.checkRequiredCloudTables(true);
    assert.strictEqual(checkRes.success, false);
    assert.strictEqual(checkRes.transport, false);

    setMockSupabase(() => ({
      select: async () => ({ data: null, error: schemaErr })
    }));

    let threw = false;
    try {
      await db.getAll("assets");
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, schemaErr.message);
    }
    assert.strictEqual(threw, true, "getAll MUST throw on schema error");
    console.log("✓ Test S: Online + schema failure did NOT activate cache mode (non-transport error thrown).");
    passed++;
  }

  // TEST T: Actual transport failure may activate temporary offline state & recovery
  {
    global.navigator.onLine = true;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "CACHE-T", brand: "CacheT" });

    const transportErr = new TypeError("Failed to fetch");
    setMockSupabase(() => ({
      select: async () => { throw transportErr; }
    }));

    // First read during transport failure -> returns cache
    const res1 = await db.getAll("assets");
    assert.strictEqual(res1.length, 1);
    assert.strictEqual(res1[0].id, "CACHE-T");

    // Network recovers
    global.navigator.onLine = true;
    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "CLOUD-RECOVERED", brand: "CloudT" }],
        error: null
      })
    }));

    // Second read after recovery -> attempts Cloud and succeeds
    const res2 = await db.getAll("assets");
    assert.strictEqual(res2.length, 1);
    assert.strictEqual(res2[0].id, "CLOUD-RECOVERED");
    console.log("✓ Test T: Transport failure temporarily used cache, then automatically recovered Cloud read when back online.");
    passed++;
  }

  // TEST U: Realtime offline does not block Cloud CRUD reads
  {
    global.navigator.onLine = true;
    db.isRealtimeOnline = false;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "STALE-U", brand: "StaleU" });

    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "CLOUD-U", brand: "CloudU" }],
        error: null
      })
    }));

    const res = await db.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "CLOUD-U");
    console.log("✓ Test U: Realtime offline did not block Cloud CRUD reads (returned authoritative Cloud data).");
    passed++;
  }

  // TEST V: Initial health-check failure MUST NOT disable later Cloud reads
  {
    global.navigator.onLine = true;
    const initDb = new DBEngine();
    const rlsErr = { message: "PGRST301: RLS policy violation on startup health check", code: "42501" };
    initDb.supabase = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: null, error: rlsErr })
        })
      })
    };

    // Health check fails on non-transport RLS
    const checkRes = await initDb.checkRequiredCloudTables(true);
    assert.strictEqual(checkRes.success, false);
    assert.strictEqual(checkRes.transport, false);

    // Mock subsequent read with successful Cloud data
    initDb.supabase = {
      from: () => ({
        select: async () => ({
          data: [{ id: "AST-INIT-001", brand: "Dell" }],
          error: null
        })
      })
    };

    const res = await initDb.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "AST-INIT-001");
    console.log("✓ Test V: Initial health-check failure on RLS did NOT disable later Cloud reads.");
    passed++;
  }

  // TEST W: Online listener exists after initial Cloud health-check failure
  {
    global.navigator.onLine = true;
    const initDb = new DBEngine();
    initDb.eventListenersAdded = false;
    const rlsErr = { message: "PGRST301: Startup RLS error", code: "42501" };
    initDb.supabase = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: null, error: rlsErr })
        })
      }),
      channel: () => ({
        on: function() { return this; },
        subscribe: function() { return this; }
      })
    };

    // Run init
    await initDb.init();
    assert.strictEqual(initDb.eventListenersAdded, true, "online/offline listeners MUST be added even if initial health check failed");
    console.log("✓ Test W: Online listeners were properly added even after initial Cloud health-check failure.");
    passed++;
  }

  // TEST X: Realtime disconnected but operational Cloud available
  {
    global.navigator.onLine = true;
    db.isRealtimeOnline = false;
    db.isCloudOnline = false;
    db.isOperationalReady = false;
    db.clearFallbackStore("assets");
    db.saveToFallbackStore("assets", { id: "STALE-X", brand: "StaleX" });

    setMockSupabase(() => ({
      select: async () => ({
        data: [{ id: "CLOUD-X", brand: "CloudX" }],
        error: null
      })
    }));

    const res = await db.getAll("assets");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "CLOUD-X");
    console.log("✓ Test X: Realtime disconnected + stale status flags did not block Cloud CRUD reads.");
    passed++;
  }

  console.log("================================================================================");
  console.log(`ALL ${passed}/${total} MANDATORY CLOUD READ INTEGRITY TESTS PASSED!`);
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
