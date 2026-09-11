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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    department_id TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Asset Types Table
CREATE TABLE IF NOT EXISTS public.asset_types (
    id TEXT PRIMARY KEY,
    code TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    has_tech_specs BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'Active',
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
    progress NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Application users are provisioned by an administrator; no default accounts
-- are inserted by the application.
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    full_name_ar TEXT,
    full_name_en TEXT,
    role TEXT NOT NULL DEFAULT 'Viewer',
    employee_id TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fields used by the warehouse handoff and installation workflow.
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS installation_date TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS installed_by TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS office TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS handover_status TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS assignment_date TEXT;

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS location_id TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS branch_id TEXT;

ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS installed_branch_id TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS installed_department_id TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS installed_office TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS receiving_employee TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS end_user_id TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS installation_status TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS installation_notes TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS delivery_date TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS administration TEXT;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS office_name TEXT;

-- A physical asset can have only one active warehouse handoff at a time.
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
-- Hierarchical integrity additions: offices & mandatory department<->location relationship
-- ========================================================================

-- Add department linkage on locations (so an office location can reference its parent department)
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS department_id TEXT;

-- Add office reference on employees (employee must belong to an office location)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS office_id TEXT;

-- Backfill departments.location_id for existing rows to a default 'loc-main' if missing
UPDATE public.departments SET location_id = 'loc-main' WHERE location_id IS NULL;

-- Ensure at least one location 'loc-main' exists to satisfy default backfill (create it if missing)
INSERT INTO public.locations (id, code, name_ar, name_en, type, parent_id, created_at)
SELECT 'loc-main','HQ','المكتب الرئيسي - افتراضي','Main Office - Default','site', NULL, NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.locations WHERE id = 'loc-main');

-- Make department.location_id mandatory (non-nullable)
ALTER TABLE public.departments ALTER COLUMN location_id SET NOT NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS departments_location_idx ON public.departments (location_id);
CREATE INDEX IF NOT EXISTS employees_office_idx ON public.employees (office_id);
CREATE INDEX IF NOT EXISTS locations_department_idx ON public.locations (department_id);

-- Add foreign key constraint from departments.location_id -> locations.id
ALTER TABLE public.departments
    ADD CONSTRAINT IF NOT EXISTS departments_location_fk FOREIGN KEY (location_id)
    REFERENCES public.locations(id) ON DELETE RESTRICT;

-- Add foreign key from employees.office_id -> locations.id (office locations)
ALTER TABLE public.employees
    ADD CONSTRAINT IF NOT EXISTS employees_office_fk FOREIGN KEY (office_id)
    REFERENCES public.locations(id) ON DELETE SET NULL;

-- Note: We avoid adding a strict FK from locations.department_id -> departments.id to prevent circular dependency
-- Instead locations.department_id is used to tag office locations with their owning department (enforced at app level)

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

DROP POLICY IF EXISTS "Allow all operations for anon" ON public.departments;
CREATE POLICY "Allow all operations for anon" ON public.departments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.locations;
CREATE POLICY "Allow all operations for anon" ON public.locations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.employees;
CREATE POLICY "Allow all operations for anon" ON public.employees FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.asset_types;
CREATE POLICY "Allow all operations for anon" ON public.asset_types FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.assets;
CREATE POLICY "Allow all operations for anon" ON public.assets FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.maintenance;
CREATE POLICY "Allow all operations for anon" ON public.maintenance FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.asset_transactions;
CREATE POLICY "Allow all operations for anon" ON public.asset_transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.system_settings;
CREATE POLICY "Allow all operations for anon" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.warehouse_issues;
CREATE POLICY "Allow all operations for anon" ON public.warehouse_issues FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.asset_transfers;
CREATE POLICY "Allow all operations for anon" ON public.asset_transfers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.contractors;
CREATE POLICY "Allow all operations for anon" ON public.contractors FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.projects;
CREATE POLICY "Allow all operations for anon" ON public.projects FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.project_tasks;
CREATE POLICY "Allow all operations for anon" ON public.project_tasks FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.licenses;
CREATE POLICY "Allow all operations for anon" ON public.licenses FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.users;
CREATE POLICY "Allow all operations for anon" ON public.users FOR ALL USING (true) WITH CHECK (true);

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
        'users'
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
