import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://urcfjbhhcklhmnglqsnj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyY2ZqYmhoY2tsaG1uZ2xxc25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTc4ODAsImV4cCI6MjA2NTc3Mzg4MH0.dImAZyN5Z-jVilyUxNH2nfGYVAftPFLqQmXM_5QA_54';
export const supabase = createClient(supabaseUrl, supabaseKey); 