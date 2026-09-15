const https = require('https');

const SUPABASE_URL = 'xzfudqyctujxlhbgpdbs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL';

const sql = `
-- 1. Create Helpdesk Requests Table
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

-- 2. Create Notifications Table
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

-- 3. Enable RLS and Setup Policies for Helpdesk Requests
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

-- 4. Enable RLS and Setup Policies for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth_Read_notifications" ON public.notifications;
CREATE POLICY "Auth_Read_notifications" ON public.notifications FOR SELECT TO authenticated 
USING (
  public.get_auth_role() IN ('Administrator', 'IT User')
  OR employee_id = public.get_auth_employee_id()
);

DROP POLICY IF EXISTS "Auth_Insert_notifications" ON public.notifications;
CREATE POLICY "Admin_IT_Insert_notifications" ON public.notifications FOR INSERT TO authenticated 
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

-- 5. Add to Realtime Publication (if needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'helpdesk_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE helpdesk_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
`;

const data = JSON.stringify({ query: sql });

const options = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/', // REST API can't execute raw SQL without RPC function
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  }
};
// We cannot execute raw SQL directly through the REST API without an RPC function setup for it.
console.log("Direct SQL execution requires Service Role Key or active RPC. Must use Supabase UI.");
