// ============================================================
// টিন হাউস — পাবলিক Supabase কনফিগারেশন
// এখানে শুধু URL ও anon key থাকে — এগুলো ব্রাউজারে প্রকাশ পেলেও
// সমস্যা নেই (anon key পাবলিক হওয়ার জন্যই বানানো, RLS দিয়ে সুরক্ষিত)।
// service role key কখনোই এখানে বা কোনো ফ্রন্টএন্ড ফাইলে বসাবেন না —
// সেটা শুধু Vercel-এর Environment Variables-এ থাকবে (api/ ফোল্ডারের জন্য)।
// ============================================================
const SUPABASE_URL = "https://qbmdmgprdkbeleceodww.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibWRtZ3ByZGtiZWxlY2VvZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODczMTYsImV4cCI6MjEwMTA2MzMxNn0.CFdqWSmhfDhPnpG5nUJ5kv9OepfCZDUqaOWgoAb3PFI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "tinhouse-auth",
  },
});
