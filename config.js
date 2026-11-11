/* Pocket Pair settings. The URL and the anon key are meant to be public:
   the database rules (row level security) are what keep your data private. */
window.PAIR_CONFIG = {
  supabaseUrl: 'https://xxjmzvijvfcymuyownnq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4am16dmlqdmZjeW11eW93bm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNDYwODMsImV4cCI6MjEwOTkyMjA4M30.NDjMtoWHtDFzDpfKsvXeuLL9MBZIUZlCBlg54Aq21II',
  // public half of the push key; the private half stays in the database
  vapidPublicKey: 'BOdqxrBKDa4JrJJFj7EeBaMXzTytZowsfGOlJCPqrWwdfZK3vyUqhEY9o__JHlzBFqBfCidN8-qTptnlKEmF4j4'
};
