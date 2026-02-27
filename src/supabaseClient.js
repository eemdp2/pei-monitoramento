import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jabyknpbegfaegbyoitb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYnlrbnBiZWdmYWVnYnlvaXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTc4NTQsImV4cCI6MjA4Nzc3Mzg1NH0.h_P0EFclyrgv4MHjERMn3nSPuV8BAivjcT_L9_8SskE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
