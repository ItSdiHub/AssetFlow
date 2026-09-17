ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
