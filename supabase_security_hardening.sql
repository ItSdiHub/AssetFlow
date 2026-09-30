/**
 * SDI IT Asset Hub - Security Phase 2: Database-Level RLS & RBAC Hardening
 * 
 * Enforces strict database-level authorization via Supabase RLS:
 * - Exact auth.uid() mapping against public.users.auth_user_id (no fallback).
 * - Restricts Employee writes on assets, asset_transactions, maintenance, warehouse_issues, asset_transfers, offices.
 * - Removes open write hole (WITH CHECK true) on notifications.
 * - Enforces Viewer read-only access.
 * - Preserves Administrator and IT User operational workflows.
 */

BEGIN;

-- 1. Hardened Helper Functions
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
SELECT role
FROM public.users
WHERE auth_user_id = auth.uid()::text
AND active = true
LIMIT 1;
$$ LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_employee_id()
RETURNS text AS $$
SELECT employee_id
FROM public.users
WHERE auth_user_id = auth.uid()::text
AND active = true
LIMIT 1;
$$ LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public;

-- Dedicated Claim Function for Unlinked Authenticated User Profiles
CREATE OR REPLACE FUNCTION public.claim_authenticated_user_profile()
RETURNS TABLE (
  id TEXT,
  username TEXT,
  full_name TEXT,
  full_name_ar TEXT,
  full_name_en TEXT,
  role TEXT,
  employee_id TEXT,
  auth_user_id TEXT,
  active BOOLEAN,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jwt_email TEXT := lower(trim(auth.jwt() ->> 'email'));
  v_match_count INT;
  v_target_id TEXT;
BEGIN
  -- 1 & 3: Reject when auth.uid() is NULL or JWT email is NULL/empty
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF v_jwt_email IS NULL OR v_jwt_email = '' THEN
    RAISE EXCEPTION 'Authenticated identity has no verified email claim' USING ERRCODE = '22000';
  END IF;

  -- Reject if an active profile with this email is already linked to another Auth UID
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE lower(trim(u.email)) = v_jwt_email
      AND u.active = true
      AND u.auth_user_id IS NOT NULL
      AND u.auth_user_id != v_uid::text
  ) THEN
    RAISE EXCEPTION 'Profile is already linked to another authentication identity' USING ERRCODE = 'P0005';
  END IF;

  -- 4: Find exactly ONE active public.users profile where auth_user_id IS NULL, email IS NOT NULL, and lower(email) matches
  SELECT count(*), min(u.id)
  INTO v_match_count, v_target_id
  FROM public.users u
  WHERE u.auth_user_id IS NULL
    AND u.active = true
    AND u.email IS NOT NULL
    AND lower(trim(u.email)) = v_jwt_email;

  -- 6: Reject if no matching profile exists
  IF v_match_count = 0 THEN
    -- If already linked to this auth user, return existing row safely
    IF EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = v_uid::text
        AND u.active = true
        AND lower(trim(u.email)) = v_jwt_email
    ) THEN
      RETURN QUERY
      SELECT u.id, u.username, u.full_name, u.full_name_ar, u.full_name_en, u.role, u.employee_id, u.auth_user_id, u.active, u.email
      FROM public.users u
      WHERE u.auth_user_id = v_uid::text;
      RETURN;
    END IF;

    RAISE EXCEPTION 'No unlinked active profile found for authenticated email' USING ERRCODE = 'P0002';
  END IF;

  -- 5: Reject ambiguous matches
  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Ambiguous profile match: multiple unlinked profiles found' USING ERRCODE = 'P0003';
  END IF;

  -- 7 & 8: Atomically claim by setting ONLY auth_user_id = auth.uid()::text without altering any other fields
  UPDATE public.users
  SET auth_user_id = v_uid::text
  WHERE public.users.id = v_target_id
    AND public.users.auth_user_id IS NULL;

  -- 9 & 10: Verify the resulting row before returning success
  RETURN QUERY
  SELECT u.id, u.username, u.full_name, u.full_name_ar, u.full_name_en, u.role, u.employee_id, u.auth_user_id, u.active, u.email
  FROM public.users u
  WHERE u.id = v_target_id
    AND u.auth_user_id = v_uid::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification failed after claiming profile' USING ERRCODE = 'P0004';
  END IF;
END;
$$;

-- Dedicated RPC for username resolution
CREATE OR REPLACE FUNCTION public.resolve_login_email_by_username(p_username text)
RETURNS TABLE (email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized_username TEXT := lower(trim(p_username));
  v_count INT;
  v_email TEXT;
BEGIN
  -- 1. Find matches
  SELECT count(*), min(u.email)
  INTO v_count, v_email
  FROM public.users u
  WHERE lower(trim(u.username)) = v_normalized_username
    AND u.active = true
    AND u.email IS NOT NULL
    AND u.email != '';

  -- 2. Reject if no match or ambiguous
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No active user found with username %', p_username USING ERRCODE = 'P0002';
  END IF;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'Ambiguous user match for username %', p_username USING ERRCODE = 'P0003';
  END IF;

  -- 3. Return email only
  RETURN QUERY SELECT v_email;
END;
$$;

-- Restrict RPC execution
REVOKE ALL ON FUNCTION public.claim_authenticated_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_authenticated_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_authenticated_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_authenticated_user_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_authenticated_user_profile() TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_login_email_by_username(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_login_email_by_username(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email_by_username(text) TO anon;

-- 2. Revoke anonymous access to ensure secure boundary
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Add partial unique index for active auth identities to guarantee uniqueness at database level
CREATE UNIQUE INDEX IF NOT EXISTS users_active_auth_user_id_uidx
ON public.users (auth_user_id)
WHERE active = true
AND auth_user_id IS NOT NULL;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. Enable RLS on all core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. public.users Policies
DROP POLICY IF EXISTS "Auth_Read_Users" ON public.users;
CREATE POLICY "Auth_Read_Users" ON public.users FOR SELECT TO authenticated 
USING (
  auth_user_id = auth.uid()::text 
  OR public.get_auth_role() = 'Administrator'
);

DROP POLICY IF EXISTS "Admin_Insert_Users" ON public.users;
CREATE POLICY "Admin_Insert_Users" ON public.users FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() = 'Administrator');

DROP POLICY IF EXISTS "Admin_Update_Users" ON public.users;
CREATE POLICY "Admin_Update_Users" ON public.users FOR UPDATE TO authenticated 
USING (public.get_auth_role() = 'Administrator')
WITH CHECK (public.get_auth_role() = 'Administrator');

DROP POLICY IF EXISTS "Admin_Delete_Users" ON public.users;
CREATE POLICY "Admin_Delete_Users" ON public.users FOR DELETE TO authenticated 
USING (public.get_auth_role() = 'Administrator');

-- 5. Master Data Policies (Admin/IT Write, Authenticated Read for general taxonomy)
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['departments', 'locations', 'asset_types']) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Auth_Read_%I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Auth_Read_%I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Admin_IT_Insert_%I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admin_IT_Insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_auth_role() IN (''Administrator'', ''IT User''))', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Admin_IT_Update_%I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admin_IT_Update_%I" ON public.%I FOR UPDATE TO authenticated USING (public.get_auth_role() IN (''Administrator'', ''IT User''))', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Admin_IT_Delete_%I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admin_IT_Delete_%I" ON public.%I FOR DELETE TO authenticated USING (public.get_auth_role() IN (''Administrator'', ''IT User''))', t, t);
    END LOOP;
END $$;

-- Contractors: Explicit restricted access (Admin, IT User, Viewer)
DROP POLICY IF EXISTS "Auth_Read_contractors" ON public.contractors;
CREATE POLICY "Auth_Read_contractors" ON public.contractors FOR SELECT TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer'));

DROP POLICY IF EXISTS "Admin_IT_Insert_contractors" ON public.contractors;
CREATE POLICY "Admin_IT_Insert_contractors" ON public.contractors FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_contractors" ON public.contractors;
CREATE POLICY "Admin_IT_Update_contractors" ON public.contractors FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_contractors" ON public.contractors;
CREATE POLICY "Admin_IT_Delete_contractors" ON public.contractors FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- Projects: Explicit restricted access (Admin, IT User, Viewer)
DROP POLICY IF EXISTS "Auth_Read_projects" ON public.projects;
CREATE POLICY "Auth_Read_projects" ON public.projects FOR SELECT TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer'));

DROP POLICY IF EXISTS "Admin_IT_Insert_projects" ON public.projects;
CREATE POLICY "Admin_IT_Insert_projects" ON public.projects FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_projects" ON public.projects;
CREATE POLICY "Admin_IT_Update_projects" ON public.projects FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_projects" ON public.projects;
CREATE POLICY "Admin_IT_Delete_projects" ON public.projects FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- Project Tasks: Explicit restricted access (Admin, IT User, Viewer)
DROP POLICY IF EXISTS "Auth_Read_project_tasks" ON public.project_tasks;
CREATE POLICY "Auth_Read_project_tasks" ON public.project_tasks FOR SELECT TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer'));

DROP POLICY IF EXISTS "Admin_IT_Insert_project_tasks" ON public.project_tasks;
CREATE POLICY "Admin_IT_Insert_project_tasks" ON public.project_tasks FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_project_tasks" ON public.project_tasks;
CREATE POLICY "Admin_IT_Update_project_tasks" ON public.project_tasks FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_project_tasks" ON public.project_tasks;
CREATE POLICY "Admin_IT_Delete_project_tasks" ON public.project_tasks FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- Licenses: Explicit restricted access (Admin, IT User, Viewer)
DROP POLICY IF EXISTS "Auth_Read_licenses" ON public.licenses;
CREATE POLICY "Auth_Read_licenses" ON public.licenses FOR SELECT TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer'));

DROP POLICY IF EXISTS "Admin_IT_Insert_licenses" ON public.licenses;
CREATE POLICY "Admin_IT_Insert_licenses" ON public.licenses FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_licenses" ON public.licenses;
CREATE POLICY "Admin_IT_Update_licenses" ON public.licenses FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_licenses" ON public.licenses;
CREATE POLICY "Admin_IT_Delete_licenses" ON public.licenses FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- Offices: Explicit restricted access
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth_Read_offices" ON public.offices;
CREATE POLICY "Auth_Read_offices" ON public.offices FOR SELECT TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer'));

DROP POLICY IF EXISTS "Admin_IT_Insert_offices" ON public.offices;
CREATE POLICY "Admin_IT_Insert_offices" ON public.offices FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_offices" ON public.offices;
CREATE POLICY "Admin_IT_Update_offices" ON public.offices FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_offices" ON public.offices;
CREATE POLICY "Admin_IT_Delete_offices" ON public.offices FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- System Settings: Admin write only
DROP POLICY IF EXISTS "Auth_Read_system_settings" ON public.system_settings;
CREATE POLICY "Auth_Read_system_settings" ON public.system_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin_Insert_system_settings" ON public.system_settings;
CREATE POLICY "Admin_Insert_system_settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.get_auth_role() = 'Administrator');

DROP POLICY IF EXISTS "Admin_Update_system_settings" ON public.system_settings;
CREATE POLICY "Admin_Update_system_settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.get_auth_role() = 'Administrator');

DROP POLICY IF EXISTS "Admin_Delete_system_settings" ON public.system_settings;
CREATE POLICY "Admin_Delete_system_settings" ON public.system_settings FOR DELETE TO authenticated USING (public.get_auth_role() = 'Administrator');

-- 6. public.employees Policies
DROP POLICY IF EXISTS "Auth_Read_Employees" ON public.employees;
CREATE POLICY "Auth_Read_Employees" ON public.employees FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Admin_IT_Insert_Employees" ON public.employees;
CREATE POLICY "Admin_IT_Insert_Employees" ON public.employees FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_Employees" ON public.employees;
CREATE POLICY "Admin_IT_Update_Employees" ON public.employees FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_Employees" ON public.employees;
CREATE POLICY "Admin_IT_Delete_Employees" ON public.employees FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- 7. public.assets Policies (CRITICAL: Employee CANNOT update assets)
DROP POLICY IF EXISTS "Auth_Read_Assets" ON public.assets;
CREATE POLICY "Auth_Read_Assets" ON public.assets FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR current_employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Admin_IT_Insert_Assets" ON public.assets;
CREATE POLICY "Admin_IT_Insert_Assets" ON public.assets FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

-- Removed Employee update capability on assets
DROP POLICY IF EXISTS "Admin_IT_Update_Assets" ON public.assets;
DROP POLICY IF EXISTS "Admin_IT_Employee_Update_Assets" ON public.assets;
CREATE POLICY "Admin_IT_Update_Assets" ON public.assets FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_Assets" ON public.assets;
CREATE POLICY "Admin_IT_Delete_Assets" ON public.assets FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- 8. public.asset_transactions Policies (CRITICAL: Employee CANNOT insert/modify asset transactions)
DROP POLICY IF EXISTS "Auth_Read_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Auth_Read_AssetTransactions" ON public.asset_transactions FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR to_employee_id = public.get_auth_employee_id()
  OR from_employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Admin_IT_Insert_AssetTransactions" ON public.asset_transactions;
DROP POLICY IF EXISTS "Admin_IT_Employee_Insert_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Admin_IT_Insert_AssetTransactions" ON public.asset_transactions FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Admin_IT_Update_AssetTransactions" ON public.asset_transactions FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Admin_IT_Delete_AssetTransactions" ON public.asset_transactions FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- 9. Operational Tables (maintenance, warehouse_issues, asset_transfers) - Employee NO Write
DROP POLICY IF EXISTS "Auth_Read_maintenance" ON public.maintenance;
CREATE POLICY "Auth_Read_maintenance" ON public.maintenance FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR asset_id IN (SELECT id FROM public.assets WHERE current_employee_id = public.get_auth_employee_id())
);

DROP POLICY IF EXISTS "Admin_IT_Insert_maintenance" ON public.maintenance;
CREATE POLICY "Admin_IT_Insert_maintenance" ON public.maintenance FOR INSERT TO authenticated WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_maintenance" ON public.maintenance;
CREATE POLICY "Admin_IT_Update_maintenance" ON public.maintenance FOR UPDATE TO authenticated USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_maintenance" ON public.maintenance;
CREATE POLICY "Admin_IT_Delete_maintenance" ON public.maintenance FOR DELETE TO authenticated USING (public.get_auth_role() IN ('Administrator', 'IT User'));


DROP POLICY IF EXISTS "Auth_Read_warehouse_issues" ON public.warehouse_issues;
CREATE POLICY "Auth_Read_warehouse_issues" ON public.warehouse_issues FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR it_employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Admin_IT_Insert_warehouse_issues" ON public.warehouse_issues;
CREATE POLICY "Admin_IT_Insert_warehouse_issues" ON public.warehouse_issues FOR INSERT TO authenticated WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_warehouse_issues" ON public.warehouse_issues;
CREATE POLICY "Admin_IT_Update_warehouse_issues" ON public.warehouse_issues FOR UPDATE TO authenticated USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_warehouse_issues" ON public.warehouse_issues;
CREATE POLICY "Admin_IT_Delete_warehouse_issues" ON public.warehouse_issues FOR DELETE TO authenticated USING (public.get_auth_role() IN ('Administrator', 'IT User'));


DROP POLICY IF EXISTS "Auth_Read_asset_transfers" ON public.asset_transfers;
CREATE POLICY "Auth_Read_asset_transfers" ON public.asset_transfers FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR asset_id IN (SELECT id FROM public.assets WHERE current_employee_id = public.get_auth_employee_id())
);

DROP POLICY IF EXISTS "Admin_IT_Insert_asset_transfers" ON public.asset_transfers;
CREATE POLICY "Admin_IT_Insert_asset_transfers" ON public.asset_transfers FOR INSERT TO authenticated WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_asset_transfers" ON public.asset_transfers;
CREATE POLICY "Admin_IT_Update_asset_transfers" ON public.asset_transfers FOR UPDATE TO authenticated USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_asset_transfers" ON public.asset_transfers;
CREATE POLICY "Admin_IT_Delete_asset_transfers" ON public.asset_transfers FOR DELETE TO authenticated USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- 10. Helpdesk Requests Policies
DROP POLICY IF EXISTS "Auth_Read_helpdesk_requests" ON public.helpdesk_requests;
CREATE POLICY "Auth_Read_helpdesk_requests" ON public.helpdesk_requests FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Insert_helpdesk_requests" ON public.helpdesk_requests;
CREATE POLICY "Auth_Insert_helpdesk_requests" ON public.helpdesk_requests FOR INSERT TO authenticated 
WITH CHECK (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Update_helpdesk_requests" ON public.helpdesk_requests;
CREATE POLICY "Auth_Update_helpdesk_requests" ON public.helpdesk_requests FOR UPDATE TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Delete_helpdesk_requests" ON public.helpdesk_requests;
CREATE POLICY "Auth_Delete_helpdesk_requests" ON public.helpdesk_requests FOR DELETE TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
);

-- 11. Notifications Policies (Removed open WITH CHECK (true) write hole)
DROP POLICY IF EXISTS "Auth_Read_notifications" ON public.notifications;
CREATE POLICY "Auth_Read_notifications" ON public.notifications FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin_IT_Insert_notifications" ON public.notifications;
CREATE POLICY "Auth_Insert_notifications" ON public.notifications FOR INSERT TO authenticated 
WITH CHECK (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Update_notifications" ON public.notifications;
CREATE POLICY "Auth_Update_notifications" ON public.notifications FOR UPDATE TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Delete_notifications" ON public.notifications;
CREATE POLICY "Auth_Delete_notifications" ON public.notifications FOR DELETE TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
);

COMMIT;
