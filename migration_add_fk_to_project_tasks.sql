ALTER TABLE public.project_tasks
ADD CONSTRAINT IF NOT EXISTS project_tasks_project_id_fk 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
