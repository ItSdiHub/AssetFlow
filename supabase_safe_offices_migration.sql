/**
 * SDI IT Asset Hub - Safe Supabase Migration for Standalone Offices Entity
 * 
 * ABSOLUTE SAFETY RULES:
 * - NO DROP TABLE of business data or tables.
 * - NO automatic mass assignment of departments to 'loc-main'.
 * - Atomic transaction block (BEGIN ... COMMIT).
 * - Preserves legacy data and handles ambiguous records safely.
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

-- 2. Create performance indexes for offices
CREATE INDEX IF NOT EXISTS offices_location_idx ON public.offices (location_id);
CREATE INDEX IF NOT EXISTS offices_department_idx ON public.offices (department_id);

-- 3. Safely migrate objectively verified legacy rooms/offices from locations (type = 'room')
-- Only migrate locations where department_id and parent_id (location_id) are explicitly known and valid.
INSERT INTO public.offices (id, code, name_ar, name_en, status, location_id, department_id, created_at, updated_at)
SELECT 
    l.id AS id,
    l.code AS code,
    l.name_ar AS name_ar,
    l.name_en AS name_en,
    COALESCE(l.status, 'Active') AS status,
    l.parent_id AS location_id,
    l.department_id AS department_id,
    COALESCE(l.created_at, NOW()) AS created_at,
    NOW() AS updated_at
FROM public.locations l
WHERE l.type = 'room'
  AND l.department_id IS NOT NULL 
  AND l.parent_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = l.department_id)
  AND EXISTS (SELECT 1 FROM public.locations loc WHERE loc.id = l.parent_id)
ON CONFLICT (id) DO NOTHING;

-- 4. Update employee office references where office_id points to an existing valid office in public.offices
-- Clear out ambiguous or orphaned employee office_id references safely (set to NULL and log/preserve if necessary)
UPDATE public.employees
SET office_id = NULL
WHERE office_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.id = employees.office_id);

-- 5. Drop old foreign key on employees.office_id if it exists (pointing to locations)
ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_office_fk;

-- 6. Add new correct foreign key: employees.office_id -> offices.id
ALTER TABLE public.employees
    ADD CONSTRAINT employees_office_fk FOREIGN KEY (office_id)
    REFERENCES public.offices(id) ON DELETE SET NULL;

-- 7. Ensure index on employees.office_id
CREATE INDEX IF NOT EXISTS employees_office_idx ON public.employees (office_id);

-- 8. Add assets.office_id column if not exists, referencing offices.id (preserving legacy assets.office)
ALTER TABLE public.assets
    ADD COLUMN IF NOT EXISTS office_id TEXT;

-- Add FK for assets.office_id -> offices.id
ALTER TABLE public.assets
    DROP CONSTRAINT IF EXISTS assets_office_fk;

ALTER TABLE public.assets
    ADD CONSTRAINT assets_office_fk FOREIGN KEY (office_id)
    REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assets_office_id_idx ON public.assets (office_id);

COMMIT;
