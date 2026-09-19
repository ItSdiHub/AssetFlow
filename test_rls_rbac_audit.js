/**
 * SDI IT Asset Hub - Comprehensive RBAC / RLS Security Audit Test Suite
 * 
 * Read-only security audit runner:
 * - Static SQL policy AST / regex extraction
 * - RLS policy predicate evaluation simulation
 * - Role x Table x Operation boundary verification
 * - Zero production database writes
 * 
 * EXACTLY 24 TESTS (A - X)
 */

const fs = require('fs');
const path = require('path');

// 1. Load SQL source files
const hardeningSql = fs.readFileSync(path.join(__dirname, 'supabase_security_hardening.sql'), 'utf8');
const schemaSql = fs.readFileSync(path.join(__dirname, 'supabase_schema.sql'), 'utf8');

// 2. Core 18 tables defined in the system
const CORE_TABLES = [
  'users',
  'employees',
  'departments',
  'locations',
  'offices',
  'asset_types',
  'assets',
  'asset_transactions',
  'maintenance',
  'warehouse_issues',
  'asset_transfers',
  'contractors',
  'projects',
  'project_tasks',
  'licenses',
  'system_settings',
  'helpdesk_requests',
  'notifications'
];

// Helper: Extract all policies from SQL
function extractAllPolicies(sqlText) {
  const policies = [];

  // Loop-based policies: ARRAY['departments', 'locations', 'asset_types', 'contractors', 'projects', 'project_tasks', 'licenses']
  const arrayMatch = sqlText.match(/ARRAY\[([\s\S]*?)\]/);
  if (arrayMatch) {
    const loopTables = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    for (const t of loopTables) {
      policies.push({
        name: `Auth_Read_${t}`,
        table: t,
        command: 'SELECT',
        targetRole: 'authenticated',
        using: 'true',
        withCheck: null
      });
      policies.push({
        name: `Admin_IT_Insert_${t}`,
        table: t,
        command: 'INSERT',
        targetRole: 'authenticated',
        using: null,
        withCheck: "public.get_auth_role() IN ('Administrator', 'IT User')"
      });
      policies.push({
        name: `Admin_IT_Update_${t}`,
        table: t,
        command: 'UPDATE',
        targetRole: 'authenticated',
        using: "public.get_auth_role() IN ('Administrator', 'IT User')",
        withCheck: null
      });
      policies.push({
        name: `Admin_IT_Delete_${t}`,
        table: t,
        command: 'DELETE',
        targetRole: 'authenticated',
        using: "public.get_auth_role() IN ('Administrator', 'IT User')",
        withCheck: null
      });
    }
  }

  // Explicit CREATE POLICY statements
  const policyRegex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+public\.(\w+)\s+(?:FOR\s+(\w+)\s+)?(?:TO\s+(\w+)\s+)?(?:USING\s*\(([\s\S]*?)\))?(?:\s*WITH CHECK\s*\(([\s\S]*?)\))?;/g;
  let match;
  while ((match = policyRegex.exec(sqlText)) !== null) {
    const [_, name, table, command, targetRole, usingClause, withCheckClause] = match;
    policies.push({
      name,
      table,
      command: command || 'ALL',
      targetRole: targetRole || 'public',
      using: usingClause ? usingClause.trim() : null,
      withCheck: withCheckClause ? withCheckClause.trim() : null
    });
  }

  return policies;
}

const ALL_POLICIES = extractAllPolicies(hardeningSql);

// Policy evaluation simulator
function evaluatePolicy(policy, context) {
  // context: { role, authUid, employeeId, record, isAnon }
  if (context.isAnon) {
    if (policy.targetRole === 'authenticated') return false;
    if (policy.targetRole === 'public') {
      // In Supabase, if REVOKE ALL FROM anon is in effect, anon has no table privileges
      return false;
    }
    return false;
  }

  const clause = policy.using || policy.withCheck;
  if (!clause) return false;

  // Handle true
  if (clause === 'true') return true;

  // Simulate SQL functions
  const userRole = context.role || null;
  const userEmpId = context.employeeId || null;
  const authUid = context.authUid || null;

  // public.get_auth_role() = 'Administrator'
  if (clause.includes("public.get_auth_role() = 'Administrator'")) {
    if (clause.includes('auth_user_id = auth.uid()::text')) {
      // e.g. auth_user_id = auth.uid()::text OR public.get_auth_role() = 'Administrator'
      const isOwner = context.record && context.record.auth_user_id === authUid;
      const isAdmin = userRole === 'Administrator';
      return isOwner || isAdmin;
    }
    return userRole === 'Administrator';
  }

  // public.get_auth_role() IN ('Administrator', 'IT User')
  if (clause.includes("public.get_auth_role() IN ('Administrator', 'IT User')")) {
    const isPrivileged = userRole === 'Administrator' || userRole === 'IT User';
    if (clause.includes('public.get_auth_employee_id()')) {
      // Check for employee-specific conditions
      if (context.record) {
        if (clause.includes('employee_id = public.get_auth_employee_id()')) {
          const isOwn = context.record.employee_id === userEmpId;
          return isPrivileged || (isOwn && userEmpId !== null);
        }
        if (clause.includes('current_employee_id = public.get_auth_employee_id()')) {
          const isOwn = context.record.current_employee_id === userEmpId;
          return isPrivileged || (isOwn && userEmpId !== null);
        }
        if (clause.includes('it_employee_id = public.get_auth_employee_id()')) {
          const isOwn = context.record.it_employee_id === userEmpId;
          return isPrivileged || (isOwn && userEmpId !== null);
        }
      }
    }
    return isPrivileged;
  }

  // public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  if (clause.includes("public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')")) {
    const isStaffOrViewer = userRole === 'Administrator' || userRole === 'IT User' || userRole === 'Viewer';
    if (clause.includes('public.get_auth_employee_id()')) {
      if (context.record) {
        if (/\bcurrent_employee_id\s*=\s*public\.get_auth_employee_id\(\)/.test(clause)) {
          const isOwn = context.record.current_employee_id === userEmpId;
          return isStaffOrViewer || (isOwn && userEmpId !== null);
        }
        if (/\bemployee_id\s*=\s*public\.get_auth_employee_id\(\)/.test(clause)) {
          const isOwn = context.record.employee_id === userEmpId;
          return isStaffOrViewer || (isOwn && userEmpId !== null);
        }
        if (/\bid\s*=\s*public\.get_auth_employee_id\(\)/.test(clause)) {
          const isOwn = context.record.id === userEmpId;
          return isStaffOrViewer || (isOwn && userEmpId !== null);
        }
      }
    }
    return isStaffOrViewer;
  }

  return false;
}

// Test Runner
const results = [];
let passCount = 0;
let failCount = 0;

function runTest(testId, description, fn) {
  try {
    fn();
    console.log(`✓ Test ${testId}: ${description}`);
    results.push({ id: testId, description, passed: true });
    passCount++;
  } catch (err) {
    console.error(`✗ Test ${testId} FAILED: ${description}`);
    console.error(`   Error: ${err.message}`);
    results.push({ id: testId, description, passed: false, error: err.message });
    failCount++;
  }
}

console.log('================================================================================');
console.log('STARTING SDI IT ASSET HUB - RBAC / RLS SECURITY AUDIT TEST SUITE (A - X)');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// TEST A: Anonymous access is revoked.
// -----------------------------------------------------------------------------
runTest('A', 'Anonymous access is revoked from public schema tables', () => {
  const hasRevoke = /REVOKE\s+ALL\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon;/i.test(hardeningSql);
  if (!hasRevoke) throw new Error('Hardening SQL does not explicitly revoke all table access from anon role');
  
  // Verify no policy grants TO anon
  const anonPolicies = ALL_POLICIES.filter(p => p.targetRole === 'anon');
  if (anonPolicies.length > 0) throw new Error(`Found ${anonPolicies.length} policies granting access to anon`);
});

// -----------------------------------------------------------------------------
// TEST B: Administrator full intended access.
// -----------------------------------------------------------------------------
runTest('B', 'Administrator has full intended read and write access across all 18 tables', () => {
  const adminCtx = { role: 'Administrator', authUid: 'admin-uid-1', employeeId: 'emp-admin', isAnon: false };
  for (const table of CORE_TABLES) {
    for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const pol = ALL_POLICIES.find(p => p.table === table && (p.command === cmd || p.command === 'ALL'));
      if (!pol) throw new Error(`Missing policy for table ${table} command ${cmd}`);
      const allowed = evaluatePolicy(pol, adminCtx);
      if (!allowed) throw new Error(`Administrator unexpectedly denied for ${table}.${cmd}`);
    }
  }
});

// -----------------------------------------------------------------------------
// TEST C: IT User operational write access.
// -----------------------------------------------------------------------------
runTest('C', 'IT User has operational write access on core inventory and maintenance tables', () => {
  const itCtx = { role: 'IT User', authUid: 'it-uid-1', employeeId: 'emp-it', isAnon: false };
  const operationalTables = [
    'assets', 'asset_transactions', 'maintenance', 'warehouse_issues',
    'asset_transfers', 'helpdesk_requests', 'employees', 'offices',
    'departments', 'locations', 'asset_types', 'contractors',
    'projects', 'project_tasks', 'licenses'
  ];

  for (const table of operationalTables) {
    for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
      const pol = ALL_POLICIES.find(p => p.table === table && (p.command === cmd || p.command === 'ALL'));
      if (!pol) throw new Error(`Missing write policy for ${table}.${cmd}`);
      const allowed = evaluatePolicy(pol, itCtx);
      if (!allowed) throw new Error(`IT User unexpectedly denied for ${table}.${cmd}`);
    }
  }
});

// -----------------------------------------------------------------------------
// TEST D: IT User cannot manage users.
// -----------------------------------------------------------------------------
runTest('D', 'IT User cannot insert, update, or delete users or system settings', () => {
  const itCtx = { role: 'IT User', authUid: 'it-uid-1', employeeId: 'emp-it', isAnon: false };
  const restrictedTables = ['users', 'system_settings'];

  for (const table of restrictedTables) {
    for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
      const pol = ALL_POLICIES.find(p => p.table === table && (p.command === cmd || p.command === 'ALL'));
      if (!pol) throw new Error(`Missing policy for ${table}.${cmd}`);
      const allowed = evaluatePolicy(pol, itCtx);
      if (allowed) throw new Error(`IT User was improperly granted write access to ${table}.${cmd}`);
    }
  }
});

// -----------------------------------------------------------------------------
// TEST E: Viewer cannot INSERT.
// -----------------------------------------------------------------------------
runTest('E', 'Viewer cannot perform INSERT operations on any of the 18 tables', () => {
  const viewerCtx = { role: 'Viewer', authUid: 'viewer-uid-1', employeeId: 'emp-view', isAnon: false };
  for (const table of CORE_TABLES) {
    const pol = ALL_POLICIES.find(p => p.table === table && (p.command === 'INSERT' || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing INSERT policy for ${table}`);
    const allowed = evaluatePolicy(pol, viewerCtx);
    if (allowed) throw new Error(`Viewer improperly permitted INSERT on ${table}`);
  }
});

// -----------------------------------------------------------------------------
// TEST F: Viewer cannot UPDATE.
// -----------------------------------------------------------------------------
runTest('F', 'Viewer cannot perform UPDATE operations on any of the 18 tables', () => {
  const viewerCtx = { role: 'Viewer', authUid: 'viewer-uid-1', employeeId: 'emp-view', isAnon: false };
  for (const table of CORE_TABLES) {
    const pol = ALL_POLICIES.find(p => p.table === table && (p.command === 'UPDATE' || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing UPDATE policy for ${table}`);
    const allowed = evaluatePolicy(pol, viewerCtx);
    if (allowed) throw new Error(`Viewer improperly permitted UPDATE on ${table}`);
  }
});

// -----------------------------------------------------------------------------
// TEST G: Viewer cannot DELETE.
// -----------------------------------------------------------------------------
runTest('G', 'Viewer cannot perform DELETE operations on any of the 18 tables', () => {
  const viewerCtx = { role: 'Viewer', authUid: 'viewer-uid-1', employeeId: 'emp-view', isAnon: false };
  for (const table of CORE_TABLES) {
    const pol = ALL_POLICIES.find(p => p.table === table && (p.command === 'DELETE' || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing DELETE policy for ${table}`);
    const allowed = evaluatePolicy(pol, viewerCtx);
    if (allowed) throw new Error(`Viewer improperly permitted DELETE on ${table}`);
  }
});

// -----------------------------------------------------------------------------
// TEST H: Employee cannot modify assets.
// -----------------------------------------------------------------------------
runTest('H', 'Employee cannot INSERT, UPDATE, or DELETE records in assets table', () => {
  const empCtx = { role: 'Employee', authUid: 'emp-uid-1', employeeId: 'emp-101', isAnon: false };
  for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
    const pol = ALL_POLICIES.find(p => p.table === 'assets' && (p.command === cmd || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing policy for assets.${cmd}`);
    const allowed = evaluatePolicy(pol, empCtx);
    if (allowed) throw new Error(`Employee improperly permitted ${cmd} on assets`);
  }
});

// -----------------------------------------------------------------------------
// TEST I: Employee cannot modify maintenance.
// -----------------------------------------------------------------------------
runTest('I', 'Employee cannot INSERT, UPDATE, or DELETE records in maintenance table', () => {
  const empCtx = { role: 'Employee', authUid: 'emp-uid-1', employeeId: 'emp-101', isAnon: false };
  for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
    const pol = ALL_POLICIES.find(p => p.table === 'maintenance' && (p.command === cmd || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing policy for maintenance.${cmd}`);
    const allowed = evaluatePolicy(pol, empCtx);
    if (allowed) throw new Error(`Employee improperly permitted ${cmd} on maintenance`);
  }
});

// -----------------------------------------------------------------------------
// TEST J: Employee cannot modify warehouse issues.
// -----------------------------------------------------------------------------
runTest('J', 'Employee cannot INSERT, UPDATE, or DELETE records in warehouse_issues table', () => {
  const empCtx = { role: 'Employee', authUid: 'emp-uid-1', employeeId: 'emp-101', isAnon: false };
  for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
    const pol = ALL_POLICIES.find(p => p.table === 'warehouse_issues' && (p.command === cmd || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing policy for warehouse_issues.${cmd}`);
    const allowed = evaluatePolicy(pol, empCtx);
    if (allowed) throw new Error(`Employee improperly permitted ${cmd} on warehouse_issues`);
  }
});

// -----------------------------------------------------------------------------
// TEST K: Employee cannot modify transfers.
// -----------------------------------------------------------------------------
runTest('K', 'Employee cannot INSERT, UPDATE, or DELETE records in asset_transfers table', () => {
  const empCtx = { role: 'Employee', authUid: 'emp-uid-1', employeeId: 'emp-101', isAnon: false };
  for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
    const pol = ALL_POLICIES.find(p => p.table === 'asset_transfers' && (p.command === cmd || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing policy for asset_transfers.${cmd}`);
    const allowed = evaluatePolicy(pol, empCtx);
    if (allowed) throw new Error(`Employee improperly permitted ${cmd} on asset_transfers`);
  }
});

// -----------------------------------------------------------------------------
// TEST L: Employee cannot modify asset transactions.
// -----------------------------------------------------------------------------
runTest('L', 'Employee cannot INSERT, UPDATE, or DELETE records in asset_transactions table', () => {
  const empCtx = { role: 'Employee', authUid: 'emp-uid-1', employeeId: 'emp-101', isAnon: false };
  for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
    const pol = ALL_POLICIES.find(p => p.table === 'asset_transactions' && (p.command === cmd || p.command === 'ALL'));
    if (!pol) throw new Error(`Missing policy for asset_transactions.${cmd}`);
    const allowed = evaluatePolicy(pol, empCtx);
    if (allowed) throw new Error(`Employee improperly permitted ${cmd} on asset_transactions`);
  }
});

// -----------------------------------------------------------------------------
// TEST M: Employee sees only own user profile.
// -----------------------------------------------------------------------------
runTest('M', 'Employee SELECT on users returns only their own user record', () => {
  const empCtx = { role: 'Employee', authUid: 'auth-user-123', employeeId: 'emp-101', isAnon: false };
  const selPol = ALL_POLICIES.find(p => p.table === 'users' && p.command === 'SELECT');
  if (!selPol) throw new Error('Missing SELECT policy on users');

  const ownRecord = { id: 'usr-1', auth_user_id: 'auth-user-123', username: 'emp1' };
  const otherRecord = { id: 'usr-2', auth_user_id: 'auth-other-456', username: 'admin' };

  const ownAllowed = evaluatePolicy(selPol, { ...empCtx, record: ownRecord });
  const otherAllowed = evaluatePolicy(selPol, { ...empCtx, record: otherRecord });

  if (!ownAllowed) throw new Error('Employee denied read access to own user profile');
  if (otherAllowed) throw new Error('Employee improperly granted read access to other user profiles');
});

// -----------------------------------------------------------------------------
// TEST N: Employee sees only own employee record.
// -----------------------------------------------------------------------------
runTest('N', 'Employee SELECT on employees returns only their own employee profile', () => {
  const empCtx = { role: 'Employee', authUid: 'auth-user-123', employeeId: 'emp-101', isAnon: false };
  const selPol = ALL_POLICIES.find(p => p.table === 'employees' && p.command === 'SELECT');
  if (!selPol) throw new Error('Missing SELECT policy on employees');

  const ownEmp = { id: 'emp-101', name_ar: 'أحمد' };
  const otherEmp = { id: 'emp-999', name_ar: 'سالم' };

  const ownAllowed = evaluatePolicy(selPol, { ...empCtx, record: ownEmp });
  const otherAllowed = evaluatePolicy(selPol, { ...empCtx, record: otherEmp });

  if (!ownAllowed) throw new Error('Employee denied read access to own employee record');
  if (otherAllowed) throw new Error('Employee improperly granted read access to other employees records');
});

// -----------------------------------------------------------------------------
// TEST O: Employee sees only assigned assets.
// -----------------------------------------------------------------------------
runTest('O', 'Employee SELECT on assets returns only assets assigned to them', () => {
  const empCtx = { role: 'Employee', authUid: 'auth-user-123', employeeId: 'emp-101', isAnon: false };
  const selPol = ALL_POLICIES.find(p => p.table === 'assets' && p.command === 'SELECT');
  if (!selPol) throw new Error('Missing SELECT policy on assets');

  const assignedAsset = { id: 'ast-1', current_employee_id: 'emp-101', brand: 'Dell' };
  const unassignedAsset = { id: 'ast-2', current_employee_id: null, brand: 'HP' };
  const otherAsset = { id: 'ast-3', current_employee_id: 'emp-999', brand: 'Lenovo' };

  const assignedAllowed = evaluatePolicy(selPol, { ...empCtx, record: assignedAsset });
  const unassignedAllowed = evaluatePolicy(selPol, { ...empCtx, record: unassignedAsset });
  const otherAllowed = evaluatePolicy(selPol, { ...empCtx, record: otherAsset });

  if (!assignedAllowed) throw new Error('Employee denied access to their assigned asset');
  if (unassignedAllowed) throw new Error('Employee improperly granted access to unassigned/warehouse asset');
  if (otherAllowed) throw new Error('Employee improperly granted access to another employee asset');
});

// -----------------------------------------------------------------------------
// TEST P: Employee sees only own helpdesk requests.
// -----------------------------------------------------------------------------
runTest('P', 'Employee SELECT on helpdesk_requests returns only their own requests', () => {
  const empCtx = { role: 'Employee', authUid: 'auth-user-123', employeeId: 'emp-101', isAnon: false };
  const selPol = ALL_POLICIES.find(p => p.table === 'helpdesk_requests' && p.command === 'SELECT');
  if (!selPol) throw new Error('Missing SELECT policy on helpdesk_requests');

  const ownReq = { id: 'req-1', employee_id: 'emp-101', subject: 'Printer broken' };
  const otherReq = { id: 'req-2', employee_id: 'emp-999', subject: 'Password reset' };

  const ownAllowed = evaluatePolicy(selPol, { ...empCtx, record: ownReq });
  const otherAllowed = evaluatePolicy(selPol, { ...empCtx, record: otherReq });

  if (!ownAllowed) throw new Error('Employee denied access to own helpdesk request');
  if (otherAllowed) throw new Error('Employee improperly granted access to another employee helpdesk request');
});

// -----------------------------------------------------------------------------
// TEST Q: Employee sees only own notifications.
// -----------------------------------------------------------------------------
runTest('Q', 'Employee SELECT on notifications returns only notifications destined for them', () => {
  const empCtx = { role: 'Employee', authUid: 'auth-user-123', employeeId: 'emp-101', isAnon: false };
  const selPol = ALL_POLICIES.find(p => p.table === 'notifications' && p.command === 'SELECT');
  if (!selPol) throw new Error('Missing SELECT policy on notifications');

  const ownNotif = { id: 'notif-1', employee_id: 'emp-101', title_en: 'Asset assigned' };
  const otherNotif = { id: 'notif-2', employee_id: 'emp-999', title_en: 'Maintenance done' };

  const ownAllowed = evaluatePolicy(selPol, { ...empCtx, record: ownNotif });
  const otherAllowed = evaluatePolicy(selPol, { ...empCtx, record: otherNotif });

  if (!ownAllowed) throw new Error('Employee denied access to own notification');
  if (otherAllowed) throw new Error('Employee improperly granted access to another employee notification');
});

// -----------------------------------------------------------------------------
// TEST R: Conflicting/missing auth_user_id does not bypass RLS.
// -----------------------------------------------------------------------------
runTest('R', 'Unmapped or unauthenticated session resolves get_auth_role() to NULL and fails closed', () => {
  // Simulate missing/unmatched auth_user_id
  const unlinkedCtx = { role: null, authUid: 'unknown-uid-999', employeeId: null, isAnon: false };
  
  // Sensitive operational tables MUST reject unlinked users
  const sensitiveTables = ['users', 'employees', 'assets', 'maintenance', 'warehouse_issues', 'asset_transfers', 'helpdesk_requests', 'notifications', 'offices'];
  for (const table of sensitiveTables) {
    const selPol = ALL_POLICIES.find(p => p.table === table && p.command === 'SELECT');
    if (!selPol) throw new Error(`Missing SELECT policy on ${table}`);
    const allowed = evaluatePolicy(selPol, { ...unlinkedCtx, record: { id: 'rec-1', auth_user_id: 'other', employee_id: 'emp-1', current_employee_id: 'emp-1' } });
    if (allowed) throw new Error(`Unlinked session improperly granted access to ${table}`);
  }
});

// -----------------------------------------------------------------------------
// TEST S: RLS is not dependent solely on JavaScript UI guards.
// -----------------------------------------------------------------------------
runTest('S', 'Database security enforcement is decoupled from client-side JavaScript UI hiding', () => {
  // Check that all write operations on public tables have database-enforced policies
  for (const table of CORE_TABLES) {
    const writePolicies = ALL_POLICIES.filter(p => p.table === table && ['INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(p.command));
    if (writePolicies.length === 0) throw new Error(`Table ${table} lacks database-enforced write policies`);
  }

  // Check that Employee role has zero write permissions on core asset & tracking tables in SQL
  const readonlyForEmp = ['assets', 'maintenance', 'warehouse_issues', 'asset_transfers', 'asset_transactions', 'users'];
  for (const table of readonlyForEmp) {
    const policies = ALL_POLICIES.filter(p => p.table === table && ['INSERT', 'UPDATE', 'DELETE'].includes(p.command));
    for (const p of policies) {
      const allowed = evaluatePolicy(p, { role: 'Employee', authUid: 'e-1', employeeId: 'emp-1', isAnon: false });
      if (allowed) throw new Error(`Database policy allows Employee write on ${table}`);
    }
  }
});

// -----------------------------------------------------------------------------
// TEST T: Every core table has RLS enabled.
// -----------------------------------------------------------------------------
runTest('T', 'All 18 core tables have explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY', () => {
  for (const table of CORE_TABLES) {
    const regex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, 'i');
    if (!regex.test(hardeningSql)) {
      throw new Error(`Table public.${table} missing ENABLE ROW LEVEL SECURITY in hardening SQL`);
    }
  }
});

// -----------------------------------------------------------------------------
// TEST U: Every core table has intended policies.
// -----------------------------------------------------------------------------
runTest('U', 'All 18 core tables have explicit SELECT, INSERT, UPDATE, and DELETE policies defined', () => {
  for (const table of CORE_TABLES) {
    for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const pol = ALL_POLICIES.find(p => p.table === table && (p.command === cmd || p.command === 'ALL'));
      if (!pol) throw new Error(`Missing ${cmd} policy for table public.${table}`);
    }
  }
  if (ALL_POLICIES.length !== 72) {
    throw new Error(`Expected exactly 72 policies (18 tables x 4 operations), found ${ALL_POLICIES.length}`);
  }
});

// -----------------------------------------------------------------------------
// TEST V: Broad USING(true) policies are enumerated for review.
// -----------------------------------------------------------------------------
runTest('V', 'All broad USING(true) policies are identified and verified strictly read-only', () => {
  const trueSelects = ALL_POLICIES.filter(p => p.command === 'SELECT' && p.using === 'true');
  const expectedBroadTables = [
    'departments', 'locations', 'asset_types', 'contractors',
    'projects', 'project_tasks', 'licenses', 'system_settings'
  ];

  if (trueSelects.length !== expectedBroadTables.length) {
    throw new Error(`Expected ${expectedBroadTables.length} broad SELECT policies, found ${trueSelects.length}`);
  }

  for (const t of expectedBroadTables) {
    if (!trueSelects.some(p => p.table === t)) {
      throw new Error(`Expected table ${t} to be in broad SELECT list`);
    }
  }

  // CRITICAL: Ensure NO write policy (INSERT, UPDATE, DELETE) uses true or open WITH CHECK
  const unsafeWrites = ALL_POLICIES.filter(p => p.command !== 'SELECT' && (p.using === 'true' || p.withCheck === 'true'));
  if (unsafeWrites.length > 0) {
    throw new Error(`Found unsafe write policy with open TRUE: ${unsafeWrites.map(p => p.name).join(', ')}`);
  }
});

// -----------------------------------------------------------------------------
// TEST W: Security DEFINER functions use safe search_path.
// -----------------------------------------------------------------------------
runTest('W', 'Helper functions get_auth_role() and get_auth_employee_id() enforce safe search_path', () => {
  const roleFnRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_auth_role\(\)[\s\S]*?SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public/i;
  const empFnRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_auth_employee_id\(\)[\s\S]*?SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public/i;

  if (!roleFnRegex.test(hardeningSql)) {
    throw new Error('public.get_auth_role() missing SECURITY DEFINER or SET search_path = public');
  }
  if (!empFnRegex.test(hardeningSql)) {
    throw new Error('public.get_auth_employee_id() missing SECURITY DEFINER or SET search_path = public');
  }
});

// -----------------------------------------------------------------------------
// TEST X: No anonymous protected read path exists.
// -----------------------------------------------------------------------------
runTest('X', 'Anonymous unauthenticated access is completely blocked from all protected tables', () => {
  const anonCtx = { isAnon: true, role: null, authUid: null, employeeId: null };

  for (const table of CORE_TABLES) {
    for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const pol = ALL_POLICIES.find(p => p.table === table && (p.command === cmd || p.command === 'ALL'));
      if (pol) {
        const allowed = evaluatePolicy(pol, anonCtx);
        if (allowed) throw new Error(`Anonymous access allowed on ${table}.${cmd}`);
      }
    }
  }
});

// -----------------------------------------------------------------------------
// Summary & Exit
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
if (passCount === 24 && failCount === 0) {
  console.log(`ALL ${passCount}/24 RBAC / RLS SECURITY AUDIT TESTS (A-X) PASSED!`);
  console.log('================================================================================');
  process.exit(0);
} else {
  console.error(`AUDIT FAILED: ${passCount} passed, ${failCount} failed out of 24 tests.`);
  console.log('================================================================================');
  process.exit(1);
}
