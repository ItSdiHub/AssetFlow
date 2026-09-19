/**
 * SDI IT Asset Hub / AssetFlow - Controlled Offices Schema Repair
 * 
 * Target:
 * 1. Create public.offices table with location_id & department_id FKs (ON DELETE RESTRICT)
 * 2. Create performance indexes: offices_location_idx, offices_department_idx
 * 3. Add employees.office_id TEXT NULL referencing public.offices(id) ON DELETE SET NULL
 * 4. Create index: employees_office_idx
 * 5. Add assets.office_id TEXT NULL referencing public.offices(id) ON DELETE SET NULL
 * 6. Create index: assets_office_id_idx
 * 7. Enable RLS on public.offices and set 4 CRUD policies:
 *    - Auth_Read_offices (SELECT for Administrator, IT User, Viewer)
 *    - Admin_IT_Insert_offices (INSERT for Administrator, IT User)
 *    - Admin_IT_Update_offices (UPDATE for Administrator, IT User)
 *    - Admin_IT_Delete_offices (DELETE for Administrator, IT User)
 * 
 * Safety:
 * - NO DROP TABLE / DATA LOSS
 * - NO DATA MIGRATION OR POPULATION OF OFFICES
 * - Preserves legacy assets.office column
 */

BEGIN;

-- 1. Create public.offices table if it does not exist
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

-- 2. Create required indexes for offices
CREATE INDEX IF NOT EXISTS offices_location_idx ON public.offices (location_id);
CREATE INDEX IF NOT EXISTS offices_department_idx ON public.offices (department_id);

-- 3. Safely add employees.office_id column and foreign key constraint
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS office_id TEXT NULL;

ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_office_fk;

ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_office_id_fkey;

ALTER TABLE public.employees
    ADD CONSTRAINT employees_office_fk FOREIGN KEY (office_id)
    REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_office_idx ON public.employees (office_id);

-- 4. Safely add assets.office_id column and foreign key constraint (preserving legacy assets.office)
ALTER TABLE public.assets
    ADD COLUMN IF NOT EXISTS office_id TEXT NULL;

ALTER TABLE public.assets
    DROP CONSTRAINT IF EXISTS assets_office_fk;

ALTER TABLE public.assets
    DROP CONSTRAINT IF EXISTS assets_office_id_fkey;

ALTER TABLE public.assets
    ADD CONSTRAINT assets_office_fk FOREIGN KEY (office_id)
    REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assets_office_id_idx ON public.assets (office_id);

-- 5. Enable Row Level Security and configure explicit policies on public.offices
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

COMMIT;
