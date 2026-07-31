// ============================================================
// POST /api/delete-staff
// owner অন্য স্টাফ ডিলিট করতে পারবে (নিজেকে ডিলিট করতে পারবে না)।
// body: { staff_id }
// header: Authorization: Bearer <owner's access_token>
// ============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "শুধু POST মেথড সমর্থিত" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "লগইন টোকেন পাওয়া যায়নি" });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "সেশন সঠিক নয়, আবার লগইন করো" });
  }

  const { data: requesterProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, shop_id")
    .eq("id", user.id)
    .single();

  if (profileError || !requesterProfile || requesterProfile.role !== "owner") {
    return res.status(403).json({ error: "শুধু owner স্টাফ ডিলিট করতে পারবে" });
  }

  const { staff_id } = req.body || {};
  if (!staff_id) {
    return res.status(400).json({ error: "staff_id লাগবে" });
  }
  if (staff_id === user.id) {
    return res.status(400).json({ error: "নিজেকে ডিলিট করা যাবে না" });
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("shop_id")
    .eq("id", staff_id)
    .single();

  if (
    targetError ||
    !targetProfile ||
    targetProfile.shop_id !== requesterProfile.shop_id
  ) {
    return res.status(403).json({ error: "এই স্টাফ তোমার দোকানের নয়" });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(staff_id);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "স্টাফ ডিলিট করতে সমস্যা হয়েছে" });
  }
}
