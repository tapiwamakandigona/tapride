import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bswikdlxlutpdaweuohi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzd2lrZGx4bHV0cGRhd2V1b2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTYyNDcsImV4cCI6MjA5MDI5MjI0N30.mJbDz032jCBt-gU04A4XXTnXSfyr-Xog6CQiPzuFjzk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
