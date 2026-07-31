// ============================================================
// POST /api/create-staff
// শুধু owner staff account তৈরি করতে পারবে।
// body: { full_name, email, password }
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

  // requester owner কিনা যাচাই
  const { data: requesterProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, shop_id")
    .eq("id", user.id)
    .single();

  if (profileError || !requesterProfile || requesterProfile.role !== "owner") {
    return res
      .status(403)
      .json({ error: "শুধু owner নতুন স্টাফ যোগ করতে পারবে" });
  }

  const { full_name, email, password } = req.body || {};
  if (!full_name || !email || !password) {
    return res
      .status(400)
      .json({ error: "নাম, ইমেইল, পাসওয়ার্ড — সবগুলো লাগবে" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে" });
  }

  let createdUserId = null;

  try {
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError) throw createError;
    createdUserId = newUser.user.id;

    const { error: insertError } = await supabaseAdmin.from("profiles").insert({
      id: newUser.user.id,
      shop_id: requesterProfile.shop_id,
      full_name,
      role: "staff",
    });
    if (insertError) {
      // profile insert ফেইল করলে তৈরি হওয়া auth user টা রোলব্যাক করে দাও
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw insertError;
    }

    return res.status(200).json({ success: true, user_id: newUser.user.id });
  } catch (err) {
    const msg = String(err.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return res
        .status(400)
        .json({ error: "এই ইমেইল দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে" });
    }
    return res
      .status(500)
      .json({ error: err.message || "স্টাফ তৈরি করতে সমস্যা হয়েছে" });
  }
}
