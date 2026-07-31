// ============================================================
// POST /api/reset-password
// owner অন্য স্টাফের পাসওয়ার্ড রিসেট করতে পারবে।
// body: { staff_id, new_password }
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
    return res
      .status(403)
      .json({ error: "শুধু owner পাসওয়ার্ড রিসেট করতে পারবে" });
  }

  const { staff_id, new_password } = req.body || {};
  if (!staff_id || !new_password) {
    return res.status(400).json({ error: "staff_id ও নতুন পাসওয়ার্ড লাগবে" });
  }
  if (new_password.length < 6) {
    return res
      .status(400)
      .json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে" });
  }

  // টার্গেট স্টাফ একই shop-এর কিনা যাচাই — অন্য shop-এর স্টাফের পাসওয়ার্ড বদলানো ঠেকাতে
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(staff_id, {
      password: new_password,
    });
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "পাসওয়ার্ড রিসেট করতে সমস্যা হয়েছে" });
  }
}
