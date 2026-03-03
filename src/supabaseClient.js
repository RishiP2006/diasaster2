// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// HARDCODE THESE JUST FOR THIS TEST
const supabaseUrl = 'https://gbttxpvdtgmyjkfydcim.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdidHR4cHZkdGdteWprZnlkY2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDE0NjksImV4cCI6MjA4NzUxNzQ2OX0.05Ax9SmEMsdDzp1P8Vl4-b9Oi0nI6wf1Cpl07Lz1nBQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)