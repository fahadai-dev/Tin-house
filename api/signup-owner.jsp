// ============================================================
// POST /api/signup-owner
// নতুন দোকান + মালিক অ্যাকাউন্ট তৈরি করে।
// ⚠️ এই এন্ডপয়েন্ট সুরক্ষিত — সঠিক admin_code ছাড়া কেউ দোকান
// তৈরি করতে পারবে না। শুধু ডেভেলপার (আপনি) admin-create-shop.html
// পেজ থেকে এই কোড দিয়ে দোকান তৈরি করবেন। ক্লায়েন্ট/স্টাফরা কখনো
// এই কোড জানবে না।
// body: { admin_code, shop_name, full_name, email, password }
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
 
 const { admin_code, shop_name, full_name, email, password } = req.body || {};
 
 // ------------------------------------------------------------
 // সবচেয়ে গুরুত্বপূর্ণ যাচাই: গোপন admin_code সঠিক কিনা।
 // ADMIN_SIGNUP_CODE Vercel-এর Environment Variables-এ সেট করতে হবে।
 // ------------------------------------------------------------
 if (!process.env.ADMIN_SIGNUP_CODE) {
 return res
 .status(500)
 .json({ error: "সার্ভারে ADMIN_SIGNUP_CODE সেট করা নেই — Vercel Environment Variables চেক করুন" });
 }
 if (!admin_code || admin_code !== process.env.ADMIN_SIGNUP_CODE) {
 return res.status(403).json({ error: "অ্যাডমিন কোড সঠিক নয়" });
 }
 
 if (!shop_name || !full_name || !email || !password) {
 return res
 .status(400)
 .json({ error: "দোকানের নাম, আপনার নাম, ইমেইল, পাসওয়ার্ড — সবগুলো লাগবে" });
 }
 if (password.length < 6) {
 return res
 .status(400)
 .json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে" });
 }
 
 let createdShopId = null;
 let createdUserId = null;
 
 try {
 // ১) shop তৈরি
 const { data: shop, error: shopError } = await supabaseAdmin
 .from("shops")
 .insert({ name: shop_name })
 .select()
 .single();
 if (shopError) throw shopError;
 createdShopId = shop.id;
 
 // ২) auth user তৈরি (ইমেইল আগে থেকেই কনফার্ম করা, যাতে সাথে সাথেই লগইন করা যায়)
 const { data: newUser, error: createError } =
 await supabaseAdmin.auth.admin.createUser({
 email,
 password,
 email_confirm: true,
 });
 if (createError) throw createError;
 createdUserId = newUser.user.id;
 
 // ৩) owner profile তৈরি
 const { error: insertError } = await supabaseAdmin.from("profiles").insert({
 id: newUser.user.id,
 shop_id: shop.id,
 full_name,
 role: "owner",
 });
 if (insertError) throw insertError;
 
 // ৪) খালি shop_data রো তৈরি (index.html প্রথমবার লোড হলে ডিফল্ট ডেমো ডেটা নিজেই বসিয়ে নেবে)
 const { error: dataError } = await supabaseAdmin.from("shop_data").insert({
 shop_id: shop.id,
 data: {},
 });
 if (dataError) throw dataError;
 
 return res.status(200).json({ success: true, shop_id: shop.id });
 } catch (err) {
 // কোনো ধাপে ব্যর্থ হলে আগের তৈরি হওয়া অংশগুলো রোলব্যাক করে দাও
 if (createdUserId) {
 await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
 }
 if (createdShopId) {
 try { await supabaseAdmin.from("shops").delete().eq("id", createdShopId); } catch (e2) {}
 }
 const msg = String(err.message || "").toLowerCase();
 if (msg.includes("already") || msg.includes("registered")) {
 return res.status(400).json({ error: "এই ইমেইল দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে" });
 }
 return res
 .status(500)
 .json({ error: err.message || "দোকান তৈরি করতে সমস্যা হয়েছে" });
 }
}
 