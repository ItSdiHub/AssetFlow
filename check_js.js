const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const dbContent = fs.readFileSync('js/db.js', 'utf8');
const urlMatch = dbContent.match(/url:\s*["']([^"']+)["']/);
const keyMatch = dbContent.match(/anonKey:\s*["']([^"']+)["']/);
const url = urlMatch[1];
const key = keyMatch[1];

const supabase = createClient(url, key);

async function run() {
    const coreTables = ["assets", "employees", "departments", "locations", "asset_types", "maintenance"];
    for (const table of coreTables) {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) {
          console.log("Error on table", table, error);
      } else {
          console.log("Success on table", table);
      }
    }
}
run();
