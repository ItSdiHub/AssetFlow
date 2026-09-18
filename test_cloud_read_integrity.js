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
  console.log("STARTING SDI IT ASSET HUB - CLOUD READ INTEGRITY MANDATORY TESTS A-P");
  console.log("================================================================================");

  let passed = 0;
  let total = 16;

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

  console.log("================================================================================");
  console.log(`ALL ${passed}/${total} MANDATORY CLOUD READ INTEGRITY TESTS PASSED!`);
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
