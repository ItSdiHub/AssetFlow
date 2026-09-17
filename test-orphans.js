const { createClient } = require('@supabase/supabase-js');
const supabase = createClient("https://xzfudqyctujxlhbgpdbs.supabase.co", "sb_publishable_frNz4FgL329ldYzbHhKrEA_PwiIv7nL");

async function check() {
  const { data: tasks, error: taskError } = await supabase.from('project_tasks').select('id, project_id');
  if (taskError) { console.error("Error fetching tasks:", taskError); return; }
  
  const { data: projects, error: projError } = await supabase.from('projects').select('id');
  if (projError) { console.error("Error fetching projects:", projError); return; }
  
  const projectIds = new Set(projects.map(p => p.id));
  const orphans = tasks.filter(t => !projectIds.has(t.project_id));
  
  console.log("Total tasks:", tasks.length);
  console.log("Total projects:", projects.length);
  console.log("Orphans found:", orphans.length);
  if (orphans.length > 0) {
    console.log("Orphan examples:", orphans.slice(0, 5));
  }
}
check();
