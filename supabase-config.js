// supabase-config.js
const SUPABASE_URL = 'https://ymprkjiwhmqlpwixvnxb.supabase.co'; // جایگزین کن
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltcHJraml3aG1xbHB3aXh2bnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzUzMzEsImV4cCI6MjA4MzExMTMzMX0.20eIbVxPIka4PRHVMOATqF0NCLY0m3oix4jmhGptS1Q'; // جایگزین کن

// Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

// تست اتصال
async function testConnection() {
    try {
        const { data, error } = await supabase.from('users').select('count');
        if (error) throw error;
        console.log('✅ اتصال به Supabase موفقیت‌آمیز بود');
        return true;
    } catch (error) {
        console.error('❌ خطا در اتصال به Supabase:', error.message);
        return false;
    }
}

// Export
window.supabaseClient = supabase;
window.testSupabaseConnection = testConnection;
