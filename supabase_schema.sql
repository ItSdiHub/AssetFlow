-- ========================================================================
-- SDI IT Asset Hub - Supabase Cloud Database Schema (PostgreSQL)
-- Compatible with IndexedDB Version 5 Schema & Helpdesk Service Portal
-- ========================================================================

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    manager_name TEXT,
    location_id TEXT,
    branch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Locations Table (Hierarchical Tree: Building -> Floor -> Room)
CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    type TEXT,
    parent_id TEXT,
    department_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2b. Offices Table (Master Data: Location -> Department -> Office)
CREATE TABLE IF NOT EXISTS public.offices (
    id TEXT PRIMARY KEY,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    status TEXT DEFAULT 'Active',
    location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offices_location_idx ON public.offices (location_id);
CREATE INDEX IF NOT EXISTS offices_department_idx ON public.offices (department_id);

-- 3. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    employee_number TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    department_id TEXT,
    office_id TEXT,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Asset Types Table
CREATE TABLE IF NOT EXISTS public.asset_types (
    id TEXT PRIMARY KEY,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    has_tech_specs BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Assets Table
CREATE TABLE IF NOT EXISTS public.assets (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    asset_type_id TEXT,
    brand TEXT,
    model TEXT,
    serial TEXT,
    barcode_value TEXT,
    qr_code_value TEXT,
    status TEXT DEFAULT 'Available',
    department_id TEXT,
    location_id TEXT,
    current_employee_id TEXT,
    purchase_date TEXT,
    warranty_expiry TEXT,
    purchase_cost NUMERIC DEFAULT 0,
    notes TEXT,
    specs JSONB DEFAULT '{}'::jsonb,
    supplier TEXT,
    installation_date TEXT,
    installed_by TEXT,
    project_id TEXT,
    office TEXT,
    office_id TEXT REFERENCES public.offices(id) ON DELETE SET NULL,
    branch_id TEXT,
    condition TEXT,
    handover_status TEXT,
    assignment_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Maintenance & Helpdesk Tickets Table
CREATE TABLE IF NOT EXISTS public.maintenance (
    id TEXT PRIMARY KEY,
    asset_id TEXT,
    problem TEXT NOT NULL,
    action_taken TEXT,
    technician TEXT,
    vendor TEXT,
    maint_date TEXT,
    return_date TEXT,
    cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Open',
    priority TEXT DEFAULT 'Medium',
    reported_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6b. Helpdesk Requests Table
CREATE TABLE IF NOT EXISTS public.helpdesk_requests (
    id TEXT PRIMARY KEY,
    request_number TEXT NOT NULL,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE RESTRICT,
    asset_id TEXT REFERENCES public.assets(id) ON DELETE SET NULL,
    category TEXT DEFAULT 'Hardware',
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'New',
    technician_notes TEXT,
    assigned_to TEXT,
    messages JSONB DEFAULT '[]'::jsonb,
    maintenance_id TEXT REFERENCES public.maintenance(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS helpdesk_requests_employee_idx ON public.helpdesk_requests (employee_id);
CREATE INDEX IF NOT EXISTS helpdesk_requests_asset_idx ON public.helpdesk_requests (asset_id);
CREATE INDEX IF NOT EXISTS helpdesk_requests_status_idx ON public.helpdesk_requests (status);

-- 7. Asset Transactions / History Log
CREATE TABLE IF NOT EXISTS public.asset_transactions (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    from_employee_id TEXT,
    to_employee_id TEXT,
    from_location_id TEXT,
    to_location_id TEXT,
    date TEXT NOT NULL,
    "user" TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. System Branding & Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    system_name_ar TEXT,
    system_name_en TEXT,
    org_name_ar TEXT,
    org_name_en TEXT,
    logo_data_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Warehouse Issues Table (Warehouse -> IT Employee receipt)
CREATE TABLE IF NOT EXISTS public.warehouse_issues (
    id TEXT PRIMARY KEY,
    issue_no TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    warehouse_location_id TEXT NOT NULL,
    it_employee_id TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    project_id TEXT,
    status TEXT DEFAULT 'Issued',
    notes TEXT,
    installed_date TEXT,
    installed_location_id TEXT,
    installed_user_id TEXT,
    installed_branch_id TEXT,
    installed_department_id TEXT,
    installed_office TEXT,
    receiving_employee TEXT,
    end_user_id TEXT,
    installation_status TEXT,
    installation_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_date TEXT,
    site_name TEXT,
    administration TEXT,
    office_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Asset Transfers Table (Location to Location movements)
CREATE TABLE IF NOT EXISTS public.asset_transfers (
    id TEXT PRIMARY KEY,
    transfer_no TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    from_location_id TEXT NOT NULL,
    to_location_id TEXT NOT NULL,
    transfer_date TEXT NOT NULL,
    responsible_employee_id TEXT,
    status TEXT DEFAULT 'Completed',
    condition TEXT DEFAULT 'Working',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Contractors / Vendors Table
CREATE TABLE IF NOT EXISTS public.contractors (
    id TEXT PRIMARY KEY,
    code TEXT,
    company_name_ar TEXT NOT NULL,
    company_name_en TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. IT Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    project_no TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    project_type TEXT DEFAULT 'Infrastructure',
    start_date TEXT NOT NULL,
    planned_end_date TEXT NOT NULL,
    actual_end_date TEXT,
    contractor_id TEXT,
    location_id TEXT,
    responsible_employee_id TEXT,
    progress NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Planning',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Project Tasks Table
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    task_name_ar TEXT NOT NULL,
    task_name_en TEXT,
    description TEXT,
    start_date TEXT,
    due_date TEXT,
    responsible_employee_id TEXT,
    contractor_id TEXT,
    priority TEXT DEFAULT 'Medium',
    progress NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT project_tasks_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 14. Software Licenses Table
CREATE TABLE IF NOT EXISTS public.licenses (
    id TEXT PRIMARY KEY,
    license_no TEXT NOT NULL,
    software_name TEXT NOT NULL,
    vendor TEXT,
    license_key TEXT,
    quantity INTEGER DEFAULT 1,
    assigned_quantity INTEGER DEFAULT 0,
    purchase_date TEXT,
    expiry_date TEXT,
    cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Application Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    full_name_ar TEXT,
    full_name_en TEXT,
    role TEXT NOT NULL DEFAULT 'Viewer',
    employee_id TEXT,
    auth_user_id TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_active_auth_user_id_uidx
ON public.users (auth_user_id)
WHERE active = true
AND auth_user_id IS NOT NULL;

-- Ensure email column exists on existing deployments
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- 16. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    message_ar TEXT NOT NULL,
    message_en TEXT,
    type TEXT DEFAULT 'general',
    related_id TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_employee_idx ON public.notifications (employee_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications (read);

-- ========================================================================
-- MIGRATION: Hierarchical integrity additions: offices & department<->location relationship
-- ========================================================================

-- Step 1: Create indexes for the new columns
CREATE INDEX IF NOT EXISTS departments_location_idx ON public.departments (location_id);
CREATE INDEX IF NOT EXISTS employees_office_idx ON public.employees (office_id);
CREATE INDEX IF NOT EXISTS locations_department_idx ON public.locations (department_id);
CREATE INDEX IF NOT EXISTS employees_employee_number_idx ON public.employees (employee_number);

-- Step 2: Add foreign key constraint from departments.location_id -> locations.id
ALTER TABLE public.departments
    ADD CONSTRAINT IF NOT EXISTS departments_location_fk FOREIGN KEY (location_id)
    REFERENCES public.locations(id) ON DELETE RESTRICT;

-- Step 3: Add foreign key from employees.office_id -> offices.id (standalone offices table)
ALTER TABLE public.employees
    ADD CONSTRAINT IF NOT EXISTS employees_office_fk FOREIGN KEY (office_id)
    REFERENCES public.offices(id) ON DELETE SET NULL;

-- Note: We avoid adding a strict FK from locations.department_id -> departments.id to prevent circular dependency
-- Instead locations.department_id is used to tag office locations with their owning department (enforced at app level)

-- ========================================================================
-- Unique Constraints for Data Integrity
-- ========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS assets_asset_id_unique
ON public.assets (asset_id);

CREATE UNIQUE INDEX IF NOT EXISTS assets_barcode_value_unique
ON public.assets (barcode_value)
WHERE barcode_value IS NOT NULL AND barcode_value <> '';

CREATE UNIQUE INDEX IF NOT EXISTS assets_qr_code_value_unique
ON public.assets (qr_code_value)
WHERE qr_code_value IS NOT NULL AND qr_code_value <> '';

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_issues_issue_no_unique
ON public.warehouse_issues (issue_no);

CREATE UNIQUE INDEX IF NOT EXISTS asset_transfers_transfer_no_unique
ON public.asset_transfers (transfer_no);

CREATE UNIQUE INDEX IF NOT EXISTS projects_project_no_unique
ON public.projects (project_no);

CREATE UNIQUE INDEX IF NOT EXISTS licenses_license_no_unique
ON public.licenses (license_no);

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_issues_one_open_asset_idx
ON public.warehouse_issues (asset_id)
WHERE status IN ('Issued', 'In Transit', 'Awaiting Installation');

-- ========================================================================
-- Enable Row Level Security (RLS) & Allow Anonymous Read/Write with anon key
-- ========================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- Enable Row Level Security (RLS) & Secure Role-Based Access Control (RBAC)
-- ========================================================================

-- 1. Helper Functions for RLS
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

-- Revoke anon access to enforce authentication
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Grant authenticated access
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Drop any previous permissive policies
DO $ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all operations for anon" ON public.%I', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------
-- 1. public.users
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth_Read_Users" ON public.users;
CREATE POLICY "Auth_Read_Users" ON public.users FOR SELECT TO authenticated 
USING (auth_user_id = auth.uid()::text OR public.get_auth_role() = 'Administrator');

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

-- ------------------------------------------------------------------------
-- 2. Master Data Tables (departments, locations, asset_types, system_settings, contractors, projects, project_tasks, licenses)
-- ------------------------------------------------------------------------
DO $ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['departments', 'locations', 'asset_types', 'contractors', 'projects', 'project_tasks', 'licenses']) 
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

-- ------------------------------------------------------------------------
-- 3. public.employees
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 4. public.assets
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth_Read_Assets" ON public.assets;
CREATE POLICY "Auth_Read_Assets" ON public.assets FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR current_employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Admin_IT_Insert_Assets" ON public.assets;
CREATE POLICY "Admin_IT_Insert_Assets" ON public.assets FOR INSERT TO authenticated 
WITH CHECK (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Update_Assets" ON public.assets;

CREATE POLICY "Admin_IT_Update_Assets"
ON public.assets
FOR UPDATE TO authenticated
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
);

DROP POLICY IF EXISTS "Admin_IT_Delete_Assets" ON public.assets;
CREATE POLICY "Admin_IT_Delete_Assets" ON public.assets FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- ------------------------------------------------------------------------
-- 5. public.asset_transactions
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth_Read_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Auth_Read_AssetTransactions" ON public.asset_transactions FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User', 'Viewer')
  OR to_employee_id = public.get_auth_employee_id()
  OR from_employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Admin_IT_Insert_AssetTransactions"
ON public.asset_transactions;

CREATE POLICY "Admin_IT_Insert_AssetTransactions"
ON public.asset_transactions
FOR INSERT TO authenticated
WITH CHECK (
  public.get_auth_role() IN ('Administrator', 'IT User')
);

DROP POLICY IF EXISTS "Admin_IT_Update_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Admin_IT_Update_AssetTransactions" ON public.asset_transactions FOR UPDATE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

DROP POLICY IF EXISTS "Admin_IT_Delete_AssetTransactions" ON public.asset_transactions;
CREATE POLICY "Admin_IT_Delete_AssetTransactions" ON public.asset_transactions FOR DELETE TO authenticated 
USING (public.get_auth_role() IN ('Administrator', 'IT User'));

-- ------------------------------------------------------------------------
-- 6. Operational Tables (maintenance, warehouse_issues, asset_transfers)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 7. public.helpdesk_requests
-- ------------------------------------------------------------------------
ALTER TABLE public.helpdesk_requests ENABLE ROW LEVEL SECURITY;

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


-- ------------------------------------------------------------------------
-- 8. public.notifications
-- ------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth_Read_notifications" ON public.notifications;
CREATE POLICY "Auth_Read_notifications" ON public.notifications FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Insert_notifications"
ON public.notifications;

CREATE POLICY "Admin_IT_Insert_notifications"
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  public.get_auth_role() IN ('Administrator', 'IT User')
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


-- ========================================================================
-- Enable Realtime for Live Instant Helpdesk & Ticket Updates
-- ========================================================================
DO $$
DECLARE
    v_table_name TEXT;
BEGIN
    FOREACH v_table_name IN ARRAY ARRAY[
        'assets',
        'maintenance',
        'employees',
        'locations',
        'departments',
        'system_settings',
        'warehouse_issues',
        'asset_transfers',
        'projects',
        'asset_types',
        'asset_transactions',
        'project_tasks',
        'licenses',
        'users',
        'helpdesk_requests',
        'notifications'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = v_table_name
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                v_table_name
            );
        END IF;
    END LOOP;
END
$$;
