import { createClient } from "@supabase/supabase-js";

// Publishable key: safe to ship in browser code. Access is enforced by RLS.
export const SUPABASE_URL = "https://ewkeozftinyhokmynrix.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bFm6iBRuD_pbhRrFy9J8Yg_FTIJlxmq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: typeof window !== "undefined" },
});
