if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.warn("Service worker রেজিস্টার হয়নি:", err));
  });
  let swRefreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swRefreshed) return;
    swRefreshed = true;
    window.location.reload();
  });
}
/* ============================================================
 ডেটা মডেল (Supabase-এ shop_data টেবিলে JSON আকারে সংরক্ষিত হয়)
 ============================================================ */
let BRANDS = ["আকিজ", "পিএইচপি", "কেওয়াই স্টিল", "নাহার", "গ্যালকো"];
let PRODUCT_CATEGORIES = [
  {
    id: "tin",
    name: "টিন",
    icon: "🏠",
    hasBrands: true,
    unitLabel: "মিলিমিটার",
    sizeLabel: "ফুট",
    usesBan: true,
  },
  {
    id: "tua",
    name: "টুয়া",
    icon: "🔩",
    hasBrands: true,
    unitLabel: "পণ্যের নাম",
    sizeLabel: "পরিমাণ",
    usesBan: false,
  },
  {
    id: "plainsheet",
    name: "প্লেন সিট",
    icon: "🧱",
    hasBrands: true,
    unitLabel: "পণ্যের নাম",
    sizeLabel: "পরিমাণ",
    usesBan: false,
  },
  {
    id: "hardware",
    name: "হার্ডওয়্যার",
    icon: "🛠️",
    hasBrands: true,
    unitLabel: "পণ্যের নাম",
    sizeLabel: "পরিমাণ",
    usesBan: false,
  },
  {
    id: "wood",
    name: "কাঠ",
    icon: "🪵",
    hasBrands: true,
    unitLabel: "পণ্যের নাম",
    sizeLabel: "পরিমাণ",
    usesBan: false,
  },
  {
    id: "plasticset",
    name: "প্লাস্টিক সেট",
    icon: "🧴",
    hasBrands: true,
    unitLabel: "পণ্যের নাম",
    sizeLabel: "পরিমাণ",
    usesBan: false,
  },
];
let categoryNextId = 7;
let brandCategory = {}; // ব্র্যান্ডের নাম -> ক্যাটাগরি আইডি
let brandUnitLabel = {}; // ব্র্যান্ডের নাম -> কাস্টম প্রথম-মাপের টাইটেল
let brandSizeLabel = {}; // ব্র্যান্ডের নাম -> কাস্টম দ্বিতীয়-মাপের টাইটেল
function ensureCategoryPseudoBrand(cat) {
  if (cat.hasBrands) return;
  if (!BRANDS.includes(cat.name)) BRANDS.push(cat.name);
  if (!inventory[cat.name]) inventory[cat.name] = {};
  brandCategory[cat.name] = cat.id;
}
function initCategoryPseudoBrands() {
  PRODUCT_CATEGORIES.forEach((cat) => {
    if (!cat.hasBrands) ensureCategoryPseudoBrand(cat);
  });
  BRANDS.forEach((b) => {
    if (!brandCategory[b]) brandCategory[b] = "tin";
  });
}
const SAFE_FALLBACK_CATEGORY = {
  id: "unknown",
  name: "সাধারণ",
  icon: "📦",
  hasBrands: true,
  unitLabel: "পণ্যের নাম",
  sizeLabel: "পরিমাণ",
  usesBan: false,
};
function getCategoryOf(brand) {
  const cid = brandCategory[brand];
  return PRODUCT_CATEGORIES.find((c) => c.id === cid) || SAFE_FALLBACK_CATEGORY;
}
function getBrandLabels(brand) {
  const cat = getCategoryOf(brand);
  return {
    unitLabel: brandUnitLabel[brand] || cat.unitLabel,
    sizeLabel: brandSizeLabel[brand] || cat.sizeLabel,
    qtyMode: cat.qtyMode || "measure",
  };
}
function formatQtyByMode(qtyMode, grams) {
  if (qtyMode === "weight") {
    if (grams >= 1000)
      return (grams / 1000).toFixed(3).replace(/\.?0+$/, "") + " কেজি";
    return grams + " গ্রাম";
  }
  return grams + " পিস";
}
function isWeightBrand(brand) {
  return getBrandLabels(brand).qtyMode === "weight";
}
function isCountBrand(brand) {
  return getBrandLabels(brand).qtyMode === "count";
}
function cartQtyMode(brand) {
  const m = getBrandLabels(brand).qtyMode;
  if (m === "weight") return "weight";
  if (m === "count") return "count";
  return "measure";
}
function baseUnitLabelFor(brand) {
  const cat = getCategoryOf(brand);
  if (cat.usesBan) return "পিস";
  return getBrandLabels(brand).sizeLabel || "";
}
function formatItemQty(brand, qty) {
  if (isWeightBrand(brand)) return formatQtyByMode("weight", qty);
  const unit = baseUnitLabelFor(brand);
  return unit ? `${qty} ${unit}` : String(qty);
}
function itemLabelText(brand, mm, size) {
  if (isWeightBrand(brand)) return " (ওজন অনুযায়ী)";
  const cat = getCategoryOf(brand);
  if (cat.simpleMode) return "";
  const lbl = getBrandLabels(brand);
  const sizeNum = parseFloat(size);
  if (!sizeNum || sizeNum === 0) {
    return ` · ${mm} ${lbl.unitLabel}`;
  }
  return ` · ${mm} ${lbl.unitLabel} · ${size} ${lbl.sizeLabel}`;
}
const MM_LIST = [12, 13, 14, 15, 16, 17, 18, 19, 20];
const SIZE_LIST = [6, 7, 8, 9, 10, 11, 12];
const FEET_PER_BAN = 72; // ৭২ ফুটে এক
const UNIT_OPTIONS = [
  "ফুট",
  "বান",
  "পিস",
  "প্যাকেট",
  "কেজি",
  "গ্রাম",
  "সেট",
  "বক্স",
  "বান্ডেল",
  "রোল",
  "স্কয়ার ফুট",
  "ইঞ্চি",
  "মিটার",
];
function unitSelectHtml(fieldId, currentValue) {
  const cur = currentValue || "";
  const isCustom = cur !== "" && !UNIT_OPTIONS.includes(cur);
  const displayLabel = cur === "" ? "— বাছুন —" : cur;
  const opts = UNIT_OPTIONS.map(
    (u) =>
      `<div class="unit-opt ${cur === u ? "active" : ""}" onclick="unitSelectPick('${fieldId}','${jsq(u)}')">${esc(u)}</div>`,
  ).join("");
  return `
 <div class="unit-picker">
   <button type="button" class="unit-picker-btn" onclick="unitPickerToggle('${fieldId}')">
     <span id="${fieldId}PickerLabel">${esc(displayLabel)}</span><span class="unit-picker-arrow">▾</span>
   </button>
   <div class="unit-picker-list" id="${fieldId}List" style="display:none;">
     ${opts}
     <div class="unit-opt custom ${isCustom ? "active" : ""}" onclick="unitSelectPick('${fieldId}','__custom__')">✏️ নিজে লিখুন (অন্য কিছু)</div>
   </div>
 </div>
 <input type="text" id="${fieldId}" value="${esc(cur)}" placeholder="যেমনঃ প্যাক, বোতল" style="margin-top:8px; ${isCustom || cur === "" ? "" : "display:none;"}">`;
}
function unitPickerToggle(fieldId) {
  document.querySelectorAll(".unit-picker-list").forEach((el) => {
    if (el.id !== fieldId + "List") el.style.display = "none";
  });
  const list = document.getElementById(fieldId + "List");
  if (list)
    list.style.display = list.style.display === "none" ? "block" : "none";
}
function unitSelectPick(fieldId, val) {
  const input = document.getElementById(fieldId);
  const labelEl = document.getElementById(fieldId + "PickerLabel");
  const list = document.getElementById(fieldId + "List");
  if (list) list.style.display = "none";
  if (!input) return;
  if (val === "__custom__") {
    if (labelEl) labelEl.textContent = "✏️ নিজে লিখুন (অন্য কিছু)";
    input.style.display = "";
    input.value = "";
    input.focus();
  } else {
    if (labelEl) labelEl.textContent = val;
    input.style.display = "none";
    input.value = val;
  }
}

function seededRand(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildDemoInventory() {
  let inv = {};
  let seed = 1;
  BRANDS.forEach((brand, bi) => {
    inv[brand] = {};
    MM_LIST.forEach((mm, mi) => {
      const hasIt = seededRand(seed++) > 0.28;
      if (!hasIt) return;
      inv[brand][mm] = {};
      SIZE_LIST.forEach((sz, si) => {
        if (seededRand(seed++) > 0.35) {
          const baseBuy = 380 + mm * 14 + sz * 22 + bi * 9;
          const buy = Math.round(baseBuy / 5) * 5;
          const sell = Math.round((buy * 1.14) / 5) * 5;
          const stock =
            Math.floor(seededRand(seed++) * 40) +
            (seededRand(seed++) > 0.85 ? 0 : 3);
          const banPrice = Math.round((buy * FEET_PER_BAN) / sz);
          inv[brand][mm][sz] = { buy, sell, stock, banPrice };
        }
      });
    });
  });
  return inv;
}

let inventory = {};

let ledger = [];
let ledgerNextId = 1;

let cashCustomers = [];
let cashNextId = 1;

let invoices = [];
let invoiceCounter = 1001;

let payments = [];
let paymentCounter = 1;

let purchases = [];
let purchaseCounter = 1;

let suppliers = [];
let supplierNextId = 1;
let supplierDueEntries = []; // সাপ্লায়ারের কাছ থেকে ক্রয়/বাকি যোগ হওয়ার এন্ট্রি
let supplierDueNextId = 1;
let supplierDetailId = null;
let customerDueEntries = []; // গ্রাহককে ক্যাশ মেমো ছাড়া সরাসরি বাকি দেওয়ার এন্ট্রি
let customerDueNextId = 1;
let cart = [];

let expenseCategories = [
  { id: 1, name: "বেতন", icon: "💰" },
  { id: 2, name: "কেনা", icon: "📦" },
  { id: 3, name: "বিল", icon: "🧾" },
  { id: 4, name: "ভাড়া", icon: "🏠" },
  { id: 5, name: "পরিবহন", icon: "🚚" },
  { id: 6, name: "দোকান খরচ", icon: "🏪" },
  { id: 7, name: "অগ্রিম", icon: "🪙" },
];
let expenseCatNextId = 8;

let expensePeople = [];
let expensePersonNextId = 1;

let expenses = [];
let expenseNextId = 1;
let incomeCategories = [
  { id: 1, name: "ভাড়া আয়", icon: "🏠" },
  { id: 2, name: "কমিশন", icon: "🤝" },
  { id: 3, name: "সুদ", icon: "💹" },
  { id: 4, name: "পুরাতন মাল বিক্রি", icon: "♻️" },
  { id: 5, name: "অন্যান্য আয়", icon: "💰" },
];
let incomeCatNextId = 6;

let incomePeople = []; // { id, name, address, phone }
let incomePersonNextId = 1;

let incomes = []; // { id, date, categoryId, categoryName, personId, personName, personAddress, personPhone, amount, note }
let incomeNextId = 1;

let incomeSearch = "";

let expenseSearch = "";
let expenseTab = "entries";
let expensePersonFilter = null;

let activityLog = [];
let activityLogNextId = 1;
function logActivity(action, detail) {
  activityLog.unshift({
    id: activityLogNextId++,
    date: new Date(),
    staffName: currentUser ? currentUser.full_name : "অজানা",
    action,
    detail: detail || "",
  });
  if (activityLog.length > 500) activityLog.length = 500;
  persistShopData();
}
/* ============================================================
 ট্র্যাশ / রিস্টোর সিস্টেম
 ============================================================ */
function moveToTrash(type, label, detail, data) {
  trashBin.unshift({
    id: trashNextId++,
    type,
    label,
    detail: detail || "",
    data,
    deletedAt: new Date(),
    deletedBy: currentUser ? currentUser.full_name : "অজানা",
  });
  if (trashBin.length > 300) trashBin.length = 300;
}
function trashTypeLabel(type) {
  return (
    {
      stockItem: "📦 স্টক আইটেম",
      brand: "🏷️ ব্র্যান্ড",
      customer: "🧑 গ্রাহক (বাকির খাতা)",
      supplier: "🚚 সাপ্লায়ার",
      employee: "👷 কর্মচারী",
      purchase: "🛒 ক্রয়ের এন্ট্রি",
      expense: "💸 খরচের এন্ট্রি",
      income: "💰 আয়ের এন্ট্রি",
      payment: "🧾 পেমেন্ট রশিদ",
      quickSale: "⚡ দ্রুত বিক্রি",
    }[type] || "🗑️ আইটেম"
  );
}
function restoreFromTrash(trashId) {
  const t = trashBin.find((x) => x.id === trashId);
  if (!t) return;
  const d = t.data;
  if (t.type === "stockItem") {
    if (!inventory[d.brand]) inventory[d.brand] = {};
    if (!inventory[d.brand][d.mm]) inventory[d.brand][d.mm] = {};
    inventory[d.brand][d.mm][d.sz] = d.item;
  } else if (t.type === "brand") {
    if (!BRANDS.includes(d.name)) BRANDS.push(d.name);
    inventory[d.name] = d.inventory;
    brandCategory[d.name] = d.category;
  } else if (t.type === "customer") {
    ledger.push(d);
  } else if (t.type === "supplier") {
    suppliers.push(d);
  } else if (t.type === "employee") {
    expensePeople.push(d);
  } else if (t.type === "purchase") {
    purchases.push(d);
    if (
      inventory[d.brand] &&
      inventory[d.brand][d.mm] &&
      inventory[d.brand][d.mm][d.size]
    ) {
      inventory[d.brand][d.mm][d.size].stock += d.pieces;
    }
  } else if (t.type === "expense") {
    expenses.push(d);
  } else if (t.type === "income") {
    incomes.push(d);
  } else if (t.type === "payment") {
    payments.push(d);
    const cust = ledger.find((l) => l.id === d.custId);
    if (cust) {
      cust.due = Math.max(0, cust.due - d.amount - (d.discount || 0));
      cust.paidTotal = (cust.paidTotal || 0) + d.amount;
    }
  } else if (t.type === "quickSale") {
    quickSales.push(d);
  }
  trashBin = trashBin.filter((x) => x.id !== trashId);
  logActivity(
    "ট্র্যাশ থেকে রিস্টোর করা হয়েছে",
    `${trashTypeLabel(t.type)} · ${t.label}`,
  );
  showToast("✅ ফিরিয়ে আনা হয়েছে");
  render();
  persistShopData();
}
function permanentDeletePrompt(trashId) {
  const t = trashBin.find((x) => x.id === trashId);
  if (!t) return;
  openModal(
    "স্থায়ীভাবে মুছবেন?",
    `<p style="font-size:13.5px;line-height:1.7;">"${esc(t.label)}" ট্র্যাশ থেকেও স্থায়ীভাবে মুছে ফেলা হবে। এরপর আর কোনোভাবেই ফিরিয়ে আনা যাবে না।</p>`,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('স্থায়ীভাবে মুছুন', () => permanentDeleteConfirmed(${trashId}))">হ্যাঁ, স্থায়ীভাবে মুছুন</button>
 `,
  );
}
function permanentDeleteConfirmed(trashId) {
  trashBin = trashBin.filter((x) => x.id !== trashId);
  closeModal();
  render();
  showToast("স্থায়ীভাবে মুছে ফেলা হয়েছে");
  persistShopData();
}
function renderTrash() {
  if (trashBin.length === 0) {
    return `<div class="empty-state"><div class="ic">🗑️</div>ট্র্যাশ খালি<br><span style="font-size:12px;">কোনো কিছু মুছে ফেললে সেটা প্রথমে এখানে জমা থাকবে</span></div>`;
  }
  const rows = trashBin
    .map(
      (t) => `
 <div class="day-tx">
 <div>
 <div class="txname">${trashTypeLabel(t.type)} — ${esc(t.label)}</div>
 <div class="txmeta">${esc(t.detail)}${t.detail ? " · " : ""}${new Date(t.deletedAt).toLocaleString("bn-BD")} · মুছেছেন ${esc(t.deletedBy)}</div>
 </div>
 <div style="display:flex; gap:8px;">
 <button class="btn btn-primary" onclick="restoreFromTrash(${t.id})">♻️ ফিরিয়ে আনুন</button>
 <button class="btn btn-outline" style="color:var(--red);border-color:var(--red);" onclick="permanentDeletePrompt(${t.id})">🗑️ স্থায়ী মুছুন</button>
 </div>
 </div>`,
    )
    .join("");
  return `
 <div style="font-size:12.5px;color:var(--steel-500);margin-bottom:14px;">সর্বশেষ ৩০০টি ডিলিট হওয়া জিনিস এখানে জমা থাকে — যেকোনোটি ফিরিয়ে আনতে পারবেন, অথবা স্থায়ীভাবে মুছে ফেলতে পারবেন</div>
 ${rows}`;
}
let LOW_STOCK_THRESHOLD = 5;

let returns = [];
let returnNextId = 1;

let quickSales = [];
let quickSaleNextId = 1;

let trashBin = [];
let trashNextId = 1;

let currentView = "dashboard";
let lastInvoiceId = null;
let lastPaymentId = null;
function pushBackStep() {
  try {
    history.pushState({ sub: true }, "");
  } catch (e) {}
}
function scrollContentTop() {
  const c = document.getElementById("content");
  if (c) c.scrollTop = 0;
  window.scrollTo(0, 0);
}
let posStep = 0;
let posCategory = null;
let posBrand = null;
let posBrandSearch = "";
let posItemSearch = "";
let stockStep = 0;
let stockCategory = null;
let stockBrand = null;
let stockSearch = "";
let stockAddUnitMode = "ban"; // 'ban' | 'piece'
let invoiceSearch = "";
let ledgerSearch = "";
let ledgerMinDue = "";
let ledgerMaxDue = "";
let ledgerSort = "default"; // 'default' | 'newest' | 'oldest' | 'dueHigh' | 'dueLow'
let cashSearch = "";
let dailySelectedDate = null;
let dailyOverviewPreset = "all"; // 'day' | 'month' | 'year' | 'all'
// বাকির খাতায় কোন গ্রাহকের বিস্তারিত দেখানো হচ্ছে
let ledgerDetailId = null;
let saleCustomerType = "cash"; // 'cash' | 'credit'
let ledgerTab = "due"; // 'due' | 'paid'

let purchaseSearch = "";
let salesLedgerSearch = "";
let salesLedgerPreset = "month"; // 'day' | 'month' | 'year' | 'all'
let salesLedgerAnchor = new Date();
let salesLedgerCatPreset = "month";
let salesLedgerCatAnchor = new Date();
let salesLedgerCatType = "cash";
let salesLedgerCatSearch = "";
let cashboxPreset = "month";
let cashboxFrom = null;
let cashboxTo = null;
let cashboxFilter = "all";

let reportPreset = "month";
let reportFrom = null;
let reportTo = null;
let reportSelectedDay = null;

let profitTab = "monthly";
let profitDrillPath = [];

// কর্মচারী পেজের জন্য — কোন কর্মচারীর বিস্তারিত দেখানো হচ্ছে
let employeeDetailId = null;
// কোন মাসের বেতন হিসাব দেখানো হচ্ছে (YYYY-MM), null হলে চলতি মাস ধরা হবে
let employeeSalaryMonth = null;

// ড্যাশবোর্ডের দিন/মাস টগল
let dashboardPeriod = "day"; // 'day' | 'month'

// শেষ ব্যাকআপের সময় (shop_data এর সাথেই সংরক্ষিত হয়)
let lastBackupAt = null;
// সার্ভারে সর্বশেষ যে ভার্সন পড়া হয়েছিল, তার updated_at — একাধিক ডিভাইস সিঙ্কের জন্য
let lastKnownUpdatedAt = null;

const OWNER_ONLY_VIEWS = [
  "report",
  "profit",
  "staff",
  "settings",
  "aiAssistant",
];

const nav = [
  { id: "dashboard", label: "ড্যাশবোর্ড", icon: "📊" },
  { id: "sales", label: "বিক্রয়", icon: "🧾" },
  { id: "stock", label: "স্টক তালিকা", icon: "📦" },
  { id: "purchaseLedger", label: "কেনার খাতা", icon: "🛒" },
  { id: "salesLedger", label: "বেচার খাতা", icon: "📗" },
  { id: "ledger", label: "বাকির খাতা", icon: "📒" },
  { id: "employees", label: "কর্মচারী", icon: "👷" },
  { id: "suppliers", label: "সাপ্লায়ার", icon: "🚚" },
  { id: "cash", label: "নগদ ক্রেতা", icon: "💵" },
  { id: "income", label: "আয়", icon: "💰" },
  { id: "expenses", label: "খরচ", icon: "💸" },
  { id: "invoices", label: "ক্যাশ মেমো হিস্ট্রি", icon: "🗂️" },
  { id: "returns", label: "রিটার্ন/এক্সচেঞ্জ", icon: "↩️" },
  { id: "daily", label: "দৈনিক হিসাব", icon: "📅" },
  { id: "profit", label: "লাভ-ক্ষতি", icon: "📈" },
  { id: "report", label: "ব্যবসার রিপোর্ট", icon: "📋" },
  { id: "aiAssistant", label: "AI সহকারী", icon: "🤖" },
  { id: "staff", label: "স্টাফ ও লগ", icon: "👥" },
  { id: "trash", label: "রিস্টোর/ট্র্যাশ", icon: "🗑️" },
  { id: "settings", label: "দোকানের তথ্য", icon: "⚙️" },
];

/* ============================================================
 SESSION BOOTSTRAP
 লগইন/সাইনআপ এখন আলাদা login.html পেজে হয় (আসল ইমেইল+পাসওয়ার্ড দিয়ে)।
 এই পেজে ঢোকার সাথে সাথে আগে থেকে লগইন করা আছে কিনা যাচাই করা হয়;
 না থাকলে সরাসরি login.html-এ পাঠিয়ে দেওয়া হয়।
 ============================================================ */
let currentUser = null; // { id, full_name, role, shop_id }
let SHOP_ID = null;
let SHOP_NAME = "আমার দোকান";
let SHOP_PHONE = "";
let SHOP_ADDRESS = "";
let SHOP_EMAIL = "";
let SHOP_LOGO = "";
let SHOP_MOBILE_BANKING_TYPE = ""; // বিকাশ/নগদ/রকেট
let SHOP_MOBILE_BANKING_NUMBER = "";
let staffList = []; // এই দোকানের স্টাফদের তালিকা (owner এর জন্য)

// owner-only সার্ভারলেস API কল করার হেল্পার (/api/create-staff, /api/delete-staff, /api/reset-password)
async function callStaffApi(path, body) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session ? sessionData.session.access_token : null;
  if (!token) throw new Error("সেশন পাওয়া যায়নি, আবার লগইন করুন");
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "সার্ভারে সমস্যা হয়েছে");
  return json;
}

let isOffline = false;
let pendingSync = false;
function cacheKey(suffix) {
  return "tinhouse_" + suffix;
}
function updateOfflineBadge() {
  const el = document.getElementById("offlineBadge");
  if (el) el.classList.toggle("hidden", !isOffline);
}
async function bootstrapApp() {
  const hint = document.getElementById("connStatusHint");
  if (!navigator.onLine) isOffline = true;
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "login.html";
      return;
    }
    const uid = sessionData.session.user.id;

    let profile = null;
    try {
      const { data: profData, error: profErr } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (profErr) throw profErr;
      profile = profData;
      if (profile)
        localStorage.setItem(
          cacheKey("profile_" + uid),
          JSON.stringify(profile),
        );
    } catch (netErr) {
      const cached = localStorage.getItem(cacheKey("profile_" + uid));
      if (cached) {
        profile = JSON.parse(cached);
        isOffline = true;
      }
    }
    if (!profile) {
      hint.textContent = "প্রোফাইল পাওয়া যায়নি, আবার লগইন করুন...";
      await supabaseClient.auth.signOut();
      setTimeout(() => (window.location.href = "login.html"), 800);
      return;
    }

    currentUser = {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      shop_id: profile.shop_id,
      email: sessionData.session.user.email,
    };
    SHOP_ID = profile.shop_id;

    try {
      const { data: shopRow } = await supabaseClient
        .from("shops")
        .select("name")
        .eq("id", SHOP_ID)
        .maybeSingle();
      SHOP_NAME = (shopRow && shopRow.name) || "আমার দোকান";
      localStorage.setItem(cacheKey("shopname_" + SHOP_ID), SHOP_NAME);
    } catch (netErr) {
      SHOP_NAME =
        localStorage.getItem(cacheKey("shopname_" + SHOP_ID)) || "আমার দোকান";
      isOffline = true;
    }

    let shopData = null;
    try {
      const { data: dataRow, error: dataErr } = await supabaseClient
        .from("shop_data")
        .select("data, updated_at")
        .eq("shop_id", SHOP_ID)
        .maybeSingle();
      if (dataErr) throw dataErr;
      shopData = (dataRow && dataRow.data) || {};
      lastKnownUpdatedAt = dataRow ? dataRow.updated_at : null;
      localStorage.setItem(
        cacheKey("data_" + SHOP_ID),
        JSON.stringify(shopData),
      );
    } catch (netErr) {
      const cached = localStorage.getItem(cacheKey("data_" + SHOP_ID));
      if (cached) {
        shopData = JSON.parse(cached);
        isOffline = true;
      } else {
        hint.textContent =
          "দোকানের ডেটা লোড করা যায়নি — ইন্টারনেট সংযোগ পরীক্ষা করুন";
        return;
      }
    }
    applyState(shopData);
    updateShopBrandUI();

    if (currentUser.role === "owner") {
      try {
        await loadStaffList();
      } catch (e) {
        /* অফলাইনে হলে সাইলেন্টলি বাদ */
      }
    }

    document.getElementById("lockScreen").style.display = "none";
    document.getElementById("app").classList.add("active");
    switchView("dashboard", { replace: true });
    updateOfflineBadge();
    showToast(
      isOffline
        ? "📡 অফলাইন মোডে চলছে — শেষ সেভ করা তথ্য দেখানো হচ্ছে"
        : `স্বাগতম, ${currentUser.full_name}`,
    );
  } catch (e) {
    hint.textContent = "সংযোগে সমস্যা হয়েছে — পেজ রিলোড করে আবার চেষ্টা করুন";
  }
}

function bnDigitsToEn(str) {
  const map = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
  };
  return String(str).replace(/[০-৯]/g, (d) => map[d]);
}
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || el.tagName !== "INPUT") return;
  if (["text", "number", "tel", "search"].includes(el.type)) {
    const converted = bnDigitsToEn(el.value);
    if (converted !== el.value) {
      const pos = el.selectionStart;
      el.value = converted;
      try {
        el.setSelectionRange(pos, pos);
      } catch (err) {}
    }
  }
});
function startVoiceSearch(onResult) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast("এই ব্রাউজারে ভয়েস সার্চ সাপোর্ট নেই");
    return;
  }
  const rec = new SR();
  rec.lang = "bn-BD";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  showToast("🎤 বলুন...");
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript.trim();
    if (text) onResult(text);
  };
  rec.onerror = () => {
    showToast("ভয়েস শোনা যায়নি, আবার চেষ্টা করুন");
  };
  try {
    rec.start();
  } catch (err) {
    showToast("ভয়েস সার্চ চালু করা যায়নি");
  }
}
function voiceSearchBrand() {
  startVoiceSearch((text) => posBrandSearchInput(text));
}
function voiceSearchItem() {
  startVoiceSearch((text) => posItemSearchInput(text));
}

document.addEventListener("focusin", (e) => {
  if (e.target && e.target.tagName === "INPUT" && e.target.type === "number") {
    e.target.select();
  }
});

bootstrapApp();

window.addEventListener("online", () => {
  if (isOffline || pendingSync) persistShopData();
});
window.addEventListener("offline", () => {
  isOffline = true;
  updateOfflineBadge();
});

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}
function updateShopBrandUI() {
  const sideEl = document.getElementById("sidebarShopName");
  if (sideEl) sideEl.textContent = SHOP_NAME;
  const nameEl = document.getElementById("topbarShopName");
  if (nameEl) nameEl.textContent = SHOP_NAME;
  const iconEl = document.getElementById("topbarBrandIcon");
  if (iconEl) {
    if (SHOP_LOGO) iconEl.innerHTML = `<img src="${SHOP_LOGO}">`;
    else {
      const initial = (SHOP_NAME || "দ").trim().charAt(0) || "🏪";
      iconEl.textContent = initial;
    }
  }
}

/* ============================================================
 STAFF ম্যানেজমেন্ট — /api সার্ভারলেস ফাংশন দিয়ে (service role key সার্ভারে থাকে, ব্রাউজারে না)
 ============================================================ */
async function loadStaffList() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("shop_id", SHOP_ID)
    .eq("role", "staff")
    .order("created_at", { ascending: true });
  if (!error) staffList = data || [];
}
function addStaffPrompt() {
  openModal(
    "নতুন স্টাফ যুক্ত করুন",
    `
 <div class="field"><label>নাম</label><input type="text" id="staffName" placeholder="যেমনঃ মোঃ রহিম"></div>
 <div class="field"><label>ইমেইল</label><input type="email" id="staffEmail" placeholder="যেমনঃ rahim@example.com"></div>
 <div class="field"><label>পাসওয়ার্ড</label><input type="password" id="staffPassword" placeholder="কমপক্ষে ৬ ক্যারেক্টার"></div>
 <div style="font-size:11.5px;color:var(--steel-500);">স্টাফরা বিক্রয়, স্টক, খাতা ইত্যাদি পরিচালনা করতে পারবেন, কিন্তু "ব্যবসার রিপোর্ট", "লাভ-ক্ষতি", "স্টাফ ও লগ" ও "দোকানের তথ্য" পেজ শুধু আপনি (মালিক) দেখতে পারবেন।</div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" id="saveStaffBtn" onclick="saveNewStaff()">যুক্ত করুন</button>
 `,
  );
}
async function saveNewStaff() {
  const full_name = document.getElementById("staffName").value.trim();
  const email = document
    .getElementById("staffEmail")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("staffPassword").value;
  if (!full_name) {
    showToast("নাম আবশ্যক");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("সঠিক ইমেইল দিন");
    return;
  }
  if (password.length < 6) {
    showToast("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
    return;
  }
  const btn = document.getElementById("saveStaffBtn");
  if (btn) btn.disabled = true;
  try {
    await callStaffApi("/api/create-staff", { full_name, email, password });
    closeModal();
    await loadStaffList();
    render();
    showToast("নতুন স্টাফ যুক্ত হয়েছে");
    logActivity("নতুন স্টাফ যুক্ত হয়েছে", full_name + " (" + email + ")");
  } catch (e) {
    showToast(e.message || "স্টাফ তৈরি ব্যর্থ হয়েছে");
  } finally {
    if (btn) btn.disabled = false;
  }
}
function editStaffPrompt(id) {
  const s = staffList.find((x) => x.id === id);
  if (!s) return;
  openModal(
    `স্টাফ পরিচালনা — ${esc(s.full_name)}`,
    `
 <div class="field"><label>নাম পরিবর্তন করুন</label><input type="text" id="staffNameEdit" value="${esc(s.full_name)}"></div>
 <div style="border-top:1px dashed var(--steel-300); padding-top:12px; margin-top:6px;">
 <div style="font-size:12.5px;font-weight:600;color:var(--steel-700);margin-bottom:8px;">পাসওয়ার্ড রিসেট করুন</div>
 <div class="field"><label>নতুন পাসওয়ার্ড</label><input type="password" id="staffNewPass" placeholder="কমপক্ষে ৬ ক্যারেক্টার"></div>
 <button type="button" class="btn btn-outline" style="width:100%; justify-content:center;" onclick="resetStaffPassword('${id}')">পাসওয়ার্ড রিসেট করুন</button>
 </div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteStaffPrompt('${id}', '${jsq(s.full_name)}')">স্টাফ মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveStaffEdit('${id}')">নাম সংরক্ষণ করুন</button>
 `,
  );
}
async function saveStaffEdit(id) {
  const full_name = document.getElementById("staffNameEdit").value.trim();
  if (!full_name) {
    showToast("নাম আবশ্যক");
    return;
  }
  const { error } = await supabaseClient
    .from("profiles")
    .update({ full_name })
    .eq("id", id);
  if (error) {
    showToast("আপডেট ব্যর্থ হয়েছে");
    return;
  }
  closeModal();
  await loadStaffList();
  render();
  showToast("আপডেট হয়েছে");
}
async function resetStaffPassword(id) {
  const new_password = document.getElementById("staffNewPass").value;
  if (new_password.length < 6) {
    showToast("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
    return;
  }
  try {
    await callStaffApi("/api/reset-password", { staff_id: id, new_password });
    closeModal();
    showToast("পাসওয়ার্ড রিসেট হয়েছে — স্টাফকে নতুন পাসওয়ার্ড জানিয়ে দিন");
    logActivity("স্টাফের পাসওয়ার্ড রিসেট করা হয়েছে", id);
  } catch (e) {
    showToast(e.message || "পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে");
  }
}
function deleteStaffPrompt(id, name) {
  openModal(
    "স্টাফ মুছবেন?",
    `
 <p style="font-size:13.5px;">"${esc(name)}" কে স্টাফ তালিকা থেকে স্থায়ীভাবে মুছে ফেলা হবে — এই স্টাফ আর লগইন করতে পারবেন না। এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('স্টাফ মুছুন', () => deleteStaffConfirmed('${id}'))">হ্যাঁ, মুছুন</button>
 `,
  );
}
async function deleteStaffConfirmed(id) {
  try {
    await callStaffApi("/api/delete-staff", { staff_id: id });
    closeModal();
    await loadStaffList();
    render();
    showToast("স্টাফ মুছে ফেলা হয়েছে");
    logActivity("স্টাফ মুছে ফেলা হয়েছে", id);
  } catch (e) {
    showToast(e.message || "স্টাফ মুছতে ব্যর্থ হয়েছে");
  }
}

/* ============================================================
 STATE COLLECT / APPLY / PERSIST (Supabase shop_data)
 ============================================================ */
function collectState(isNewShop) {
  return {
    BRANDS,
    PRODUCT_CATEGORIES,
    categoryNextId,
    brandCategory,
    brandUnitLabel,
    brandSizeLabel,
    inventory: isNewShop ? buildDemoInventory() : inventory,
    ledger,
    ledgerNextId,
    cashCustomers,
    cashNextId,
    invoices,
    invoiceCounter,
    payments,
    paymentCounter,
    purchases,
    purchaseCounter,
    suppliers,
    supplierNextId,
    customerDueEntries,
    customerDueNextId,
    supplierDueEntries,
    supplierDueNextId,
    expenseCategories,
    expenseCatNextId,
    expensePeople,
    expensePersonNextId,
    expenses,
    expenseNextId,
    incomeCategories,
    incomeCatNextId,
    incomePeople,
    incomePersonNextId,
    incomes,
    incomeNextId,
    activityLog,
    activityLogNextId,
    LOW_STOCK_THRESHOLD,
    returns,
    returnNextId,
    quickSales,
    quickSaleNextId,
    trashBin,
    trashNextId,
    shopPhone: SHOP_PHONE,
    shopAddress: SHOP_ADDRESS,
    shopEmail: SHOP_EMAIL,
    shopLogo: SHOP_LOGO,
    shopMobileBankingType: SHOP_MOBILE_BANKING_TYPE,
    shopMobileBankingNumber: SHOP_MOBILE_BANKING_NUMBER,
    lastBackupAt,
  };
}
function applyState(s) {
  BRANDS = s.BRANDS || ["আকিজ", "পিএইচপি", "কেওয়াই স্টিল", "নাহার", "গ্যালকো"];
  inventory = s.inventory || buildDemoInventory();
  ledger = s.ledger || [];
  ledgerNextId =
    s.ledgerNextId ||
    (ledger.length ? Math.max(...ledger.map((l) => l.id)) + 1 : 1);
  cashCustomers = s.cashCustomers || [];
  cashNextId = s.cashNextId || 1;
  invoices = s.invoices || [];
  invoiceCounter = s.invoiceCounter || 1001;
  payments = s.payments || [];
  paymentCounter = s.paymentCounter || 1;
  purchases = s.purchases || [];
  purchaseCounter = s.purchaseCounter || 1;
  suppliers = s.suppliers || [];
  customerDueEntries = s.customerDueEntries || [];
  customerDueNextId = s.customerDueNextId || 1;
  supplierNextId = s.supplierNextId || 1;
  supplierDueEntries = s.supplierDueEntries || [];
  supplierDueNextId = s.supplierDueNextId || 1;
  expenseCategories =
    s.expenseCategories && s.expenseCategories.length
      ? s.expenseCategories
      : expenseCategories;
  expenseCatNextId = s.expenseCatNextId || 7;
  expensePeople = s.expensePeople || [];
  expensePersonNextId = s.expensePersonNextId || 1;
  expenses = s.expenses || [];
  expenseNextId = s.expenseNextId || 1;
  incomeCategories =
    s.incomeCategories && s.incomeCategories.length
      ? s.incomeCategories
      : incomeCategories;
  incomeCatNextId = s.incomeCatNextId || 6;
  incomePeople = s.incomePeople || [];
  incomePersonNextId = s.incomePersonNextId || 1;
  incomes = s.incomes || [];
  incomeNextId = s.incomeNextId || 1;
  activityLog = s.activityLog || [];
  activityLogNextId = s.activityLogNextId || 1;
  LOW_STOCK_THRESHOLD = s.LOW_STOCK_THRESHOLD || 5;
  returns = s.returns || [];
  returnNextId = s.returnNextId || 1;
  quickSales = s.quickSales || [];
  quickSaleNextId = s.quickSaleNextId || 1;
  trashBin = s.trashBin || [];
  trashNextId = s.trashNextId || 1;
  SHOP_PHONE = s.shopPhone || "";
  SHOP_ADDRESS = s.shopAddress || "";
  SHOP_EMAIL = s.shopEmail || "";
  SHOP_LOGO = s.shopLogo || "";
  SHOP_MOBILE_BANKING_TYPE = s.shopMobileBankingType || "";
  SHOP_MOBILE_BANKING_NUMBER = s.shopMobileBankingNumber || "";
  lastBackupAt = s.lastBackupAt || null;
  PRODUCT_CATEGORIES =
    s.PRODUCT_CATEGORIES && s.PRODUCT_CATEGORIES.length
      ? s.PRODUCT_CATEGORIES
      : PRODUCT_CATEGORIES;
  categoryNextId = s.categoryNextId || categoryNextId;

  PRODUCT_CATEGORIES.forEach((c) => {
    if (c.usesBan === undefined) c.usesBan = c.id === "tin";
    c.hasBrands = true;
  });
  brandCategory = s.brandCategory || {};
  brandUnitLabel = s.brandUnitLabel || {};
  brandSizeLabel = s.brandSizeLabel || {};
  initCategoryPseudoBrands();
}
function mergeArraysById(localArr, serverArr) {
  const map = new Map();
  (serverArr || []).forEach((item) => {
    if (item && item.id != null) map.set(item.id, item);
  });
  (localArr || []).forEach((item) => {
    if (item && item.id != null) map.set(item.id, item);
  });
  return Array.from(map.values());
}
function applyMergedListsAndCounters(serverData) {
  if (!serverData) return;
  invoices = mergeArraysById(invoices, serverData.invoices);
  payments = mergeArraysById(payments, serverData.payments);
  purchases = mergeArraysById(purchases, serverData.purchases);
  expenses = mergeArraysById(expenses, serverData.expenses);
  incomes = mergeArraysById(incomes, serverData.incomes);
  returns = mergeArraysById(returns, serverData.returns);
  quickSales = mergeArraysById(quickSales, serverData.quickSales);
  activityLog = mergeArraysById(activityLog, serverData.activityLog);
  customerDueEntries = mergeArraysById(
    customerDueEntries,
    serverData.customerDueEntries,
  );
  supplierDueEntries = mergeArraysById(
    supplierDueEntries,
    serverData.supplierDueEntries,
  );
  cashCustomers = mergeArraysById(cashCustomers, serverData.cashCustomers);
  invoiceCounter = Math.max(invoiceCounter, serverData.invoiceCounter || 0);
  paymentCounter = Math.max(paymentCounter, serverData.paymentCounter || 0);
  purchaseCounter = Math.max(purchaseCounter, serverData.purchaseCounter || 0);
  ledgerNextId = Math.max(ledgerNextId, serverData.ledgerNextId || 0);
  cashNextId = Math.max(cashNextId, serverData.cashNextId || 0);
  expenseNextId = Math.max(expenseNextId, serverData.expenseNextId || 0);
  incomeNextId = Math.max(incomeNextId, serverData.incomeNextId || 0);
  returnNextId = Math.max(returnNextId, serverData.returnNextId || 0);
  quickSaleNextId = Math.max(quickSaleNextId, serverData.quickSaleNextId || 0);
  activityLogNextId = Math.max(
    activityLogNextId,
    serverData.activityLogNextId || 0,
  );
  customerDueNextId = Math.max(
    customerDueNextId,
    serverData.customerDueNextId || 0,
  );
  supplierDueNextId = Math.max(
    supplierDueNextId,
    serverData.supplierDueNextId || 0,
  );
  supplierNextId = Math.max(supplierNextId, serverData.supplierNextId || 0);
  expensePersonNextId = Math.max(
    expensePersonNextId,
    serverData.expensePersonNextId || 0,
  );
  incomePersonNextId = Math.max(
    incomePersonNextId,
    serverData.incomePersonNextId || 0,
  );
}
let persistTimer = null;
function persistShopData() {
  if (!SHOP_ID) return;
  // প্রতিটা পরিবর্তন সাথে সাথেই ডিভাইসে (localStorage) সেভ হয়ে যায়,
  // ইন্টারনেট থাকুক বা না থাকুক — তাই রিলোড/অ্যাপ বন্ধ হলেও ডেটা হারাবে না
  try {
    localStorage.setItem(
      cacheKey("data_" + SHOP_ID),
      JSON.stringify(collectState(false)),
    );
  } catch (e) {
    /* স্টোরেজ পূর্ণ হলে সাইলেন্টলি বাদ */
  }
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    if (!navigator.onLine) {
      pendingSync = true;
      isOffline = true;
      updateOfflineBadge();
      return;
    }
    try {
      const { data: serverRow, error: fetchErr } = await supabaseClient
        .from("shop_data")
        .select("data, updated_at")
        .eq("shop_id", SHOP_ID)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const serverChangedByOther =
        serverRow &&
        serverRow.updated_at &&
        serverRow.updated_at !== lastKnownUpdatedAt;

      if (serverChangedByOther) {
        applyMergedListsAndCounters(serverRow.data);
      }

      const { data: updatedRow, error: updateErr } = await supabaseClient
        .from("shop_data")
        .update({
          data: collectState(false),
          updated_at: new Date().toISOString(),
        })
        .eq("shop_id", SHOP_ID)
        .select("updated_at")
        .maybeSingle();
      if (updateErr) throw updateErr;
      lastKnownUpdatedAt = updatedRow
        ? updatedRow.updated_at
        : lastKnownUpdatedAt;

      if (serverChangedByOther) {
        render();
        showToast(
          "🔄 অন্য একটি ডিভাইসের নতুন তথ্যের সাথে মিলিয়ে সংরক্ষণ করা হয়েছে",
        );
      }

      pendingSync = false;
      if (isOffline) {
        isOffline = false;
        updateOfflineBadge();
        showToast("✅ ইন্টারনেট ফিরে এসেছে — সব তথ্য সার্ভারে সংরক্ষিত হয়েছে");
      }
    } catch (e) {
      pendingSync = true;
      isOffline = true;
      updateOfflineBadge();
    }
  }, 900);
}

/* ============================================================
 ডাটা ব্যাকআপ — সম্পূর্ণ দোকানের ডেটা JSON ফাইল আকারে ডাউনলোড
 ============================================================ */
function backupTimestampLabel() {
  if (!lastBackupAt) return "এখনো ব্যাকআপ নেওয়া হয়নি";
  const d = new Date(lastBackupAt);
  const dateStr = d.toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("bn-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr}, ${timeStr}`;
}
function downloadBackupNow() {
  try {
    const backupObj = {
      shopName: SHOP_NAME,
      backedUpAt: new Date().toISOString(),
      data: collectState(false),
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname =
      (SHOP_NAME || "দোকান").replace(/\s+/g, "-") +
      "-ব্যাকআপ-" +
      toDateInputValue(new Date()) +
      ".json";
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    lastBackupAt = new Date().toISOString();
    persistShopData();
    logActivity("ডাটা ব্যাকআপ নেওয়া হয়েছে", fname);
    showToast("✅ ব্যাকআপ ফাইল ডাউনলোড হয়েছে");
    render();
  } catch (e) {
    showToast("ব্যাকআপ ব্যর্থ হয়েছে, আবার চেষ্টা করুন");
  }
}

/* ============================================================
 ড্যাশবোর্ডের জন্য দিন/মাস হিসাব
 ============================================================ */
function setDashboardPeriod(p) {
  dashboardPeriod = p;
  render();
}

function computePeriodStats(period) {
  const now = new Date();
  const todayKey = dayKey(now);
  const monthKey = monthKeyOf(now);
  const matches = (d) =>
    period === "day" ? dayKey(d) === todayKey : monthKeyOf(d) === monthKey;

  let sales = 0,
    receivedFromSales = 0,
    dueGiven = 0,
    dueReceived = 0,
    expense = 0,
    quickSalesRevenue = 0;

  invoices.forEach((inv) => {
    if (inv.cancelled) return;
    if (matches(inv.date)) {
      sales += inv.total;
      receivedFromSales += inv.paid;
      dueGiven += inv.due;
    }
  });
  payments.forEach((p) => {
    if (matches(p.date)) dueReceived += p.amount;
  });
  expenses.forEach((e) => {
    if (matches(e.date)) expense += e.amount;
  });
  quickSales.forEach((q) => {
    if (matches(q.date)) quickSalesRevenue += q.totalAmount;
  });

  return {
    sales: sales + quickSalesRevenue,
    received: receivedFromSales + dueReceived + quickSalesRevenue,
    dueGiven,
    dueReceived,
    expense,
  };
}
function computeTotalStockPieces() {
  let total = 0;
  Object.values(inventory).forEach((mmObj) =>
    Object.values(mmObj).forEach((szObj) =>
      Object.values(szObj).forEach((v) => (total += v.stock)),
    ),
  );
  return total;
}

/* ============================================================
 বিভিন্ন তালিকা পেজের জন্য দিন/মাস/বছর ফিল্টার (কেনার খাতা,
 বেচার খাতা, ক্যাশ মেমো হিস্ট্রি, খরচের খাতা, রিটার্ন ইত্যাদিতে ব্যবহৃত)
 ============================================================ */
let periodAnchor = {}; // pageKey -> Date (কোন তারিখ/মাস/বছর থেকে দেখানো হচ্ছে)
function getPeriodAnchor(pageKey) {
  if (!periodAnchor[pageKey]) periodAnchor[pageKey] = new Date();
  return periodAnchor[pageKey];
}
function anchoredRange(period, anchor) {
  if (period === "day") {
    const k = dayKey(anchor);
    return { from: k, to: k };
  }
  if (period === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: dayKey(first), to: dayKey(last) };
  }
  if (period === "year") {
    return {
      from: anchor.getFullYear() + "-01-01",
      to: anchor.getFullYear() + "-12-31",
    };
  }
  return { from: null, to: null };
}
function anchoredLabel(period, anchor) {
  if (period === "day") return dayLabel(dayKey(anchor));
  if (period === "month") return monthLabelOf(monthKeyOf(anchor));
  if (period === "year") return bnDigits(anchor.getFullYear()) + " সাল";
  return "সব সময়";
}
function inSelectedPeriodAnchored(dateVal, period, anchor) {
  if (period === "all") return true;
  const range = anchoredRange(period, anchor);
  const k = dayKey(dateVal);
  if (range.from && k < range.from) return false;
  if (range.to && k > range.to) return false;
  return true;
}
function navListPeriod(pageKey, delta) {
  const period = listPeriod[pageKey] || "all";
  const a = new Date(getPeriodAnchor(pageKey));
  if (period === "day") a.setDate(a.getDate() + delta);
  else if (period === "month") a.setMonth(a.getMonth() + delta);
  else if (period === "year") a.setFullYear(a.getFullYear() + delta);
  else return;
  periodAnchor[pageKey] = a;
  render();
}
let listPeriod = {
  purchaseLedger: "all",
  salesLedger: "all",
  invoices: "all",
  expenses: "all",
  returns: "all",
  dueSummary: "day",
  employees: "month",
  suppliers: "all",
  customerDetail: "all",
};
function setListPeriod(pageKey, period) {
  listPeriod[pageKey] = period;
  periodAnchor[pageKey] = new Date();
  render();
}
function inSelectedPeriod(date, period) {
  if (period === "all") return true;
  const now = new Date();
  if (period === "day") return dayKey(date) === dayKey(now);
  if (period === "month") return monthKeyOf(date) === monthKeyOf(now);
  if (period === "year")
    return String(new Date(date).getFullYear()) === String(now.getFullYear());
  return true;
}
function periodTabsHtml(pageKey) {
  const cur = listPeriod[pageKey] || "all";
  const opts = [
    ["day", "দিন"],
    ["month", "মাস"],
    ["year", "বছর"],
    ["all", "সব সময়"],
  ];
  const tabs = `<div class="tab-row" style="margin-bottom:12px;">
 ${opts.map(([key, label]) => `<button class="btn ${cur === key ? "btn-primary" : "btn-outline"}" style="padding:7px 14px;font-size:12.5px;" onclick="setListPeriod('${pageKey}','${key}')">${label}</button>`).join("")}
 </div>`;
  const navBar =
    cur !== "all"
      ? `
 <div style="display:flex;align-items:center;justify-content:space-between;background:var(--steel-900);border-radius:10px;padding:11px 16px;margin-bottom:14px;">
 <button type="button" onclick="navListPeriod('${pageKey}',-1)" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;">←</button>
 <div style="color:white;font-size:14px;font-weight:700;">${anchoredLabel(cur, getPeriodAnchor(pageKey))}</div>
 <button type="button" onclick="navListPeriod('${pageKey}',1)" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;">→</button>
 </div>`
      : "";
  return tabs + navBar;
}

/* ============================================================
 NAV
 ============================================================ */
function goHome() {
  switchView("dashboard");
}
function goBackStep() {
  try {
    history.back();
  } catch (e) {
    goHome();
  }
}

function switchView(id, opts) {
  opts = opts || {};
  const isOwner = currentUser && currentUser.role === "owner";
  if (!isOwner && OWNER_ONLY_VIEWS.includes(id)) {
    showToast("এই পেজ শুধু দোকানের মালিক দেখতে পারবেন");
    return;
  }
  currentView = id;
  if (id === "salesPicker") {
    posStep = 0;
    posCategory = null;
    posBrand = null;
    posBrandSearch = "";
    posItemSearch = "";
  }
  if (id === "stock") {
    stockStep = 0;
    stockCategory = null;
    stockBrand = null;
    stockSearch = "";
  }
  if (id === "purchaseLedger") {
    purchaseSearch = "";
  }
  if (id === "salesLedger") {
    salesLedgerSearch = "";
    salesLedgerPreset = "month";
    salesLedgerAnchor = new Date();
  }
  if (id === "salesLedgerCat") {
    salesLedgerCatSearch = "";
  }
  if (id === "invoices") {
    invoiceSearch = "";
  }
  if (id === "ledger") {
    ledgerSearch = "";
    ledgerDetailId = null;
    ledgerMinDue = "";
    ledgerMaxDue = "";
    ledgerSort = "default";
    ledgerTab = "due";
  }
  if (id === "sales" || id === "checkout") {
    saleCustomerType = "cash";
  }
  if (id === "employees") {
    employeeDetailId = null;
  }
  if (id === "suppliers") {
    supplierDetailId = null;
  }
  if (id === "cash") {
    cashSearch = "";
  }
  if (id === "daily") {
    dailySelectedDate = null;
  }
  if (id === "profit") {
    profitTab = "monthly";
    profitDrillPath = [];
  }
  if (id === "income") {
    incomeSearch = "";
  }
  if (id === "expenses") {
    expenseSearch = "";
    expenseTab = "entries";
    expensePersonFilter = null;
  }
  if (id === "report") {
    reportPreset = "month";
    reportFrom = null;
    reportTo = null;
  }
  if (id === "cashbox") {
    cashboxPreset = "month";
    cashboxFrom = null;
    cashboxTo = null;
    cashboxFilter = "all";
  }
  if (id === "staff") {
    loadStaffList().then(render);
  }
  const titles = {
    dashboard: "ড্যাশবোর্ড",
    sales: "নতুন বিক্রয়",
    salesPicker: "পণ্য বাছাই করুন",
    cart: "কার্ট",
    checkout: "ক্যাশ মেমো তৈরি করুন",
    invoicePreview: "ক্যাশ মেমো",
    paymentReceipt: "প্রাপ্তি রশিদ",
    stock: "স্টক তালিকা",
    purchaseLedger: "কেনার খাতা",
    salesLedger: "বেচার খাতা",
    ledger: "বাকির খাতা",
    dueSummary: "বাকির হিসাব (দিয়েছি/পেয়েছি)",
    employees: "কর্মচারী",
    suppliers: "সাপ্লায়ার",
    cash: "নগদ ক্রেতা",
    expenses: "খরচ",
    invoices: "ক্যাশ মেমো হিস্ট্রি",
    returns: "রিটার্ন/এক্সচেঞ্জ",
    daily: "দৈনিক হিসাব",
    profit: "লাভ-ক্ষতি",
    report: "ব্যবসার রিপোর্ট",
    aiAssistant: "AI সহকারী",
    cashbox: "ক্যাশবক্স",
    staff: "স্টাফ ও লগ",
    trash: "রিস্টোর/ট্র্যাশ",
    settings: "দোকানের তথ্য",
  };
  document.getElementById("pageTitle").textContent =
    id === "salesLedgerCat"
      ? salesLedgerCatTitle(salesLedgerCatType)
      : titles[id];
  const homeBtnEl = document.getElementById("homeBtn");
  if (homeBtnEl) homeBtnEl.classList.toggle("hidden", id === "dashboard");
  const backBtnEl = document.getElementById("backBtn");
  if (backBtnEl) backBtnEl.classList.toggle("hidden", id === "dashboard");
  render();
  scrollContentTop();
  // মোবাইলে ব্যাক বাটন চাপলে যেন পুরো অ্যাপ থেকে বের না হয়ে শুধু একধাপ পেছনে যায়
  if (!opts.fromPopState) {
    try {
      if (opts.replace) history.replaceState({ view: id }, "", "#" + id);
      else history.pushState({ view: id }, "", "#" + id);
    } catch (e) {
      /* history API না থাকলে সাইলেন্টলি বাদ */
    }
  }
}
window.addEventListener("popstate", (e) => {
  const modalOverlay = document.getElementById("modalOverlay");
  if (modalOverlay && modalOverlay.classList.contains("active")) {
    modalOverlay.classList.remove("active");
    __pwConfirmCallback = null;
    return;
  }
  if (currentView === "sales" && posStep === 2) {
    const posCat = PRODUCT_CATEGORIES.find((c) => c.id === posCategory);
    posGoStep(posCat && !posCat.hasBrands ? 0 : 1);
    return;
  }
  if (currentView === "sales" && posStep === 1) {
    posGoStep(0);
    return;
  }
  if (currentView === "stock" && stockStep === 2) {
    const stockCat = PRODUCT_CATEGORIES.find((c) => c.id === stockCategory);
    stockGoStep(stockCat && !stockCat.hasBrands ? 0 : 1);
    return;
  }
  if (currentView === "stock" && stockStep === 1) {
    stockGoStep(0);
    return;
  }
  if (currentView === "ledger" && ledgerDetailId) {
    ledgerDetailId = null;
    render();
    scrollContentTop();
    return;
  }
  if (currentView === "employees" && employeeDetailId) {
    employeeDetailId = null;
    render();
    scrollContentTop();
    return;
  }
  if (currentView === "suppliers" && supplierDetailId) {
    supplierDetailId = null;
    render();
    scrollContentTop();
    return;
  }
  if (currentView === "daily" && dailySelectedDate) {
    dailySelectedDate = null;
    render();
    scrollContentTop();
    return;
  }
  if (currentView === "salesLedger" && salesLedgerCatType) {
    salesLedgerCatType = null;
    render();
    scrollContentTop();
    return;
  }
  if (currentView === "profit" && profitDrillPath.length > 0) {
    profitDrillPath.pop();
    render();
    scrollContentTop();
    return;
  }
  const view = (e.state && e.state.view) || "dashboard";
  switchView(view, { fromPopState: true });
});

function render() {
  const c = document.getElementById("content");
  if (currentView === "dashboard") c.innerHTML = renderDashboard();
  else if (currentView === "sales") c.innerHTML = renderSales();
  else if (currentView === "salesPicker") c.innerHTML = renderSalesPicker();
  else if (currentView === "cart") c.innerHTML = renderCartPage();
  else if (currentView === "checkout") c.innerHTML = renderCheckout();
  else if (currentView === "invoicePreview")
    c.innerHTML = renderInvoicePreview();
  else if (currentView === "paymentReceipt")
    c.innerHTML = renderPaymentReceiptPage();
  else if (currentView === "stock") c.innerHTML = renderStock();
  else if (currentView === "purchaseLedger")
    c.innerHTML = renderPurchaseLedger();
  else if (currentView === "salesLedger") c.innerHTML = renderSalesLedger();
  else if (currentView === "salesLedgerCat")
    c.innerHTML = renderSalesLedgerCatPage();
  else if (currentView === "ledger") c.innerHTML = renderLedger();
  else if (currentView === "dueSummary") c.innerHTML = renderDueSummary();
  else if (currentView === "employees") c.innerHTML = renderEmployees();
  else if (currentView === "suppliers") c.innerHTML = renderSuppliers();
  else if (currentView === "cash") c.innerHTML = renderCashCustomers();
  else if (currentView === "income") c.innerHTML = renderIncome();
  else if (currentView === "expenses") c.innerHTML = renderExpenses();
  else if (currentView === "invoices") c.innerHTML = renderInvoices();
  else if (currentView === "returns") c.innerHTML = renderReturns();
  else if (currentView === "daily") c.innerHTML = renderDaily();
  else if (currentView === "profit") c.innerHTML = renderProfit();
  else if (currentView === "report") c.innerHTML = renderBusinessReport();
  else if (currentView === "aiAssistant") c.innerHTML = renderAIAssistant();
  else if (currentView === "cashbox") c.innerHTML = renderCashbox();
  else if (currentView === "staff") c.innerHTML = renderStaff();
  else if (currentView === "trash") c.innerHTML = renderTrash();
  else if (currentView === "settings") c.innerHTML = renderSettings();
}

/* ============================================================
 সাধারণ হেল্পার
 ============================================================ */
function fmt(n) {
  return "৳ " + Number(n).toLocaleString("en-IN");
}
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function normalizeStr(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}
function isDuplicateEntry(list, name, phone) {
  const n = normalizeStr(name);
  const p = normalizeStr(phone);
  return list.some(
    (x) => normalizeStr(x.name) === n && normalizeStr(x.phone) === p,
  );
}
function jsq(str) {
  return String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}
function toDateInputValue(d) {
  const dt = d ? new Date(d) : new Date();
  const off = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}
function dateFromInput(val) {
  if (!val) return new Date();
  const now = new Date();
  const [y, m, d] = val.split("-").map(Number);
  const chosen = new Date(
    y,
    m - 1,
    d,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
  return chosen;
}
function dayKey(d) {
  return toDateInputValue(d);
}
function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("bn-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function monthKeyOf(d) {
  return toDateInputValue(d).slice(0, 7);
}
function bnDigits(str) {
  const map = {
    0: "০",
    1: "১",
    2: "২",
    3: "৩",
    4: "৪",
    5: "৫",
    6: "৬",
    7: "৭",
    8: "৮",
    9: "৯",
  };
  return String(str).replace(/[0-9]/g, (d) => map[d]);
}
function monthLabelOf(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
  });
}
function tryPrint() {
  try {
    window.print();
  } catch (e) {
    showToast('প্রিন্ট চালু করা যায়নি — এর বদলে "ডাউনলোড করুন" বাটন চাপুন');
  }
}
function buildThermalInvoiceHtml(inv, widthMm) {
  const rows = inv.items
    .map((it) => {
      const weight = isWeightBrand(it.brand);
      const nameLine = weight
        ? `${esc(it.brand)} (ওজন)`
        : `${esc(it.brand)}${itemLabelText(it.brand, it.mm, it.size)}${it.banQty ? ` (${it.banQty} বান)` : ""}`;
      const priceLine = weight
        ? fmt(it.sellPrice * 1000) + "/কেজি"
        : fmt(it.sellPrice);
      return `
 <div class="th-item">
 <div>${nameLine}</div>
 <div class="th-row"><span>${formatItemQty(it.brand, it.qty)} × ${priceLine}</span><span>${fmt(it.qty * it.sellPrice)}</span></div>
 </div>`;
    })
    .join("");
  const itemsSubtotal =
    inv.itemsSubtotal != null ? inv.itemsSubtotal : inv.total;
  return `
 <div class="thermal-box" style="width:${widthMm}mm;">
  <div class="th-center th-bold th-lg">${esc(SHOP_NAME)}</div>
 ${SHOP_PHONE ? `<div class="th-center">ফোনঃ ${esc(SHOP_PHONE)}</div>` : ""}
 ${SHOP_MOBILE_BANKING_NUMBER ? `<div class="th-center">${esc(SHOP_MOBILE_BANKING_TYPE || "মোবাইল ব্যাংকিং")}ঃ ${esc(SHOP_MOBILE_BANKING_NUMBER)}</div>` : ""}
 ${SHOP_ADDRESS ? `<div class="th-center">${esc(SHOP_ADDRESS)}</div>` : ""}
 <div class="th-line"></div>
 <div>ক্যাশ মেমো #${inv.id}</div>
 <div>তারিখঃ ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 <div>ক্রেতাঃ ${esc(inv.customer)}</div>
 ${inv.customerPhone ? `<div>ফোনঃ ${esc(inv.customerPhone)}</div>` : ""}
 <div class="th-line"></div>
 ${rows}
 <div class="th-line"></div>
 <div class="th-row"><span>সাবটোটাল</span><span>${fmt(itemsSubtotal)}</span></div>
 ${inv.discount > 0 ? `<div class="th-row"><span>ডিসকাউন্ট</span><span>${fmt(inv.discount)}</span></div>` : ""}
 ${inv.delivery > 0 ? `<div class="th-row"><span>ডেলিভারি</span><span>${fmt(inv.delivery)}</span></div>` : ""}
 ${inv.expenseAmt > 0 ? `<div class="th-row"><span>${esc(inv.expenseLabel) || "ভাড়া"}</span><span>${fmt(inv.expenseAmt)}</span></div>` : ""}
 <div class="th-line"></div>
 <div class="th-row th-bold th-lg"><span>মোট</span><span>${fmt(inv.total)}</span></div>
  <div class="th-row"><span>মোট জমা</span><span>${fmt(inv.paid)}</span></div>
 <div class="th-row th-bold"><span>বাকি</span><span>${fmt(inv.due)}</span></div>
 <div class="th-line"></div>
 <div class="th-center">ধন্যবাদ! আবার আসবেন</div>
 </div>`;
}
function printThermal(invId, widthMm) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  const html = buildThermalInvoiceHtml(inv, widthMm);
  const pa = document.getElementById("printArea");
  if (pa) pa.innerHTML = html;
  let styleTag = document.getElementById("thermalPageStyle");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "thermalPageStyle";
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = `@page{ size:${widthMm}mm auto; margin:2mm; }`;
  setTimeout(() => {
    try {
      window.print();
    } catch (e) {
      showToast("প্রিন্ট চালু করা যায়নি");
    }
  }, 60);
}
function downloadThermal(invId, widthMm) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  const pa = document.getElementById("printArea");
  if (pa) pa.innerHTML = buildThermalInvoiceHtml(inv, widthMm);
  downloadPrintArea("থার্মাল-ক্যাশ মেমো-" + inv.id);
}
function downloadPrintArea(filename) {
  try {
    const inner = document.getElementById("printArea").innerHTML;
    const styles = `
 body{font-family:'Hind Siliguri',sans-serif;background:#fff;color:#161B1F;padding:24px;}
 .invoice-box{background:#fff;border:1px solid #E9ECED;border-radius:10px;padding:26px;max-width:520px;margin:0 auto;}
 .invoice-box .ihead{text-align:center;border-bottom:2px dashed #AEB9BD;padding-bottom:14px;margin-bottom:14px;}
 .invoice-box .ihead h2{font-size:20px;margin:0;}
 .invoice-box .ihead p{font-size:11.5px;color:#6B7A82;margin-top:3px;}
 .itbl{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;}
 .itbl th{text-align:left;border-bottom:1.5px solid #161B1F;padding:6px 4px;font-size:11px;}
 .itbl td{padding:6px 4px;border-bottom:1px dotted #E9ECED;}
 .itbl td.r, .itbl th.r{text-align:right;font-family:monospace;}
 .itotal{display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #161B1F;font-size:16px;font-weight:700;font-family:monospace;}
 .idiscount{display:flex;justify-content:space-between;font-size:12.5px;color:#3C7A54;margin-top:4px;}
 .isubrow{display:flex;justify-content:space-between;font-size:12.5px;color:#3A464E;margin-top:4px;}
 .mono{font-family:'JetBrains Mono','Hind Siliguri',monospace;font-weight:600;}
 .si-box{background:#fff;border:1px solid #E9ECED;border-radius:16px;padding:30px 32px;max-width:640px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:0 4px 24px rgba(0,0,0,0.06);}
 .si-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding-bottom:18px;border-bottom:3px solid #BE4A22;flex-wrap:wrap;}
 .si-top-left{display:flex;gap:12px;align-items:flex-start;}
 .si-logo{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#BE4A22,#E0A030);display:flex;align-items:center;justify-content:center;font-size:25px;flex-shrink:0;color:#fff;box-shadow:0 4px 10px rgba(190,74,34,0.3);}
 .si-shop-name{font-family:'Baloo Da 2',sans-serif;font-weight:700;font-size:19px;color:#9A3A19;line-height:1.3;}
 .si-shop-meta{font-size:11px;color:#6B7A82;margin-top:5px;line-height:1.7;}
 .si-top-right{text-align:right;}
 .si-title{font-family:'Baloo Da 2',sans-serif;font-size:30px;font-weight:800;color:#BE4A22;letter-spacing:.03em;}
 .si-top-right .si-date{font-size:11px;color:#6B7A82;margin-top:4px;}
 .si-bar{display:flex;background:linear-gradient(90deg,#BE4A22,#9A3A19);color:#fff;border-radius:10px;overflow:hidden;margin:18px 0;font-size:12.5px;font-weight:700;box-shadow:0 3px 10px rgba(190,74,34,0.22);}
 .si-bar > div{flex:1;padding:10px 18px;}
 .si-bar > div:first-child{border-right:1px solid rgba(255,255,255,0.28);}
 .si-bar > div:last-child{text-align:right;}
 .si-cust{margin-bottom:16px;font-size:13px;background:#F1EFE9;border-radius:10px;padding:12px 16px;}
 .si-cust-row{display:flex;gap:10px;padding:2.5px 0;}
 .si-cust-row .si-lbl{width:80px;flex-shrink:0;color:#6B7A82;font-weight:600;}
 .si-tbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px;border-radius:8px;overflow:hidden;}
 .si-tbl th{background:#1E262C;color:#fff;text-align:left;padding:10px 10px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
 .si-tbl th.r, .si-tbl td.r{text-align:right;}
 .si-tbl td{padding:9px 10px;border-bottom:1px solid #E9ECED;font-family:'JetBrains Mono',monospace;}
 .si-tbl td:nth-child(2){font-family:'Hind Siliguri',sans-serif;}
 .si-tbl tbody tr:nth-child(even){background:#FAF9F6;}
 .si-serial{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#BE4A22;color:#fff;font-size:11px;font-weight:700;}
 .si-summary-wrap{display:flex;justify-content:flex-end;margin-top:14px;}
 .si-summary{width:260px;font-size:12.5px;background:#F1EFE9;border-radius:10px;padding:14px 16px;}
 .si-srow{display:flex;justify-content:space-between;padding:4.5px 0;}
 .si-srow.total{border-top:1.5px dashed #AEB9BD;font-weight:700;font-size:14.5px;padding-top:9px;margin-top:5px;color:#9A3A19;}
 .si-srow.hl{background:#BE4A22;color:#fff;border-radius:7px;padding:9px 11px;margin-top:8px;font-weight:700;}
 .si-words{font-size:12px;margin-top:18px;color:#3A464E;text-align:center;font-style:italic;}
 .si-sign{display:flex;justify-content:space-between;margin-top:48px;}
 .si-sign div{text-align:center;font-size:12px;border-top:1px solid #6B7A82;padding-top:6px;width:170px;}
 .thermal-box{font-family:'JetBrains Mono',monospace;font-size:11px;color:#000;background:#fff;padding:6px 4px;margin:0 auto;line-height:1.5;}
 .thermal-box .th-center{text-align:center;}
 .thermal-box .th-bold{font-weight:700;}
 .thermal-box .th-lg{font-size:13px;}
 .thermal-box .th-line{border-top:1px dashed #000;margin:6px 0;}
 .thermal-box .th-row{display:flex;justify-content:space-between;gap:6px;}
 .thermal-box .th-item{margin-bottom:3px;}
 `;
    const doc = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>${filename}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet"><style>${styles}</style></head><body>${inner}</body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast("ডাউনলোড হয়েছে — ফাইলটি ব্রাউজারে খুলে প্রিন্ট করতে পারবেন");
  } catch (e) {
    showToast("ডাউনলোড ব্যর্থ হয়েছে, আবার চেষ্টা করুন");
  }
}
async function shareHtmlFile(filename, innerHtml, textSummary) {
  try {
    const styleTag = document.getElementById("thermalPageStyle");
    const doc = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>${filename}</title></head><body>${innerHtml}</body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const file = new File([blob], filename + ".html", { type: "text/html" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: textSummary || "",
      });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: filename, text: textSummary || filename });
      return;
    }
    showToast(
      "এই ব্রাউজারে সরাসরি শেয়ার সাপোর্ট নেই — ডাউনলোড করে শেয়ার করুন",
    );
  } catch (e) {
    if (e && e.name !== "AbortError")
      showToast("শেয়ার করা যায়নি, আবার চেষ্টা করুন");
  }
}
function shareInvoice(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  const html = buildInvoiceHtml(inv);
  const summary = `${SHOP_NAME} — ক্যাশ মেমো #${inv.id} — ${inv.customer} — মোট ${fmt(inv.total)}`;
  shareHtmlFile("ক্যাশ মেমো-" + inv.id, html, summary);
}
function sharePaymentReceipt(payId) {
  const p = payments.find((x) => x.id === payId);
  if (!p) return;
  const html = buildPaymentReceiptHtml(p);
  const summary = `${SHOP_NAME} — প্রাপ্তি রশিদ #${p.id} — ${p.custName} — জমা ${fmt(p.amount)}`;
  shareHtmlFile("রশিদ-" + p.id, html, summary);
}

/* ============================================================
 দোকানের তথ্য (SETTINGS)
 ============================================================ */
function renderSettings() {
  return `
 <div class="panel" style="max-width:480px;">
 <h3>দোকানের তথ্য (ক্যাশ মেমো ও রশিদে দেখাবে)</h3>
 <div style="font-size:12px;color:var(--steel-500);margin-bottom:16px;">যে তথ্য নাই বা দিতে চান না, সেই ঘর ফাঁকা রাখুন — ক্যাশ মেমোে সেটা দেখাবে না।</div>
 <div class="field">
 <label>দোকানের লোগো/ছবি (ক্যাশ মেমোে দেখাবে)</label>
 <div style="display:flex; align-items:center; gap:14px; margin-bottom:6px;">
 <div id="shopLogoPreviewWrap" style="width:64px;height:64px;border-radius:12px;overflow:hidden;background:var(--steel-100);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
 ${SHOP_LOGO ? `<img id="shopLogoPreviewImg" src="${SHOP_LOGO}" style="width:100%;height:100%;object-fit:cover;">` : `<span id="shopLogoPreviewImg" style="font-size:26px;">🏪</span>`}
 </div>
 <div style="flex:1;">
 <input type="file" id="setShopLogoFile" accept="image/*" onchange="handleShopLogoUpload(this)">
 <div style="font-size:11px;color:var(--steel-500);margin-top:4px;">ছবি ছোট (৫০০KB এর নিচে) হলে ভালো — নাহলে সেভ হতে সময় লাগতে পারে</div>
 ${SHOP_LOGO ? `<button type="button" class="btn btn-outline" style="margin-top:6px;padding:5px 10px;font-size:11.5px;color:var(--red);" onclick="removeShopLogo()">ছবি সরান</button>` : ""}
 </div>
 </div>
 </div>
 <div class="field"><label>দোকানের নাম</label><input type="text" id="setShopName" value="${esc(SHOP_NAME)}" placeholder="যেমনঃ টিন হাউস"></div>
 <div class="field"><label>ফোন নাম্বার (না থাকলে ফাঁকা রাখুন)</label><input type="text" id="setShopPhone" value="${esc(SHOP_PHONE)}" placeholder="01xxx-xxxxxx"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="setShopAddress" value="${esc(SHOP_ADDRESS)}" placeholder="যেমনঃ বাজার রোড, সাভার, ঢাকা"></div>
  <div class="field"><label>ইমেইল (ঐচ্ছিক)</label><input type="text" id="setShopEmail" value="${esc(SHOP_EMAIL)}" placeholder="shop@example.com"></div>
 <div class="field"><label>মোবাইল ব্যাংকিং (ঐচ্ছিক)</label>
 <select id="setShopMobBankType">
 <option value="" ${!SHOP_MOBILE_BANKING_TYPE ? "selected" : ""}>— বাছুন —</option>
 <option value="বিকাশ" ${SHOP_MOBILE_BANKING_TYPE === "বিকাশ" ? "selected" : ""}>বিকাশ</option>
 <option value="নগদ" ${SHOP_MOBILE_BANKING_TYPE === "নগদ" ? "selected" : ""}>নগদ</option>
 <option value="রকেট" ${SHOP_MOBILE_BANKING_TYPE === "রকেট" ? "selected" : ""}>রকেট</option>
 </select>
 </div>
 <div class="field"><label>মোবাইল ব্যাংকিং নাম্বার (ঐচ্ছিক)</label><input type="text" id="setShopMobBankNumber" value="${esc(SHOP_MOBILE_BANKING_NUMBER)}" placeholder="01xxx-xxxxxx"></div>
 <button class="btn btn-primary" onclick="saveShopSettings()">সংরক্ষণ করুন</button>
 </div>`;
}
function handleShopLogoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("একটি ছবি ফাইল বাছুন");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    SHOP_LOGO = reader.result;
    const wrap = document.getElementById("shopLogoPreviewWrap");
    if (wrap)
      wrap.innerHTML = `<img id="shopLogoPreviewImg" src="${SHOP_LOGO}" style="width:100%;height:100%;object-fit:cover;">`;
    persistShopData();
    updateShopBrandUI();
    showToast("ছবি যুক্ত হয়েছে");
    render();
  };
  reader.readAsDataURL(file);
}
function removeShopLogo() {
  SHOP_LOGO = "";
  persistShopData();
  updateShopBrandUI();
  showToast("ছবি সরানো হয়েছে");
  render();
}
async function saveShopSettings() {
  const name = document.getElementById("setShopName").value.trim();
  SHOP_PHONE = document.getElementById("setShopPhone").value.trim();
  SHOP_ADDRESS = document.getElementById("setShopAddress").value.trim();
  SHOP_EMAIL = document.getElementById("setShopEmail").value.trim();
  SHOP_MOBILE_BANKING_TYPE =
    document.getElementById("setShopMobBankType").value;
  SHOP_MOBILE_BANKING_NUMBER = document
    .getElementById("setShopMobBankNumber")
    .value.trim();
  if (name && name !== SHOP_NAME) {
    SHOP_NAME = name;
    try {
      await supabaseClient
        .from("shops")
        .update({ name: SHOP_NAME })
        .eq("id", SHOP_ID);
    } catch (e) {
      /* সাইলেন্টলি ব্যর্থ */
    }
  }
  updateShopBrandUI();
  persistShopData();
  showToast("দোকানের তথ্য সংরক্ষণ হয়েছে");
}

/* ============================================================
 DASHBOARD
 ============================================================ */
function renderDashboard() {
  const stats = computePeriodStats(dashboardPeriod);
  const totalDue = ledger.reduce((s, l) => s + l.due, 0);
  const totalStock = computeTotalStockPieces();
  const isOwner = currentUser && currentUser.role === "owner";
  const periodLabel =
    dashboardPeriod === "day" ? "আজকের বিক্রয়" : "এই মাসের বিক্রয়";

  const tile = (view, colorClass, icon, label) =>
    `<div class="dash-tile" onclick="switchView('${view}')">
 <div class="dt-ic ${colorClass}">${icon}</div><div class="dt-lbl">${label}</div>
 </div>`;

  const ledgerTiles = [
    tile("income", "c-gold", "💰", "আয়ের খাতা"),
    tile("purchaseLedger", "c-blue", "📋", "কেনার খাতা"),
    tile("salesLedger", "c-green", "🧾", "বেচার খাতা"),
    tile("ledger", "c-red", "📒", "বাকির খাতা"),
    tile("expenses", "c-amber", "💸", "খরচের খাতা"),
    tile("employees", "c-brown", "👷", "কর্মচারী"),
    tile("suppliers", "c-slate", "🚚", "সাপ্লায়ার"),
  ].join("");

  const businessTiles = [
    tile("cashbox", "c-gold", "💰", "ক্যাশবক্স"),
    tile("stock", "c-teal", "📦", "স্টক তালিকা"),
    tile("invoices", "c-indigo", "🗂️", "ক্যাশ মেমো হিস্ট্রি"),
    tile("daily", "c-cyan", "📅", "দৈনিক হিসাব"),
    tile("returns", "c-pink", "↩️", "রিটার্ন/এক্সচেঞ্জ"),
    tile("cash", "c-brown", "💵", "নগদ ক্রেতা"),
  ].join("");

  const ownerTiles = isOwner
    ? [
        tile("profit", "c-gold", "📈", "লাভ-ক্ষতি"),
        tile("report", "c-slate", "📊", "ব্যবসার রিপোর্ট"),
        tile("aiAssistant", "c-purple", "🤖", "AI সহকারী"),
        tile("staff", "c-gray", "👥", "অ্যাপ অ্যাক্সেস (স্টাফ)"),
        tile("trash", "c-red", "🗑️", "রিস্টোর/ট্র্যাশ"),
        tile("settings", "c-teal", "⚙️", "দোকানের তথ্য"),
      ].join("")
    : "";

  return `
 <div class="panel" style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; font-size:12px;">
 <div style="color:var(--steel-500);">সর্বশেষ ব্যাকআপঃ <b style="color:var(--steel-900);">${backupTimestampLabel()}</b></div>
 <div style="display:flex; gap:8px;">
 <button class="btn btn-primary" style="padding:6px 12px;font-size:11.5px;" onclick="downloadBackupNow()">💾 ডাটা ব্যাকআপ</button>
 </div>
 </div>

 <div class="dash-hero">
 <div style="display:flex; justify-content:space-between; align-items:center;">
 <div class="dh-label">${periodLabel}</div>
 <div style="display:flex; gap:6px;">
 <button class="btn ${dashboardPeriod === "day" ? "btn-primary" : "btn-outline"}" style="padding:5px 14px;font-size:12px;" onclick="setDashboardPeriod('day')">দিন</button>
 <button class="btn ${dashboardPeriod === "month" ? "btn-primary" : "btn-outline"}" style="padding:5px 14px;font-size:12px;" onclick="setDashboardPeriod('month')">মাস</button>
 </div>
 </div>
 <div class="dh-val">${fmt(stats.sales)}</div>
 <div class="dh-sub" style="grid-template-columns:repeat(2,1fr);">
 <div style="cursor:pointer;" onclick="switchView('dueSummary')">বাকি দিয়েছি<b>${fmt(stats.dueGiven)}</b></div>
 <div style="cursor:pointer;" onclick="switchView('dueSummary')">বাকি পেয়েছি<b>${fmt(stats.dueReceived)}</b></div>
 <div style="cursor:pointer;" onclick="switchView('cashbox')">${dashboardPeriod === "day" ? "আজকে" : "এই মাসে"} পেলাম<b>${fmt(stats.received)}</b></div>
 <div style="cursor:pointer;" onclick="switchView('expenses')">${dashboardPeriod === "day" ? "আজকে" : "এই মাসে"} দিয়েছি<b>${fmt(stats.expense)}</b></div>
 </div>
 </div>

 <div class="stat-grid" style="grid-template-columns:repeat(2,1fr); margin-top:12px;">
 <div class="stat-card" style="--accent:var(--red); cursor:pointer;" onclick="switchView('ledger')">
 <div class="lbl">মোট বাকি (গ্রাহকের কাছে পাওনা)</div><div class="val">${fmt(totalDue)}</div>
 </div>
 <div class="stat-card" style="--accent:var(--teal); cursor:pointer;" onclick="switchView('stock')">
 <div class="lbl">স্টক সংখ্যা</div><div class="val">${totalStock} পিস</div>
 </div>
 </div>

 <div class="dash-actions">
 <button class="dash-action-btn buy" onclick="switchView('stock')">📥 ক্রয় করুন</button>
 <button class="dash-action-btn sell" onclick="switchView('sales')">🧾 বিক্রি করুন</button>
 </div>
 <div class="dash-section-label">খাতা সমূহ</div>
 <div class="dash-tile-grid">${ledgerTiles}</div>
 <div class="dash-section-label">আপনার ব্যবসার জন্য</div>
 <div class="dash-tile-grid">${businessTiles}</div>
 ${isOwner ? `<div class="dash-section-label">মালিকের জন্য</div><div class="dash-tile-grid">${ownerTiles}</div>` : ""}
 `;
}

/* ============================================================
 বিক্রয় (POS)
 ============================================================ */
function renderSales() {
  const itemsSubtotal = cart.reduce(
    (s, i) => s + cartEffectiveQty(i) * i.sellPrice,
    0,
  );
  const customerOptions = ledger
    .map(
      (l) =>
        `<option value="${l.id}">${esc(l.name)}${l.phone ? " · " + esc(l.phone) : ""}</option>`,
    )
    .join("");
  const teamMembers = [];
  if (currentUser)
    teamMembers.push({
      id: currentUser.id,
      name: currentUser.full_name,
      role: currentUser.role,
    });
  (staffList || []).forEach((s) => {
    if (!teamMembers.find((t) => t.id === s.id))
      teamMembers.push({ id: s.id, name: s.full_name, role: "staff" });
  });
  const salesByOptions = teamMembers
    .map(
      (t) =>
        `<option value="${esc(t.name)}" ${currentUser && t.id === currentUser.id ? "selected" : ""}>${esc(t.name)}${t.role === "owner" ? " (মালিক)" : " (স্টাফ)"}</option>`,
    )
    .join("");

  const itemRows =
    cart.length === 0
      ? `<div class="no-match" style="margin-bottom:14px;">এখনো কোনো পণ্য যোগ করা হয়নি — নিচে "আইটেম যোগ করুন" চাপুন</div>`
      : cart
          .map((item, idx) => {
            const eff = cartEffectiveQty(item);
            const totalAmt = eff * item.sellPrice;
            return `
 <div class="cart-item" style="background:white;border:1px solid var(--steel-100);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;">
 <div class="cart-item-top">
 <span style="font-weight:700;">${esc(item.brand)}${itemLabelText(item.brand, item.mm, item.size)}</span>
 <span class="remove" onclick="removeFromCart(${idx})">✕ বাদ</span>
 </div>
 <div class="cart-sub" style="text-align:left;margin-top:6px;">পরিমাণঃ ${formatItemQty(item.brand, eff)} · দরঃ ${fmt(item.sellPrice)} · মোটঃ ${fmt(totalAmt)}</div>
 <button class="btn btn-outline" style="margin-top:8px;padding:6px 12px;font-size:12px;" onclick="openCartItemModal('${jsq(item.brand)}', ${item.mm}, ${item.size}, ${idx})">✏️ এডিট</button>
 </div>`;
          })
          .join("");

  return `
 <div class="panel" style="margin-bottom:16px;">
 <h3>পণ্যের তালিকা (${cart.length} আইটেম)</h3>
 ${itemRows}
 <button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:6px;" onclick="switchView('salesPicker')">➕ আইটেম যোগ করুন</button>
 <div style="display:flex;justify-content:space-between;padding-top:14px;margin-top:10px;border-top:2px solid var(--ink);font-weight:700;font-size:14.5px;">
 <span>সাবটোটাল</span><span class="mono">${fmt(itemsSubtotal)}</span>
 </div>
 </div>
 <div class="panel" style="max-width:520px;">
 <div class="field">
 <label>ক্যাশ মেমো নম্বর</label>
 <input type="number" id="invNumber" value="${invoiceCounter}" min="1">
 </div>
 <div class="field">
 <label>বিক্রয়কারী — কে এই ক্যাশ মেমোটি করছেন</label>
 <select id="invSalesBy">${salesByOptions || '<option value="">— নির্বাচন করুন —</option>'}</select>
 </div>
  ${saleCustomerToggleHtml()}
 ${saleCustomerFieldsHtml()}
 <div class="field"><label>বিক্রয়ের তারিখ</label><input type="date" id="invDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>পণ্যের সাবটোটাল</label><input type="text" value="${fmt(itemsSubtotal)}" disabled style="background:var(--steel-100);color:var(--steel-700);"></div>
 <div class="field"><label>ডেলিভারি চার্জ (৳) — না থাকলে ০ রাখুন</label><input type="number" id="invDelivery" value="0" min="0" oninput="checkoutRecalc(${itemsSubtotal})"></div>
 <div class="field"><label>অন্যান্য খরচের বিবরণ (ঐচ্ছিক)</label><input type="text" id="invExpenseLabel" placeholder="যেমনঃ লেবার খরচ, লোড-আনলোড"></div>
 <div class="field"><label>অন্যান্য খরচের পরিমাণ (৳)</label><input type="number" id="invExpenseAmt" value="0" min="0" oninput="checkoutRecalc(${itemsSubtotal})"></div>
 <div class="field"><label>ছাড়/ডিসকাউন্ট (৳)</label><input type="number" id="invDiscount" value="0" min="0" oninput="checkoutRecalc(${itemsSubtotal})"></div>
  <div class="field">
 <label>জমার পরিমাণ</label>
 <input type="number" id="invPaid" value="${saleCustomerType === "credit" ? "" : itemsSubtotal}" min="0" placeholder="${saleCustomerType === "credit" ? "খালি রাখলে সম্পূর্ণ বাকি হবে" : "0"}" oninput="checkoutRecalc(${itemsSubtotal})">
 </div>
 <div style="background:var(--steel-100); border-radius:8px; padding:12px 14px; font-size:13.5px;">
 <div style="display:flex;justify-content:space-between;"><span>সর্বমোট বিল</span><b class="mono" id="invGrandVal">${fmt(itemsSubtotal)}</b></div>
 <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>বাকি থাকবে</span><b class="mono" id="invDueVal">${fmt(0)}</b></div>
 </div>
 <div style="font-size:11.5px;color:var(--steel-500);margin:8px 0 16px;">পুরো টাকা পরিশোধ হলে এই গ্রাহক "নগদ ক্রেতা" পেজে (সার্চযোগ্য) যুক্ত হবে। বাকি বা আংশিক বাকি থাকলে ক্রেতা স্বয়ংক্রিয়ভাবে বাকির খাতায় যুক্ত হয়ে যাবেন।</div>
 <button class="checkout-btn" onclick="confirmInvoice(${itemsSubtotal})" ${cart.length === 0 ? "disabled" : ""}>ক্যাশ মেমো তৈরি করুন →</button>
 ${cart.length === 0 ? `<div style="font-size:11px;color:var(--red);margin-top:6px;text-align:center;">আগে অন্তত একটা পণ্য যোগ করুন</div>` : ""}
 </div>`;
}
function renderSalesPicker() {
  let bodyHtml;

  if (posStep === 0) {
    bodyHtml = `
 <div class="back-row">
 <button class="btn btn-outline" onclick="switchView('sales')">← বিক্রয়ে ফিরে যান</button>
 <div class="cur-brand">🛒 কার্টে আছে ${cart.length} আইটেম</div>
 </div>
 ${categoryCardsHtml("sales")}`;
  } else if (posStep === 1) {
    const q = posBrandSearch.trim().toLowerCase();
    const catBrandsList = BRANDS.filter(
      (b) => brandCategory[b] === posCategory,
    );
    const filteredBrands = catBrandsList.filter((b) =>
      b.toLowerCase().includes(q),
    );

    const backBar = `<div class="back-row">
 <button class="btn btn-outline" onclick="posGoStep(0)">← ক্যাটাগরি</button>
 <div class="cur-brand">${esc((PRODUCT_CATEGORIES.find((c) => c.id === posCategory) || {}).name || "")}</div>
 </div>`;

    const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="posBrandSearchInput" value="${posBrandSearch}" placeholder="ব্র্যান্ডের নাম দিয়ে সার্চ করুন, বা 🎤 চেপে বলুন"
 oninput="posBrandSearchInput(this.value)" autocomplete="off">
 <span class="sclear" onclick="posBrandSearchInput('')">✕</span>
 <button type="button" class="voice-btn" onclick="voiceSearchBrand()" title="ভয়েস সার্চ">🎤</button>
 </div>`;

    const grid =
      filteredBrands.length === 0
        ? `<div class="no-match">🔍 "${posBrandSearch}" নামে কোনো ব্র্যান্ড পাওয়া যায়নি</div>`
        : `<div class="brand-grid">` +
          filteredBrands
            .map((b) => {
              let itemCount = 0,
                totalStock = 0;
              Object.values(inventory[b] || {}).forEach((szObj) =>
                Object.values(szObj).forEach((v) => {
                  itemCount++;
                  totalStock += v.stock;
                }),
              );
              return `<button class="brand-tile" onclick="posSelectBrand('${jsq(b)}')">
 <div class="bname">${esc(b)}</div>
 <div class="bmeta">${itemCount} টি আইটেম · ${totalStock} পিস স্টক</div>
 </button>`;
            })
            .join("") +
          `</div>`;

    bodyHtml = backBar + searchBar + grid;
  } else {
    const cat = getCategoryOf(posBrand);
    const lbl = getBrandLabels(posBrand);
    const q = posItemSearch.trim().toLowerCase();
    const results = [];
    Object.keys(inventory[posBrand] || {}).forEach((mm) => {
      Object.keys(inventory[posBrand][mm]).forEach((sz) => {
        const hay = (
          mm +
          " " +
          lbl.unitLabel +
          " " +
          sz +
          " " +
          lbl.sizeLabel
        ).toLowerCase();
        if (q === "" || hay.includes(q))
          results.push({ mm, sz, v: inventory[posBrand][mm][sz] });
      });
    });
    results.sort((a, b) => a.mm - b.mm || a.sz - b.sz);

    const backBar = `<div class="back-row">
 <button class="btn btn-outline" onclick="posGoStep(${cat.hasBrands ? 1 : 0})">← পেছনে যান</button>
 <div class="cur-brand">${esc(posBrand)}</div>
 </div>`;
    const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
  <input type="text" id="posItemSearchInput" value="${posItemSearch}" placeholder="${esc(lbl.unitLabel)} বা ${esc(lbl.sizeLabel)} দিয়ে সার্চ করুন"
 oninput="posItemSearchInput(this.value)" autocomplete="off">
 <span class="sclear" onclick="posItemSearchInput('')">✕</span>
 <button type="button" class="voice-btn" onclick="voiceSearchItem()" title="ভয়েস সার্চ">🎤</button>
 </div>`;

    const isBrandEmpty = Object.keys(inventory[posBrand] || {}).length === 0;
    const list =
      results.length === 0
        ? isBrandEmpty
          ? `<div class="no-match">📦 ${esc(posBrand)}-এ এখনো কোনো মাল স্টকে যোগ করা হয়নি। "স্টক তালিকা" থেকে আগে মাল যোগ করুন।</div>`
          : `<div class="no-match">🔍 মিল খুঁজে পাওয়া যায়নি</div>`
        : `<div class="search-results">` +
          results
            .map((r, i) => {
              return `<div class="result-row">
 <div class="result-serial">${i + 1}</div>
 <div class="result-info">
  <div class="rname">${esc(posBrand)} <span class="rdim">· ${r.mm} ${esc(lbl.unitLabel)}${parseFloat(r.sz) ? ` · ${r.sz} ${esc(lbl.sizeLabel)}` : ""}</span></div>
 <div class="rmeta">ক্রয়ঃ <b>${fmt(r.v.buy)}</b> &nbsp;বিক্রয়ঃ <b>${fmt(r.v.sell)}</b> &nbsp;স্টকঃ <b class="${r.v.stock <= 3 ? "stock-low" : ""}">${r.v.stock} পিস</b></div>
 </div>
    <button class="result-add" onclick="openCartItemModal('${jsq(posBrand)}', ${r.mm}, ${r.sz})">+ যোগ করুন</button>
 </div>`;
            })
            .join("") +
          `</div>`;

    bodyHtml = `${backBar}${searchBar}${list}`;
  }

  const totalPieces = cart.reduce((s, i) => s + cartEffectiveQty(i), 0);
  const totalAmt = cart.reduce(
    (s, i) => s + cartEffectiveQty(i) * i.sellPrice,
    0,
  );
  const cartBar = `
 <div class="back-row" style="justify-content:space-between;">
 <div class="cur-brand">🛒 কার্ট — ${cart.length} আইটেম${cart.length > 0 ? ` · ${totalPieces} পরিমাণ · ${fmt(totalAmt)}` : ""}</div>
 <button class="btn btn-primary" onclick="switchView('sales')">ক্যাশ মেমোে ফিরে যান →</button>
 </div>`;

  return cartBar + bodyHtml;
}
function renderRecentQuickSales() {
  const recent = quickSales.slice(-5).reverse();
  if (recent.length === 0) return "";
  return `
 <div class="panel" style="margin-bottom:16px;">
 <h3 style="font-size:13px;">সাম্প্রতিক দ্রুত বিক্রি</h3>
 ${recent
   .map(
     (q) => `
 <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--steel-100);font-size:12.5px;">
 <div>
 <span class="tx-tag payment">দ্রুত বিক্রি</span>
 ${q.name ? esc(q.name) + " · " : ""}${fmt(q.totalAmount)}${q.profit ? " · লাভ " + fmt(q.profit) : ""}
 </div>
 <button class="btn btn-outline" style="padding:3px 8px;font-size:11px;color:var(--red);" onclick="requestPasswordConfirm('দ্রুত বিক্রি এন্ট্রি মুছুন', () => deleteQuickSale(${q.id}))">✕</button>
 </div>`,
   )
   .join("")}
 </div>`;
}
function renderCartPage() {
  if (cart.length === 0) {
    return `<div class="empty-state"><div class="ic">🛒</div>কার্ট খালি<br><span style="font-size:12px;">আগে "বিক্রয়" থেকে পণ্য যোগ করুন</span></div>
 <div style="text-align:center;margin-top:14px;"><button class="btn btn-primary" onclick="switchView('sales')">← বিক্রয়ে ফিরে যান</button></div>`;
  }
  const rows = cart
    .map((item, idx) => {
      const eff = cartEffectiveQty(item);
      const totalAmt = eff * item.sellPrice;
      return `
 <div class="cart-item" style="background:white;border:1px solid var(--steel-100);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;">
 <div class="cart-item-top">
 <span style="font-weight:700;">${esc(item.brand)}${itemLabelText(item.brand, item.mm, item.size)}</span>
 <span class="remove" onclick="removeFromCart(${idx})">✕ বাদ</span>
 </div>
 <div class="cart-sub" style="text-align:left;margin-top:6px;">পরিমাণঃ ${formatItemQty(item.brand, eff)} · দরঃ ${fmt(item.sellPrice)} · মোটঃ ${fmt(totalAmt)}</div>
 <button class="btn btn-outline" style="margin-top:8px;padding:6px 12px;font-size:12px;" onclick="openCartItemModal('${jsq(item.brand)}', ${item.mm}, ${item.size}, ${idx})">✏️ এডিট</button>
 </div>`;
    })
    .join("");
  const totalPieces = cart.reduce((s, i) => s + cartEffectiveQty(i), 0);
  const totalAmt = cart.reduce(
    (s, i) => s + cartEffectiveQty(i) * i.sellPrice,
    0,
  );
  return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="switchView('sales')">← আরও পণ্য যোগ করুন</button>
 <div class="cur-brand">কার্ট (${cart.length} আইটেম)</div>
 </div>
 ${rows}
 <div class="panel" style="max-width:420px;margin-top:6px;">
 <div class="cart-total-row"><span>মোট পরিমাণ</span><span class="mono">${totalPieces}</span></div>
 <div class="cart-total-row grand"><span>সর্বমোট</span><span>${fmt(totalAmt)}</span></div>
 <button class="checkout-btn" onclick="goToCheckout()">ক্যাশ মেমো তৈরি করুন →</button>
 </div>`;
}
/* ============================================================
 দ্রুত বিক্রি (QUICK SALE)
 ============================================================ */
function quickSalePrompt() {
  openModal(
    "⚡ দ্রুত বিক্রি",
    `
  <div style="font-size:11.5px;color:var(--steel-500);margin-bottom:14px;line-height:1.6;">
 নাম ও ফোন দিলে সাধারণ ক্যাশ মেমোের মতোই তৈরি হবে (বাকির খাতা/নগদ ক্রেতায় যুক্ত হবে)। নাম/ফোন ফাঁকা রাখলে কোনো ক্যাশ মেমো হবে না, কিন্তু বিক্রয়ের পুরো টাকাটা এখনই আপনার মূল হিসাব (ড্যাশবোর্ড, ক্যাশবক্স) ও লাভ-ক্ষতিতে যোগ হয়ে যাবে — লাভ লিখলে সেটাও আলাদাভাবে হিসাব হবে।
 </div>
 <div class="field"><label>ক্রেতার নাম (ঐচ্ছিক)</label><input type="text" id="qsName" placeholder="ঐচ্ছিক"></div>
 <div class="field"><label>ফোন নাম্বার (ঐচ্ছিক)</label><input type="text" id="qsPhone" placeholder="ঐচ্ছিক"></div>
 <div class="field"><label>মোট কত টাকা বিক্রি হলো (৳)</label><input type="number" id="qsAmount" min="0" placeholder="যেমনঃ ১৫০০"></div>
 <div class="field"><label>লাভ (৳) — ঐচ্ছিক</label><input type="number" id="qsProfit" min="0" placeholder="ঐচ্ছিক"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="qsDate" value="${toDateInputValue(new Date())}"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="confirmQuickSale()">সংরক্ষণ করুন</button>
 `,
  );
}
function confirmQuickSale() {
  const name = document.getElementById("qsName").value.trim();
  const phone = document.getElementById("qsPhone").value.trim();
  const totalAmount = Math.max(
    0,
    parseInt(document.getElementById("qsAmount").value) || 0,
  );
  const profitVal = document.getElementById("qsProfit").value.trim();
  const profit = profitVal === "" ? 0 : Math.max(0, parseInt(profitVal) || 0);
  const qsDate = dateFromInput(document.getElementById("qsDate").value);

  if (totalAmount <= 0) {
    showToast("মোট বিক্রয়ের পরিমাণ লিখুন");
    return;
  }

  const hasContact = name !== "" && phone !== "";

  if (hasContact) {
    const buyPrice = Math.max(0, totalAmount - profit);
    const invoice = {
      id: invoiceCounter++,
      items: [
        {
          brand: "দ্রুত বিক্রয়",
          mm: 0,
          size: 0,
          qty: 1,
          sellPrice: totalAmount,
          buyPrice: buyPrice,
          banQty: null,
        },
      ],
      itemsSubtotal: totalAmount,
      delivery: 0,
      expenseLabel: "",
      expenseAmt: 0,
      discount: 0,
      total: totalAmount,
      paid: totalAmount,
      due: 0,
      customer: name,
      customerPhone: phone,
      customerAddress: "",
      date: qsDate,
      custId: null,
      isCash: true,
      duePrev: null,
      dueTotalAfter: null,
      salesBy: currentUser ? currentUser.full_name : "",
      createdAt: new Date(),
    };
    let cc = cashCustomers.find((c) => c.phone === phone);
    if (!cc) {
      cc = {
        id: cashNextId++,
        name,
        phone,
        address: "",
        invoiceIds: [],
        totalSpent: 0,
        lastDate: null,
      };
      cashCustomers.push(cc);
    }
    cc.invoiceIds.push(invoice.id);
    cc.totalSpent += totalAmount;
    cc.lastDate = qsDate;
    invoice.custId = cc.id;
    invoices.push(invoice);
    logActivity(
      "দ্রুত বিক্রি (ক্যাশ মেমো)",
      `#${invoice.id} · ${name} · ${fmt(totalAmount)}`,
    );
    showToast("ক্যাশ মেমো তৈরি হয়েছে");
  } else {
    quickSales.push({
      id: quickSaleNextId++,
      date: qsDate,
      name,
      phone,
      totalAmount,
      profit,
      mode: "sale",
    });
    logActivity(
      "দ্রুত বিক্রি",
      `বিক্রয় ${fmt(totalAmount)}${profit > 0 ? " · লাভ " + fmt(profit) : ""} — মূল হিসাবে যোগ হয়েছে`,
    );
    showToast(
      profit > 0
        ? `বিক্রয় ${fmt(totalAmount)} ও লাভ ${fmt(profit)} মূল হিসাবে যোগ হয়েছে`
        : `বিক্রয় ${fmt(totalAmount)} মূল হিসাবে যোগ হয়েছে`,
    );
  }
  closeModal();
  render();
  persistShopData();
}
function deleteQuickSale(id) {
  const q = quickSales.find((x) => x.id === id);
  if (q) {
    moveToTrash("quickSale", q.name || "নাম নেই", fmt(q.totalAmount), q);
  }
  quickSales = quickSales.filter((x) => x.id !== id);
  render();
  showToast("ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
}
function posGoStep(step) {
  posStep = step;
  if (step === 0) {
    posCategory = null;
    posBrand = null;
    posItemSearch = "";
  }
  if (step === 1) {
    posBrand = null;
    posItemSearch = "";
  }
  render();
  scrollContentTop();
}
function posSelectCategory(id) {
  posCategory = id;
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === id);
  if (cat && !cat.hasBrands) {
    posBrand = cat.name;
    posStep = 2;
  } else {
    posStep = 1;
  }
  posBrandSearch = "";
  posItemSearch = "";
  render();
  pushBackStep();
  scrollContentTop();
}
function posSelectBrand(b) {
  const cat = getCategoryOf(b);
  if (cat.simpleMode) {
    openCartItemModal(b, "1", "1");
    return;
  }
  posBrand = b;
  posStep = 2;
  posItemSearch = "";
  render();
  pushBackStep();
  scrollContentTop();
}

function posBrandSearchInput(val) {
  posBrandSearch = val;
  render();
  const el = document.getElementById("posBrandSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function posItemSearchInput(val) {
  posItemSearch = val;
  render();
  const el = document.getElementById("posItemSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}

function addToCart(brand, mm, size) {
  const item = inventory[brand][mm][size];
  const weight = isWeightBrand(brand);
  const increment = weight ? 1000 : 1;
  const existing = cart.find(
    (c) => c.brand === brand && c.mm === mm && c.size === size,
  );
  if (existing) {
    const eff = cartEffectiveQty(existing);
    existing.qtyPieces = eff + increment;
  } else
    cart.push({
      brand,
      mm,
      size,
      qtyPieces: increment,
      sellPrice: item.sell,
      buyPrice: item.buy,
    });
  const updated = cart.find(
    (c) => c.brand === brand && c.mm === mm && c.size === size,
  );
  const eff2 = cartEffectiveQty(updated);
  const label = weight
    ? `${brand} — ${formatQtyByMode("weight", eff2)}`
    : `${brand}${itemLabelText(brand, mm, size)}`;
  showToast(
    eff2 > item.stock
      ? `${label} কার্টে যোগ হয়েছে — স্টক মাইনাসে যাবে`
      : `${label} কার্টে যোগ হয়েছে`,
  );
  render();
}
function removeFromCart(idx) {
  cart.splice(idx, 1);
  render();
}
/* ============================================================
 কার্ট আইটেম মডাল — নতুন যোগ ও এডিট দুটোর জন্যই ব্যবহৃত হয়
 ============================================================ */
let cimBrand = null,
  cimMM = null,
  cimSize = null,
  cimEditIdx = null,
  cimUnitOptions = [];
let cimSelectedUnitKey = null,
  cimPrevUnitKey = null,
  cimAddFormOpen = false;
const HARDWARE_UNIT_LIST = [
  "কেজি",
  "গ্রাম",
  "ফুট",
  "গজ",
  "পিস",
  "রোল",
  "সেট",
  "প্যাকেট",
  "বান্ডেল",
  "স্কয়ার ফুট",
];

function cartUnitOptionsFor(brand, size, mm) {
  const item0 =
    inventory[brand] && inventory[brand][mm] && inventory[brand][mm][size];
  const extra0 = (item0 && item0.extraUnits) || [];
  if (isWeightBrand(brand)) {
    const pieceFactor = (item0 && item0.pieceGramFactor) || 0;
    const opts = [
      {
        key: "piece",
        label: "পিস",
        factor: pieceFactor || 1,
        needsFactor: !pieceFactor,
      },
      { key: "kg", label: "কেজি", factor: 1000 },
      { key: "g", label: "গ্রাম", factor: 1 },
    ];
    extra0.forEach((u, i) =>
      opts.push({ key: "ex" + i, label: u.label, factor: u.factor }),
    );
    return opts;
  }
  const cat = getCategoryOf(brand);
  if (cat.usesBan) {
    const ppb = piecesPerBan(size);
    return [
      { key: "piece", label: "পিস", factor: 1 },
      { key: "ban", label: "বান", factor: ppb },
    ];
  }
  const lbl = getBrandLabels(brand);
  let opts = [];
  if (cat.id === "hardware") {
    opts = HARDWARE_UNIT_LIST.map((label, i) => ({
      key: "hw" + i,
      label,
      factor: 1,
    }));
  } else {
    opts = [{ key: "base", label: lbl.sizeLabel, factor: 1 }];
    const sizeNum = parseFloat(size);
    if (!isNaN(sizeNum) && sizeNum > 0 && lbl.sizeLabel !== "পিস") {
      opts.push({ key: "piece_fallback", label: "পিস", factor: sizeNum });
    }
  }
  extra0.forEach((u, i) =>
    opts.push({ key: "ex" + i, label: u.label, factor: u.factor }),
  );
  return opts;
}
function openCartItemModal(brand, mm, size, editIdx) {
  cimBrand = brand;
  cimMM = mm;
  cimSize = size;
  cimEditIdx = editIdx != null ? editIdx : null;
  cimUnitOptions = cartUnitOptionsFor(brand, size, mm);
  const invItem = (inventory[brand] &&
    inventory[brand][mm] &&
    inventory[brand][mm][size]) || { sell: 0, buy: 0, stock: 0 };
  const existing = cimEditIdx != null ? cart[cimEditIdx] : null;
  const defaultUnit = cimUnitOptions[0];
  const existingBaseQty = existing ? cartEffectiveQty(existing) : 0;
  const existingUnitQty = defaultUnit.factor
    ? existingBaseQty / defaultUnit.factor
    : existingBaseQty;
  const existingPricePerUnit = existing
    ? Math.round(existing.sellPrice * defaultUnit.factor * 1000000) / 1000000
    : Math.round(invItem.sell * defaultUnit.factor * 1000000) / 1000000;
  const itemName = `${brand}${itemLabelText(brand, mm, size)}`;
  cimSelectedUnitKey = defaultUnit.key;
  cimPrevUnitKey = defaultUnit.key;
  cimAddFormOpen = false;
  const unitSelectHtml2 = cimUnitPickerHtml();

  openModal(
    editIdx != null ? "আইটেম এডিট করুন" : "নতুন আইটেম লাইন",
    `
 <div class="field"><label>পণ্য/সার্ভিস নাম</label><input type="text" id="cimName" value="${esc(itemName)}" disabled style="background:var(--steel-100);"></div>
 <div style="display:flex; gap:10px;">
 <div class="field" style="flex:1;"><label>পরিমাণ</label><input type="number" id="cimQty" min="0" step="any" value="${existingUnitQty || 1}" oninput="cimRecalc()"></div>
 <div class="field" style="flex:1;"><label>প্রাইমারি ইউনিট</label>${unitSelectHtml2}</div>
 </div>
  <div id="cimGramPresets" class="cim-gram-presets" style="display:none;">
 <div class="cim-gram-presets-label">দ্রুত নির্বাচন (গ্রাম)</div>
 <div class="cim-gram-presets-row">
 ${[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((g) => `<button type="button" class="cim-gram-chip" onclick="cimSetQty(${g})">${g}</button>`).join("")}
 </div>
 </div>
 <div class="field"><label id="cimPriceLabel">মূল্য (প্রতি ${esc(defaultUnit.label)})</label><input type="number" id="cimPrice" min="0" step="any" value="${existingPricePerUnit || invItem.sell}" oninput="cimRecalc()"></div>
  <div style="font-weight:600;color:var(--rust);margin:14px 0 6px;">ডিসকাউন্ট</div>
 <div class="cim-disc-row">
 <div class="cim-disc-box"><input type="number" id="cimDiscPercent" min="0" max="100" value="0" oninput="cimRecalc()"><span class="cim-disc-tag amber">%</span></div>
 <div class="cim-disc-box"><span class="cim-disc-tag dark">৳</span><input type="number" id="cimDiscAmount" min="0" value="0" oninput="cimRecalc()"></div>
 </div>
 <div style="background:var(--steel-100); border-radius:8px; padding:12px 14px; font-size:13.5px;">
 <div style="display:flex;justify-content:space-between;"><span>সাব টোটাল</span><b class="mono" id="cimSubtotal">৳০</b></div>
 <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>ডিসকাউন্ট</span><b class="mono" id="cimDiscountVal">৳০</b></div>
 <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid var(--steel-300);font-size:15px;"><span>মোট মূল্য</span><b class="mono" id="cimTotal">৳০</b></div>
 </div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="cimSave()">ঠিক আছে</button>
 `,
  );
  cimRecalc();
  cimGramPresetsUpdate();
  if (defaultUnit.needsFactor) cimUnitPick(defaultUnit.key);
}

function cimUnitPickerHtml() {
  const cimCat = getCategoryOf(cimBrand);
  const allowAdd = !cimCat.usesBan;
  if (cimUnitOptions.length <= 1 && !allowAdd) {
    return `<input type="text" value="${esc(cimUnitOptions[0].label)}" disabled>`;
  }
  const cur =
    cimUnitOptions.find((u) => u.key === cimSelectedUnitKey) ||
    cimUnitOptions[0];
  const opts = cimUnitOptions
    .map(
      (u) =>
        `<div class="unit-opt ${u.key === cimSelectedUnitKey ? "active" : ""}" onclick="cimUnitPick('${u.key}')">${esc(u.label)}</div>`,
    )
    .join("");
  const addTile = allowAdd
    ? `<div class="unit-opt add-unit" onclick="cimAddFormToggle()">➕ নতুন ইউনিট যোগ করুন</div>`
    : "";
  return `
 <div class="unit-picker">
   <button type="button" class="unit-picker-btn" onclick="cimUnitPickerToggle()">
     <span id="cimUnitPickerLabel">${esc(cur ? cur.label : "")}</span><span class="unit-picker-arrow">▾</span>
   </button>
   <div class="unit-picker-list" id="cimUnitList" style="display:none;">${opts}${addTile}</div>
 </div>
 <div id="cimAddUnitForm" class="cim-add-unit-form" style="display:${cimAddFormOpen ? "flex" : "none"};">
 <input type="text" id="cimNewUnitLabel" placeholder="ইউনিটের নাম (যেমনঃ থান)">
  <input type="number" id="cimNewUnitFactor" min="0" step="any" placeholder="= কত ${esc(isWeightBrand(cimBrand) ? "গ্রাম" : getBrandLabels(cimBrand).sizeLabel)}">
 <button type="button" class="btn btn-primary" onclick="cimAddFormConfirm()">যোগ করুন</button>
 </div>`;
}
function cimAddFormToggle() {
  cimAddFormOpen = !cimAddFormOpen;
  const list = document.getElementById("cimUnitList");
  if (list) list.style.display = "none";
  const form = document.getElementById("cimAddUnitForm");
  if (form) {
    form.style.display = cimAddFormOpen ? "flex" : "none";
    if (cimAddFormOpen) document.getElementById("cimNewUnitLabel").focus();
  }
}
function cimAddFormConfirm() {
  const label = document.getElementById("cimNewUnitLabel").value.trim();
  const factor =
    parseFloat(document.getElementById("cimNewUnitFactor").value) || 0;
  if (!label || factor <= 0) {
    showToast("ইউনিটের নাম ও সঠিক পরিমাণ লিখুন");
    return;
  }
  if (!inventory[cimBrand][cimMM][cimSize].extraUnits) {
    inventory[cimBrand][cimMM][cimSize].extraUnits = [];
  }
  inventory[cimBrand][cimMM][cimSize].extraUnits.push({ label, factor });
  persistShopData();
  cimUnitOptions = cartUnitOptionsFor(cimBrand, cimSize, cimMM);
  cimSelectedUnitKey = cimUnitOptions[cimUnitOptions.length - 1].key;
  cimAddFormOpen = false;
  const wrap = document.getElementById("cimUnit")
    ? document.getElementById("cimUnit").parentElement
    : null;
  const container = document.querySelector(".unit-picker")?.parentElement;
  if (container) {
    container.innerHTML = cimUnitPickerHtml();
  }
  cimUnitPick(cimSelectedUnitKey);
  showToast("নতুন ইউনিট যোগ হয়েছে");
}
function cimUnitPickerToggle() {
  const list = document.getElementById("cimUnitList");
  if (list)
    list.style.display = list.style.display === "none" ? "block" : "none";
}
function cimUnitPick(key) {
  let unit = cimUnitOptions.find((u) => u.key === key) || cimUnitOptions[0];
  if (unit.needsFactor) {
    const val = window.prompt("১ পিস = কত গ্রাম?", "");
    const grams = parseFloat(bnDigitsToEn(val || "")) || 0;
    if (grams <= 0) {
      showToast("সঠিক পরিমাণ দিন");
      return;
    }
    if (
      inventory[cimBrand] &&
      inventory[cimBrand][cimMM] &&
      inventory[cimBrand][cimMM][cimSize]
    ) {
      inventory[cimBrand][cimMM][cimSize].pieceGramFactor = grams;
      persistShopData();
    }
    cimUnitOptions = cartUnitOptionsFor(cimBrand, cimSize, cimMM);
    unit = cimUnitOptions.find((u) => u.key === key) || cimUnitOptions[0];
  }
  cimSelectedUnitKey = key;
  const list = document.getElementById("cimUnitList");
  const labelEl = document.getElementById("cimUnitPickerLabel");
  if (list) {
    list.style.display = "none";
    list.querySelectorAll(".unit-opt").forEach((el, i) => {
      el.classList.toggle(
        "active",
        cimUnitOptions[i] && cimUnitOptions[i].key === key,
      );
    });
  }
  if (labelEl) labelEl.textContent = unit.label;
  const priceEl = document.getElementById("cimPrice");
  const oldUnit = cimUnitOptions.find((u) => u.key === cimPrevUnitKey);
  if (priceEl) {
    const curPricePerUnit = parseFloat(priceEl.value) || 0;
    if (oldUnit && oldUnit.factor && curPricePerUnit > 0) {
      // আগের ইউনিটের দাম থেকে নতুন ইউনিটের দামে রূপান্তর — যা আছে সেটার ভিত্তিতেই
      const pricePerBase = curPricePerUnit / oldUnit.factor;
      priceEl.value =
        Math.round(pricePerBase * unit.factor * 1000000) / 1000000;
    } else {
      const invItem = (inventory[cimBrand] &&
        inventory[cimBrand][cimMM] &&
        inventory[cimBrand][cimMM][cimSize]) || { sell: 0 };
      priceEl.value =
        Math.round(invItem.sell * unit.factor * 1000000) / 1000000;
    }
  }
  cimPrevUnitKey = key;
  const lblEl = document.getElementById("cimPriceLabel");
  if (lblEl) lblEl.textContent = "মূল্য (প্রতি " + unit.label + ")";
  cimRecalc();
  cimGramPresetsUpdate();
}
function cimGramPresetsUpdate() {
  const presetsEl = document.getElementById("cimGramPresets");
  if (!presetsEl) return;
  presetsEl.style.display = cimSelectedUnitKey === "g" ? "block" : "none";
}
function cimSetQty(val) {
  const qtyEl = document.getElementById("cimQty");
  if (!qtyEl) return;
  qtyEl.value = val;
  cimRecalc();
}

function cimRecalc() {
  const qtyEl = document.getElementById("cimQty");
  const priceEl = document.getElementById("cimPrice");
  const discPEl = document.getElementById("cimDiscPercent");
  const discAEl = document.getElementById("cimDiscAmount");
  if (!qtyEl || !priceEl) return;
  const qty = Math.max(0, parseFloat(qtyEl.value) || 0);
  const price = Math.max(0, parseFloat(priceEl.value) || 0);
  const discP = Math.max(0, parseFloat(discPEl.value) || 0);
  const discA = Math.max(0, parseFloat(discAEl.value) || 0);
  const subtotal = qty * price;
  const discountTotal = Math.min(subtotal, (subtotal * discP) / 100 + discA);
  const total = Math.max(0, subtotal - discountTotal);
  document.getElementById("cimSubtotal").textContent = fmt(
    Math.round(subtotal),
  );
  document.getElementById("cimDiscountVal").textContent = fmt(
    Math.round(discountTotal),
  );
  document.getElementById("cimTotal").textContent = fmt(Math.round(total));
}

function cimSave() {
  const unit =
    cimUnitOptions.find((u) => u.key === cimSelectedUnitKey) ||
    cimUnitOptions[0];
  const qty = Math.max(
    0,
    parseFloat(document.getElementById("cimQty").value) || 0,
  );
  const price = Math.max(
    0,
    parseFloat(document.getElementById("cimPrice").value) || 0,
  );
  const discP = Math.max(
    0,
    parseFloat(document.getElementById("cimDiscPercent").value) || 0,
  );
  const discA = Math.max(
    0,
    parseFloat(document.getElementById("cimDiscAmount").value) || 0,
  );
  if (qty <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const subtotal = qty * price;
  const discountTotal = Math.min(subtotal, (subtotal * discP) / 100 + discA);
  const total = Math.max(0, subtotal - discountTotal);
  const baseQty = Math.round(qty * unit.factor * 100) / 100;
  const finalPricePerBase = baseQty > 0 ? total / baseQty : 0;
  const invItem = (inventory[cimBrand] &&
    inventory[cimBrand][cimMM] &&
    inventory[cimBrand][cimMM][cimSize]) || { buy: 0 };

  const banQtyVal = unit.key === "ban" ? qty : null;
  if (cimEditIdx != null) {
    const item = cart[cimEditIdx];
    item.qtyPieces = baseQty;
    item.sellPrice = Math.round(finalPricePerBase * 1000000) / 1000000;
    item.banQty = banQtyVal;
  } else {
    cart.push({
      brand: cimBrand,
      mm: cimMM,
      size: cimSize,
      qtyPieces: baseQty,
      sellPrice: Math.round(finalPricePerBase * 1000000) / 1000000,
      buyPrice: invItem.buy,
      banQty: banQtyVal,
    });
  }

  closeModal();
  showToast(
    cimEditIdx != null ? "আইটেম আপডেট হয়েছে" : "আইটেম কার্টে যোগ হয়েছে",
  );
  render();
}
function sellFeetPerBan(sizeFeet) {
  // বিক্রির সময় ৭ ফুট ও ১০ ফুট সাইজের ক্ষেত্রে ৭০ ফুটে এক বান ধরা হয় (বাকি ২ ফুট লাভ থেকে যায়)
  const sz = Number(sizeFeet);
  if (sz === 7 || sz === 10) return 70;
  return FEET_PER_BAN;
}
function piecesPerBan(sizeFeet) {
  const num = parseFloat(sizeFeet);
  if (isNaN(num) || num <= 0) return 0;
  const feetPerBan = sellFeetPerBan(num);
  return feetPerBan / num;
}
function cartEffectiveQty(item) {
  return Math.round((Number(item.qtyPieces) || 0) * 100) / 100;
}
function updateCartBan(idx, val) {
  const item = cart[idx];
  if (val === "") {
    render();
    return;
  }
  const ppb = piecesPerBan(item.size);
  const ban = Math.max(0, parseFloat(val) || 0);
  item.qtyPieces = Math.round(ppb * ban);
  render();
}
function updateCartPieces(idx, val) {
  const item = cart[idx];
  if (val === "") {
    render();
    return;
  }
  item.qtyPieces = Math.max(0, parseFloat(val) || 0);
  render();
}
function updateCartPrice(idx, val) {
  cart[idx].sellPrice = Math.max(0, parseInt(val) || 0);
  render();
}
function updateCartBanPrice(idx, val) {
  const item = cart[idx];
  const ppb = piecesPerBan(item.size);
  if (val === "" || !ppb) {
    render();
    return;
  }
  const banPrice = Math.max(0, parseFloat(val) || 0);
  item.sellPrice = Math.round(banPrice / ppb);
  render();
}

function setCartQtyMode(idx, mode) {
  // আর ব্যবহার হচ্ছে না — এখন সব ঘর একসাথে দেখা যায়, রেখে দেওয়া নিরাপদ
  render();
}
function updateCartTotalAmount(idx, val) {
  const item = cart[idx];
  const maxStock = inventory[item.brand][item.mm][item.size].stock;
  if (val === "") {
    render();
    return;
  }
  const totalAmt = Math.max(0, parseFloat(val) || 0);
  if (!item.sellPrice) {
    showToast("আগে দর (প্রতি পিস) লিখুন");
    return;
  }
  let qty = Math.round(totalAmt / item.sellPrice);
  if (qty > maxStock) {
    qty = maxStock;
    showToast("স্টকে যতটুকু আছে তার বেশি বিক্রি করা যাবে না");
  }
  item.qtyMode = "piece";
  item.qtyPieces = qty;
  item.qtyBan = null;
  render();
}

/* ============================================================
 চেকআউট / ক্যাশ মেমো তৈরি
 ============================================================ */
async function goToCheckout() {
  if (cart.length === 0) {
    showToast("কার্ট খালি — আগে একটি পণ্য যোগ করুন");
    return;
  }
  try {
    await loadStaffList();
  } catch (e) {
    /* সাইলেন্টলি ব্যর্থ */
  }
  switchView("checkout");
}
function renderCheckout() {
  if (cart.length === 0) {
    return `<div class="empty-state"><div class="ic">🧾</div>কার্ট খালি<br><span style="font-size:12px;">আগে "বিক্রয়" থেকে পণ্য যোগ করুন</span></div>
 <div style="text-align:center;margin-top:14px;"><button class="btn btn-primary" onclick="switchView('sales')">← বিক্রয়ে ফিরে যান</button></div>`;
  }
  const itemsSubtotal = cart.reduce(
    (s, i) => s + cartEffectiveQty(i) * i.sellPrice,
    0,
  );
  const customerOptions = ledger
    .map(
      (l) =>
        `<option value="${l.id}">${esc(l.name)}${l.phone ? " · " + esc(l.phone) : ""}</option>`,
    )
    .join("");
  const teamMembers = [];
  if (currentUser)
    teamMembers.push({
      id: currentUser.id,
      name: currentUser.full_name,
      role: currentUser.role,
    });
  (staffList || []).forEach((s) => {
    if (!teamMembers.find((t) => t.id === s.id))
      teamMembers.push({ id: s.id, name: s.full_name, role: "staff" });
  });
  const salesByOptions = teamMembers
    .map(
      (t) =>
        `<option value="${esc(t.name)}" ${currentUser && t.id === currentUser.id ? "selected" : ""}>${esc(t.name)}${t.role === "owner" ? " (মালিক)" : " (স্টাফ)"}</option>`,
    )
    .join("");
  const cartSummaryRows = cart
    .map((item) => {
      const eff = cartEffectiveQty(item);
      const weight = isWeightBrand(item.brand);
      const nameHtml = weight
        ? esc(item.brand)
        : `${esc(item.brand)}${itemLabelText(item.brand, item.mm, item.size)}`;
      return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--steel-100);">
 <span>${nameHtml} <span class="mono" style="color:var(--steel-500);">× ${formatItemQty(item.brand, eff)}</span></span>
 <b class="mono">${fmt(eff * item.sellPrice)}</b>
 </div>`;
    })
    .join("");
  return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="switchView('cart')">← কার্টে ফিরে যান</button>
 <div class="cur-brand">ক্যাশ মেমো তৈরি করুন</div>
 </div>
 <div class="panel" style="margin-bottom:16px;">
 <h3>কার্টের পণ্য (${cart.length} আইটেম)</h3>
 ${cartSummaryRows}
 <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:6px;border-top:2px solid var(--ink);font-weight:700;font-size:14.5px;">
 <span>সাবটোটাল</span><span class="mono">${fmt(itemsSubtotal)}</span>
 </div>
 </div>
 <div class="panel" style="max-width:520px;">
 <div class="field">
 <label>ক্যাশ মেমো নম্বর</label>
 <input type="number" id="invNumber" value="${invoiceCounter}" min="1">
 </div>
 <div class="field">
 <label>বিক্রয়কারী — কে এই ক্যাশ মেমোটি করছেন</label>
 <select id="invSalesBy">${salesByOptions || '<option value="">— নির্বাচন করুন —</option>'}</select>
 </div>
  ${saleCustomerToggleHtml()}
 ${saleCustomerFieldsHtml()}
 <div class="field"><label>বিক্রয়ের তারিখ (যেই তারিখের বিক্রয় হিসেবে গণ্য হবে, দরকার হলে আগের তারিখও দিতে পারেন)</label><input type="date" id="invDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>পণ্যের সাবটোটাল</label><input type="text" value="${fmt(itemsSubtotal)}" disabled style="background:var(--steel-100);color:var(--steel-700);"></div>
 <div class="field"><label>ডেলিভারি চার্জ (৳) — না থাকলে ০ রাখুন</label><input type="number" id="invDelivery" value="0" min="0" oninput="checkoutRecalc(${itemsSubtotal})"></div>
 <div class="field"><label>অন্যান্য খরচের বিবরণ (ঐচ্ছিক)</label><input type="text" id="invExpenseLabel" placeholder="যেমনঃ লেবার খরচ, লোড-আনলোড"></div>
 <div class="field"><label>অন্যান্য খরচের পরিমাণ (৳)</label><input type="number" id="invExpenseAmt" value="0" min="0" oninput="checkoutRecalc(${itemsSubtotal})"></div>
 <div class="field"><label>ছাড়/ডিসকাউন্ট (৳)</label><input type="number" id="invDiscount" value="0" min="0" oninput="checkoutRecalc(${itemsSubtotal})"></div>
   <div class="field">
 <label>জমার পরিমাণ</label>
 <input type="number" id="invPaid" value="${saleCustomerType === "credit" ? "" : itemsSubtotal}" min="0" placeholder="${saleCustomerType === "credit" ? "খালি রাখলে সম্পূর্ণ বাকি হবে" : "0"}" oninput="checkoutRecalc(${itemsSubtotal})">
 </div>
 <div style="background:var(--steel-100); border-radius:8px; padding:12px 14px; font-size:13.5px;">
 <div style="display:flex;justify-content:space-between;"><span>সর্বমোট বিল</span><b class="mono" id="invGrandVal">${fmt(itemsSubtotal)}</b></div>
 <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>বাকি থাকবে</span><b class="mono" id="invDueVal">${fmt(0)}</b></div>
 </div>
 <div style="font-size:11.5px;color:var(--steel-500);margin:8px 0 16px;">পুরো টাকা পরিশোধ হলে এই গ্রাহক "নগদ ক্রেতা" পেজে (সার্চযোগ্য) যুক্ত হবে। বাকি বা আংশিক বাকি থাকলে ক্রেতা স্বয়ংক্রিয়ভাবে বাকির খাতায় যুক্ত হয়ে যাবেন।</div>
 <button class="checkout-btn" onclick="confirmInvoice(${itemsSubtotal})">ক্যাশ মেমো তৈরি করুন →</button>
 </div>`;
}
function checkoutRecalc(itemsSubtotal) {
  const paidEl = document.getElementById("invPaid");
  if (!paidEl) return;
  const delivery = Math.max(
    0,
    parseInt(document.getElementById("invDelivery").value) || 0,
  );
  const expense = Math.max(
    0,
    parseInt(document.getElementById("invExpenseAmt").value) || 0,
  );
  const discount = Math.max(
    0,
    parseInt(document.getElementById("invDiscount").value) || 0,
  );
  const grandTotal = Math.max(0, itemsSubtotal + delivery + expense - discount);
  const paid = Math.min(grandTotal, Math.max(0, parseInt(paidEl.value) || 0));
  const grandEl = document.getElementById("invGrandVal");
  const dueVal = document.getElementById("invDueVal");
  if (grandEl) grandEl.textContent = fmt(grandTotal);
  if (dueVal) dueVal.textContent = fmt(grandTotal - paid);
}
function saleCustomerToggleHtml() {
  return `
 <div class="sale-type-toggle">
 <button type="button" class="stt-btn ${saleCustomerType === "cash" ? "active cash" : ""}" onclick="setSaleCustomerType('cash')">💵 নগদ</button>
 <button type="button" class="stt-btn ${saleCustomerType === "credit" ? "active credit" : ""}" onclick="setSaleCustomerType('credit')">📒 বাকি</button>
 </div>`;
}
function setSaleCustomerType(type) {
  saleCustomerType = type;
  render();
}
function saleCustomerFieldsHtml() {
  if (saleCustomerType === "cash") {
    const opts = cashCustomers
      .map(
        (c) =>
          `<option value="${c.id}">${esc(c.name)}${c.phone ? " · " + esc(c.phone) : ""}</option>`,
      )
      .join("");
    return `
 <div class="field">
 <label>বিদ্যমান নগদ ক্রেতা বাছাই করুন (নাহলে নিচে নতুন নাম লিখুন)</label>
 <select id="invCustomer" onchange="invCashCustomerChange(this.value)"><option value="">— নতুন নগদ ক্রেতা —</option>${opts}</select>
 </div>
 <div class="field"><label>ক্রেতার নাম</label><input type="text" id="invCustName" placeholder="যেমনঃ নগদ ক্রেতা"></div>
 <div class="field"><label>ক্রেতার ঠিকানা</label><input type="text" id="invCustAddress" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>মোবাইল নাম্বার (ঐচ্ছিক)</label><input type="text" id="invCustPhone" placeholder="01xxx-xxxxxx"></div>`;
  }
  const opts = ledger
    .map(
      (l) =>
        `<option value="${l.id}">${esc(l.name)}${l.phone ? " · " + esc(l.phone) : ""}</option>`,
    )
    .join("");
  return `
 <div class="field">
 <label>বিদ্যমান বাকি গ্রাহক বাছাই করুন (নাহলে নিচে নতুন গ্রাহক যোগ করুন)</label>
 <select id="invCustomer" onchange="invCustomerChange(this.value)"><option value="">— নতুন গ্রাহক —</option>${opts}</select>
 </div>
 <div class="field"><label>গ্রাহকের নাম</label><input type="text" id="invCustName" placeholder="যেমনঃ মোঃ করিম"></div>
 <div class="field"><label>গ্রাহকের ঠিকানা</label><input type="text" id="invCustAddress" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="invCustPhone" placeholder="01xxx-xxxxxx"></div>`;
}
function invCashCustomerChange(id) {
  const nameEl = document.getElementById("invCustName");
  const phoneEl = document.getElementById("invCustPhone");
  const addrEl = document.getElementById("invCustAddress");
  if (!id) {
    nameEl.value = "";
    phoneEl.value = "";
    addrEl.value = "";
    return;
  }
  const cc = cashCustomers.find((c) => c.id == id);
  if (!cc) return;
  nameEl.value = cc.name;
  phoneEl.value = cc.phone || "";
  addrEl.value = cc.address || "";
}
function invCustomerChange(id) {
  const nameEl = document.getElementById("invCustName");
  const phoneEl = document.getElementById("invCustPhone");
  const addrEl = document.getElementById("invCustAddress");
  if (!id) {
    nameEl.value = "";
    phoneEl.value = "";
    addrEl.value = "";
    return;
  }
  const cust = ledger.find((l) => l.id == id);
  nameEl.value = cust.name;
  phoneEl.value = cust.phone || "";
  addrEl.value = cust.address || "";
}
function confirmInvoice(itemsSubtotal) {
  const invNumberEl = document.getElementById("invNumber");
  const invNumber = invNumberEl ? parseInt(invNumberEl.value) : NaN;
  if (!invNumber || invNumber < 1) {
    showToast("সঠিক ক্যাশ মেমো নম্বর দিন");
    return;
  }
  if (invoices.find((x) => x.id === invNumber)) {
    showToast("এই ক্যাশ মেমো নম্বর আগে থেকেই ব্যবহৃত হয়েছে — অন্য নম্বর দিন");
    return;
  }
  const custId =
    saleCustomerType === "credit"
      ? document.getElementById("invCustomer").value
      : "";
  const typedName = document.getElementById("invCustName").value.trim();
  const typedAddress = document.getElementById("invCustAddress").value.trim();
  const typedPhone = document.getElementById("invCustPhone").value.trim();
  const delivery = Math.max(
    0,
    parseInt(document.getElementById("invDelivery").value) || 0,
  );
  const expenseLabel = document.getElementById("invExpenseLabel").value.trim();
  const expenseAmt = Math.max(
    0,
    parseInt(document.getElementById("invExpenseAmt").value) || 0,
  );
  const discount = Math.max(
    0,
    parseInt(document.getElementById("invDiscount").value) || 0,
  );
  const grandTotal = Math.max(
    0,
    itemsSubtotal + delivery + expenseAmt - discount,
  );
  const paid = Math.min(
    grandTotal,
    Math.max(0, parseInt(document.getElementById("invPaid").value) || 0),
  );
  const due = grandTotal - paid;
  const invDate = dateFromInput(document.getElementById("invDate").value);
  const salesByEl = document.getElementById("invSalesBy");
  const salesBy =
    salesByEl && salesByEl.value
      ? salesByEl.value
      : currentUser
        ? currentUser.full_name
        : "";

  cart.forEach((item) => {
    inventory[item.brand][item.mm][item.size].stock -= cartEffectiveQty(item);
  });
  const finalCartItems = cart.map((item) => ({
    brand: item.brand,
    mm: item.mm,
    size: item.size,
    qty: cartEffectiveQty(item),
    sellPrice: item.sellPrice,
    buyPrice: item.buyPrice,
    banQty: item.banQty != null ? item.banQty : null,
  }));

  let customerName,
    customerPhone,
    customerAddress,
    custIdFinal = null,
    isCash = false;
  let duePrevVal = null,
    dueTotalAfterVal = null;
  if (custId) {
    const cust = ledger.find((l) => l.id == custId);
    customerName = cust.name;
    customerPhone = cust.phone;
    customerAddress = typedAddress || cust.address;
    custIdFinal = cust.id;
    duePrevVal = cust.due;
    if (due > 0) cust.due += due;
    dueTotalAfterVal = cust.due;
  } else {
    customerName = typedName || "নগদ ক্রেতা";
    customerPhone = typedPhone;
    customerAddress = typedAddress;
    if (saleCustomerType === "credit" || due > 0) {
      const existingDup = ledger.find(
        (l) =>
          normalizeStr(l.name) === normalizeStr(customerName) &&
          normalizeStr(l.phone) === normalizeStr(customerPhone),
      );
      if (existingDup) {
        // নাম ও নাম্বার আগের কারো সাথে হুবহু মিলে গেলে নতুন এন্ট্রি না বানিয়ে পুরনোটাতেই বাকি যোগ হবে
        duePrevVal = existingDup.due;
        if (due > 0) existingDup.due += due;
        existingDup.paidTotal = (existingDup.paidTotal || 0) + paid;
        custIdFinal = existingDup.id;
        dueTotalAfterVal = existingDup.due;
      } else {
        duePrevVal = 0;
        const newCust = {
          id: ledgerNextId++,
          name: customerName,
          address: customerAddress,
          phone: customerPhone,
          due: due,
          paidTotal: paid,
          discountTotal: 0,
          addedDate: invDate,
        };
        ledger.push(newCust);
        custIdFinal = newCust.id;
        dueTotalAfterVal = newCust.due;
      }
    } else {
      isCash = true;
      let cc = cashCustomers.find(
        (c) =>
          (customerPhone && c.phone === customerPhone) ||
          (!customerPhone && c.name === customerName),
      );
      if (!cc) {
        cc = {
          id: cashNextId++,
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          invoiceIds: [],
          totalSpent: 0,
          lastDate: null,
        };
        cashCustomers.push(cc);
      }
      cc.invoiceIds.push(invNumber);
      cc.totalSpent += grandTotal;
      cc.lastDate = invDate;
      if (customerPhone && !cc.phone) cc.phone = customerPhone;
      if (customerAddress && !cc.address) cc.address = customerAddress;
      custIdFinal = cc.id;
    }
  }

  const invoice = {
    id: invNumber,
    items: finalCartItems,
    itemsSubtotal,
    delivery,
    expenseLabel,
    expenseAmt,
    discount,
    total: grandTotal,
    paid,
    due,
    customer: customerName,
    customerPhone,
    customerAddress,
    date: invDate,
    custId: custIdFinal,
    isCash,
    duePrev: duePrevVal,
    dueTotalAfter: dueTotalAfterVal,
    salesBy,
    createdAt: new Date(),
  };
  invoices.push(invoice);
  invoiceCounter = Math.max(invoiceCounter, invNumber + 1);
  logActivity(
    "নতুন ক্যাশ মেমো তৈরি",
    `#${invoice.id} · ${customerName} · ${fmt(grandTotal)}${due > 0 ? " (বাকি " + fmt(due) + ")" : ""}`,
  );

  lastInvoiceId = invoice.id;
  cart = [];
  posStep = 1;
  posBrand = null;
  posBrandSearch = "";
  posItemSearch = "";
  showToast("ক্যাশ মেমো তৈরি হয়েছে");
  persistShopData();
  switchView("invoicePreview");
}

const BN_ONES = [
  "",
  "এক",
  "দুই",
  "তিন",
  "চার",
  "পাঁচ",
  "ছয়",
  "সাত",
  "আট",
  "নয়",
  "দশ",
  "এগারো",
  "বারো",
  "তেরো",
  "চৌদ্দ",
  "পনেরো",
  "ষোলো",
  "সতেরো",
  "আঠারো",
  "উনিশ",
  "বিশ",
  "একুশ",
  "বাইশ",
  "তেইশ",
  "চব্বিশ",
  "পঁচিশ",
  "ছাব্বিশ",
  "সাতাশ",
  "আটাশ",
  "উনত্রিশ",
  "ত্রিশ",
  "একত্রিশ",
  "বত্রিশ",
  "তেত্রিশ",
  "চৌত্রিশ",
  "পঁয়ত্রিশ",
  "ছত্রিশ",
  "সাঁইত্রিশ",
  "আটত্রিশ",
  "উনচল্লিশ",
  "চল্লিশ",
  "একচল্লিশ",
  "বিয়াল্লিশ",
  "তেতাল্লিশ",
  "চুয়াল্লিশ",
  "পঁয়তাল্লিশ",
  "ছেচল্লিশ",
  "সাতচল্লিশ",
  "আটচল্লিশ",
  "উনপঞ্চাশ",
  "পঞ্চাশ",
  "একান্ন",
  "বায়ান্ন",
  "তিপ্পান্ন",
  "চুয়ান্ন",
  "পঞ্চান্ন",
  "ছাপ্পান্ন",
  "সাতান্ন",
  "আটান্ন",
  "উনষাট",
  "ষাট",
  "একষট্টি",
  "বাষট্টি",
  "তেষট্টি",
  "চৌষট্টি",
  "পঁয়ষট্টি",
  "ছেষট্টি",
  "সাতষট্টি",
  "আটষট্টি",
  "উনসত্তর",
  "সত্তর",
  "একাত্তর",
  "বাহাত্তর",
  "তিয়াত্তর",
  "চুয়াত্তর",
  "পঁচাত্তর",
  "ছিয়াত্তর",
  "সাতাত্তর",
  "আটাত্তর",
  "উনআশি",
  "আশি",
  "একাশি",
  "বিরাশি",
  "তিরাশি",
  "চুরাশি",
  "পঁচাশি",
  "ছিয়াশি",
  "সাতাশি",
  "আটাশি",
  "উননব্বই",
  "নব্বই",
  "একানব্বই",
  "বিরানব্বই",
  "তিরানব্বই",
  "চুরানব্বই",
  "পঁচানব্বই",
  "ছিয়ানব্বই",
  "সাতানব্বই",
  "আটানব্বই",
  "নিরানব্বই",
];
function amountToBengaliWords(num) {
  num = Math.round(Math.abs(Number(num) || 0));
  if (num === 0) return "শূন্য টাকা মাত্র";
  let crore = Math.floor(num / 1e7);
  let rem = num % 1e7;
  let lakh = Math.floor(rem / 1e5);
  rem %= 1e5;
  let thousand = Math.floor(rem / 1e3);
  rem %= 1e3;
  let hundred = Math.floor(rem / 100);
  let last = rem % 100;
  let parts = [];
  if (crore > 0) parts.push(BN_ONES[crore] + " কোটি");
  if (lakh > 0) parts.push(BN_ONES[lakh] + " লক্ষ");
  if (thousand > 0) parts.push(BN_ONES[thousand] + " হাজার");
  if (hundred > 0) parts.push(BN_ONES[hundred] + " শত");
  if (last > 0) parts.push(BN_ONES[last]);
  return parts.join(" ") + " টাকা মাত্র";
}
function buildInvoiceHtml(inv) {
  const rows = inv.items
    .map((it, idx) => {
      const weight = isWeightBrand(it.brand);
      const nameHtml = weight
        ? `${esc(it.brand)} <span style="font-size:10px;color:#6B7A82;">(ওজন অনুযায়ী)</span>`
        : `${esc(it.brand)}${itemLabelText(it.brand, it.mm, it.size)}${it.banQty ? ` <span style="font-size:10px;color:#6B7A82;">(${it.banQty} বান)</span>` : ""}`;
      const priceHtml = weight
        ? fmt(it.sellPrice * 1000) + "/কেজি"
        : fmt(it.sellPrice);
      return `
 <tr>
 <td><span class="si-serial">${idx + 1}</span></td>
 <td>${nameHtml}</td>
 <td class="r num" style="text-align:center;">${formatItemQty(it.brand, it.qty)}</td>
 <td class="r num">${priceHtml}</td>
 <td class="r num">${fmt(it.qty * it.sellPrice)}</td>
 </tr>`;
    })
    .join("");
  const delivery = inv.delivery || 0;
  const expenseAmt = inv.expenseAmt || 0;
  const discount = inv.discount || 0;
  const itemsSubtotal =
    inv.itemsSubtotal != null ? inv.itemsSubtotal : inv.total;
  const shopMetaLines = [
    SHOP_PHONE ? `ফোন: ${esc(SHOP_PHONE)}` : "",
    SHOP_MOBILE_BANKING_NUMBER
      ? `${esc(SHOP_MOBILE_BANKING_TYPE || "মোবাইল ব্যাংকিং")}: ${esc(SHOP_MOBILE_BANKING_NUMBER)}`
      : "",
    SHOP_ADDRESS ? `ঠিকানা: ${esc(SHOP_ADDRESS)}` : "",
    SHOP_EMAIL ? `ইমেইল: ${esc(SHOP_EMAIL)}` : "",
  ]
    .filter(Boolean)
    .map((l) => `<div>${l}</div>`)
    .join("");
  return `
 <div class="si-box">
 <div class="si-top">
 <div class="si-top-left">
 <div class="si-logo">${SHOP_LOGO ? `<img src="${SHOP_LOGO}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">` : "🧾"}</div>
 <div>
 <div class="si-shop-name">${esc(SHOP_NAME)}</div>
 <div class="si-shop-meta">${shopMetaLines}</div>
 </div>
 </div>
  <div class="si-top-right">
 <div class="si-title">ক্যাশ মেমো</div>
 <div class="si-date">তারিখ: ${new Date(inv.createdAt || inv.date).toLocaleDateString("bn-BD")}</div>
 </div>
 </div>
 <div class="si-bar">
 <div>ক্যাশ মেমো নম্বর: #${inv.id}</div>
 <div>ক্যাশ মেমো তারিখ: ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 </div>
 <div class="si-cust">
 <div class="si-cust-row"><span class="si-lbl">কাস্টমার:</span><span>${esc(inv.customer)}</span></div>
 ${inv.customerPhone ? `<div class="si-cust-row"><span class="si-lbl">ফোন:</span><span>${telHtml(inv.customerPhone)}</span></div>` : ""}
 ${inv.customerAddress ? `<div class="si-cust-row"><span class="si-lbl">ঠিকানা:</span><span>${esc(inv.customerAddress)}</span></div>` : ""}
 ${inv.salesBy ? `<div class="si-cust-row"><span class="si-lbl">বিক্রয়কারী:</span><span>${esc(inv.salesBy)}</span></div>` : ""}
 </div>
 <table class="si-tbl">
  <thead><tr><th>ক্রম</th><th>আইটেম নাম</th><th class="r" style="text-align:center;">পরিমাণ</th><th class="r">মূল্য</th><th class="r">মোট মূল্য</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 <div class="si-summary-wrap">
 <div class="si-summary">
 <div class="si-srow"><span>সর্বমোট:</span><span class="mono">${fmt(itemsSubtotal)}</span></div>
 <div class="si-srow"><span>ডিসকাউন্ট:</span><span class="mono">${fmt(discount)}</span></div>
 <div class="si-srow"><span>ডেলিভারি চার্জ:</span><span class="mono">${fmt(delivery)}</span></div>
 <div class="si-srow"><span>${esc(inv.expenseLabel) || "ভাড়া"}:</span><span class="mono">${fmt(expenseAmt)}</span></div>
 <div class="si-srow total"><span>মোট মূল্য:</span><span class="mono">${fmt(inv.total)}</span></div>
  <div class="si-srow"><span>মোট জমা:</span><span class="mono">${fmt(inv.paid)}</span></div>
 <div class="si-srow"><span>মোট বাকি:</span><span class="mono">${fmt(inv.due)}</span></div>
 <div class="si-srow"><span>পূর্বের পাওনা:</span><span class="mono">${fmt(inv.duePrev != null ? inv.duePrev : 0)}</span></div>
 <div class="si-srow hl"><span>বর্তমান পাওনা:</span><span class="mono">${fmt(inv.dueTotalAfter != null ? inv.dueTotalAfter : 0)}</span></div>
 </div>
 </div>
 <div class="si-words">কথায়: ${amountToBengaliWords(inv.total)}</div>
 <div class="si-sign">
 <div>ক্রেতার স্বাক্ষর</div>
 <div>অনুমোদনকারীর স্বাক্ষর</div>
 </div>
 </div>`;
}
function printInvoice(inv) {
  lastInvoiceId = inv.id;
  switchView("invoicePreview");
}
function renderInvoicePreview() {
  const inv = invoices.find((x) => x.id === lastInvoiceId);
  if (!inv) {
    return `<div class="empty-state"><div class="ic">🧾</div>কোনো ক্যাশ মেমো পাওয়া যায়নি<br><span style="font-size:12px;">"ক্যাশ মেমো হিস্ট্রি" থেকে দেখুন</span></div>
 <div style="text-align:center;margin-top:14px;"><button class="btn btn-primary" onclick="switchView('sales')">← বিক্রয়ে ফিরে যান</button></div>`;
  }
  const html = buildInvoiceHtml(inv);
  setTimeout(() => {
    const pa = document.getElementById("printArea");
    if (pa) pa.innerHTML = html;
  }, 0);
  const cancelledBanner = inv.cancelled
    ? `<div style="max-width:680px;margin:0 auto 14px;background:#FCEBE9;color:var(--red);border:1px solid #F3C4BC;border-radius:8px;padding:10px 14px;font-size:13px;text-align:center;font-weight:700;">❌ এই ক্যাশ মেমোটি বাতিল করা হয়েছে — স্টক ও হিসাব ফিরিয়ে নেওয়া হয়েছে</div>`
    : "";
  return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="switchView('sales')">← নতুন বিক্রয়</button>
 <div class="cur-brand">ক্যাশ মেমো #${inv.id}</div>
 </div>
 ${cancelledBanner}
 <div style="max-width:680px;margin:0 auto;">
 ${html}
 <div style="display:flex; gap:10px; justify-content:center; margin-top:20px; flex-wrap:wrap;">
 <button class="btn btn-outline" onclick="switchView('invoices')">🗂️ ক্যাশ মেমো হিস্ট্রি</button>
 <button class="btn btn-outline" onclick="downloadPrintArea('${jsq("ক্যাশ মেমো-" + inv.id)}')">⬇ ডাউনলোড (A4)</button>
  <button class="btn btn-primary" onclick="shareInvoice(${inv.id})">📤 শেয়ার করুন</button>
 <button class="btn btn-primary" onclick="tryPrint()">🖨 প্রিন্ট (A4)</button>
 <button class="btn btn-outline" onclick="printThermal(${inv.id},58)">🧾 থার্মাল প্রিন্ট (৫৮mm)</button>
 <button class="btn btn-outline" onclick="downloadThermal(${inv.id},58)">⬇ থার্মাল ডাউনলোড (৫৮mm)</button>
 <button class="btn btn-outline" onclick="printThermal(${inv.id},80)">🧾 থার্মাল প্রিন্ট (৮০mm)</button>
 <button class="btn btn-outline" onclick="downloadThermal(${inv.id},80)">⬇ থার্মাল ডাউনলোড (৮০mm)</button>
  ${!inv.cancelled ? `<button class="btn btn-outline" onclick="editInvoicePrompt(${inv.id})">✏️ ক্যাশ মেমো এডিট করুন</button>` : ""}
 ${!inv.cancelled ? `<button class="btn btn-outline" style="color:var(--red);border-color:var(--red);" onclick="cancelInvoicePrompt(${inv.id})">❌ ক্যাশ মেমো বাতিল করুন</button>` : ""}
 </div>
 </div>`;
}

function editInvoicePrompt(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv || inv.cancelled) return;
  const itemsHtml = inv.items
    .map(
      (it, idx) => `
 <div style="border:1px solid var(--steel-100);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
  <div style="font-weight:600;font-size:13px;margin-bottom:6px;">${esc(it.brand)}${itemLabelText(it.brand, it.mm, it.size)}</div>
 <div style="display:flex;gap:8px;">
 <div style="flex:1;"><label style="font-size:11px;">পরিমাণ (পিস)</label><input type="number" min="0" id="editInvQty${idx}" value="${it.qty}"></div>
 <div style="flex:1;"><label style="font-size:11px;">দর/পিস (৳)</label><input type="number" min="0" id="editInvPrice${idx}" value="${it.sellPrice}"></div>
 </div>
 </div>`,
    )
    .join("");
  openModal(
    `ক্যাশ মেমো #${inv.id} এডিট করুন`,
    `
 <div class="field"><label>ক্রেতার নাম</label><input type="text" id="editInvCustName" value="${esc(inv.customer)}"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="editInvCustPhone" value="${esc(inv.customerPhone || "")}"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="editInvCustAddress" value="${esc(inv.customerAddress || "")}"></div>
 <div style="font-weight:600;font-size:13px;margin:14px 0 8px;">পণ্যের তালিকা</div>
 ${itemsHtml}
 <div class="field"><label>ডেলিভারি চার্জ (৳)</label><input type="number" min="0" id="editInvDelivery" value="${inv.delivery || 0}"></div>
 <div class="field"><label>অন্যান্য খরচের পরিমাণ (৳)</label><input type="number" min="0" id="editInvExpenseAmt" value="${inv.expenseAmt || 0}"></div>
 <div class="field"><label>ছাড়/ডিসকাউন্ট (৳)</label><input type="number" min="0" id="editInvDiscount" value="${inv.discount || 0}"></div>
 <div class="field"><label>জমার পরিমাণ (৳)</label><input type="number" min="0" id="editInvPaid" value="${inv.paid}"></div>
 <div style="font-size:11px;color:var(--steel-500);">সংরক্ষণ করলে স্টক ও বাকির হিসাব স্বয়ংক্রিয়ভাবে সমন্বয় হয়ে যাবে।</div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveInvoiceEdit(${invId})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveInvoiceEdit(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;

  const newItems = inv.items.map((it, idx) => {
    const qtyEl = document.getElementById("editInvQty" + idx);
    const priceEl = document.getElementById("editInvPrice" + idx);
    const newQty = Math.max(0, parseInt(qtyEl.value) || 0);
    const newPrice = Math.max(0, parseInt(priceEl.value) || 0);
    const delta = newQty - it.qty;
    if (
      inventory[it.brand] &&
      inventory[it.brand][it.mm] &&
      inventory[it.brand][it.mm][it.size]
    ) {
      inventory[it.brand][it.mm][it.size].stock -= delta;
    }
    return { ...it, qty: newQty, sellPrice: newPrice };
  });

  const itemsSubtotal = newItems.reduce(
    (s, it) => s + it.qty * it.sellPrice,
    0,
  );
  const delivery = Math.max(
    0,
    parseInt(document.getElementById("editInvDelivery").value) || 0,
  );
  const expenseAmt = Math.max(
    0,
    parseInt(document.getElementById("editInvExpenseAmt").value) || 0,
  );
  const discount = Math.max(
    0,
    parseInt(document.getElementById("editInvDiscount").value) || 0,
  );
  const grandTotal = Math.max(
    0,
    itemsSubtotal + delivery + expenseAmt - discount,
  );
  const paid = Math.min(
    grandTotal,
    Math.max(0, parseInt(document.getElementById("editInvPaid").value) || 0),
  );
  const newDue = grandTotal - paid;

  const oldDue = inv.due;
  const oldTotal = inv.total;

  inv.items = newItems;
  inv.itemsSubtotal = itemsSubtotal;
  inv.delivery = delivery;
  inv.expenseAmt = expenseAmt;
  inv.discount = discount;
  inv.total = grandTotal;
  inv.paid = paid;
  inv.due = newDue;
  inv.customer =
    document.getElementById("editInvCustName").value.trim() || inv.customer;
  inv.customerPhone = document.getElementById("editInvCustPhone").value.trim();
  inv.customerAddress = document
    .getElementById("editInvCustAddress")
    .value.trim();

  if (inv.custId != null) {
    if (inv.isCash) {
      const cc = cashCustomers.find((c) => c.id === inv.custId);
      if (cc)
        cc.totalSpent = Math.max(0, cc.totalSpent + (grandTotal - oldTotal));
    } else {
      const cust = ledger.find((l) => l.id === inv.custId);
      if (cust) {
        cust.due = Math.max(0, cust.due + (newDue - oldDue));
        inv.dueTotalAfter = cust.due;
      }
    }
  }

  logActivity(
    "ক্যাশ মেমো এডিট করা হয়েছে",
    `#${inv.id} · নতুন মোট ${fmt(grandTotal)}`,
  );
  closeModal();
  showToast("ক্যাশ মেমো আপডেট হয়েছে");
  persistShopData();
  render();
}

function cancelInvoicePrompt(id) {
  const inv = invoices.find((x) => x.id === id);
  if (!inv || inv.cancelled) return;
  openModal(
    "ক্যাশ মেমো বাতিল করবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">ক্যাশ মেমো <b>#${inv.id}</b> (${esc(inv.customer)} · ${fmt(inv.total)}) বাতিল করা হবে।</p>
 <ul style="font-size:12.5px;color:var(--steel-700);line-height:1.8;padding-left:18px;">
 <li>বিক্রি করা সব পণ্য স্টকে আবার যোগ হবে</li>
 <li>এই ক্যাশ মেমোের কারণে যে বাকি যোগ হয়েছিল সেটা গ্রাহকের হিসাব থেকে বাদ যাবে</li>
 <li>ক্যাশ মেমোটা "বাতিল" হিসেবে রেকর্ডে থাকবে (মুছে যাবে না), কিন্তু কোনো রিপোর্ট/হিসাবে গণনা হবে না</li>
 </ul>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল করুন (থাক)</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('ক্যাশ মেমো বাতিল করুন', () => cancelInvoiceConfirmed(${id}))">হ্যাঁ, ক্যাশ মেমো বাতিল করুন</button>
 `,
  );
}
function cancelInvoiceConfirmed(id) {
  const inv = invoices.find((x) => x.id === id);
  if (!inv || inv.cancelled) return;

  inv.items.forEach((it) => {
    if (
      inventory[it.brand] &&
      inventory[it.brand][it.mm] &&
      inventory[it.brand][it.mm][it.size]
    ) {
      inventory[it.brand][it.mm][it.size].stock += it.qty;
    }
  });

  if (inv.custId != null) {
    const cust = ledger.find((l) => l.id === inv.custId);
    if (cust && inv.due > 0) {
      cust.due = Math.max(0, cust.due - inv.due);
    }
    inv.due = 0;
    if (inv.isCash) {
      const cc = cashCustomers.find((c) => c.id === inv.custId);
      if (cc) {
        cc.invoiceIds = cc.invoiceIds.filter((iid) => iid !== inv.id);
        cc.totalSpent = Math.max(0, cc.totalSpent - inv.total);
      }
    }
  }

  inv.cancelled = true;
  inv.cancelledAt = new Date();
  logActivity(
    "ক্যাশ মেমো বাতিল করা হয়েছে",
    `#${inv.id} · ${inv.customer} · ${fmt(inv.total)}`,
  );

  closeModal();
  showToast("ক্যাশ মেমো বাতিল করা হয়েছে");
  persistShopData();
  render();
}
function openReceiptModal(kind, id) {
  let html, filename;
  if (kind === "invoice") {
    const inv = invoices.find((x) => x.id === id);
    html = buildInvoiceHtml(inv);
    filename = "ক্যাশ মেমো-" + inv.id;
  } else if (kind === "payment") {
    const p = payments.find((x) => x.id === id);
    html = buildPaymentReceiptHtml(p);
    filename = "রশিদ-" + p.id;
  } else if (kind === "income") {
    const inc = incomes.find((x) => x.id === id);
    html = buildIncomeReceiptHtml(inc);
    filename = "আয়-রশিদ-" + inc.id;
  } else {
    const e = expenses.find((x) => x.id === id);
    html = buildExpenseReceiptHtml(e);
    filename = "খরচ-রশিদ-" + e.id;
  }
  document.getElementById("printArea").innerHTML = html;
  openModal(
    "প্রিভিউ — প্রিন্ট বা ডাউনলোড করুন",
    `
 <div style="max-height:50vh; overflow:auto; border:1px solid var(--steel-100); border-radius:8px; padding:10px; background:var(--paper);">${html}</div>
 <div style="font-size:11.5px;color:var(--steel-500);margin-top:10px;">প্রিন্ট বাটনে কাজ না করলে (কিছু ব্রাউজার/ডিভাইসে ব্লক হতে পারে) "ডাউনলোড করুন" চাপুন — এটি সবসময় কাজ করবে এবং ফাইলটি খুলে যেকোনো প্রিন্টার থেকে প্রিন্ট করা যাবে।</div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বন্ধ করুন</button>
 <button class="btn btn-outline" onclick="downloadPrintArea('${jsq(filename)}')">⬇ ডাউনলোড করুন</button>
 <button class="btn btn-primary" onclick="tryPrint()">🖨 প্রিন্ট করুন</button>
 `,
  );
}

/* ============================================================
 স্টক তালিকা (ম্যানেজমেন্ট)
 ============================================================ */
function renderStock() {
  if (stockStep === 0) return categoryCardsHtml("stock");

  if (stockStep === 1) {
    const catBrandsList = BRANDS.filter(
      (b) => brandCategory[b] === stockCategory,
    );
    return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="stockGoStep(0)">← ক্যাটাগরি</button>
 <div class="cur-brand">${esc((PRODUCT_CATEGORIES.find((c) => c.id === stockCategory) || {}).name || "")}</div>
 </div>
 <div class="mgmt-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">একটি ব্র্যান্ডের ঘরে ক্লিক করে স্টক পরিচালনা করুন</div>
 <button class="btn btn-primary" onclick="${(PRODUCT_CATEGORIES.find((c) => c.id === stockCategory) || {}).simpleMode ? "addSimpleProductPrompt()" : "addBrandPrompt()"}">+ নতুন ব্র্যান্ড</button>
 </div>
 <div class="brand-grid">
 ${catBrandsList
   .map((b) => {
     let itemCount = 0,
       totalStock = 0;
     Object.values(inventory[b] || {}).forEach((szObj) =>
       Object.values(szObj).forEach((v) => {
         itemCount++;
         totalStock += v.stock;
       }),
     );
     return `<div class="brand-tile" style="position:relative; cursor:pointer;" onclick="stockSelectBrand('${jsq(b)}')">
 <button type="button" onclick="event.stopPropagation(); editBrandPrompt('${jsq(b)}')" title="ব্র্যান্ড এডিট/মুছুন" style="position:absolute; top:8px; right:8px; background:var(--steel-100); border:none; border-radius:8px; width:28px; height:28px; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✏️</button>
 <div class="bname">${esc(b)}</div>
 <div class="bmeta">${itemCount} টি আইটেম · ${totalStock} পিস স্টক</div>
 </div>`;
   })
   .join("")}
 </div>`;
  }

  const cat = getCategoryOf(stockBrand);
  const usesBan = !!cat.usesBan;
  const lbl = getBrandLabels(stockBrand);
  const q = stockSearch.trim().toLowerCase();
  let rows = "";
  Object.keys(inventory[stockBrand] || {})
    .sort((a, b) => a - b)
    .forEach((mm) => {
      Object.keys(inventory[stockBrand][mm])
        .sort((a, b) => a - b)
        .forEach((sz) => {
          if (q !== "" && !(String(mm).includes(q) || String(sz).includes(q)))
            return;
          const v = inventory[stockBrand][mm][sz];
          const totalVal = v.buy * v.stock;
          const banCell = usesBan
            ? `<td class="num mono">${fmt(
                v.banPrice != null
                  ? v.banPrice
                  : Math.round((v.buy * FEET_PER_BAN) / sz),
              )}</td>`
            : "";
          rows += `<tr>
 <td class="num mono">${mm} ${esc(lbl.unitLabel)}</td><td class="num mono">${sz} ${esc(lbl.sizeLabel)}</td>
 ${banCell}
 <td class="num mono">${fmt(v.buy)}</td><td class="num mono">${fmt(v.sell)}</td>
 <td class="num mono">${v.stock}</td>
 <td class="num mono">${fmt(totalVal)}</td>
 <td>${v.stock <= 3 ? `<span class="pill low">কম স্টক</span>` : `<span class="pill ok">স্বাভাবিক</span>`}</td>
  <td class="tbl-actions">
 <button onclick="editStockPrompt('${jsq(stockBrand)}','${jsq(mm)}','${jsq(sz)}')">এডিট</button>
 <button style="color:var(--red);" onclick="deleteStockItemPrompt('${jsq(stockBrand)}','${jsq(mm)}','${jsq(sz)}')">মুছুন</button>
 </td>
 </tr>`;
        });
    });
  const isBrandEmpty = Object.keys(inventory[stockBrand] || {}).length === 0;
  const colSpan = usesBan ? 9 : 8;
  const emptyMsg = isBrandEmpty
    ? `<tr><td colspan="${colSpan}" class="no-match">📦 ${esc(stockBrand)}-এ এখনো কোনো মাল যোগ করা হয়নি — উপরের "+ নতুন মাল যোগ করুন" চেপে শুরু করুন</td></tr>`
    : `<tr><td colspan="${colSpan}" class="no-match">🔍 কোনো ফলাফল পাওয়া যায়নি</td></tr>`;
  return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="stockGoStep(${cat.hasBrands ? 1 : 0})">← পেছনে যান</button>
  <div class="cur-brand">${esc(stockBrand)}</div>
 <button class="btn btn-outline" style="padding:6px 10px;font-size:12px;" onclick="editBrandPrompt('${jsq(stockBrand)}')">✏️ টাইটেল এডিট</button>
 </div>
 <div class="mgmt-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">${esc(stockBrand)}-এর ${esc(lbl.unitLabel)} ও ${esc(lbl.sizeLabel)} অনুযায়ী স্টক ও মূল্য তালিকা</div>
 <button class="btn btn-primary" onclick="addStockPrompt()">+ নতুন মাল যোগ করুন</button>
 </div>
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
  <input type="text" id="stockSearchInput" value="${stockSearch}" placeholder="${esc(lbl.unitLabel)} বা ${esc(lbl.sizeLabel)} দিয়ে সার্চ করুন..."
 oninput="stockSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="stockSearchInputFn('')">✕</span>
 </div>
 <table class="tbl">
  <thead><tr><th>${esc(lbl.unitLabel)}</th><th>${esc(lbl.sizeLabel)}</th>${usesBan ? "<th>বানের দাম</th>" : ""}<th>ক্রয়মূল্য</th><th>বিক্রয়মূল্য</th><th>স্টক</th><th>মোট মূল্য</th><th>অবস্থা</th><th></th></tr></thead>
 <tbody>${rows || emptyMsg}</tbody>
 </table>`;
}
function stockGoStep(step) {
  stockStep = step;
  if (step === 0) {
    stockCategory = null;
    stockBrand = null;
    stockSearch = "";
  }
  if (step === 1) {
    stockBrand = null;
    stockSearch = "";
  }
  render();
  scrollContentTop();
}
function stockSelectCategory(id) {
  stockCategory = id;
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === id);
  if (cat && !cat.hasBrands) {
    stockBrand = cat.name;
    stockStep = 2;
  } else {
    stockStep = 1;
  }
  stockSearch = "";
  render();
  pushBackStep();
  scrollContentTop();
}
function categoryCardsHtml(navType) {
  const selectFn =
    navType === "stock" ? "stockSelectCategory" : "posSelectCategory";
  return `
 <div class="mgmt-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">একটা ক্যাটাগরিতে ক্লিক করুন</div>
 <button class="btn btn-primary" onclick="addCategoryPrompt()">+ নতুন ক্যাটাগরি</button>
 </div>
 <div class="brand-grid">
 ${PRODUCT_CATEGORIES.map((cat) => {
   let itemCount = 0;
   Object.keys(brandCategory).forEach((b) => {
     if (brandCategory[b] === cat.id && inventory[b]) {
       Object.values(inventory[b]).forEach((mmObj) => {
         itemCount += Object.keys(mmObj).length;
       });
     }
   });
   return `<div class="brand-tile" style="position:relative; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='none';this.style.boxShadow='';" onclick="${selectFn}('${cat.id}')">
 <button type="button" onclick="event.stopPropagation(); editCategoryPrompt('${cat.id}')" title="ক্যাটাগরি এডিট" style="position:absolute; top:8px; right:8px; background:var(--steel-100); border:none; border-radius:8px; width:28px; height:28px; font-size:13px; cursor:pointer;">✏️</button>
 <div style="font-size:26px;margin-bottom:6px;">${cat.icon}</div>
 <div class="bname">${esc(cat.name)}</div>
 <div class="bmeta">${itemCount} টি আইটেম</div>
 </div>`;
 }).join("")}
 </div>`;
}
function addCategoryPrompt() {
  openModal(
    "নতুন ক্যাটাগরি যোগ করুন",
    `
 <div class="field"><label>ক্যাটাগরির নাম</label><input type="text" id="newCatName2" placeholder="যেমনঃ পাইপ"></div>
 <div class="field"><label>আইকন (ইমোজি)</label><input type="text" id="newCatIcon2" value="📦"></div>
    <div class="field"><label>প্রথম ঘরের একক/লেবেল</label>${unitSelectHtml("newCatUnitLabel", "পণ্যের নাম")}</div>
 <div class="field"><label>দ্বিতীয় ঘরের একক/লেবেল (পরিমাণের একক)</label>${unitSelectHtml("newCatSizeLabel", "পরিমাণ")}</div>
 <div class="field"><label><input type="checkbox" id="newCatUsesBan" style="width:auto;margin-right:6px;"> বান (bundle) হিসেবে স্টক ও দাম হিসাব হবে — শুধু টিনের মতো পণ্যের জন্য টিক দিন, বাকি সাধারণ পণ্যের জন্য খালি রাখুন</label></div>
 <div class="field"><label><input type="checkbox" id="newCatSimpleMode" style="width:auto;margin-right:6px;"> সহজ পণ্য মোড — ব্র্যান্ড/সাইজ লাগবে না, শুধু নাম-দাম-স্টক দিয়ে পণ্য যোগ হবে</label></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewCategory()">যোগ করুন</button>
 `,
  );
}
function saveNewCategory() {
  const name = document.getElementById("newCatName2").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  if (PRODUCT_CATEGORIES.some((c) => c.name === name)) {
    showToast("এই নামে ক্যাটাগরি আগে থেকেই আছে");
    return;
  }
  const icon = document.getElementById("newCatIcon2").value.trim() || "📦";
  const hasBrands = true; // এখন থেকে সব ক্যাটাগরিতেই সবসময় আগে ব্র্যান্ড যোগ করতে হবে (টিনের মতো)
  const unitLabel =
    document.getElementById("newCatUnitLabel").value.trim() || "পণ্যের নাম";
  const sizeLabel =
    document.getElementById("newCatSizeLabel").value.trim() || "পরিমাণ";
  const usesBan = document.getElementById("newCatUsesBan").checked;
  const cat = {
    id: "cat" + categoryNextId++,
    name,
    icon,
    hasBrands,
    unitLabel,
    sizeLabel,
    usesBan,
    simpleMode: document.getElementById("newCatSimpleMode").checked,
  };
  PRODUCT_CATEGORIES.push(cat);
  ensureCategoryPseudoBrand(cat);
  closeModal();
  render();
  showToast("নতুন ক্যাটাগরি যুক্ত হয়েছে");
  persistShopData();
}
function editCategoryPrompt(id) {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === id);
  if (!cat) return;
  openModal(
    `ক্যাটাগরি এডিট — ${esc(cat.name)}`,
    `
 <div class="field"><label>ক্যাটাগরির নাম</label><input type="text" id="editCatName2" value="${esc(cat.name)}"></div>
 <div class="field"><label>আইকন (ইমোজি)</label><input type="text" id="editCatIcon2" value="${esc(cat.icon)}"></div>
  <div class="field"><label>প্রথম মাপের একক/লেবেল</label>${unitSelectHtml("editCatUnitLabel", cat.unitLabel)}</div>
 <div class="field"><label>দ্বিতীয় মাপের একক/লেবেল (পরিমাণের একক)</label>${unitSelectHtml("editCatSizeLabel", cat.sizeLabel)}</div>
 <div class="field"><label><input type="checkbox" id="editCatUsesBan" ${cat.usesBan ? "checked" : ""} style="width:auto;margin-right:6px;"> বান (bundle) হিসেবে স্টক ও দাম হিসাব হবে (যেমন টিন)</label></div>
 <div class="field"><label><input type="checkbox" id="editCatSimpleMode" ${cat.simpleMode ? "checked" : ""} style="width:auto;margin-right:6px;"> সহজ পণ্য মোড — ব্র্যান্ড/সাইজ লাগবে না, শুধু নাম-দাম-স্টক দিয়ে পণ্য যোগ হবে</label></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveCategoryEdit('${id}')">সংরক্ষণ করুন</button>
 `,
  );
}
function saveCategoryEdit(id) {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === id);
  if (!cat) return;
  const name = document.getElementById("editCatName2").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  if (!cat.hasBrands && name !== cat.name) {
    if (inventory[cat.name]) {
      inventory[name] = inventory[cat.name];
      delete inventory[cat.name];
    }
    const bIdx = BRANDS.indexOf(cat.name);
    if (bIdx > -1) BRANDS[bIdx] = name;
    delete brandCategory[cat.name];
    brandCategory[name] = cat.id;
  }
  cat.name = name;
  cat.icon = document.getElementById("editCatIcon2").value.trim() || cat.icon;
  cat.unitLabel =
    document.getElementById("editCatUnitLabel").value.trim() || cat.unitLabel;
  cat.sizeLabel =
    document.getElementById("editCatSizeLabel").value.trim() || cat.sizeLabel;
  cat.usesBan = document.getElementById("editCatUsesBan").checked;
  cat.simpleMode = document.getElementById("editCatSimpleMode").checked;
  closeModal();
  render();
  showToast("ক্যাটাগরি আপডেট হয়েছে");
  persistShopData();
}
function stockSelectBrand(b) {
  const cat = getCategoryOf(b);
  if (cat.simpleMode) {
    editSimpleProductPrompt(b);
    return;
  }
  stockBrand = b;
  stockStep = 2;
  stockSearch = "";
  render();
  pushBackStep();
  scrollContentTop();
}
function addBrandPrompt() {
  openModal(
    "নতুন ব্র্যান্ড যোগ করুন",
    `
 <div class="field"><label>ব্র্যান্ডের নাম</label><input type="text" id="newBrandName" placeholder="যেমনঃ বসুন্ধরা স্টিল"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewBrand()">যোগ করুন</button>
 `,
  );
}
function saveNewBrand() {
  const name = document.getElementById("newBrandName").value.trim();
  if (!name) {
    showToast("ব্র্যান্ডের নাম আবশ্যক");
    return;
  }
  if (BRANDS.includes(name)) {
    showToast("এই ব্র্যান্ড আগে থেকেই আছে");
    return;
  }
  BRANDS.push(name);
  inventory[name] = {};
  brandCategory[name] = stockCategory || "tin";
  closeModal();
  render();
  showToast("নতুন ব্র্যান্ড যুক্ত হয়েছে");
  persistShopData();
}
function editBrandPrompt(name) {
  const lbl = getBrandLabels(name);
  openModal(
    `ব্র্যান্ড এডিট — ${esc(name)}`,
    `
 <div class="field"><label>ব্র্যান্ডের নাম পরিবর্তন করুন</label><input type="text" id="editBrandName" value="${esc(name)}"></div>
  <div class="field"><label>প্রথম ঘরের একক/টাইটেল</label>${unitSelectHtml("editBrandUnitLabel", lbl.unitLabel)}</div>
 <div class="field"><label>দ্বিতীয় ঘরের একক/টাইটেল (পরিমাণের একক)</label>${unitSelectHtml("editBrandSizeLabel", lbl.sizeLabel)}</div>
 <div style="font-size:11px;color:var(--steel-500);">এই টাইটেল স্টক, কার্ট, ক্যাশ মেমো — সব জায়গায় দেখাবে।</div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteBrandPrompt('${jsq(name)}')">🗑️ ব্র্যান্ড মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveBrandRename('${jsq(name)}')">সংরক্ষণ করুন</button>
 `,
  );
}
function saveBrandRename(oldName) {
  const newName = document.getElementById("editBrandName").value.trim();
  if (!newName) {
    showToast("ব্র্যান্ডের নাম আবশ্যক");
    return;
  }
  if (newName !== oldName && BRANDS.includes(newName)) {
    showToast("এই নামে আরেকটা ব্র্যান্ড আগে থেকেই আছে");
    return;
  }
  const newUnitLabel = document
    .getElementById("editBrandUnitLabel")
    .value.trim();
  const newSizeLabel = document
    .getElementById("editBrandSizeLabel")
    .value.trim();
  if (newName !== oldName) {
    const idx = BRANDS.indexOf(oldName);
    if (idx > -1) BRANDS[idx] = newName;
    inventory[newName] = inventory[oldName] || {};
    delete inventory[oldName];
    brandCategory[newName] = brandCategory[oldName];
    delete brandCategory[oldName];
    logActivity("ব্র্যান্ডের নাম পরিবর্তন", `${oldName} → ${newName}`);
  }
  delete brandUnitLabel[oldName];
  delete brandSizeLabel[oldName];
  if (newUnitLabel) brandUnitLabel[newName] = newUnitLabel;
  if (newSizeLabel) brandSizeLabel[newName] = newSizeLabel;
  closeModal();
  render();
  showToast("ব্র্যান্ড আপডেট হয়েছে");
  persistShopData();
}
function deleteBrandPrompt(name) {
  const itemCount = Object.keys(inventory[name] || {}).length;
  openModal(
    "ব্র্যান্ড মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">"${esc(name)}" ব্র্যান্ডটি ও এর বর্তমান স্টক তালিকা (${itemCount} টি আইটেম) স্থায়ীভাবে মুছে ফেলা হবে। আগের ক্যাশ মেমো/কেনার খাতার রেকর্ডে ব্র্যান্ডের নাম থেকে যাবে (মুছে যাবে না), শুধু বর্তমান স্টক তালিকা থেকে ব্র্যান্ডটি বাদ যাবে।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('ব্র্যান্ড মুছুন', () => deleteBrandConfirmed('${jsq(name)}'))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteBrandConfirmed(name) {
  moveToTrash(
    "brand",
    name,
    `${Object.keys(inventory[name] || {}).length} টি আইটেম সহ`,
    { name, inventory: inventory[name] || {}, category: brandCategory[name] },
  );
  BRANDS = BRANDS.filter((b) => b !== name);
  delete inventory[name];
  logActivity("ব্র্যান্ড মুছে ফেলা হয়েছে", name);
  closeModal();
  render();
  showToast("ব্র্যান্ড ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
}
function addSimpleProductPrompt() {
  openModal(
    "নতুন পণ্য যোগ করুন",
    `
 <div class="field"><label>পণ্যের নাম</label><input type="text" id="newSimpleName" placeholder="যেমনঃ ফোম সাদা ৩৯ ইঞ্চি"></div>
 <div class="field"><label>পরিমাণ (স্টক)</label><input type="number" id="newSimpleQty" min="0" value="0"></div>
 <div class="field"><label>ক্রয়মূল্য (৳)</label><input type="number" id="newSimpleBuy" min="0" value="0"></div>
 <div class="field"><label>বিক্রয়মূল্য (৳)</label><input type="number" id="newSimpleSell" min="0" value="0"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSimpleProduct()">যোগ করুন</button>
 `,
  );
}
function saveSimpleProduct() {
  const name = document.getElementById("newSimpleName").value.trim();
  if (!name) {
    showToast("পণ্যের নাম আবশ্যক");
    return;
  }
  if (BRANDS.includes(name)) {
    showToast("এই নামে পণ্য আগে থেকেই আছে");
    return;
  }
  const qty = Math.max(
    0,
    parseInt(document.getElementById("newSimpleQty").value) || 0,
  );
  const buy = Math.max(
    0,
    parseInt(document.getElementById("newSimpleBuy").value) || 0,
  );
  const sell = Math.max(
    0,
    parseInt(document.getElementById("newSimpleSell").value) || 0,
  );
  BRANDS.push(name);
  brandCategory[name] = stockCategory;
  inventory[name] = { 1: { 1: { buy, sell, stock: qty } } };
  if (qty > 0 && buy > 0)
    recordPurchase(name, "1", "1", 0, buy, qty, buy, qty * buy);
  closeModal();
  render();
  showToast("নতুন পণ্য যুক্ত হয়েছে");
  persistShopData();
}
function editSimpleProductPrompt(name) {
  const v = (inventory[name] &&
    inventory[name]["1"] &&
    inventory[name]["1"]["1"]) || { buy: 0, sell: 0, stock: 0 };
  openModal(
    `পণ্য এডিট — ${esc(name)}`,
    `
 <div class="field"><label>পণ্যের নাম</label><input type="text" id="editSimpleName" value="${esc(name)}"></div>
 <div class="field"><label>ক্রয়মূল্য (৳)</label><input type="number" id="editSimpleBuy" value="${v.buy}" min="0"></div>
 <div class="field"><label>বিক্রয়মূল্য (৳)</label><input type="number" id="editSimpleSell" value="${v.sell}" min="0"></div>
 <div class="field"><label>স্টক (পরিমাণ)</label><input type="number" id="editSimpleStock" value="${v.stock}" min="0"></div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteBrandPrompt('${jsq(name)}')">🗑️ মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSimpleProductEdit('${jsq(name)}')">সংরক্ষণ করুন</button>
 `,
  );
}
function saveSimpleProductEdit(oldName) {
  const newName = document.getElementById("editSimpleName").value.trim();
  if (!newName) {
    showToast("নাম আবশ্যক");
    return;
  }
  const buy = Math.max(
    0,
    parseInt(document.getElementById("editSimpleBuy").value) || 0,
  );
  const sell = Math.max(
    0,
    parseInt(document.getElementById("editSimpleSell").value) || 0,
  );
  const stock = Math.max(
    0,
    parseInt(document.getElementById("editSimpleStock").value) || 0,
  );
  if (newName !== oldName) {
    if (BRANDS.includes(newName)) {
      showToast("এই নামে আরেকটা পণ্য আছে");
      return;
    }
    const idx = BRANDS.indexOf(oldName);
    if (idx > -1) BRANDS[idx] = newName;
    inventory[newName] = inventory[oldName];
    delete inventory[oldName];
    brandCategory[newName] = brandCategory[oldName];
    delete brandCategory[oldName];
  }
  inventory[newName]["1"]["1"] = { buy, sell, stock };
  closeModal();
  render();
  showToast("পণ্য আপডেট হয়েছে");
  persistShopData();
}
function stockSearchInputFn(val) {
  stockSearch = val;
  render();
  const el = document.getElementById("stockSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function calcBuyFromBan(banPrice, sizeFeet) {
  if (!sizeFeet) return 0;
  return (banPrice * sizeFeet) / FEET_PER_BAN;
}

function setStockAddUnitMode(mode) {
  stockAddUnitMode = mode;
  const banWrap = document.getElementById("banFieldsWrap");
  const pieceWrap = document.getElementById("pieceFieldsWrap");
  const banBtn = document.getElementById("unitModeBanBtn");
  const pieceBtn = document.getElementById("unitModePieceBtn");
  if (banWrap) banWrap.style.display = mode === "ban" ? "block" : "none";
  if (pieceWrap) pieceWrap.style.display = mode === "piece" ? "block" : "none";
  if (banBtn)
    banBtn.className =
      "btn " + (mode === "ban" ? "btn-primary" : "btn-outline");
  if (pieceBtn)
    pieceBtn.className =
      "btn " + (mode === "piece" ? "btn-primary" : "btn-outline");
  addStockRecalc();
}
let stockSellManualOverride = false;
function addStockRecalc() {
  const weightQtyEl = document.getElementById("newWeightQty");
  if (weightQtyEl) {
    const unit = document.getElementById("newWeightUnit").value;
    const qty = Math.max(0, parseFloat(weightQtyEl.value) || 0);
    const grams = Math.round(unit === "kg" ? qty * 1000 : qty);
    const buyPerKg = Math.max(
      0,
      parseFloat(document.getElementById("newWeightBuyPrice").value) || 0,
    );
    const stockEl2 = document.getElementById("newStock");
    const infoEl2 = document.getElementById("newWeightInfo");
    if (stockEl2) stockEl2.value = grams;
    if (infoEl2)
      infoEl2.textContent = `মোট ${formatQtyByMode("weight", grams)} স্টকে যোগ হবে · প্রতি গ্রাম ক্রয়মূল্য ৳${(buyPerKg / 1000).toFixed(3)}`;
    return;
  }
  const szEl = document.getElementById("newSize");
  if (!szEl) return;
  const sz = parseFloat(szEl.value) || 0;
  const stockEl = document.getElementById("newStock");
  const sellEl = document.getElementById("newSell");

  if (stockAddUnitMode === "piece") {
    const pieceQtyEl = document.getElementById("newPieceQty");
    const pieceBuyEl = document.getElementById("newPieceBuyPrice");
    const pieceQty = pieceQtyEl
      ? Math.max(0, parseFloat(pieceQtyEl.value) || 0)
      : 0;
    const buyPerPiece = pieceBuyEl
      ? Math.max(0, parseFloat(pieceBuyEl.value) || 0)
      : 0;
    if (stockEl) stockEl.value = Math.round(pieceQty);
    if (sellEl && !stockSellManualOverride)
      sellEl.value = buyPerPiece > 0 ? buyPerPiece + 10 : "";
    return;
  }

  const banEl = document.getElementById("newBanPrice");
  const banQtyEl = document.getElementById("newBanQty");
  if (!banEl) return;
  const banPrice = parseFloat(banEl.value) || 0;
  const banQty = banQtyEl ? parseFloat(banQtyEl.value) || 0 : 0;
  const piecesPerBan = sz > 0 ? FEET_PER_BAN / sz : 0;
  const totalPieces = Math.round(piecesPerBan * banQty);
  const buyPerPiece = calcBuyFromBan(banPrice, sz);
  const infoEl = document.getElementById("newPiecesInfo");
  const buyEl = document.getElementById("newBuyComputed");
  const totalPiecesEl = document.getElementById("newTotalPiecesInfo");
  if (infoEl)
    infoEl.textContent = `এক বানে (৭২ ফুট) প্রায় ${piecesPerBan ? piecesPerBan.toFixed(1) : "০"} পিস আসে`;
  if (buyEl) buyEl.textContent = fmt(buyPerPiece);
  if (totalPiecesEl)
    totalPiecesEl.textContent = `${banQty || 0} বানে মোট প্রায় ${totalPieces} পিস আসবে`;
  if (stockEl) stockEl.value = totalPieces;
  if (sellEl && !stockSellManualOverride)
    sellEl.value = buyPerPiece > 0 ? buyPerPiece + 10 : "";
}
function editStockRecalc(sz) {
  const banPriceEl = document.getElementById("editBanPrice");
  const buyEl = document.getElementById("editBuyComputed");
  if (!banPriceEl || !buyEl) return;
  const banPrice = parseFloat(banPriceEl.value) || 0;
  const buyPerPiece = calcBuyFromBan(banPrice, sz);
  buyEl.textContent = fmt(buyPerPiece);
}
function editNewBanRecalc(sz) {
  const qtyEl = document.getElementById("editNewBanQty");
  const infoEl = document.getElementById("editNewBanInfo");
  if (!qtyEl || !infoEl) return;
  const banQty = parseFloat(qtyEl.value) || 0;
  const piecesPerBan = sz > 0 ? FEET_PER_BAN / sz : 0;
  const totalPieces = Math.round(piecesPerBan * banQty);
  infoEl.textContent = `${banQty || 0} বানে প্রায় ${totalPieces} পিস আসবে`;
}
function editAddBanToStock(brand, mm, sz) {
  const qtyEl = document.getElementById("editNewBanQty");
  const stockEl = document.getElementById("editStock");
  const banPriceEl = document.getElementById("editBanPrice");
  if (!qtyEl || !stockEl) return;
  const banQty = parseFloat(qtyEl.value) || 0;
  if (banQty <= 0) {
    showToast("কয় বান যোগ হয়েছে তা লিখুন");
    return;
  }
  const banPrice = banPriceEl ? parseFloat(banPriceEl.value) || 0 : 0;
  const piecesPerBanVal = sz > 0 ? FEET_PER_BAN / sz : 0;
  const addPieces = Math.round(piecesPerBanVal * banQty);
  const currentStock = parseInt(stockEl.value) || 0;
  stockEl.value = currentStock + addPieces;
  const buyPerPiece = calcBuyFromBan(banPrice, sz);
  if (banPrice > 0) {
    recordPurchase(brand, mm, sz, banQty, banPrice, addPieces, buyPerPiece);
  }
  qtyEl.value = "";
  document.getElementById("editNewBanInfo").textContent =
    `০ বানে প্রায় ০ পিস আসবে`;
  showToast(
    `${addPieces} পিস স্টকে যোগ হয়েছে ও কেনার খাতায় লেখা হয়েছে — সংরক্ষণ করতে "সংরক্ষণ করুন" চাপুন`,
  );
}

function addStockPrompt() {
  stockSellManualOverride = false;
  const cat = getBrandLabels(stockBrand);
  const catInfo = getCategoryOf(stockBrand);
  const usesBan = !!catInfo.usesBan;
  stockAddUnitMode = usesBan ? "ban" : "piece";
  const firstFieldDefault = catInfo.hasBrands ? MM_LIST[0] : "";
  const secondFieldDefault = catInfo.hasBrands ? SIZE_LIST[0] : "";
  const mmOptions = MM_LIST.map((m) => `<option value="${m}">`).join("");
  const szOptions = SIZE_LIST.map((s) => `<option value="${s}">`).join("");
  const modeToggleHtml = usesBan
    ? `
 <div class="field">
 <label>কীভাবে স্টক যোগ করবেন</label>
 <div style="display:flex;gap:8px;">
 <button type="button" id="unitModeBanBtn" class="btn btn-primary" style="flex:1;justify-content:center;" onclick="setStockAddUnitMode('ban')">📦 বান হিসেবে</button>
 <button type="button" id="unitModePieceBtn" class="btn btn-outline" style="flex:1;justify-content:center;" onclick="setStockAddUnitMode('piece')">🔢 পিস হিসেবে</button>
 </div>
 </div>
  <div id="banFieldsWrap" style="display:block;">
  <div class="field"><label>এক বানের মোট দাম (৳) — এক বানে মোট ৭২ ফুট থাকে</label><input type="number" id="newBanPrice" value="4000" min="0" oninput="addStockRecalc()"></div>
 <div class="field"><label>কয় বান কিনলেন</label><input type="number" id="newBanQty" value="1" min="0" step="0.5" oninput="addStockRecalc()"></div>
 <div style="background:var(--steel-100); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px;">
 <div id="newPiecesInfo">এক বানে (৭২ ফুট) প্রায় — পিস আসে</div>
 <div id="newTotalPiecesInfo" style="margin-top:4px;font-weight:600;">০ বানে মোট প্রায় ০ পিস আসবে</div>
 <div style="display:flex;justify-content:space-between;margin-top:6px;"><span>প্রতি পিস ক্রয়মূল্য (স্বয়ংক্রিয়)</span><b class="mono" id="newBuyComputed">৳০</b></div>
 </div>
 </div>
  <div id="pieceFieldsWrap" style="display:none;">
 <div class="field"><label>কত ${esc(cat.sizeLabel)} স্টকে যোগ করবেন</label><input type="number" id="newPieceQty" value="0" min="0" oninput="addStockRecalc()"></div>
 <div class="field"><label>প্রতি ${esc(cat.sizeLabel)} ক্রয়মূল্য (৳)</label><input type="number" id="newPieceBuyPrice" value="0" min="0" oninput="addStockRecalc()"></div>
 </div>`
    : `
 <div class="field"><label>পরিমাণ (${esc(cat.sizeLabel)})</label><input type="number" id="newPieceQty" value="0" min="0" oninput="addStockRecalc()"></div>
 <div class="field"><label>ক্রয়মূল্য (৳ — প্রতি ${esc(cat.sizeLabel)})</label><input type="number" id="newPieceBuyPrice" value="0" min="0" oninput="addStockRecalc()"></div>`;
  openModal(
    `নতুন মাল যোগ করুন — ${esc(stockBrand)}`,
    `
 <div class="field"><label>${esc(cat.unitLabel)} (তালিকা থেকে বাছুন বা নিজে লিখুন)</label>
   <input type="text" id="newMM" list="mmSuggestList" value="${firstFieldDefault}" placeholder="${catInfo.hasBrands ? "যেমনঃ 14" : "যেমনঃ চেয়ার"}">
 <datalist id="mmSuggestList">${mmOptions}</datalist>
 </div>
  <div class="field"><label>${esc(cat.sizeLabel)} (তালিকা থেকে বাছুন বা নিজে লিখুন)</label>
   <input type="text" id="newSize" list="sizeSuggestList" value="${secondFieldDefault}" placeholder="${catInfo.hasBrands ? "যেমনঃ 8" : "যেমনঃ ৫ পিস"}" oninput="addStockRecalc()">
 <datalist id="sizeSuggestList">${szOptions}</datalist>
 </div>
 ${modeToggleHtml}
 <div class="field"><label>বিক্রয়মূল্য (৳)</label><input type="number" id="newSell" value="570" min="0" oninput="stockSellManualOverride=true;"></div>
 <div class="field"><label>স্টক (${usesBan ? "পিস" : esc(cat.sizeLabel)}) — উপরের হিসাব অনুযায়ী স্বয়ংক্রিয়ভাবে বসেছে, চাইলে হাতে ঠিক করে নিন</label><input type="number" id="newStock" value="0" min="0"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewStock()">যোগ করুন</button>
 `,
  );
  addStockRecalc();
}
function saveNewStock() {
  const weightQtyEl = document.getElementById("newWeightQty");
  if (weightQtyEl) {
    const unit = document.getElementById("newWeightUnit").value;
    const qty = Math.max(0, parseFloat(weightQtyEl.value) || 0);
    const grams = Math.round(unit === "kg" ? qty * 1000 : qty);
    const buyPerKg = Math.max(
      0,
      parseFloat(document.getElementById("newWeightBuyPrice").value) || 0,
    );
    const sellPerKg = Math.max(
      0,
      parseFloat(document.getElementById("newSell").value) || 0,
    );
    const buyPerGram = buyPerKg / 1000;
    const sellPerGram = sellPerKg / 1000;
    const mmKey = "ওজন";
    const szKey = "প্রতিটি";
    if (!inventory[stockBrand][mmKey]) inventory[stockBrand][mmKey] = {};
    inventory[stockBrand][mmKey][szKey] = {
      buy: buyPerGram,
      sell: sellPerGram,
      stock: grams,
    };
    if (grams > 0 && buyPerKg > 0) {
      recordPurchase(
        stockBrand,
        mmKey,
        szKey,
        0,
        buyPerGram,
        grams,
        buyPerGram,
        grams * buyPerGram,
      );
    }
    closeModal();
    render();
    showToast("নতুন মাল যোগ হয়েছে");
    persistShopData();
    return;
  }
  const mm = document.getElementById("newMM").value;
  const sz = document.getElementById("newSize").value;
  if (!mm || !sz) {
    showToast("মিলিমিটার ও সাইজ লিখুন");
    return;
  }
  const stockPieces = parseInt(document.getElementById("newStock").value) || 0;
  let buyPerPiece = 0;
  let banPrice = 0;
  let banQty = 0;

  if (stockAddUnitMode === "piece") {
    buyPerPiece = Math.max(
      0,
      parseInt(document.getElementById("newPieceBuyPrice").value) || 0,
    );
  } else {
    banPrice = parseInt(document.getElementById("newBanPrice").value) || 0;
    banQty = parseFloat(document.getElementById("newBanQty").value) || 0;
    buyPerPiece = calcBuyFromBan(banPrice, parseFloat(sz));
  }

  if (!inventory[stockBrand][mm]) inventory[stockBrand][mm] = {};
  inventory[stockBrand][mm][sz] = {
    buy: buyPerPiece,
    banPrice: banPrice,
    sell: parseInt(document.getElementById("newSell").value) || 0,
    stock: stockPieces,
  };

  if (stockAddUnitMode === "piece") {
    if (stockPieces > 0 && buyPerPiece > 0) {
      recordPurchase(
        stockBrand,
        mm,
        sz,
        0,
        buyPerPiece,
        stockPieces,
        buyPerPiece,
        stockPieces * buyPerPiece,
      );
    }
  } else if (banQty > 0 && banPrice > 0) {
    recordPurchase(
      stockBrand,
      mm,
      sz,
      banQty,
      banPrice,
      stockPieces,
      buyPerPiece,
    );
  }
  closeModal();
  render();
  showToast("নতুন মাল যোগ হয়েছে ও কেনার খাতায় লেখা হয়েছে");
  persistShopData();
}
function editStockPrompt(brand, mm, sz) {
  const v = inventory[brand][mm][sz];
  const cat = getBrandLabels(brand);
  const catInfo = getCategoryOf(brand);
  const usesBan = !!catInfo.usesBan;
  const banStart =
    v.banPrice != null ? v.banPrice : Math.round((v.buy * FEET_PER_BAN) / sz);

  const banSectionHtml = usesBan
    ? `
  <div class="field"><label>এক বানের মোট দাম (৳) — এক বানে মোট ৭২ ফুট থাকে</label><input type="number" id="editBanPrice" value="${banStart}" min="0" oninput="editStockRecalc(${sz})"></div>
 <div style="background:var(--steel-100); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px;">
 <div style="display:flex;justify-content:space-between;"><span>এক বানে (৭২ ফুট) প্রায়</span><b class="mono">${(FEET_PER_BAN / sz).toFixed(1)} পিস</b></div>
 <div style="display:flex;justify-content:space-between;margin-top:6px;"><span>প্রতি পিস ক্রয়মূল্য (স্বয়ংক্রিয়)</span><b class="mono" id="editBuyComputed">${fmt(v.buy)}</b></div>
 </div>`
    : `
 <div class="field"><label>ক্রয়মূল্য (৳ — প্রতি ${esc(cat.sizeLabel)})</label><input type="number" id="editBuyDirect" value="${v.buy}" min="0"></div>`;

  const banAddSectionHtml = usesBan
    ? `
 <div style="border-top:1px dashed var(--steel-300); padding-top:12px; margin-top:4px;">
 <div style="font-size:12.5px;font-weight:600;color:var(--steel-700);margin-bottom:8px;">নতুন করে বান কিনলে এখানে যোগ করুন</div>
 <div class="field"><label>নতুন কেনা বান সংখ্যা</label><input type="number" id="editNewBanQty" value="" min="0" step="0.5" placeholder="যেমনঃ ২" oninput="editNewBanRecalc(${sz})"></div>
 <div style="background:var(--steel-100); border-radius:8px; padding:10px 14px; margin-bottom:10px; font-size:13px;">
 <div id="editNewBanInfo">০ বানে প্রায় ০ পিস আসবে</div>
 </div>
  <button type="button" class="btn btn-outline" style="width:100%; justify-content:center;" onclick="editAddBanToStock('${jsq(brand)}', '${jsq(mm)}', '${jsq(sz)}')">+ উপরের স্টকে যোগ করুন</button>
 </div>`
    : "";

  openModal(
    `এডিট — ${esc(brand)} · ${esc(cat.unitLabel)} ${mm} · ${esc(cat.sizeLabel)} ${sz}`,
    `
 <div style="font-size:11.5px;color:var(--red);margin-bottom:10px;line-height:1.5;">ভুল করে তথ্য ভুল দিয়ে থাকলে এখানে ঠিক করে নিন।</div>
  <div style="display:flex; gap:10px;">
  <div class="field" style="flex:1;"><label>${esc(cat.unitLabel)}</label><input type="text" id="editMM" value="${mm}"></div>
 <div class="field" style="flex:1;"><label>${esc(cat.sizeLabel)}</label><input type="text" id="editSize" value="${sz}"></div>
 </div>
 ${banSectionHtml}
 <div class="field"><label>বিক্রয়মূল্য (৳)</label><input type="number" id="editSell" value="${v.sell}" min="0"></div>
 <div class="field"><label>স্টক (${usesBan ? "পিস" : esc(cat.sizeLabel)})</label><input type="number" id="editStock" value="${v.stock}" min="0"></div>
 ${banAddSectionHtml}
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
  <button class="btn btn-primary" onclick="saveStockEdit('${jsq(brand)}','${jsq(mm)}','${jsq(sz)}')">সংরক্ষণ করুন</button>
 `,
  );
}
function saveStockEdit(brand, mm, sz) {
  const v = inventory[brand][mm][sz];
  const newMM = document.getElementById("editMM").value;
  const newSize = document.getElementById("editSize").value;
  if (!newMM || !newSize) {
    showToast("তথ্য আবশ্যক");
    return;
  }
  const banPriceEl = document.getElementById("editBanPrice");
  if (banPriceEl) {
    const banPrice = parseInt(banPriceEl.value) || 0;
    v.banPrice = banPrice;
    v.buy = calcBuyFromBan(banPrice, parseFloat(newSize)) || v.buy;
  } else {
    const buyDirectEl = document.getElementById("editBuyDirect");
    if (buyDirectEl) v.buy = Math.max(0, parseInt(buyDirectEl.value) || 0);
  }
  v.sell = parseInt(document.getElementById("editSell").value) || v.sell;
  v.stock = parseInt(document.getElementById("editStock").value) ?? v.stock;

  const mmChanged = String(newMM) !== String(mm);
  const sizeChanged = String(newSize) !== String(sz);
  if (mmChanged || sizeChanged) {
    const collision =
      inventory[brand][newMM] && inventory[brand][newMM][newSize];
    if (collision) {
      showToast("এই তথ্যের আইটেম আগে থেকেই আছে — অন্য মান দিন");
      return;
    }
    delete inventory[brand][mm][sz];
    if (Object.keys(inventory[brand][mm]).length === 0)
      delete inventory[brand][mm];
    if (!inventory[brand][newMM]) inventory[brand][newMM] = {};
    inventory[brand][newMM][newSize] = v;
    logActivity(
      "স্টক আইটেমের তথ্য সংশোধন",
      `${brand} · ${mm}→${newMM}, ${sz}→${newSize}`,
    );
  }
  closeModal();
  render();
  showToast("আপডেট হয়েছে");
  persistShopData();
}
function deleteStockItemPrompt(brand, mm, sz) {
  const v =
    inventory[brand] && inventory[brand][mm] && inventory[brand][mm][sz];
  if (!v) return;
  const lbl = getBrandLabels(brand);
  openModal(
    "আইটেম মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">"${esc(brand)}" ব্র্যান্ডের <b>${esc(mm)} ${esc(lbl.unitLabel)} · ${esc(sz)} ${esc(lbl.sizeLabel)}</b> আইটেমটি (বর্তমান স্টক ${v.stock}) স্থায়ীভাবে মুছে ফেলা হবে।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না — আগের ক্যাশ মেমো/কেনার খাতার রেকর্ডে নাম থেকে যাবে, শুধু বর্তমান স্টক তালিকা থেকে এই আইটেমটি বাদ যাবে।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('স্টক আইটেম মুছুন', () => deleteStockItemConfirmed('${jsq(brand)}','${jsq(mm)}','${jsq(sz)}'))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteStockItemConfirmed(brand, mm, sz) {
  if (inventory[brand] && inventory[brand][mm] && inventory[brand][mm][sz]) {
    moveToTrash(
      "stockItem",
      `${brand} · ${mm} · ${sz}`,
      `স্টক ছিল ${inventory[brand][mm][sz].stock}`,
      { brand, mm, sz, item: inventory[brand][mm][sz] },
    );
    delete inventory[brand][mm][sz];
    if (Object.keys(inventory[brand][mm]).length === 0) {
      delete inventory[brand][mm];
    }
  }
  logActivity("স্টক আইটেম মুছে ফেলা হয়েছে", `${brand} · ${mm} · ${sz}`);
  closeModal();
  render();
  showToast("আইটেম ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
}

/* ============================================================
 কেনার খাতা (PURCHASE LEDGER)
 ============================================================ */
function recordPurchase(
  brand,
  mm,
  sz,
  banQty,
  banPrice,
  pieces,
  buyPerPiece,
  explicitCost,
) {
  const cost =
    explicitCost != null
      ? Math.round(Number(explicitCost))
      : Math.round(Number(banQty) * Number(banPrice));
  purchases.push({
    id: purchaseCounter++,
    date: new Date(),
    brand,
    mm: Number(mm),
    size: Number(sz),
    banQty: Number(banQty),
    banPrice: Number(banPrice),
    pieces: Number(pieces) || 0,
    buyPerPiece: Number(buyPerPiece) || 0,
    cost,
  });
  logActivity(
    "নতুন মাল ক্রয়/যোগ",
    `${brand} · ${mm}মি:লি: · ${sz}ফুট · ${pieces} পিস · খরচ ${fmt(cost)}`,
  );
}
function renderPurchaseLedger() {
  const q = purchaseSearch.trim().toLowerCase();
  const period = listPeriod.purchaseLedger || "all";
  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="purchaseSearchInput" value="${esc(purchaseSearch)}" placeholder="ব্র্যান্ড, মি:লি:, সাইজ বা তারিখ দিয়ে সার্চ করুন..."
 oninput="purchaseSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="purchaseSearchInputFn('')">✕</span>
 </div>`;

  if (purchases.length === 0)
    return (
      periodTabsHtml("purchaseLedger") +
      `<div style="font-size:13px;color:var(--steel-500);margin-bottom:14px;">দোকানের সব ক্রয়ের হিসাব এখানে স্বয়ংক্রিয়ভাবে যুক্ত হয় — "স্টক তালিকা" থেকে নতুন মাল বা নতুন বান যোগ করুন</div>` +
      `<div class="empty-state"><div class="ic">🛒</div>এখনো কোনো ক্রয় লিপিবদ্ধ হয়নি<br><span style="font-size:12px;">"স্টক তালিকা" থেকে নতুন মাল যোগ করলে বা কোনো আইটেমে নতুন বান যোগ করলে এখানে স্বয়ংক্রিয়ভাবে যুক্ত হবে</span></div>`
    );

  const filtered = purchases.filter((p) => {
    if (
      !inSelectedPeriodAnchored(
        p.date,
        period,
        getPeriodAnchor("purchaseLedger"),
      )
    )
      return false;
    if (q === "") return true;
    const dateStr = new Date(p.date).toLocaleDateString("bn-BD", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const hay = (
      p.brand +
      " " +
      p.mm +
      " " +
      p.size +
      " " +
      dateStr
    ).toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0)
    return (
      periodTabsHtml("purchaseLedger") +
      searchBar +
      `<div class="no-match">🔍 এই সময়ে/সার্চে কোনো ক্রয় পাওয়া যায়নি</div>`
    );

  const totalCost = filtered.reduce((s, p) => s + p.cost, 0);
  const totalPieces = filtered.reduce((s, p) => s + p.pieces, 0);
  const totalBan = filtered.reduce((s, p) => s + p.banQty, 0);

  return (
    periodTabsHtml("purchaseLedger") +
    `
 <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
 <div class="stat-card" style="--accent:var(--steel-700)"><div class="lbl">মোট ক্রয় খরচ</div><div class="val">${fmt(totalCost)}</div></div>
 <div class="stat-card" style="--accent:var(--amber)"><div class="lbl">মোট পিস কেনা হয়েছে</div><div class="val">${totalPieces}</div></div>
 <div class="stat-card" style="--accent:var(--rust)"><div class="lbl">মোট বান কেনা হয়েছে</div><div class="val">${totalBan}</div></div>
 </div>
 ${searchBar}
  <table class="tbl">
 <thead><tr><th>তারিখ</th><th>ব্র্যান্ড</th><th>প্রথম মাপ</th><th>দ্বিতীয় মাপ</th><th>বান</th><th>বানের দাম</th><th class="r">পিস এলো</th><th class="r">মোট খরচ</th><th></th></tr></thead>
 <tbody>${filtered
   .slice()
   .sort((a, b) => new Date(b.date) - new Date(a.date))
   .map((p) => {
     const lbl = getBrandLabels(p.brand);
     return `
 <tr>
 <td>${new Date(p.date).toLocaleDateString("bn-BD")}</td>
 <td>${esc(p.brand)}</td>
 <td class="num mono">${p.mm} ${esc(lbl.unitLabel)}</td>
 <td class="num mono">${p.size} ${esc(lbl.sizeLabel)}</td>
 <td class="num mono">${p.banQty}</td>
 <td class="num mono">${fmt(p.banPrice)}</td>
 <td class="num r mono">${p.pieces}</td>
 <td class="num r mono">${fmt(p.cost)}</td>
 <td class="tbl-actions">
 <button onclick="editPurchasePrompt(${p.id})">এডিট</button>
 <button style="color:var(--red);" onclick="deletePurchasePrompt(${p.id})">মুছুন</button>
 </td>
 </tr>`;
   })
   .join("")}
 </tbody></table>`
  );
}
function editPurchasePrompt(id) {
  const p = purchases.find((x) => x.id === id);
  if (!p) return;
  openModal(
    `ক্রয় এডিট — ${esc(p.brand)} · ${p.mm}মি:লি: · ${p.size}ফুট`,
    `
 <div style="font-size:11.5px;color:var(--steel-500);margin-bottom:10px;line-height:1.5;">বান সংখ্যা বা দাম বদলালে স্টকের পরিমাণও সেই অনুযায়ী সমন্বয় হয়ে যাবে।</div>
 <div class="field"><label>বান সংখ্যা</label><input type="number" id="editPurchaseBanQty" value="${p.banQty}" min="0" step="0.5"></div>
  <div class="field"><label>এক বানের মোট দাম (৳) — এক বানে মোট ৭২ ফুট থাকে</label><input type="number" id="editPurchaseBanPrice" value="${p.banPrice}" min="0"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="editPurchaseDate" value="${toDateInputValue(p.date)}"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="savePurchaseEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function savePurchaseEdit(id) {
  const p = purchases.find((x) => x.id === id);
  if (!p) return;
  const newBanQty = Math.max(
    0,
    parseFloat(document.getElementById("editPurchaseBanQty").value) || 0,
  );
  const newBanPrice = Math.max(
    0,
    parseFloat(document.getElementById("editPurchaseBanPrice").value) || 0,
  );
  const newDate = dateFromInput(
    document.getElementById("editPurchaseDate").value,
  );

  const piecesPerBan = p.size > 0 ? FEET_PER_BAN / p.size : 0;
  const newPieces = Math.round(piecesPerBan * newBanQty);
  const newBuyPerPiece = calcBuyFromBan(newBanPrice, p.size);
  const pieceDiff = newPieces - p.pieces;

  if (
    inventory[p.brand] &&
    inventory[p.brand][p.mm] &&
    inventory[p.brand][p.mm][p.size]
  ) {
    const item = inventory[p.brand][p.mm][p.size];
    item.stock = Math.max(0, item.stock + pieceDiff);
    if (newBuyPerPiece > 0) {
      item.buy = newBuyPerPiece;
      item.banPrice = newBanPrice;
    }
  }

  p.banQty = newBanQty;
  p.banPrice = newBanPrice;
  p.pieces = newPieces;
  p.buyPerPiece = newBuyPerPiece;
  p.cost = Math.round(newBanQty * newBanPrice);
  p.date = newDate;

  logActivity(
    "ক্রয়ের এন্ট্রি এডিট",
    `${p.brand} · ${p.mm}মি:লি: · ${p.size}ফুট · নতুন খরচ ${fmt(p.cost)}`,
  );
  closeModal();
  render();
  showToast("আপডেট হয়েছে");
  persistShopData();
}
function deletePurchasePrompt(id) {
  const p = purchases.find((x) => x.id === id);
  if (!p) return;
  openModal(
    "ক্রয়ের এন্ট্রি মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">${esc(p.brand)} · ${p.mm}মি:লি: · ${p.size}ফুট · ${fmt(p.cost)} টাকার এই ক্রয়ের এন্ট্রিটি মুছে ফেলা হবে। এই ক্রয়ের ${p.pieces} পিস স্টক থেকেও বাদ যাবে (স্টকে যতটুকু আছে তার বেশি বাদ যাবে না)।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('ক্রয়ের এন্ট্রি মুছুন', () => deletePurchaseConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deletePurchaseConfirmed(id) {
  const p = purchases.find((x) => x.id === id);
  if (!p) return;
  moveToTrash(
    "purchase",
    `${p.brand} · ${p.mm}মি:লি: · ${p.size}ফুট`,
    fmt(p.cost),
    p,
  );
  if (
    inventory[p.brand] &&
    inventory[p.brand][p.mm] &&
    inventory[p.brand][p.mm][p.size]
  ) {
    const item = inventory[p.brand][p.mm][p.size];
    item.stock = Math.max(0, item.stock - p.pieces);
  }
  purchases = purchases.filter((x) => x.id !== id);
  logActivity(
    "ক্রয়ের এন্ট্রি মুছে ফেলা হয়েছে",
    `${p.brand} · ${p.mm}মি:লি: · ${p.size}ফুট · ${fmt(p.cost)}`,
  );
  closeModal();
  render();
  showToast("ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
}
function purchaseSearchInputFn(val) {
  purchaseSearch = val;
  render();
  const el = document.getElementById("purchaseSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}

/* ============================================================
 বেচার খাতা (SALES LEDGER)
 ============================================================ */
function renderSalesLedger() {
  const range = salesLedgerGetRange();

  if (invoices.length === 0 && quickSales.length === 0)
    return `<div class="empty-state"><div class="ic">📗</div>এখনো কোনো বিক্রয় হয়নি<br><span style="font-size:12px;">"বিক্রয়" থেকে প্রথম ক্যাশ মেমো তৈরি করুন</span></div>`;

  const presetTabs = `
 <div class="tab-row" style="margin-bottom:10px;">
 <button class="btn ${salesLedgerPreset === "day" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerSetPreset('day')">দিন</button>
 <button class="btn ${salesLedgerPreset === "month" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerSetPreset('month')">মাস</button>
 <button class="btn ${salesLedgerPreset === "year" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerSetPreset('year')">বছর</button>
 <button class="btn ${salesLedgerPreset === "all" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerSetPreset('all')">সব সময়</button>
 </div>`;

  const navBar =
    salesLedgerPreset !== "all"
      ? `
 <div style="display:flex;align-items:center;justify-content:space-between;background:var(--steel-900);border-radius:10px;padding:11px 16px;margin-bottom:14px;">
 <button type="button" onclick="salesLedgerNav(-1)" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;">←</button>
 <div style="color:white;font-size:14px;font-weight:700;">${salesLedgerRangeLabel()}</div>
 <button type="button" onclick="salesLedgerNav(1)" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;">→</button>
 </div>`
      : `<div style="margin-bottom:14px;"></div>`;

  let cashTotal = 0,
    dueTotal = 0,
    quickTotal = 0,
    invoiceSalesTotal = 0;
  invoices.forEach((inv) => {
    if (inv.cancelled) return;
    if (!reportInRange(inv.date, range.from, range.to)) return;
    invoiceSalesTotal += inv.total;
    cashTotal += inv.paid;
    dueTotal += inv.due;
  });
  quickSales.forEach((qs) => {
    if (!reportInRange(qs.date, range.from, range.to)) return;
    quickTotal += qs.totalAmount;
  });
  const grandTotal = invoiceSalesTotal + quickTotal;

  const totalHero = `
 <div class="dash-hero" style="margin-bottom:14px;">
 <div class="dh-label">${salesLedgerPreset === "all" ? "সর্বমোট বিক্রয়" : salesLedgerRangeLabel() + " — মোট বিক্রয়"}</div>
 <div class="dh-val">${fmt(grandTotal)}</div>
 </div>`;

  const hoverAttrs = `onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.15)';" onmouseleave="this.style.transform='';this.style.boxShadow='';"`;
  const catCards = `
 <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px;">
 <div class="stat-card" style="--accent:var(--green); cursor:pointer; transition:transform .15s, box-shadow .15s;" ${hoverAttrs} onclick="openSalesLedgerCategoryDetail('cash')">
 <div class="lbl">💵 নগদ বিক্রি</div><div class="val" style="font-size:16px;">${fmt(cashTotal)}</div>
 </div>
 <div class="stat-card" style="--accent:var(--red); cursor:pointer; transition:transform .15s, box-shadow .15s;" ${hoverAttrs} onclick="openSalesLedgerCategoryDetail('due')">
 <div class="lbl">📒 বাকি বিক্রি</div><div class="val" style="font-size:16px;">${fmt(dueTotal)}</div>
 </div>
 <div class="stat-card" style="--accent:var(--amber); cursor:pointer; transition:transform .15s, box-shadow .15s;" ${hoverAttrs} onclick="openSalesLedgerCategoryDetail('quick')">
 <div class="lbl">⚡ দ্রুত বিক্রি</div><div class="val" style="font-size:16px;">${fmt(quickTotal)}</div>
 </div>
 </div>
 <div style="font-size:11.5px;color:var(--steel-500);margin-top:10px;text-align:center;">যেকোনো কার্ডে ক্লিক করে সেই ভাগের বিস্তারিত পেজে যান</div>`;

  return presetTabs + navBar + totalHero + catCards;
}
function salesLedgerSearchInputFn(val) {
  salesLedgerSearch = val;
  render();
  const el = document.getElementById("salesLedgerSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function salesLedgerGetRange() {
  const a = salesLedgerAnchor;
  if (salesLedgerPreset === "day") {
    const k = dayKey(a);
    return { from: k, to: k };
  }
  if (salesLedgerPreset === "month") {
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return { from: dayKey(first), to: dayKey(last) };
  }
  if (salesLedgerPreset === "year") {
    return { from: a.getFullYear() + "-01-01", to: a.getFullYear() + "-12-31" };
  }
  return { from: null, to: null };
}
function salesLedgerRangeLabel() {
  const a = salesLedgerAnchor;
  if (salesLedgerPreset === "day") return dayLabel(dayKey(a));
  if (salesLedgerPreset === "month") return monthLabelOf(monthKeyOf(a));
  if (salesLedgerPreset === "year") return bnDigits(a.getFullYear()) + " সাল";
  return "সব সময়";
}
function salesLedgerNav(delta) {
  const a = new Date(salesLedgerAnchor);
  if (salesLedgerPreset === "day") a.setDate(a.getDate() + delta);
  else if (salesLedgerPreset === "month") a.setMonth(a.getMonth() + delta);
  else if (salesLedgerPreset === "year") a.setFullYear(a.getFullYear() + delta);
  else return;
  salesLedgerAnchor = a;
  render();
}
function salesLedgerSetPreset(p) {
  salesLedgerPreset = p;
  salesLedgerAnchor = new Date();
  render();
}

/* ===== "বেচার খাতা"-র নগদ/বাকি/দ্রুত বিক্রি — কার্ডে ক্লিক করলে বিস্তারিত মডাল ===== */
function openSalesLedgerCategoryDetail(type) {
  salesLedgerCatType = type;
  salesLedgerCatPreset = "month";
  salesLedgerCatAnchor = new Date();
  salesLedgerCatSearch = "";
  render();
  pushBackStep();
  scrollContentTop();
}
function salesLedgerCatTitle(type) {
  if (type === "cash") return "💵 নগদ বিক্রি";
  if (type === "due") return "📒 বাকি বিক্রি";
  return "⚡ দ্রুত বিক্রি";
}
function salesLedgerCatGetRange() {
  const a = salesLedgerCatAnchor;
  if (salesLedgerCatPreset === "day") {
    const k = dayKey(a);
    return { from: k, to: k };
  }
  if (salesLedgerCatPreset === "month") {
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return { from: dayKey(first), to: dayKey(last) };
  }
  if (salesLedgerCatPreset === "year") {
    return { from: a.getFullYear() + "-01-01", to: a.getFullYear() + "-12-31" };
  }
  return { from: null, to: null };
}
function salesLedgerCatRangeLabel() {
  const a = salesLedgerCatAnchor;
  if (salesLedgerCatPreset === "day") return dayLabel(dayKey(a));
  if (salesLedgerCatPreset === "month") return monthLabelOf(monthKeyOf(a));
  if (salesLedgerCatPreset === "year")
    return bnDigits(a.getFullYear()) + " সাল";
  return "সব সময়";
}
function salesLedgerCatNav(delta) {
  const a = new Date(salesLedgerCatAnchor);
  if (salesLedgerCatPreset === "day") a.setDate(a.getDate() + delta);
  else if (salesLedgerCatPreset === "month") a.setMonth(a.getMonth() + delta);
  else if (salesLedgerCatPreset === "year")
    a.setFullYear(a.getFullYear() + delta);
  else return;
  salesLedgerCatAnchor = a;
  render();
}
function salesLedgerCatSetPreset(p) {
  salesLedgerCatPreset = p;
  salesLedgerCatAnchor = new Date();
  render();
}
function salesLedgerCatBackToList() {
  salesLedgerCatType = null;
  render();
  scrollContentTop();
}
function salesLedgerCatSearchInputFn(val) {
  salesLedgerCatSearch = val;
  render();
  const el = document.getElementById("salesLedgerCatSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function editQuickSalePrompt(id) {
  const q = quickSales.find((x) => x.id === id);
  if (!q) return;
  openModal(
    "দ্রুত বিক্রি এডিট করুন",
    `
 <div class="field"><label>ক্রেতার নাম (ঐচ্ছিক)</label><input type="text" id="editQsName" value="${esc(q.name || "")}" placeholder="ঐচ্ছিক"></div>
 <div class="field"><label>ফোন নাম্বার (ঐচ্ছিক)</label><input type="text" id="editQsPhone" value="${esc(q.phone || "")}" placeholder="ঐচ্ছিক"></div>
 <div class="field"><label>মোট কত টাকা বিক্রি হলো (৳)</label><input type="number" id="editQsAmount" min="0" value="${q.totalAmount}"></div>
 <div class="field"><label>লাভ (৳) — ঐচ্ছিক</label><input type="number" id="editQsProfit" min="0" value="${q.profit || 0}"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="editQsDate" value="${toDateInputValue(q.date)}"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveQuickSaleEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveQuickSaleEdit(id) {
  const q = quickSales.find((x) => x.id === id);
  if (!q) return;
  q.name = document.getElementById("editQsName").value.trim();
  q.phone = document.getElementById("editQsPhone").value.trim();
  q.totalAmount = Math.max(
    0,
    parseInt(document.getElementById("editQsAmount").value) || 0,
  );
  q.profit = Math.max(
    0,
    parseInt(document.getElementById("editQsProfit").value) || 0,
  );
  q.date = dateFromInput(document.getElementById("editQsDate").value);
  closeModal();
  render();
  showToast("দ্রুত বিক্রি আপডেট হয়েছে");
  persistShopData();
}
function renderSalesLedgerCatDetail() {
  const type = salesLedgerCatType;
  const range = salesLedgerCatGetRange();
  const q = salesLedgerCatSearch.trim().toLowerCase();

  let rows = [],
    total = 0;

  if (type === "cash" || type === "due") {
    invoices.forEach((inv) => {
      if (inv.cancelled) return;
      if (!reportInRange(inv.date, range.from, range.to)) return;
      const amount = type === "cash" ? inv.paid : inv.due;
      if (amount <= 0) return;
      if (q !== "") {
        const hay = (
          inv.customer +
          " " +
          (inv.customerPhone || "") +
          " #" +
          inv.id
        ).toLowerCase();
        if (!hay.includes(q)) return;
      }
      total += amount;
      rows.push({
        t: new Date(inv.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
 <div class="txname">${esc(inv.customer)}</div>
 <div class="txmeta">ক্যাশ মেমো #${inv.id} · ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 </div>
 <div style="text-align:right;">
 <div class="mono" style="font-weight:700;color:${type === "cash" ? "var(--green)" : "var(--red)"};">${fmt(amount)}</div>
 <div style="display:flex;gap:6px;margin-top:5px;">
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;" onclick="openCashboxMemoDetail(${inv.id})">দেখুন/এডিট</button>
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;color:var(--red);" onclick="cancelInvoicePrompt(${inv.id})">মুছুন</button>
 </div>
 </div>
 </div>`,
      });
    });
  } else {
    quickSales.forEach((qs) => {
      if (!reportInRange(qs.date, range.from, range.to)) return;
      if (q !== "") {
        const hay = ((qs.name || "") + " " + (qs.phone || "")).toLowerCase();
        if (!hay.includes(q)) return;
      }
      total += qs.totalAmount;
      rows.push({
        t: new Date(qs.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
 <div class="txname">${qs.name ? esc(qs.name) : "নাম নেই"}</div>
 <div class="txmeta">${new Date(qs.date).toLocaleDateString("bn-BD")}${qs.profit ? " · লাভ " + fmt(qs.profit) : ""}</div>
 </div>
 <div style="text-align:right;">
 <div class="mono" style="font-weight:700;">${fmt(qs.totalAmount)}</div>
 <div style="display:flex;gap:6px;margin-top:5px;">
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;" onclick="editQuickSalePrompt(${qs.id})">এডিট</button>
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;color:var(--red);" onclick="requestPasswordConfirm('দ্রুত বিক্রি এন্ট্রি মুছুন', () => deleteQuickSale(${qs.id}))">মুছুন</button>
 </div>
 </div>
 </div>`,
      });
    });
  }

  rows.sort((a, b) => b.t - a.t);

  const backRow = `<div class="back-row">
 <button class="btn btn-outline" onclick="salesLedgerCatBackToList()">← বেচার খাতা</button>
 <div class="cur-brand">${salesLedgerCatTitle(type)}</div>
 </div>`;

  const presetTabs = `
 <div class="tab-row" style="margin-bottom:10px;">
 <button class="btn ${salesLedgerCatPreset === "day" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerCatSetPreset('day')">দিন</button>
 <button class="btn ${salesLedgerCatPreset === "month" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerCatSetPreset('month')">মাস</button>
 <button class="btn ${salesLedgerCatPreset === "year" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerCatSetPreset('year')">বছর</button>
 <button class="btn ${salesLedgerCatPreset === "all" ? "btn-primary" : "btn-outline"}" onclick="salesLedgerCatSetPreset('all')">সব সময়</button>
 </div>`;

  const navBar =
    salesLedgerCatPreset !== "all"
      ? `
 <div style="display:flex;align-items:center;justify-content:space-between;background:var(--steel-900);border-radius:10px;padding:11px 16px;margin-bottom:14px;">
 <button type="button" onclick="salesLedgerCatNav(-1)" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;">←</button>
 <div style="color:white;font-size:14px;font-weight:700;">${salesLedgerCatRangeLabel()}</div>
 <button type="button" onclick="salesLedgerCatNav(1)" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:4px 8px;">→</button>
 </div>`
      : `<div style="margin-bottom:14px;"></div>`;

  const totalHero = `
 <div class="dash-hero" style="margin-bottom:14px;">
 <div class="dh-label">${salesLedgerCatPreset === "all" ? "সর্বমোট" : salesLedgerCatRangeLabel() + " — মোট"}</div>
 <div class="dh-val">${fmt(total)}</div>
 </div>`;

  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="salesLedgerCatSearchInput" value="${esc(salesLedgerCatSearch)}" placeholder="নাম, ফোন বা ক্যাশ মেমো নম্বর দিয়ে সার্চ করুন..."
 oninput="salesLedgerCatSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="salesLedgerCatSearchInputFn('')">✕</span>
 </div>`;

  const listHtml =
    rows.length === 0
      ? `<div class="no-match">এই সময়ে/সার্চে কোনো লেনদেন নেই</div>`
      : rows.map((r) => r.html).join("");

  return backRow + presetTabs + navBar + totalHero + searchBar + listHtml;
}

/* ============================================================
 বাকির খাতা
 ============================================================ */
function renderLedger() {
  if (ledgerDetailId) return renderCustomerDetail(ledgerDetailId);
  const q = ledgerSearch.trim().toLowerCase();
  const dueCount = ledger.filter((l) => l.due > 0).length;
  const paidCount = ledger.filter((l) => l.due === 0).length;
  const ledgerTabsHtml = `
 <div class="tab-row" style="margin-bottom:14px;">
 <button class="btn ${ledgerTab === "due" ? "btn-primary" : "btn-outline"}" onclick="setLedgerTab('due')">📒 বাকি আছে (${dueCount})</button>
 <button class="btn ${ledgerTab === "paid" ? "btn-primary" : "btn-outline"}" onclick="setLedgerTab('paid')">✅ পরিশোধিত কাস্টমার (${paidCount})</button>
 </div>`;
  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="ledgerSearchInput" value="${ledgerSearch}" placeholder="নাম, মোবাইল নাম্বার বা ঠিকানা দিয়ে সার্চ করুন..."
 oninput="ledgerSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="ledgerSearchInputFn('')">✕</span>
 </div>`;

  const filterBar = `
 <div class="panel" style="margin-bottom:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
 <div class="field" style="margin-bottom:0; flex:1; min-width:130px;">
 <label>সর্বনিম্ন বাকি (৳)</label>
 <input type="number" id="ledgerMinDueInput" min="0" placeholder="যেমনঃ ৫০০" value="${ledgerMinDue}" onchange="ledgerMinDueInputFn(this.value)">
 </div>
 <div class="field" style="margin-bottom:0; flex:1; min-width:130px;">
 <label>সর্বোচ্চ বাকি (৳)</label>
 <input type="number" id="ledgerMaxDueInput" min="0" placeholder="যেমনঃ ৫০০০" value="${ledgerMaxDue}" onchange="ledgerMaxDueInputFn(this.value)">
 </div>
 <div class="field" style="margin-bottom:0; flex:1; min-width:170px;">
 <label>সাজান</label>
 <select id="ledgerSortSelect" onchange="ledgerSortChange(this.value)">
 <option value="default" ${ledgerSort === "default" ? "selected" : ""}>সিরিয়াল অনুযায়ী</option>
 <option value="newest" ${ledgerSort === "newest" ? "selected" : ""}>নতুন কাস্টমার আগে</option>
 <option value="oldest" ${ledgerSort === "oldest" ? "selected" : ""}>পুরাতন কাস্টমার আগে</option>
 <option value="dueHigh" ${ledgerSort === "dueHigh" ? "selected" : ""}>বেশি বাকি আগে</option>
 <option value="dueLow" ${ledgerSort === "dueLow" ? "selected" : ""}>কম বাকি আগে</option>
 </select>
 </div>
 </div>`;

  let filtered = ledger
    .map((l, idx) => ({ l, serial: idx + 1 }))
    .filter(({ l }) => (ledgerTab === "paid" ? l.due === 0 : l.due > 0))
    .filter(
      ({ l }) =>
        q === "" ||
        (l.name + " " + (l.phone || "") + " " + (l.address || ""))
          .toLowerCase()
          .includes(q),
    );

  const minDueVal = ledgerMinDue !== "" ? parseFloat(ledgerMinDue) : null;
  const maxDueVal = ledgerMaxDue !== "" ? parseFloat(ledgerMaxDue) : null;
  if (minDueVal !== null)
    filtered = filtered.filter(({ l }) => l.due >= minDueVal);
  if (maxDueVal !== null)
    filtered = filtered.filter(({ l }) => l.due <= maxDueVal);

  if (ledgerSort === "newest") {
    filtered = filtered
      .slice()
      .sort(
        (a, b) => new Date(b.l.addedDate || 0) - new Date(a.l.addedDate || 0),
      );
  } else if (ledgerSort === "oldest") {
    filtered = filtered
      .slice()
      .sort(
        (a, b) => new Date(a.l.addedDate || 0) - new Date(b.l.addedDate || 0),
      );
  } else if (ledgerSort === "dueHigh") {
    filtered = filtered.slice().sort((a, b) => b.l.due - a.l.due);
  } else if (ledgerSort === "dueLow") {
    filtered = filtered.slice().sort((a, b) => a.l.due - b.l.due);
  }

  const list =
    filtered.length === 0
      ? `<div class="no-match">🔍 এই সার্চ/ফিল্টারে কোনো গ্রাহক পাওয়া যায়নি</div>`
      : `<div class="ledger-list">
 ${filtered
   .map(
     ({ l, serial }) => `
 <div class="ledger-row">
 <div class="ledger-serial">${serial}</div>
 <div class="ledger-info">
 <div class="lname">${esc(l.name)}</div>
 <div class="lmeta">${esc(l.address) || ""}${l.address && l.phone ? " · " : ""}${l.phone ? `<b style="color:var(--rust); font-weight:700; letter-spacing:0.02em;">${telHtml(l.phone)}</b>` : l.address ? "" : "কোনো তথ্য নেই"}${l.addedDate ? " · যুক্তঃ " + new Date(l.addedDate).toLocaleDateString("bn-BD") : ""}</div>
 </div>
 <div class="ledger-due">
 <div class="amt ${l.due === 0 ? "clear" : ""}">${l.due === 0 ? "পরিশোধিত" : fmt(l.due)}</div>
 <div class="lbl">${l.due === 0 ? "কোনো বাকি নেই" : "বকেয়া"}</div>
 </div>
 ${
   l.due > 0
     ? `
 <button class="btn btn-outline" style="background:#25D366;color:white;border-color:#25D366;" onclick="sendDueReminder(${l.id})">📱 রিমাইন্ডার</button>
 <button class="btn btn-outline" onclick="callCustomer(${l.id})">📞 কল</button>`
     : ""
 }
  <button class="btn btn-outline" onclick="editCustomerPrompt(${l.id})">✏️ এডিট</button>
 <button class="btn btn-outline" onclick="openCustomerDetail(${l.id})">📋 বিস্তারিত</button>
 <button class="btn btn-outline" style="color:var(--red);border-color:var(--red);" onclick="addCustomerDuePrompt(${l.id})">➕ বাকি দিচ্ছি</button>
 <button class="btn btn-primary" onclick="paymentPrompt(${l.id})">💵 জমা নিচ্ছি</button>
 </div>`,
   )
   .join("")}
 </div>`;

  return `
 <div class="ledger-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">যে সিরিয়ালে গ্রাহক যুক্ত হয়েছে, পরিশোধ করলেও সেই সিরিয়ালেই থাকবে</div>
 <button class="btn btn-primary" onclick="addCustomerPrompt()">+ নতুন গ্রাহক</button>
 </div>
 ${ledgerTabsHtml}
 ${searchBar}
 ${filterBar}
 ${list}`;
}
function ledgerSearchInputFn(val) {
  ledgerSearch = val;
  render();
  const el = document.getElementById("ledgerSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function ledgerMinDueInputFn(val) {
  ledgerMinDue = val;
  render();
}
function ledgerMaxDueInputFn(val) {
  ledgerMaxDue = val;
  render();
}
function ledgerSortChange(val) {
  ledgerSort = val;
  render();
}
function setLedgerTab(tab) {
  ledgerTab = tab;
  render();
}

/* ============================================================
 বাকির হিসাব (দিয়েছি / পেয়েছি) — দিন/মাস/বছর/সব সময় অনুযায়ী বিস্তারিত
 ============================================================ */
function renderDueSummary() {
  const period = listPeriod.dueSummary || "day";

  // "বাকি দিয়েছি" = এই সময়ে বাকিতে যত টাকার পণ্য বিক্রি হয়েছে (ক্যাশ মেমোের due অংশ)
  const anchor = getPeriodAnchor("dueSummary");
  const dueGivenInvoices = invoices.filter(
    (inv) =>
      !inv.cancelled &&
      inv.due > 0 &&
      inSelectedPeriodAnchored(inv.date, period, anchor),
  );
  // "বাকি পেয়েছি" = এই সময়ে বাকি থেকে যত টাকা আদায় হয়েছে
  const dueReceivedPayments = payments.filter((p) =>
    inSelectedPeriodAnchored(p.date, period, anchor),
  );

  const totalGiven = dueGivenInvoices.reduce((s, inv) => s + inv.due, 0);
  const totalReceived = dueReceivedPayments.reduce((s, p) => s + p.amount, 0);
  const totalDueOutstanding = ledger.reduce((s, l) => s + l.due, 0);

  const periodLabel =
    {
      day: "আজকের",
      month: "এই মাসের",
      year: "এই বছরের",
      all: "সর্বমোট (সব সময়ের)",
    }[period] || "";

  const givenRows = dueGivenInvoices
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (inv) => `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag sale">বাকি দিলাম</span>${esc(inv.customer)}${inv.customerPhone ? " · " + telHtml(inv.customerPhone) : ""}</div>
 <div class="txmeta">ক্যাশ মেমো #${inv.id} · ${new Date(inv.date).toLocaleDateString("bn-BD")} · মোট বিল ${fmt(inv.total)} · বাকি রইলো ${fmt(inv.due)}</div>
 </div>
 <button class="btn btn-outline" onclick="printInvoice(invoices.find(x=>x.id===${inv.id}))">দেখুন</button>
 </div>`,
    )
    .join("");

  const receivedRows = dueReceivedPayments
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (p) => `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag payment">বাকি পেলাম</span>${esc(p.custName)}${p.custPhone ? " · " + telHtml(p.custPhone) : ""}</div>
 <div class="txmeta">রশিদ #${p.id} · ${new Date(p.date).toLocaleDateString("bn-BD")} · জমা ${fmt(p.amount)}${p.discount > 0 ? " · ছাড় " + fmt(p.discount) : ""} · মাধ্যম ${esc(p.method || "ক্যাশ")}</div>
 </div>
 <button class="btn btn-outline" onclick="viewPaymentReceipt(${p.id})">দেখুন</button>
 </div>`,
    )
    .join("");

  return `
 ${periodTabsHtml("dueSummary")}
 <div style="font-size:13.5px; color:var(--steel-500); margin-bottom:14px;">📋 <b style="color:var(--ink);">${periodLabel}</b> বাকির হিসাব</div>
 <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
 <div class="stat-card" style="--accent:var(--red);"><div class="lbl">বাকি দিয়েছি (নতুন বাকি বিক্রি)</div><div class="val">${fmt(totalGiven)}</div></div>
 <div class="stat-card" style="--accent:var(--green);"><div class="lbl">বাকি পেয়েছি (আদায়)</div><div class="val">${fmt(totalReceived)}</div></div>
 <div class="stat-card" style="--accent:var(--steel-700);"><div class="lbl">এই মুহূর্তে সর্বমোট বাকি পাওনা</div><div class="val">${fmt(totalDueOutstanding)}</div></div>
 </div>

 <div class="panel" style="margin-top:16px; margin-bottom:8px;">
 <h3 style="color:var(--red);">বাকি দিয়েছি — ${dueGivenInvoices.length} টি ক্যাশ মেমো</h3>
 ${givenRows || `<div class="no-match">এই সময়ে কোনো বাকি বিক্রি নেই</div>`}
 </div>

 <div class="panel" style="margin-top:16px;">
 <h3 style="color:var(--green);">বাকি পেয়েছি — ${dueReceivedPayments.length} টি জমা</h3>
 ${receivedRows || `<div class="no-match">এই সময়ে কোনো বাকি আদায় নেই</div>`}
 </div>
 `;
}

/* ============================================================
 কর্মচারী — বেতন ও অগ্রিমের হিসাব (খরচের খাতার সাথে সরাসরি যুক্ত)
 ============================================================ */
function getOrCreateAdvanceCategoryId() {
  let cat = expenseCategories.find((c) => c.name === "অগ্রিম");
  if (!cat) {
    cat = { id: expenseCatNextId++, name: "অগ্রিম", icon: "🪙" };
    expenseCategories.push(cat);
    persistShopData();
  }
  return cat.id;
}
function getSalaryCategoryId() {
  let cat = expenseCategories.find((c) => c.name === "বেতন");
  if (!cat) {
    cat = { id: expenseCatNextId++, name: "বেতন", icon: "💰" };
    expenseCategories.push(cat);
    persistShopData();
  }
  return cat.id;
}
function employeePeriodTotal(personId, period) {
  return expenses
    .filter((e) => e.personId === personId && inSelectedPeriod(e.date, period))
    .reduce((s, e) => s + e.amount, 0);
}
function openEmployeeDetail(id) {
  employeeDetailId = id;
  render();
  pushBackStep();
  scrollContentTop();
}

/* ---- মাস-ভিত্তিক বেতন/অগ্রিম সমন্বয় ---- */
function employeeMonthOptionsHtml(selectedKey) {
  const opts = [];
  const now = new Date();
  for (let i = -6; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = monthKeyOf(d);
    opts.push(
      `<option value="${key}" ${key === selectedKey ? "selected" : ""}>${monthLabelOf(key)}</option>`,
    );
  }
  return opts.join("");
}
function setEmployeeSalaryMonth(id, val) {
  employeeSalaryMonth = val;
  render();
}
function empMatchesMonth(e, monthKey) {
  // যে এন্ট্রিতে forMonth ট্যাগ করা আছে সেটা দিয়ে মেলানো হবে, না থাকলে তারিখের মাস দিয়ে (পুরনো এন্ট্রির জন্য)
  if (e.forMonth) return e.forMonth === monthKey;
  return monthKeyOf(e.date) === monthKey;
}
function employeeForMonthTotal(personId, monthKey, categoryName) {
  return expenses
    .filter(
      (e) =>
        e.personId === personId &&
        empMatchesMonth(e, monthKey) &&
        (!categoryName || e.categoryName === categoryName),
    )
    .reduce((s, e) => s + e.amount, 0);
}
function openEmployeePaymentModal(personId, kind) {
  const p = expensePeople.find((x) => x.id === personId);
  if (!p) return;
  const defaultMonth = employeeSalaryMonth || monthKeyOf(new Date());
  const title =
    kind === "salary"
      ? `💰 বেতন দিন — ${esc(p.name)}`
      : `🪙 অগ্রিম দিন — ${esc(p.name)}`;
  openModal(
    title,
    `
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="empPayAmount" min="0" placeholder="যেমনঃ ৫০০০"></div>
 <div class="field"><label>এটা কোন মাসের ${kind === "salary" ? "বেতন" : "বেতনের বিপরীতে অগ্রিম"} হিসেবে গণ্য হবে</label>
 <select id="empPayMonth">${employeeMonthOptionsHtml(defaultMonth)}</select>
 </div>
 <div class="field"><label>তারিখ (আজকে দিলে যেই তারিখে দিয়েছেন)</label><input type="date" id="empPayDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>নোট (ঐচ্ছিক)</label><input type="text" id="empPayNote" placeholder="যেমনঃ ঈদ বোনাস, জরুরি প্রয়োজন"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveEmployeePayment(${personId}, '${kind}')">সংরক্ষণ করুন</button>
 `,
  );
}
function saveEmployeePayment(personId, kind) {
  const p = expensePeople.find((x) => x.id === personId);
  if (!p) return;
  const amount = Math.max(
    0,
    parseInt(document.getElementById("empPayAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const forMonth = document.getElementById("empPayMonth").value;
  const payDate = dateFromInput(document.getElementById("empPayDate").value);
  const note = document.getElementById("empPayNote").value.trim();
  const catId =
    kind === "salary" ? getSalaryCategoryId() : getOrCreateAdvanceCategoryId();
  const cat = expenseCategories.find((c) => c.id === catId);
  const expense = {
    id: expenseNextId++,
    date: payDate,
    categoryId: catId,
    categoryName: cat ? cat.name : kind === "salary" ? "বেতন" : "অগ্রিম",
    personId,
    personName: p.name,
    amount,
    note,
    forMonth,
  };
  expenses.push(expense);
  employeeSalaryMonth = forMonth;
  logActivity(
    kind === "salary"
      ? "কর্মচারীকে বেতন দেওয়া হয়েছে"
      : "কর্মচারীকে অগ্রিম দেওয়া হয়েছে",
    `${p.name} · ${monthLabelOf(forMonth)} মাসের হিসাবে · ${fmt(amount)}${note ? " · " + note : ""}`,
  );
  closeModal();
  showToast(
    `${fmt(amount)} ${kind === "salary" ? "বেতন" : "অগ্রিম"} হিসেবে যোগ হয়েছে`,
  );
  render();
  persistShopData();
}

function addEmployeePrompt() {
  openModal(
    "নতুন কর্মচারী যুক্ত করুন",
    `
  <div class="field"><label>নাম</label><input type="text" id="empName" placeholder="যেমনঃ মোঃ রহিম"></div>
 <div class="field"><label>ঠিকানা (ঐচ্ছিক)</label><input type="text" id="empAddress" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>মোবাইল নাম্বার (ঐচ্ছিক)</label><input type="text" id="empPhone" placeholder="01xxx-xxxxxx"></div>
 <div class="field"><label>মাসিক বেতন (৳) — না জানলে ০ রাখুন</label><input type="number" id="empSalary" min="0" value="0"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewEmployee()">যুক্ত করুন</button>
 `,
  );
}
function saveNewEmployee() {
  const name = document.getElementById("empName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  const address = document.getElementById("empAddress").value.trim();
  const phone = document.getElementById("empPhone").value.trim();
  const salary = Math.max(
    0,
    parseInt(document.getElementById("empSalary").value) || 0,
  );
  const emp = {
    id: expensePersonNextId++,
    name,
    address,
    phone,
    note: "",
    role: "employee",
    monthlySalary: salary,
  };
  expensePeople.push(emp);
  logActivity(
    "নতুন কর্মচারী যুক্ত",
    `${name}${salary > 0 ? " · মাসিক বেতন " + fmt(salary) : ""}`,
  );
  closeModal();
  render();
  showToast("কর্মচারী যুক্ত হয়েছে");
  persistShopData();
}
function editEmployeePrompt(id) {
  const p = expensePeople.find((x) => x.id === id);
  if (!p) return;
  openModal(
    `কর্মচারীর তথ্য — ${esc(p.name)}`,
    `
  <div class="field"><label>নাম</label><input type="text" id="empEditName" value="${esc(p.name)}"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="empEditAddress" value="${esc(p.address || "")}"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="empEditPhone" value="${esc(p.phone || "")}"></div>
 <div class="field"><label>মাসিক বেতন (৳)</label><input type="number" id="empEditSalary" min="0" value="${p.monthlySalary || 0}"></div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteEmployeePrompt(${id})">মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveEmployeeEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveEmployeeEdit(id) {
  const p = expensePeople.find((x) => x.id === id);
  if (!p) return;
  const name = document.getElementById("empEditName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  p.name = name;
  p.address = document.getElementById("empEditAddress").value.trim();
  p.phone = document.getElementById("empEditPhone").value.trim();
  p.role = "employee";
  p.monthlySalary = Math.max(
    0,
    parseInt(document.getElementById("empEditSalary").value) || 0,
  );
  closeModal();
  render();
  showToast("তথ্য আপডেট হয়েছে");
  persistShopData();
}
function deleteEmployeePrompt(id) {
  const p = expensePeople.find((x) => x.id === id);
  if (!p) return;
  openModal(
    "কর্মচারী মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">"${esc(p.name)}" কে কর্মচারী তালিকা থেকে মুছে ফেলা হবে। তার আগের বেতন/অগ্রিমের হিসাব খরচের খাতায় থেকে যাবে (মুছে যাবে না), শুধু এই তালিকা থেকে বাদ যাবেন।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('কর্মচারী মুছুন', () => deleteEmployeeConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteEmployeeConfirmed(id) {
  const p = expensePeople.find((x) => x.id === id);
  if (p) {
    moveToTrash("employee", p.name, "", p);
  }
  expensePeople = expensePeople.filter((x) => x.id !== id);
  employeeDetailId = null;
  closeModal();
  render();
  showToast("কর্মচারী ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  if (p) logActivity("কর্মচারী মুছে ফেলা হয়েছে", p.name);
  persistShopData();
}

function renderEmployees() {
  if (employeeDetailId) return renderEmployeeDetail(employeeDetailId);

  const employeeList = expensePeople.filter((p) => p.role === "employee");
  const toolbar = `
 <div class="ledger-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">কর্মচারীদের বেতন ও অগ্রিমের হিসাব — এখান থেকে যা দেবেন তা স্বয়ংক্রিয়ভাবে খরচের খাতা ও রিপোর্টে যোগ হয়ে যাবে</div>
 <button class="btn btn-primary" onclick="addEmployeePrompt()">+ নতুন কর্মচারী</button>
 </div>`;

  if (employeeList.length === 0) {
    return (
      toolbar +
      `<div class="empty-state"><div class="ic">👷</div>এখনো কোনো কর্মচারী যুক্ত করা হয়নি<br><span style="font-size:12px;">"+ নতুন কর্মচারী" চেপে শুরু করুন</span></div>`
    );
  }

  const rows = employeeList
    .map((p, idx) => {
      const takenThisMonth = employeePeriodTotal(p.id, "month");
      const salary = p.monthlySalary || 0;
      const remaining = salary - takenThisMonth;
      return `<div class="person-row">
 <div class="ledger-serial">${idx + 1}</div>
 <div class="ledger-info" style="cursor:pointer;" onclick="openEmployeeDetail(${p.id})">
 <div class="lname">${esc(p.name)}</div>
  <div class="lmeta">${[esc(p.address), telHtml(p.phone), salary > 0 ? "মাসিক বেতনঃ " + fmt(salary) : "বেতন নির্ধারিত নয়"].filter(Boolean).join(" · ")}</div>
 </div>
 <div class="ledger-due">
 <div class="amt" style="color:var(--rust);">${fmt(takenThisMonth)}</div>
 <div class="lbl">এই মাসে নিয়েছে</div>
 </div>
 ${salary > 0 ? `<div class="ledger-due"><div class="amt" style="color:${remaining >= 0 ? "var(--green)" : "var(--red)"};">${fmt(Math.abs(remaining))}</div><div class="lbl">${remaining >= 0 ? "বেতন বাকি আছে" : "বেতনের বেশি নিয়েছে"}</div></div>` : ""}
 <button class="btn btn-primary" onclick="openEmployeeDetail(${p.id})">বিস্তারিত</button>
 </div>`;
    })
    .join("");

  return toolbar + `<div class="ledger-list">${rows}</div>`;
}

function renderEmployeeDetail(id) {
  const p = expensePeople.find((x) => x.id === id);
  if (!p) {
    employeeDetailId = null;
    return renderEmployees();
  }

  if (!employeeSalaryMonth) employeeSalaryMonth = monthKeyOf(new Date());
  const salaryMonth = employeeSalaryMonth;
  const salary = p.monthlySalary || 0;
  const advanceThisMonth = employeeForMonthTotal(id, salaryMonth, "অগ্রিম");
  const salaryPaidThisMonth = employeeForMonthTotal(id, salaryMonth, "বেতন");
  const totalForMonth = advanceThisMonth + salaryPaidThisMonth;
  const remaining = salary - totalForMonth;

  const backRow = `<div class="back-row">
 <button class="btn btn-outline" onclick="employeeDetailId=null; render(); scrollContentTop();">← সব কর্মচারী</button>
 <div class="cur-brand">${esc(p.name)}</div>
 </div>`;

  const headerPanel = `
 <div style="background:linear-gradient(135deg,var(--steel-900),var(--ink)); border-radius:16px; padding:20px; margin-bottom:16px; color:white; box-shadow:0 8px 22px rgba(0,0,0,0.18);">
 <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
 <div style="display:flex; align-items:center; gap:12px;">
 <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--rust),var(--amber));display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 4px 10px rgba(190,74,34,0.35);">👷</div>
 <div>
 <div style="font-weight:700; font-size:17px;">${esc(p.name)}</div>
  <div style="font-size:12.5px; color:rgba(255,255,255,0.7); margin-top:3px;">${p.phone ? esc(p.phone) : "ফোন নাম্বার নেই"}${p.address ? " · " + esc(p.address) : ""}</div>
 </div>
 </div>
 <button class="btn btn-outline" style="background:rgba(255,255,255,0.12); color:white; border-color:rgba(255,255,255,0.35);" onclick="editEmployeePrompt(${id})">✏️ এডিট</button>
 </div>
 </div>`;

  const emCard = (accent, label, value, sub) => `
 <div style="background:white; border-radius:14px; padding:16px 18px; box-shadow:0 2px 10px rgba(22,27,31,0.06); border-top:4px solid ${accent}; min-width:0;">
 <div style="font-size:11.5px; color:var(--steel-500); font-weight:600; line-height:1.4;">${label}</div>
 <div style="font-size:21px; font-weight:800; margin-top:8px; font-family:'JetBrains Mono',monospace; color:var(--ink); line-height:1.2; word-break:break-word;">${value}</div>
 ${sub ? `<div style="font-size:10.5px; color:var(--steel-500); margin-top:6px;">${sub}</div>` : ""}
 </div>`;

  const monthPanel = `
 <div class="panel" style="margin-bottom:16px;">
 <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
 <h3 style="margin-bottom:0;">📅 মাসিক বেতনের হিসাব</h3>
 <select onchange="setEmployeeSalaryMonth(${id}, this.value)" style="padding:9px 14px; border-radius:9px; border:1.5px solid var(--steel-100); font-size:13px; font-weight:600; background:var(--paper);">
 ${employeeMonthOptionsHtml(salaryMonth)}
 </select>
 </div>
 <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px;">
 ${emCard("var(--steel-700)", "মাসিক বেতন", salary > 0 ? fmt(salary) : "নির্ধারিত নয়")}
 ${emCard("var(--amber)", monthLabelOf(salaryMonth) + " — মোট নিয়েছে", fmt(totalForMonth), `বেতন ${fmt(salaryPaidThisMonth)} · অগ্রিম ${fmt(advanceThisMonth)}`)}
 ${emCard(remaining >= 0 ? "var(--green)" : "var(--red)", remaining >= 0 ? "এই মাসে বেতন বাকি আছে" : "বেতনের বেশি নিয়েছে", salary > 0 ? `<span style="color:${remaining >= 0 ? "var(--green)" : "var(--red)"}">${fmt(Math.abs(remaining))}</span>` : "—")}
 </div>
 <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap;">
 <button class="btn btn-primary" onclick="openEmployeePaymentModal(${id}, 'salary')">💰 বেতন দিন</button>
 <button class="btn btn-outline" onclick="openEmployeePaymentModal(${id}, 'advance')">🪙 অগ্রিম দিন</button>
 </div>
 <div style="font-size:11px;color:var(--steel-500);margin-top:12px;line-height:1.6;">💡 অগ্রিম দেওয়ার সময় যেই মাসের বেতনের বিপরীতে দিচ্ছেন সেই মাস বেছে দিন — সেই মাসের বেতন দেওয়ার সময় এই অগ্রিমের টাকা স্বয়ংক্রিয়ভাবে বাদ হয়ে হিসাব হবে।</div>
 </div>`;

  const period = listPeriod.employees || "month";
  const list = expenses
    .filter(
      (e) =>
        e.personId === id &&
        inSelectedPeriodAnchored(e.date, period, getPeriodAnchor("employees")),
    )
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalInPeriod = list.reduce((s, e) => s + e.amount, 0);

  const txRows =
    list.length === 0
      ? `<div class="no-match">এই সময়ে কোনো লেনদেন নেই</div>`
      : list
          .map(
            (e) => `
 <div class="day-tx">
 <div>
 <div class="txname">${expenseCategoryIcon(e.categoryId)} ${esc(e.categoryName)}${e.forMonth ? ` <span style="font-size:11px;color:var(--steel-500);font-weight:400;">· ${monthLabelOf(e.forMonth)} মাসের</span>` : ""}</div>
 <div class="txmeta">${new Date(e.date).toLocaleDateString("bn-BD")}${e.note ? " · " + esc(e.note) : ""}</div>
 </div>
 <div style="text-align:right;">
 <div class="mono" style="font-weight:700;">${fmt(e.amount)}</div>
 <button class="btn btn-outline" style="margin-top:4px;padding:3px 8px;font-size:11px;" onclick="openReceiptModal('expense', ${e.id})">রশিদ</button>
 </div>
 </div>`,
          )
          .join("");

  return (
    backRow +
    headerPanel +
    monthPanel +
    periodTabsHtml("employees") +
    `
 <div class="panel">
 <h3>সব লেনদেনের ইতিহাস — মোট ${fmt(totalInPeriod)}</h3>
 ${txRows}
 </div>`
  );
}

/* ============================================================
 সাপ্লায়ার — কার কাছে কত বাকি, কত পরিশোধ করা হয়েছে (খরচের সাথে যুক্ত)
 ============================================================ */
function getSupplierPaymentCategoryId() {
  let cat = expenseCategories.find((c) => c.name === "সাপ্লায়ার পরিশোধ");
  if (!cat) {
    cat = { id: expenseCatNextId++, name: "সাপ্লায়ার পরিশোধ", icon: "🚚" };
    expenseCategories.push(cat);
    persistShopData();
  }
  return cat.id;
}
function openSupplierDetail(id) {
  supplierDetailId = id;
  render();
  pushBackStep();
  scrollContentTop();
}

function addSupplierPrompt() {
  openModal(
    "নতুন সাপ্লায়ার যুক্ত করুন",
    `
 <div class="field"><label>নাম</label><input type="text" id="supName" placeholder="যেমনঃ আকিজ ট্রেডার্স"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="supPhone" placeholder="01xxx-xxxxxx"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="supAddress" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>কোন ব্র্যান্ড/পণ্যের সাপ্লায়ার</label><input type="text" id="supBrands" placeholder="যেমনঃ আকিজ, পিএইচপি"></div>
 <div class="field"><label>শুরুর বাকি (আগে থেকে থাকলে)</label><input type="number" id="supStartDue" value="0" min="0"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewSupplier()">যুক্ত করুন</button>
 `,
  );
}
function saveNewSupplier() {
  const name = document.getElementById("supName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  const phone = document.getElementById("supPhone").value.trim();
  if (isDuplicateEntry(suppliers, name, phone)) {
    showToast(
      "এই নাম ও মোবাইল নাম্বারে আগে থেকেই একজন সাপ্লায়ার আছে — নাম বা নাম্বারে কিছু একটা পরিবর্তন করুন",
    );
    return;
  }
  const startDue = Math.max(
    0,
    parseInt(document.getElementById("supStartDue").value) || 0,
  );
  const sup = {
    id: supplierNextId++,
    name,
    phone,
    address: document.getElementById("supAddress").value.trim(),
    brands: document.getElementById("supBrands").value.trim(),
    due: startDue,
    paidTotal: 0,
  };
  suppliers.push(sup);
  logActivity(
    "নতুন সাপ্লায়ার যুক্ত",
    `${name}${startDue > 0 ? " · শুরুর বাকি " + fmt(startDue) : ""}`,
  );
  closeModal();
  render();
  showToast("সাপ্লায়ার যুক্ত হয়েছে");
  persistShopData();
}
function editSupplierPrompt(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  openModal(
    `সাপ্লায়ারের তথ্য — ${esc(s.name)}`,
    `
 <div class="field"><label>নাম</label><input type="text" id="supEditName" value="${esc(s.name)}"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="supEditPhone" value="${esc(s.phone || "")}"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="supEditAddress" value="${esc(s.address || "")}"></div>
 <div class="field"><label>কোন ব্র্যান্ড/পণ্যের সাপ্লায়ার</label><input type="text" id="supEditBrands" value="${esc(s.brands || "")}"></div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteSupplierPrompt(${id})">মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSupplierEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveSupplierEdit(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  const name = document.getElementById("supEditName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  const phone = document.getElementById("supEditPhone").value.trim();
  const dupExists = suppliers.some(
    (x) =>
      x.id !== id &&
      normalizeStr(x.name) === normalizeStr(name) &&
      normalizeStr(x.phone) === normalizeStr(phone),
  );
  if (dupExists) {
    showToast(
      "এই নাম ও মোবাইল নাম্বারে আগে থেকেই একজন সাপ্লায়ার আছে — নাম বা নাম্বারে কিছু একটা পরিবর্তন করুন",
    );
    return;
  }
  s.name = name;
  s.phone = phone;
  s.address = document.getElementById("supEditAddress").value.trim();
  s.brands = document.getElementById("supEditBrands").value.trim();
  closeModal();
  render();
  showToast("তথ্য আপডেট হয়েছে");
  persistShopData();
}
function deleteSupplierPrompt(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  openModal(
    "সাপ্লায়ার মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">"${esc(s.name)}" কে সাপ্লায়ার তালিকা থেকে মুছে ফেলা হবে। আগের ক্রয়/পরিশোধের হিসাব থেকে যাবে, শুধু এই তালিকা থেকে বাদ যাবেন।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('সাপ্লায়ার মুছুন', () => deleteSupplierConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteSupplierConfirmed(id) {
  const s = suppliers.find((x) => x.id === id);
  if (s) {
    moveToTrash("supplier", s.name, `বাকি ছিল ${fmt(s.due || 0)}`, s);
  }
  suppliers = suppliers.filter((x) => x.id !== id);
  supplierDetailId = null;
  closeModal();
  render();
  showToast("সাপ্লায়ার ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  if (s) logActivity("সাপ্লায়ার মুছে ফেলা হয়েছে", s.name);
  persistShopData();
}

function addSupplierDuePrompt(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  openModal(
    `ক্রয়/বাকি যোগ করুন — ${esc(s.name)}`,
    `
 <div style="font-size:12px;color:var(--steel-500);margin-bottom:12px;line-height:1.6;">এই সাপ্লায়ারের কাছ থেকে মাল কিনেছেন কিন্তু এখনো টাকা দেননি — সেই পরিমাণ এখানে লিখুন। এটা তখনই "খরচ" হিসেবে গণনা হবে যখন আসলে টাকা পরিশোধ করবেন।</div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="supDueAmount" min="0" placeholder="যেমনঃ ৫০,০০০"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="supDueDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>বিবরণ (ঐচ্ছিক)</label><input type="text" id="supDueNote" placeholder="যেমনঃ ৫০ বান টিন"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSupplierDue(${id})">যোগ করুন</button>
 `,
  );
}
function saveSupplierDue(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  const amount = Math.max(
    0,
    parseInt(document.getElementById("supDueAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const date = dateFromInput(document.getElementById("supDueDate").value);
  const note = document.getElementById("supDueNote").value.trim();
  supplierDueEntries.push({
    id: supplierDueNextId++,
    supplierId: id,
    date,
    amount,
    note,
  });
  s.due = (s.due || 0) + amount;
  logActivity(
    "সাপ্লায়ারের কাছে নতুন বাকি যোগ",
    `${s.name} · ${fmt(amount)}${note ? " · " + note : ""}`,
  );
  closeModal();
  render();
  showToast("বাকি যোগ হয়েছে");
  persistShopData();
}
function editSupplierDuePrompt(id) {
  const d = supplierDueEntries.find((x) => x.id === id);
  if (!d) return;
  openModal(
    "ক্রয়/বাকির এন্ট্রি এডিট করুন",
    `
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="editSupDueAmount" min="0" value="${d.amount}"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="editSupDueDate" value="${toDateInputValue(d.date)}"></div>
 <div class="field"><label>বিবরণ (ঐচ্ছিক)</label><input type="text" id="editSupDueNote" value="${esc(d.note || "")}"></div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteSupplierDuePrompt(${id})">মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSupplierDueEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveSupplierDueEdit(id) {
  const d = supplierDueEntries.find((x) => x.id === id);
  if (!d) return;
  const s = suppliers.find((x) => x.id === d.supplierId);
  const newAmount = Math.max(
    0,
    parseInt(document.getElementById("editSupDueAmount").value) || 0,
  );
  if (newAmount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const diff = newAmount - d.amount;
  if (s) s.due = Math.max(0, (s.due || 0) + diff);
  d.amount = newAmount;
  d.date = dateFromInput(document.getElementById("editSupDueDate").value);
  d.note = document.getElementById("editSupDueNote").value.trim();
  closeModal();
  render();
  showToast("আপডেট হয়েছে");
  persistShopData();
}
function deleteSupplierDuePrompt(id) {
  const d = supplierDueEntries.find((x) => x.id === id);
  if (!d) return;
  openModal(
    "ক্রয়/বাকির এন্ট্রি মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">${fmt(d.amount)} টাকার এই এন্ট্রিটি মুছে ফেলা হবে, এবং সাপ্লায়ারের বর্তমান বাকি থেকে এই পরিমাণ বাদ যাবে।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('ক্রয়/বাকির এন্ট্রি মুছুন', () => deleteSupplierDueConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteSupplierDueConfirmed(id) {
  const d = supplierDueEntries.find((x) => x.id === id);
  if (!d) return;
  const s = suppliers.find((x) => x.id === d.supplierId);
  if (s) s.due = Math.max(0, (s.due || 0) - d.amount);
  supplierDueEntries = supplierDueEntries.filter((x) => x.id !== id);
  closeModal();
  render();
  showToast("মুছে ফেলা হয়েছে");
  persistShopData();
}
function editSupplierPaymentPrompt(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  openModal(
    "পরিশোধের এন্ট্রি এডিট করুন",
    `
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="editSupPayAmount" min="0" value="${e.amount}"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="editSupPayDate" value="${toDateInputValue(e.date)}"></div>
 <div class="field"><label>নোট</label><input type="text" id="editSupPayNote" value="${esc(e.note || "")}"></div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteSupplierPaymentPrompt(${id})">মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSupplierPaymentEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveSupplierPaymentEdit(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  const s = suppliers.find((x) => x.id === e.supplierId);
  const newAmount = Math.max(
    0,
    parseInt(document.getElementById("editSupPayAmount").value) || 0,
  );
  if (newAmount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const diff = newAmount - e.amount;
  if (s) {
    s.due = Math.max(0, (s.due || 0) - diff);
    s.paidTotal = Math.max(0, (s.paidTotal || 0) + diff);
  }
  e.amount = newAmount;
  e.date = dateFromInput(document.getElementById("editSupPayDate").value);
  e.note = document.getElementById("editSupPayNote").value.trim();
  closeModal();
  render();
  showToast("আপডেট হয়েছে");
  persistShopData();
}
function deleteSupplierPaymentPrompt(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  openModal(
    "পরিশোধের এন্ট্রি মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">${fmt(e.amount)} টাকার এই পরিশোধের এন্ট্রিটি মুছে ফেলা হবে — এই পরিমাণ আবার সাপ্লায়ারের বাকিতে যোগ হয়ে যাবে।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('পরিশোধের এন্ট্রি মুছুন', () => deleteSupplierPaymentConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteSupplierPaymentConfirmed(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  const s = suppliers.find((x) => x.id === e.supplierId);
  if (s) {
    s.due = (s.due || 0) + e.amount;
    s.paidTotal = Math.max(0, (s.paidTotal || 0) - e.amount);
  }
  expenses = expenses.filter((x) => x.id !== id);
  closeModal();
  render();
  showToast("মুছে ফেলা হয়েছে");
  persistShopData();
}

function supplierPaymentPrompt(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  openModal(
    `পরিশোধ করুন — ${esc(s.name)}`,
    `
 <div style="background:var(--steel-100);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13.5px;display:flex;justify-content:space-between;">
 <span>বর্তমান বাকি</span><b class="mono">${fmt(s.due || 0)}</b>
 </div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="supPayAmount" min="0" value="${s.due || 0}"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="supPayDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>কিভাবে দিলেন</label>
 <select id="supPayMethod">
 <option value="ক্যাশ">💵 ক্যাশ</option>
 <option value="বিকাশ">📱 বিকাশ</option>
 <option value="নগদ">📱 নগদ (Nagad)</option>
 <option value="ব্যাংক">🏦 ব্যাংক ট্রান্সফার</option>
 <option value="অন্যান্য">✏️ অন্যান্য</option>
 </select>
 </div>
 <div class="field"><label>নোট (ঐচ্ছিক)</label><input type="text" id="supPayNote" placeholder="ঐচ্ছিক"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveSupplierPayment(${id})">পরিশোধ করুন</button>
 `,
  );
}
function saveSupplierPayment(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) return;
  const amount = Math.max(
    0,
    parseInt(document.getElementById("supPayAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const date = dateFromInput(document.getElementById("supPayDate").value);
  const method = document.getElementById("supPayMethod").value;
  const note = document.getElementById("supPayNote").value.trim();

  s.due = Math.max(0, (s.due || 0) - amount);
  s.paidTotal = (s.paidTotal || 0) + amount;

  const catId = getSupplierPaymentCategoryId();
  const cat = expenseCategories.find((c) => c.id === catId);
  expenses.push({
    id: expenseNextId++,
    date,
    categoryId: catId,
    categoryName: cat ? cat.name : "সাপ্লায়ার পরিশোধ",
    personId: null,
    personName: s.name,
    supplierId: id,
    amount,
    note: note || `মাধ্যমঃ ${method}`,
  });
  logActivity("সাপ্লায়ারকে পরিশোধ", `${s.name} · ${fmt(amount)} (${method})`);
  closeModal();
  render();
  showToast(`${fmt(amount)} পরিশোধ করা হয়েছে ও খরচে যোগ হয়েছে`);
  persistShopData();
}

function renderSuppliers() {
  if (supplierDetailId) return renderSupplierDetail(supplierDetailId);
  const toolbar = `
 <div class="ledger-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">সাপ্লায়ারদের বাকি ও পরিশোধের হিসাব — পরিশোধ করলে তা স্বয়ংক্রিয়ভাবে খরচের খাতা ও রিপোর্টে যোগ হয়ে যাবে</div>
 <button class="btn btn-primary" onclick="addSupplierPrompt()">+ নতুন সাপ্লায়ার</button>
 </div>`;
  if (suppliers.length === 0) {
    return (
      toolbar +
      `<div class="empty-state"><div class="ic">🚚</div>এখনো কোনো সাপ্লায়ার যুক্ত করা হয়নি<br><span style="font-size:12px;">"+ নতুন সাপ্লায়ার" চেপে শুরু করুন</span></div>`
    );
  }
  const rows = suppliers
    .map(
      (s, idx) => `
 <div class="person-row">
 <div class="ledger-serial">${idx + 1}</div>
 <div class="ledger-info" style="cursor:pointer;" onclick="openSupplierDetail(${s.id})">
 <div class="lname">${esc(s.name)}</div>
 <div class="lmeta">${[s.brands ? "🏷️ " + esc(s.brands) : "", esc(s.address), telHtml(s.phone)].filter(Boolean).join(" · ") || "কোনো তথ্য নেই"}</div>
 </div>
 <div class="ledger-due">
 <div class="amt ${!s.due ? "clear" : ""}" style="color:${s.due > 0 ? "var(--red)" : "var(--green)"};">${s.due > 0 ? fmt(s.due) : "পরিশোধিত"}</div>
 <div class="lbl">${s.due > 0 ? "বকেয়া" : "কোনো বাকি নেই"}</div>
 </div>
  <button class="btn btn-outline" onclick="editSupplierPrompt(${s.id})">✏️ এডিট</button>
 <button class="btn btn-outline" onclick="openSupplierDetail(${s.id})">📋 বিস্তারিত</button>
 <button class="btn btn-outline" style="color:var(--red);border-color:var(--red);" onclick="addSupplierDuePrompt(${s.id})">➕ বাকি নিয়েছি</button>
 <button class="btn btn-primary" onclick="supplierPaymentPrompt(${s.id})">💵 জমা দিয়েছি</button>
 </div>`,
    )
    .join("");
  return toolbar + `<div class="ledger-list">${rows}</div>`;
}

function renderSupplierDetail(id) {
  const s = suppliers.find((x) => x.id === id);
  if (!s) {
    supplierDetailId = null;
    return renderSuppliers();
  }

  const totalOwed = supplierDueEntries
    .filter((d) => d.supplierId === id)
    .reduce((sum, d) => sum + d.amount, 0);
  const totalPaid = expenses
    .filter((e) => e.supplierId === id)
    .reduce((sum, e) => sum + e.amount, 0);

  const backRow = `<div class="back-row">
 <button class="btn btn-outline" onclick="supplierDetailId=null; render(); scrollContentTop();">← সব সাপ্লায়ার</button>
 <div class="cur-brand">${esc(s.name)}</div>
 </div>`;

  const headerPanel = `
 <div style="background:linear-gradient(135deg,var(--steel-900),var(--ink)); border-radius:16px; padding:20px; margin-bottom:16px; color:white; box-shadow:0 8px 22px rgba(0,0,0,0.18);">
 <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
 <div style="display:flex; align-items:flex-start; gap:12px;">
 <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--rust),var(--amber));display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 4px 10px rgba(190,74,34,0.35);">🚚</div>
 <div>
 <div style="font-weight:700; font-size:17px;">${esc(s.name)}</div>
 ${s.brands ? `<div style="font-size:12px; color:rgba(255,255,255,0.85); margin-top:4px;">🏷️ ${esc(s.brands)}</div>` : ""}
 <div style="font-size:12.5px; color:rgba(255,255,255,0.7); margin-top:3px;">${s.phone ? esc(s.phone) : "ফোন নাম্বার নেই"}${s.address ? " · " + esc(s.address) : ""}</div>
 </div>
 </div>
 <button class="btn btn-outline" style="background:rgba(255,255,255,0.12); color:white; border-color:rgba(255,255,255,0.35);" onclick="editSupplierPrompt(${id})">✏️ এডিট</button>
 </div>
 </div>`;

  const emCard = (accent, label, value) => `
 <div style="background:white; border-radius:14px; padding:16px 18px; box-shadow:0 2px 10px rgba(22,27,31,0.06); border-top:4px solid ${accent}; min-width:0;">
 <div style="font-size:11.5px; color:var(--steel-500); font-weight:600; line-height:1.4;">${label}</div>
 <div style="font-size:21px; font-weight:800; margin-top:8px; font-family:'JetBrains Mono',monospace; color:var(--ink); line-height:1.2; word-break:break-word;">${value}</div>
 </div>`;

  const statsPanel = `
 <div class="panel" style="margin-bottom:16px;">
 <h3 style="margin-bottom:14px;">💼 হিসাবের সারাংশ</h3>
 <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px;">
 ${emCard("var(--steel-700)", "সর্বমোট ক্রয় (এ পর্যন্ত)", fmt(totalOwed))}
 ${emCard("var(--green)", "সর্বমোট পরিশোধ করেছেন", fmt(totalPaid))}
 ${emCard(s.due > 0 ? "var(--red)" : "var(--green)", "বর্তমান বাকি", `<span style="color:${s.due > 0 ? "var(--red)" : "var(--green)"}">${fmt(s.due || 0)}</span>`)}
 </div>
  <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap;">
 <button class="btn btn-outline" onclick="addSupplierDuePrompt(${id})">➕ বাকি নিয়েছি</button>
 <button class="btn btn-primary" onclick="supplierPaymentPrompt(${id})">💵 জমা দিয়েছি</button>
 </div>
 <div style="font-size:11px;color:var(--steel-500);margin-top:12px;line-height:1.6;">💡 "ক্রয়/বাকি যোগ করুন" দিয়ে শুধু বাকি বাড়ে (খরচ হিসেবে গণনা হয় না)। "পরিশোধ করুন" দিয়ে টাকা দিলে সেটা স্বয়ংক্রিয়ভাবে আপনার খরচের খাতা ও রিপোর্টে যোগ হয়ে যায়।</div>
 </div>`;

  const period = listPeriod.suppliers || "all";
  const combined = [
    ...supplierDueEntries
      .filter(
        (d) =>
          d.supplierId === id &&
          inSelectedPeriodAnchored(
            d.date,
            period,
            getPeriodAnchor("suppliers"),
          ),
      )
      .map((d) => ({
        t: new Date(d.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag expense">ক্রয়/বাকি</span>${new Date(d.date).toLocaleDateString("bn-BD")}</div>
 <div class="txmeta">${esc(d.note) || "কোনো বিবরণ নেই"}</div>
 </div>
 <div style="text-align:right;">
 <div class="mono" style="font-weight:700; color:var(--red);">+ ${fmt(d.amount)}</div>
 <div style="display:flex;gap:6px;margin-top:5px;">
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;" onclick="editSupplierDuePrompt(${d.id})">এডিট</button>
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;color:var(--red);" onclick="deleteSupplierDuePrompt(${d.id})">মুছুন</button>
 </div>
 </div>
 </div>`,
      })),
    ...expenses
      .filter(
        (e) =>
          e.supplierId === id &&
          inSelectedPeriodAnchored(
            e.date,
            period,
            getPeriodAnchor("suppliers"),
          ),
      )
      .map((e) => ({
        t: new Date(e.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag payment">পরিশোধ</span>${new Date(e.date).toLocaleDateString("bn-BD")}</div>
 <div class="txmeta">${esc(e.note) || "কোনো বিবরণ নেই"}</div>
 </div>
 <div style="text-align:right;">
 <div class="mono" style="font-weight:700; color:var(--green);">− ${fmt(e.amount)}</div>
 <div style="display:flex;gap:6px;margin-top:5px;">
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;" onclick="openReceiptModal('expense', ${e.id})">রশিদ</button>
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;" onclick="editSupplierPaymentPrompt(${e.id})">এডিট</button>
 <button class="btn btn-outline" style="padding:3px 9px;font-size:11px;color:var(--red);" onclick="deleteSupplierPaymentPrompt(${e.id})">মুছুন</button>
 </div>
 </div>
 </div>`,
      })),
  ].sort((a, b) => b.t - a.t);

  const txHtml =
    combined.length === 0
      ? `<div class="no-match">এই সময়ে কোনো লেনদেন নেই</div>`
      : combined.map((x) => x.html).join("");

  return (
    backRow +
    headerPanel +
    statsPanel +
    periodTabsHtml("suppliers") +
    `
 <div class="panel">
 <h3>লেনদেনের ইতিহাস</h3>
 ${txHtml}
 </div>`
  );
}

function openCustomerDetail(id) {
  ledgerDetailId = id;
  render();
  pushBackStep();
  scrollContentTop();
}

function renderCustomerDetail(id) {
  const cust = ledger.find((l) => l.id === id);
  if (!cust) {
    ledgerDetailId = null;
    return renderLedger();
  }

  const custInvoices = invoices.filter(
    (inv) => inv.custId === id && !inv.cancelled,
  );
  const custPayments = payments.filter((p) => p.custId === id);
  const custDueEntriesForTotal = customerDueEntries.filter(
    (d) => d.custId === id,
  );
  const totalSales =
    custInvoices.reduce((s, inv) => s + inv.total, 0) +
    custDueEntriesForTotal.reduce((s, d) => s + d.amount, 0);
  const totalPaidAllTime = cust.paidTotal || 0;

  const backRow = `<div class="back-row">
 <button class="btn btn-outline" onclick="ledgerDetailId=null; render(); scrollContentTop();">← বাকির খাতা</button>
 <div class="cur-brand">${esc(cust.name)}</div>
 </div>`;

  const headerPanel = `
 <div style="background:linear-gradient(135deg,var(--steel-900),var(--ink)); border-radius:16px; padding:20px; margin-bottom:16px; color:white; box-shadow:0 8px 22px rgba(0,0,0,0.18);">
 <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
 <div style="display:flex; align-items:flex-start; gap:12px;">
 <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--rust),var(--amber));display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;box-shadow:0 4px 10px rgba(190,74,34,0.35);">🧑</div>
 <div>
 <div style="font-weight:700; font-size:17px;">${esc(cust.name)}</div>
 ${cust.phone ? `<div style="font-size:14px; font-weight:700; color:#ffd8a8; margin-top:5px; letter-spacing:0.02em;">📞 ${esc(cust.phone)}</div>` : ""}
 ${cust.address ? `<div style="font-size:12.5px; color:rgba(255,255,255,0.75); margin-top:3px;">📍 ${esc(cust.address)}</div>` : ""}
 </div>
 </div>
  <div style="display:flex; gap:8px;">
 <button class="btn btn-outline" style="background:rgba(255,255,255,0.12); color:white; border-color:rgba(255,255,255,0.35);" onclick="editCustomerPrompt(${id})">✏️</button>
 ${cust.due > 0 ? `<button class="btn btn-outline" style="background:#25D366; color:white; border-color:#25D366;" onclick="sendDueReminder(${id})">📱</button>` : ""}
 ${cust.phone ? `<button class="btn btn-outline" style="background:rgba(255,255,255,0.12); color:white; border-color:rgba(255,255,255,0.35);" onclick="callCustomer(${id})">📞</button>` : ""}
 </div>
 </div>
 </div>`;

  const emCard = (accent, label, value) => `
 <div style="background:white; border-radius:14px; padding:16px 18px; box-shadow:0 2px 10px rgba(22,27,31,0.06); border-top:4px solid ${accent}; min-width:0;">
 <div style="font-size:11.5px; color:var(--steel-500); font-weight:600; line-height:1.4;">${label}</div>
 <div style="font-size:21px; font-weight:800; margin-top:8px; font-family:'JetBrains Mono',monospace; color:var(--ink); line-height:1.2; word-break:break-word;">${value}</div>
 </div>`;

  const statsPanel = `
 <div class="panel" style="margin-bottom:16px;">
 <h3 style="margin-bottom:14px;">💼 হিসাবের সারাংশ</h3>
 <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px;">
 ${emCard("var(--steel-700)", "সর্বমোট বিক্রয় (এ পর্যন্ত)", fmt(totalSales))}
 ${emCard("var(--green)", "সর্বমোট পরিশোধ করেছেন", fmt(totalPaidAllTime))}
 ${emCard(cust.due > 0 ? "var(--red)" : "var(--green)", "বর্তমান বাকি", `<span style="color:${cust.due > 0 ? "var(--red)" : "var(--green)"}">${fmt(cust.due || 0)}</span>`)}
 </div>
  <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap;">
 <button class="btn btn-outline" onclick="addCustomerDuePrompt(${id})">➕ বাকি দিচ্ছি</button>
 <button class="btn btn-primary" onclick="paymentPrompt(${id})">💵 জমা নিচ্ছি</button>
 </div>
 </div>`;

  const period = listPeriod.customerDetail || "all";
  const combined = [
    ...custInvoices
      .filter((inv) =>
        inSelectedPeriodAnchored(
          inv.date,
          period,
          getPeriodAnchor("customerDetail"),
        ),
      )
      .map((inv) => ({
        t: new Date(inv.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag sale">বিক্রয়</span>ক্যাশ মেমো #${inv.id} · ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 <div class="txmeta">সর্বমোট ${fmt(inv.total)} · বাকি ${fmt(inv.due)}</div>
 </div>
 <button class="btn btn-outline" onclick="openCashboxMemoDetail(${inv.id})">দেখুন</button>
 </div>`,
      })),
    ...custPayments
      .filter((p) =>
        inSelectedPeriodAnchored(
          p.date,
          period,
          getPeriodAnchor("customerDetail"),
        ),
      )
      .map((p) => ({
        t: new Date(p.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
  <div class="txname"><span class="tx-tag payment">জমা</span>রশিদ #${p.id} · ${new Date(p.date).toLocaleDateString("bn-BD")}</div>
 <div class="txmeta">জমা ${fmt(p.amount)}${p.discount > 0 ? " · ছাড় " + fmt(p.discount) : ""} · মাধ্যমঃ ${esc(p.method || "ক্যাশ")}${p.note ? " · " + esc(p.note) : ""}</div>
 </div>
 <button class="btn btn-outline" onclick="viewPaymentReceipt(${p.id})">দেখুন</button>
 </div>`,
      })),
    ...customerDueEntries
      .filter(
        (d) =>
          d.custId === id &&
          inSelectedPeriodAnchored(
            d.date,
            period,
            getPeriodAnchor("customerDetail"),
          ),
      )
      .map((d) => ({
        t: new Date(d.date).getTime(),
        html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag expense">বাকি দিলাম</span>${new Date(d.date).toLocaleDateString("bn-BD")}</div>
 <div class="txmeta">${esc(d.note) || "কোনো বিবরণ নেই"}</div>
 </div>
 <div class="mono" style="font-weight:700; color:var(--red);">+ ${fmt(d.amount)}</div>
 </div>`,
      })),
  ].sort((a, b) => b.t - a.t);

  const txHtml =
    combined.length === 0
      ? `<div class="no-match">এই সময়ে কোনো লেনদেন নেই</div>`
      : combined.map((x) => x.html).join("");

  return (
    backRow +
    headerPanel +
    statsPanel +
    periodTabsHtml("customerDetail") +
    `
 <div class="panel">
 <h3>লেনদেনের ইতিহাস</h3>
 ${txHtml}
 </div>`
  );
}

function viewCustomerInvoices(custId) {
  const cust = ledger.find((l) => l.id === custId);
  const custInvoices = invoices.filter((inv) => inv.custId === custId);
  const custPayments = payments.filter((p) => p.custId === custId);
  const combined = [
    ...custInvoices.map((inv) => ({
      t: new Date(inv.date).getTime(),
      html: `
 <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--steel-100);font-size:13px;">
 <div>
 <div style="font-weight:600;"><span class="tx-tag sale">বিক্রয়</span>ক্যাশ মেমো #${inv.id} · ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 <div style="color:var(--steel-500);font-size:12px;">সর্বমোট ${fmt(inv.total)} · বাকি ${fmt(inv.due)}</div>
 </div>
 <button class="btn btn-outline" onclick="printInvoice(invoices.find(x=>x.id===${inv.id}))">প্রিন্ট/ডাউনলোড</button>
 </div>`,
    })),
    ...custPayments.map((p) => ({
      t: new Date(p.date).getTime(),
      html: `
 <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--steel-100);font-size:13px;">
 <div>
 <div style="font-weight:600;"><span class="tx-tag payment">জমা</span>রশিদ #${p.id} · ${new Date(p.date).toLocaleDateString("bn-BD")}</div>
 <div style="color:var(--steel-500);font-size:12px;">জমা ${fmt(p.amount)}${p.discount > 0 ? " · ছাড় " + fmt(p.discount) : ""}</div>
 </div>
 <button class="btn btn-outline" onclick="viewPaymentReceipt(${p.id})">প্রিন্ট/ডাউনলোড</button>
 </div>`,
    })),
  ].sort((a, b) => b.t - a.t);
  const rows =
    combined.length === 0
      ? `<div class="no-match">এখনো কোনো লেনদেন নেই</div>`
      : combined.map((x) => x.html).join("");
  openModal(
    `লেনদেন — ${esc(cust.name)}`,
    rows,
    `<button class="btn btn-outline" onclick="closeModal()">বন্ধ করুন</button>`,
  );
}
function addCustomerPrompt() {
  openModal(
    "নতুন গ্রাহক যুক্ত করুন",
    `
 <div class="field"><label>নাম</label><input type="text" id="custName" placeholder="যেমনঃ মোঃ করিম মিয়া"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="custAddr" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="custPhone" placeholder="01xxx-xxxxxx"></div>
 <div class="field"><label>শুরুর বাকি (থাকলে)</label><input type="number" id="custDue" value="0" min="0"></div>
 <div class="field"><label>তারিখ (চাইলে আগের কোনো তারিখ দিতে পারেন — ব্যাকডেটেড)</label><input type="date" id="custDate" value="${toDateInputValue(new Date())}"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewCustomer()">যুক্ত করুন</button>
 `,
  );
}
function saveNewCustomer() {
  const name = document.getElementById("custName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  const phone = document.getElementById("custPhone").value.trim();
  if (isDuplicateEntry(ledger, name, phone)) {
    showToast(
      "এই নাম ও মোবাইল নাম্বারে আগে থেকেই একজন গ্রাহক আছে — নাম বা নাম্বারে কিছু একটা পরিবর্তন করুন",
    );
    return;
  }
  const startDue = parseInt(document.getElementById("custDue").value) || 0;
  const custDate = dateFromInput(document.getElementById("custDate").value);
  ledger.push({
    id: ledgerNextId++,
    name,
    address: document.getElementById("custAddr").value.trim(),
    phone,
    due: startDue,
    paidTotal: 0,
    discountTotal: 0,
    addedDate: custDate,
  });
  logActivity(
    "নতুন গ্রাহক যুক্ত",
    `${name}${startDue > 0 ? " · শুরুর বাকি " + fmt(startDue) : ""}`,
  );
  closeModal();
  render();
  showToast("গ্রাহক যুক্ত হয়েছে");
  persistShopData();
}
function editCustomerPrompt(id) {
  const cust = ledger.find((l) => l.id === id);
  if (!cust) return;
  openModal(
    `গ্রাহকের তথ্য এডিট — ${esc(cust.name)}`,
    `
 <div class="field"><label>নাম</label><input type="text" id="custEditName" value="${esc(cust.name)}"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="custEditAddr" value="${esc(cust.address || "")}"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="custEditPhone" value="${esc(cust.phone || "")}"></div>
 <div class="field"><label>বর্তমান বাকি (৳)</label><input type="number" id="custEditDue" min="0" value="${cust.due}"></div>
 <div class="field"><label>যুক্ত হওয়ার তারিখ</label><input type="date" id="custEditDate" value="${toDateInputValue(cust.addedDate || new Date())}"></div>
 <div style="font-size:11px;color:var(--steel-500);">বাকির পরিমাণ এখান থেকে সরাসরি বদলালে সেটা কোনো ক্যাশ মেমো/পেমেন্টের হিসাবের সাথে যুক্ত হবে না — শুধু বর্তমান বকেয়ার সংখ্যাটাই বদলে যাবে।</div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteCustomerPrompt(${id})">🗑️ মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveCustomerEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveCustomerEdit(id) {
  const cust = ledger.find((l) => l.id === id);
  if (!cust) return;
  const name = document.getElementById("custEditName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  const phone = document.getElementById("custEditPhone").value.trim();
  const dupExists = ledger.some(
    (l) =>
      l.id !== id &&
      normalizeStr(l.name) === normalizeStr(name) &&
      normalizeStr(l.phone) === normalizeStr(phone),
  );
  if (dupExists) {
    showToast(
      "এই নাম ও মোবাইল নাম্বারে আগে থেকেই একজন গ্রাহক আছে — নাম বা নাম্বারে কিছু একটা পরিবর্তন করুন",
    );
    return;
  }
  cust.name = name;
  cust.address = document.getElementById("custEditAddr").value.trim();
  cust.phone = phone;
  cust.due = Math.max(
    0,
    parseInt(document.getElementById("custEditDue").value) || 0,
  );
  cust.addedDate = dateFromInput(document.getElementById("custEditDate").value);
  closeModal();
  render();
  showToast("গ্রাহকের তথ্য আপডেট হয়েছে");
  persistShopData();
}
function addCustomerDuePrompt(id) {
  const cust = ledger.find((l) => l.id === id);
  if (!cust) return;
  openModal(
    `বাকি দিচ্ছি — ${esc(cust.name)}`,
    `
 <div style="font-size:12px;color:var(--steel-500);margin-bottom:12px;line-height:1.6;">এই গ্রাহককে ক্যাশ মেমো ছাড়া বাকিতে মাল দিয়েছেন — সেই পরিমাণ এখানে লিখুন। এটা গ্রাহকের বর্তমান বকেয়ার সাথে যোগ হয়ে যাবে।</div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="custDueAddAmount" min="0" placeholder="যেমনঃ ২,০০০"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="custDueAddDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>বিবরণ (ঐচ্ছিক)</label><input type="text" id="custDueAddNote" placeholder="যেমনঃ ৫ বস্তা সিমেন্ট বাকিতে দেওয়া হয়েছে"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveCustomerDueAdd(${id})">যোগ করুন</button>
 `,
  );
}
function saveCustomerDueAdd(id) {
  const cust = ledger.find((l) => l.id === id);
  if (!cust) return;
  const amount = Math.max(
    0,
    parseInt(document.getElementById("custDueAddAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const date = dateFromInput(document.getElementById("custDueAddDate").value);
  const note = document.getElementById("custDueAddNote").value.trim();
  cust.due = (cust.due || 0) + amount;
  customerDueEntries.push({
    id: customerDueNextId++,
    custId: id,
    date,
    amount,
    note,
  });
  logActivity(
    "গ্রাহককে নতুন বাকি দেওয়া হয়েছে",
    `${cust.name} · ${fmt(amount)}${note ? " · " + note : ""}`,
  );
  closeModal();
  render();
  showToast("বাকি যোগ হয়েছে");
  persistShopData();
}
function deleteCustomerPrompt(id) {
  const cust = ledger.find((l) => l.id === id);
  if (!cust) return;
  openModal(
    "গ্রাহক মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">"${esc(cust.name)}" কে বাকির খাতা থেকে স্থায়ীভাবে মুছে ফেলা হবে। এই গ্রাহকের আগের ক্যাশ মেমো/পেমেন্ট রেকর্ডে নাম থেকে যাবে, শুধু এই তালিকা থেকে বাদ যাবেন।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('গ্রাহক মুছুন', () => deleteCustomerConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteCustomerConfirmed(id) {
  const cust = ledger.find((x) => x.id === id);
  if (cust) {
    moveToTrash("customer", cust.name, `বাকি ছিল ${fmt(cust.due)}`, cust);
  }
  ledger = ledger.filter((x) => x.id !== id);
  ledgerDetailId = null;
  closeModal();
  render();
  showToast("গ্রাহক ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
  switchView("ledger");
}
function paymentPrompt(id) {
  const cust = ledger.find((l) => l.id === id);
  openModal(
    `পেমেন্ট — ${esc(cust.name)}`,
    `
 <div style="background:var(--steel-100);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13.5px;display:flex;justify-content:space-between;">
 <span>বর্তমান বাকি</span><b class="mono">${fmt(cust.due)}</b>
 </div>
 <div class="field"><label>জমার তারিখ</label><input type="date" id="payDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>কিভাবে জমা দিলো</label>
 <select id="payMethod">
 <option value="ক্যাশ">💵 ক্যাশ (নগদ টাকা)</option>
 <option value="বিকাশ">📱 বিকাশ</option>
 <option value="নগদ">📱 নগদ (Nagad)</option>
 <option value="ব্যাংক">🏦 ব্যাংক ট্রান্সফার</option>
 <option value="অন্যান্য">✏️ অন্যান্য</option>
 </select>
 </div>
  <div class="field"><label>ছাড়/ডিসকাউন্ট (৳) — থাকলে লিখুন</label><input type="number" id="payDiscount" value="0" min="0" max="${cust.due}" oninput="paymentRecalc(${cust.due})"></div>
 <div class="field"><label>পরিশোধের পরিমাণ (৳)</label><input type="number" id="payAmt" value="${cust.due}" min="0" max="${cust.due}" oninput="paymentRecalc(${cust.due})"></div>
 <div class="field"><label>বিবরণ (ঐচ্ছিক)</label><input type="text" id="payNote" placeholder="যেমনঃ নগদ জমা দিয়েছেন দোকানে এসে"></div>
 <div style="background:var(--steel-100); border-radius:8px; padding:10px 14px; font-size:13px; display:flex; justify-content:space-between;">
 <span>জমার পর বাকি থাকবে</span><b class="mono" id="payRemainVal">${fmt(0)}</b>
 </div>
 <div style="font-size:11.5px;color:var(--steel-500);margin-top:8px;">পরিশোধ করার পরও এই গ্রাহক তালিকার একই সিরিয়ালে (${ledger.indexOf(cust) + 1} নং) থাকবে — উপরে-নিচে যাবে না। ছাড় দিলে সেই পরিমাণ বাকি থেকে বাদ যাবে এবং রশিদে আলাদাভাবে দেখানো হবে।</div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="applyPayment(${id})">জমা করুন ও রশিদ দিন</button>
 `,
  );
  paymentRecalc(cust.due);
}
function paymentRecalc(due) {
  const amtEl = document.getElementById("payAmt");
  const discEl = document.getElementById("payDiscount");
  if (!amtEl || !discEl) return;
  const amt = Math.max(0, parseInt(amtEl.value) || 0);
  const disc = Math.max(0, parseInt(discEl.value) || 0);
  const remain = Math.max(0, due - amt - disc);
  const remainEl = document.getElementById("payRemainVal");
  if (remainEl) remainEl.textContent = fmt(remain);
}
function applyPayment(id) {
  const cust = ledger.find((l) => l.id === id);
  const dueBefore = cust.due;
  let amt = Math.max(0, parseInt(document.getElementById("payAmt").value) || 0);
  let disc = Math.max(
    0,
    parseInt(document.getElementById("payDiscount").value) || 0,
  );
  if (amt + disc > dueBefore) {
    disc = Math.max(0, dueBefore - amt);
    if (amt > dueBefore) amt = dueBefore;
  }
  const payDate = dateFromInput(document.getElementById("payDate").value);
  const methodEl = document.getElementById("payMethod");
  const method = methodEl ? methodEl.value : "ক্যাশ";
  const noteEl = document.getElementById("payNote");
  const note = noteEl ? noteEl.value.trim() : "";
  cust.due -= amt + disc;
  cust.paidTotal += amt;
  cust.discountTotal = (cust.discountTotal || 0) + disc;
  reduceCustomerInvoiceDues(id, amt + disc);

  const payment = {
    id: paymentCounter++,
    custId: id,
    custName: cust.name,
    custPhone: cust.phone,
    custAddress: cust.address,
    method,
    amount: amt,
    discount: disc,
    note,
    dueBefore,
    dueAfter: cust.due,
    date: payDate,
  };
  payments.push(payment);
  logActivity(
    "পেমেন্ট গ্রহণ",
    `${cust.name} থেকে ${fmt(amt)} (${method})${disc > 0 ? " · ছাড় " + fmt(disc) : ""} (বকেয়া ${fmt(dueBefore)} → ${fmt(cust.due)})`,
  );

  closeModal();
  render();
  showToast(`${fmt(amt)} জমা হয়েছে${disc > 0 ? " · ছাড় " + fmt(disc) : ""}`);
  lastPaymentId = payment.id;
  persistShopData();
  switchView("paymentReceipt");
}
function viewPaymentReceipt(id) {
  lastPaymentId = id;
  switchView("paymentReceipt");
}
function renderPaymentReceiptPage() {
  const p = payments.find((x) => x.id === lastPaymentId);
  if (!p) {
    return `<div class="empty-state"><div class="ic">🧾</div>কোনো রশিদ পাওয়া যায়নি</div>
 <div style="text-align:center;margin-top:14px;"><button class="btn btn-primary" onclick="switchView('ledger')">← বাকির খাতায় ফিরে যান</button></div>`;
  }
  const html = buildPaymentReceiptHtml(p);
  setTimeout(() => {
    const pa = document.getElementById("printArea");
    if (pa) pa.innerHTML = html;
  }, 0);
  return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="switchView('ledger')">← বাকির খাতায় ফিরে যান</button>
 <div class="cur-brand">রশিদ #${p.id}</div>
 </div>
 <div style="max-width:680px;margin:0 auto;">
 ${html}
 <div style="display:flex; gap:10px; justify-content:center; margin-top:20px; flex-wrap:wrap;">
 <button class="btn btn-outline" onclick="switchView('ledger')">📒 বাকির খাতা</button>
 <button class="btn btn-outline" onclick="downloadPrintArea('${jsq("রশিদ-" + p.id)}')">⬇ ডাউনলোড করুন</button>
  <button class="btn btn-primary" onclick="sharePaymentReceipt(${p.id})">📤 শেয়ার করুন</button>
 <button class="btn btn-primary" onclick="tryPrint()">🖨 প্রিন্ট করুন / কাস্টমারকে দিন</button>
 <button class="btn btn-outline" style="color:var(--red);border-color:var(--red);" onclick="deletePaymentPrompt(${p.id})">🗑️ রশিদ মুছুন</button>
 </div>
 </div>`;
}
function deletePaymentPrompt(id) {
  const p = payments.find((x) => x.id === id);
  if (!p) return;
  openModal(
    "পেমেন্ট রশিদ মুছবেন?",
    `
 <p style="font-size:13.5px;line-height:1.7;">রশিদ <b>#${p.id}</b> (${esc(p.custName)} · জমা ${fmt(p.amount)}) মুছে ফেলা হবে। এই পরিমাণ টাকা আবার গ্রাহকের বাকিতে যোগ হয়ে যাবে।</p>
 <p style="font-size:12px;color:var(--red);">এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('পেমেন্ট রশিদ মুছুন', () => deletePaymentConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deletePaymentConfirmed(id) {
  const p = payments.find((x) => x.id === id);
  if (!p) return;
  moveToTrash("payment", `${p.custName} · রশিদ #${p.id}`, fmt(p.amount), p);
  const cust = ledger.find((l) => l.id === p.custId);
  if (cust) {
    cust.due = (cust.due || 0) + p.amount + (p.discount || 0);
    cust.paidTotal = Math.max(0, (cust.paidTotal || 0) - p.amount);
    if (cust.discountTotal)
      cust.discountTotal = Math.max(0, cust.discountTotal - (p.discount || 0));
  }
  payments = payments.filter((x) => x.id !== id);
  logActivity(
    "পেমেন্ট রশিদ মুছে ফেলা হয়েছে",
    `#${p.id} · ${p.custName} · ${fmt(p.amount)} (বাকিতে ফিরিয়ে দেওয়া হয়েছে)`,
  );
  closeModal();
  showToast("রশিদ ট্র্যাশে সরানো হয়েছে, টাকা আবার বাকিতে যোগ হয়েছে");
  persistShopData();
  switchView("ledger");
}
function reduceCustomerInvoiceDues(custId, amountToClear) {
  let remaining = amountToClear;
  if (remaining <= 0) return;
  const custInvoices = invoices
    .filter((inv) => inv.custId === custId && inv.due > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const inv of custInvoices) {
    if (remaining <= 0) break;
    const reduce = Math.min(inv.due, remaining);
    inv.due -= reduce;
    remaining -= reduce;
  }
}
function buildPaymentReceiptHtml(p) {
  const shopMetaLines = [
    SHOP_PHONE ? `ফোন: ${esc(SHOP_PHONE)}` : "",
    SHOP_EMAIL ? `ইমেইল: ${esc(SHOP_EMAIL)}` : "",
  ]
    .filter(Boolean)
    .map((l) => `<div>${l}</div>`)
    .join("");
  return `
 <div class="si-box">
 <div class="si-top">
 <div class="si-top-left">
 <div class="si-logo">${SHOP_LOGO ? `<img src="${SHOP_LOGO}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">` : "🧾"}</div>
 <div>
 <div class="si-shop-name">${esc(SHOP_NAME)}</div>
 <div class="si-shop-meta">${shopMetaLines}</div>
 </div>
 </div>
 <div class="si-top-right">
 <div class="si-title" style="font-size:22px;">প্রাপ্তি রশিদ</div>
 <div class="si-date">তারিখ: ${new Date(p.date).toLocaleDateString("bn-BD")}</div>
 ${SHOP_ADDRESS ? `<div class="si-date">ঠিকানা: ${esc(SHOP_ADDRESS)}</div>` : ""}
 </div>
 </div>
 <div class="si-bar">
 <div>রশিদ নম্বর: #${p.id}</div>
 <div>পেমেন্ট তারিখ: ${new Date(p.date).toLocaleDateString("bn-BD")}</div>
 </div>
 <div class="si-cust">
 <div class="si-cust-row"><span class="si-lbl">প্রদানকারী:</span><span>${esc(p.custName)}</span></div>
 ${p.custPhone ? `<div class="si-cust-row"><span class="si-lbl">ফোন:</span><span>${telHtml(p.custPhone)}</span></div>` : ""}
 ${p.custAddress ? `<div class="si-cust-row"><span class="si-lbl">ঠিকানা:</span><span>${esc(p.custAddress)}</span></div>` : ""}
  <div class="si-cust-row"><span class="si-lbl">মাধ্যম:</span><span>${esc(p.method || "ক্যাশ")}</span></div>
 ${p.note ? `<div class="si-cust-row"><span class="si-lbl">বিবরণ:</span><span>${esc(p.note)}</span></div>` : ""}
 </div>
 <div class="si-summary-wrap">
 <div class="si-summary">
 <div class="si-srow"><span>পূর্বের পাওনা:</span><span class="mono">${fmt(p.dueBefore)}</span></div>
 <div class="si-srow"><span>নগদ জমা:</span><span class="mono">${fmt(p.amount)}</span></div>
 <div class="si-srow"><span>ছাড়:</span><span class="mono">${fmt(p.discount || 0)}</span></div>
 <div class="si-srow hl"><span>অবশিষ্ট পাওনা:</span><span class="mono">${fmt(p.dueAfter)}</span></div>
 </div>
 </div>
 <div class="si-sign" style="justify-content:flex-end;">
 <div>গ্রহণকারীর স্বাক্ষর</div>
 </div>
 </div>`;
}

/* ============================================================
 বাকি আদায়ের রিমাইন্ডার (WhatsApp / কল)
 ============================================================ */
function telHtml(phone) {
  if (!phone) return "";
  const clean = String(phone).replace(/[^0-9+]/g, "");
  if (!clean) return "";
  return `<a href="tel:${clean}" style="color:inherit;text-decoration:none;border-bottom:1px dotted currentColor;">${esc(phone)}</a>`;
}
function cleanPhoneForWa(phone) {
  if (!phone) return "";
  let p = String(phone).replace(/[^0-9]/g, "");
  if (p.startsWith("880")) return p;
  if (p.startsWith("0")) return "88" + p;
  if (p.startsWith("1") && p.length === 10) return "880" + p;
  return p;
}
function sendDueReminder(custId) {
  const cust = ledger.find((l) => l.id === custId);
  if (!cust) return;
  if (!cust.phone) {
    showToast("এই গ্রাহকের ফোন নাম্বার সংরক্ষিত নেই");
    return;
  }
  const waPhone = cleanPhoneForWa(cust.phone);
  const msg = encodeURIComponent(
    `প্রিয় ${cust.name}, আসসালামু আলাইকুম। ${SHOP_NAME} থেকে জানানো হচ্ছে, আপনার কাছে বর্তমানে ${fmt(cust.due)} টাকা বাকি আছে। সুবিধামতো সময়ে পরিশোধ করার জন্য অনুরোধ করা হলো। ধন্যবাদ।`,
  );
  window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
  logActivity(
    "বাকি রিমাইন্ডার পাঠানো হয়েছে (WhatsApp)",
    `${cust.name} · ${fmt(cust.due)} টাকা`,
  );
}
function callCustomer(custId) {
  const cust = ledger.find((l) => l.id === custId);
  if (!cust) return;
  if (!cust.phone) {
    showToast("এই গ্রাহকের ফোন নাম্বার সংরক্ষিত নেই");
    return;
  }
  window.location.href = `tel:${String(cust.phone).replace(/[^0-9+]/g, "")}`;
  logActivity(
    "গ্রাহককে কল করা হয়েছে",
    `${cust.name} · বাকি ${fmt(cust.due)} টাকা`,
  );
}

/* ============================================================
 নগদ ক্রেতা
 ============================================================ */
function renderCashCustomers() {
  const q = cashSearch.trim().toLowerCase();
  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="cashSearchInput" value="${cashSearch}" placeholder="নাম বা মোবাইল নাম্বার দিয়ে সার্চ করুন..."
 oninput="cashSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="cashSearchInputFn('')">✕</span>
 </div>`;

  if (cashCustomers.length === 0)
    return `${searchBar}<div class="empty-state"><div class="ic">💵</div>এখনো কোনো নগদ ক্রেতা নেই<br><span style="font-size:12px;">বিক্রয় সম্পূর্ণ পরিশোধ হলে ক্রেতা এখানে স্বয়ংক্রিয়ভাবে যুক্ত হবে</span></div>`;

  const filtered = cashCustomers.filter(
    (c) =>
      q === "" || (c.name + " " + (c.phone || "")).toLowerCase().includes(q),
  );
  if (filtered.length === 0)
    return (
      searchBar +
      `<div class="no-match">🔍 "${cashSearch}" এর সাথে মিলে এমন কোনো নগদ ক্রেতা পাওয়া যায়নি</div>`
    );

  return (
    searchBar +
    `<div class="ledger-list">
 ${filtered
   .map(
     (c, idx) => `
 <div class="ledger-row">
 <div class="ledger-serial">${idx + 1}</div>
 <div class="ledger-info">
 <div class="lname">${esc(c.name)}</div>
 <div class="lmeta">${[esc(c.address), telHtml(c.phone)].filter(Boolean).join(" · ") || "কোনো তথ্য নেই"} · সর্বমোট ক্রয় ${fmt(c.totalSpent)} · সর্বশেষ ${c.lastDate ? new Date(c.lastDate).toLocaleDateString("bn-BD") : "—"}</div>
 </div>
 <div class="ledger-due"><div class="amt clear">নগদ</div><div class="lbl">সম্পূর্ণ পরিশোধিত</div></div>
 <button class="btn btn-outline" onclick="viewCashInvoices(${c.id})">ক্যাশ মেমো</button>
 </div>`,
   )
   .join("")}
 </div>`
  );
}
function cashSearchInputFn(val) {
  cashSearch = val;
  render();
  const el = document.getElementById("cashSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function viewCashInvoices(ccId) {
  const cc = cashCustomers.find((c) => c.id === ccId);
  const rows =
    cc.invoiceIds.length === 0
      ? `<div class="no-match">এখনো কোনো ক্যাশ মেমো নেই</div>`
      : cc.invoiceIds
          .slice()
          .reverse()
          .map((iid) => {
            const inv = invoices.find((x) => x.id === iid);
            if (!inv) return "";
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--steel-100);font-size:13px;">
 <div>
 <div style="font-weight:600;">ক্যাশ মেমো #${inv.id} · ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 <div style="color:var(--steel-500);font-size:12px;">সর্বমোট ${fmt(inv.total)}</div>
 </div>
 <button class="btn btn-outline" onclick="printInvoice(invoices.find(x=>x.id===${inv.id}))">প্রিন্ট/ডাউনলোড</button>
 </div>`;
          })
          .join("");
  openModal(
    `ক্যাশ মেমো — ${esc(cc.name)}`,
    rows,
    `<button class="btn btn-outline" onclick="closeModal()">বন্ধ করুন</button>`,
  );
}
/* ============================================================
 আয়ের হিসাব (INCOME)
 ============================================================ */
function incomeCategoryIcon(catId) {
  const c = incomeCategories.find((x) => x.id === catId);
  return c ? c.icon : "💰";
}
function incomeSearchInputFn(val) {
  incomeSearch = val;
  render();
  const el = document.getElementById("incomeSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function addIncomeCategoryPrompt() {
  openModal(
    "নতুন আয়ের খাত যোগ করুন",
    `
 <div class="field"><label>খাতের নাম</label><input type="text" id="newIncCatName" placeholder="যেমনঃ ভাড়া আয়, কমিশন"></div>
 <div class="field"><label>আইকন (ইমোজি, ঐচ্ছিক)</label><input type="text" id="newIncCatIcon" placeholder="💰" value="💰"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewIncomeCategory()">যোগ করুন</button>
 `,
  );
}
function saveNewIncomeCategory() {
  const name = document.getElementById("newIncCatName").value.trim();
  if (!name) {
    showToast("খাতের নাম আবশ্যক");
    return;
  }
  if (incomeCategories.some((c) => c.name === name)) {
    showToast("এই খাত আগে থেকেই আছে");
    return;
  }
  const icon = document.getElementById("newIncCatIcon").value.trim() || "💰";
  incomeCategories.push({ id: incomeCatNextId++, name, icon });
  closeModal();
  render();
  showToast("নতুন আয়ের খাত যুক্ত হয়েছে");
  persistShopData();
}
function openAddIncomeModal(categoryId) {
  const catOptions = incomeCategories
    .map(
      (c) =>
        `<option value="${c.id}" ${categoryId === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)}</option>`,
    )
    .join("");
  const personOptions = incomePeople
    .map(
      (p) =>
        `<option value="${p.id}">${esc(p.name)}${p.phone ? " · " + esc(p.phone) : ""}</option>`,
    )
    .join("");
  openModal(
    "নতুন আয় যোগ করুন",
    `
 <div class="field"><label>খাত</label><select id="incCategory">${catOptions}</select></div>
 <div class="field">
 <label>কার কাছ থেকে পাওয়া হলো</label>
 <select id="incPersonSelect" onchange="incomePersonSelectChange(this.value)">
 <option value="">— নতুন নাম লিখুন —</option>
 ${personOptions}
 </select>
 </div>
 <div id="incNewPersonWrap">
 <div class="field"><label>নাম</label><input type="text" id="incPersonName" placeholder="যেমনঃ মোঃ করিম"></div>
 <div class="field"><label>ঠিকানা (ঐচ্ছিক)</label><input type="text" id="incPersonAddress" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>মোবাইল নাম্বার (ঐচ্ছিক)</label><input type="text" id="incPersonPhone" placeholder="01xxx-xxxxxx"></div>
 </div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="incAmount" min="0" value="0"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="incDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>বিবরণ/নোট (ঐচ্ছিক)</label><input type="text" id="incNote" placeholder="যেমনঃ জুলাই মাসের ভাড়া"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewIncome()">আয় যোগ করুন</button>
 `,
  );
}
function incomePersonSelectChange(val) {
  const wrap = document.getElementById("incNewPersonWrap");
  if (!wrap) return;
  wrap.style.display = val ? "none" : "";
}
function saveNewIncome() {
  const catId = parseInt(document.getElementById("incCategory").value);
  const personSelectVal = document.getElementById("incPersonSelect").value;
  const amount = Math.max(
    0,
    parseInt(document.getElementById("incAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const incDate = dateFromInput(document.getElementById("incDate").value);
  const note = document.getElementById("incNote").value.trim();

  let personId, personName, personAddress, personPhone;
  if (personSelectVal) {
    const p = incomePeople.find((x) => x.id == personSelectVal);
    personId = p.id;
    personName = p.name;
    personAddress = p.address;
    personPhone = p.phone;
  } else {
    const typedName = document.getElementById("incPersonName").value.trim();
    if (!typedName) {
      showToast("কার কাছ থেকে পাওয়া হলো তা লিখুন বা বাছাই করুন");
      return;
    }
    const typedAddress = document
      .getElementById("incPersonAddress")
      .value.trim();
    const typedPhone = document.getElementById("incPersonPhone").value.trim();
    let existing = incomePeople.find((p) => p.name === typedName);
    if (!existing) {
      existing = {
        id: incomePersonNextId++,
        name: typedName,
        address: typedAddress,
        phone: typedPhone,
      };
      incomePeople.push(existing);
    } else {
      if (typedAddress) existing.address = typedAddress;
      if (typedPhone) existing.phone = typedPhone;
    }
    personId = existing.id;
    personName = existing.name;
    personAddress = existing.address;
    personPhone = existing.phone;
  }

  const cat = incomeCategories.find((c) => c.id === catId);
  const income = {
    id: incomeNextId++,
    date: incDate,
    categoryId: catId,
    categoryName: cat ? cat.name : "অন্যান্য আয়",
    personId,
    personName,
    personAddress,
    personPhone,
    amount,
    note,
  };
  incomes.push(income);
  logActivity(
    "নতুন আয় যোগ",
    `${personName} থেকে ${fmt(amount)} (${income.categoryName})${note ? " · " + note : ""}`,
  );
  closeModal();
  showToast("আয় যোগ হয়েছে");
  render();
  persistShopData();
}
function editIncomePrompt(id) {
  const inc = incomes.find((x) => x.id === id);
  if (!inc) return;
  const catOptions = incomeCategories
    .map(
      (c) =>
        `<option value="${c.id}" ${inc.categoryId === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)}</option>`,
    )
    .join("");
  openModal(
    "আয় এডিট করুন",
    `
 <div class="field"><label>খাত</label><select id="editIncCategory">${catOptions}</select></div>
 <div class="field"><label>কার কাছ থেকে পাওয়া হলো (নাম)</label><input type="text" id="editIncPersonName" value="${esc(inc.personName)}"></div>
 <div class="field"><label>ঠিকানা</label><input type="text" id="editIncPersonAddress" value="${esc(inc.personAddress || "")}"></div>
 <div class="field"><label>মোবাইল নাম্বার</label><input type="text" id="editIncPersonPhone" value="${esc(inc.personPhone || "")}"></div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="editIncAmount" min="0" value="${inc.amount}"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="editIncDate" value="${toDateInputValue(inc.date)}"></div>
 <div class="field"><label>বিবরণ/নোট</label><input type="text" id="editIncNote" value="${esc(inc.note || "")}"></div>
 `,
    `
 <button class="btn btn-outline" style="color:var(--red);" onclick="deleteIncomePrompt(${id})">মুছুন</button>
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveIncomeEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveIncomeEdit(id) {
  const inc = incomes.find((x) => x.id === id);
  if (!inc) return;
  const catId = parseInt(document.getElementById("editIncCategory").value);
  const amount = Math.max(
    0,
    parseInt(document.getElementById("editIncAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const cat = incomeCategories.find((c) => c.id === catId);
  inc.categoryId = catId;
  inc.categoryName = cat ? cat.name : inc.categoryName;
  inc.personName = document.getElementById("editIncPersonName").value.trim();
  inc.personAddress = document
    .getElementById("editIncPersonAddress")
    .value.trim();
  inc.personPhone = document.getElementById("editIncPersonPhone").value.trim();
  inc.amount = amount;
  inc.date = dateFromInput(document.getElementById("editIncDate").value);
  inc.note = document.getElementById("editIncNote").value.trim();
  closeModal();
  render();
  showToast("আয় আপডেট হয়েছে");
  persistShopData();
}
function deleteIncomePrompt(id) {
  const inc = incomes.find((x) => x.id === id);
  if (!inc) return;
  openModal(
    "আয় মুছবেন?",
    `
 <p style="font-size:13.5px;">${esc(inc.personName)} থেকে পাওয়া <b class="mono">${fmt(inc.amount)}</b> টাকার (${esc(inc.categoryName)}) এই এন্ট্রিটি মুছে ফেলা হবে। এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('আয়ের এন্ট্রি মুছুন', () => deleteIncomeConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteIncomeConfirmed(id) {
  const inc = incomes.find((x) => x.id === id);
  if (inc) {
    moveToTrash(
      "income",
      `${inc.personName} · ${inc.categoryName}`,
      fmt(inc.amount),
      inc,
    );
  }
  incomes = incomes.filter((x) => x.id !== id);
  closeModal();
  render();
  showToast("আয় ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
}
function buildIncomeReceiptHtml(inc) {
  const shopContactLine = [
    esc(SHOP_ADDRESS),
    SHOP_PHONE ? "ফোনঃ " + esc(SHOP_PHONE) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `
 <div class="invoice-box">
 <div class="ihead">
 <h2>${esc(SHOP_NAME)}</h2>
 ${shopContactLine ? `<p>${shopContactLine}</p>` : ""}
 <p>আয়ের রশিদ #${inc.id} · ${new Date(inc.date).toLocaleDateString("bn-BD")}</p>
 </div>
 <table class="itbl">
 <thead><tr><th>বিবরণ</th><th class="r">পরিমাণ</th></tr></thead>
 <tbody>
 <tr><td>খাত</td><td class="r">${incomeCategoryIcon(inc.categoryId)} ${esc(inc.categoryName)}</td></tr>
 <tr><td>যার কাছ থেকে পাওয়া হয়েছে</td><td class="r">${esc(inc.personName)}</td></tr>
 ${inc.personPhone ? `<tr><td>মোবাইল নাম্বার</td><td class="r">${esc(inc.personPhone)}</td></tr>` : ""}
 ${inc.personAddress ? `<tr><td>ঠিকানা</td><td class="r">${esc(inc.personAddress)}</td></tr>` : ""}
 ${inc.note ? `<tr><td>নোট</td><td class="r">${esc(inc.note)}</td></tr>` : ""}
 </tbody>
 </table>
 <div class="itotal"><span>প্রাপ্ত পরিমাণ</span><span>${fmt(inc.amount)}</span></div>
 </div>`;
}
function renderIncome() {
  const totalAll = incomes.reduce((s, i) => s + i.amount, 0);
  const thisMonthKey = monthKeyOf(new Date());
  const totalThisMonth = incomes
    .filter((i) => monthKeyOf(i.date) === thisMonthKey)
    .reduce((s, i) => s + i.amount, 0);

  const statCards = `
 <div class="stat-grid">
 <div class="stat-card" style="--accent:var(--green)">
 <div class="lbl">এই মাসের মোট আয় (${monthLabelOf(thisMonthKey)})</div><div class="val">${fmt(totalThisMonth)}</div>
 </div>
 <div class="stat-card" style="--accent:var(--steel-700)">
 <div class="lbl">সর্বমোট আয় (সব সময়)</div><div class="val">${fmt(totalAll)}</div>
 </div>
 </div>`;

  const catGrid = `
 <div class="mgmt-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">একটি খাতে ক্লিক করে দ্রুত নতুন আয় যোগ করুন</div>
 </div>
 <div class="brand-grid" style="margin-bottom:22px;">
 ${incomeCategories
   .map(
     (c) => `
 <button class="cat-tile" onclick="openAddIncomeModal(${c.id})">
 <div class="cic">${c.icon}</div><div class="cname">${esc(c.name)}</div>
 </button>`,
   )
   .join("")}
 <button class="cat-tile add-cat" onclick="addIncomeCategoryPrompt()">
 <div class="cic">➕</div><div class="cname">নতুন খাত</div>
 </button>
 </div>`;

  const q = incomeSearch.trim().toLowerCase();
  let list = incomes.slice();
  if (q !== "") {
    list = list.filter((i) => {
      const dateStr = new Date(i.date).toLocaleDateString("bn-BD", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const hay = (
        i.categoryName +
        " " +
        i.personName +
        " " +
        (i.note || "") +
        " " +
        dateStr
      ).toLowerCase();
      return hay.includes(q);
    });
  }

  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="incomeSearchInput" value="${esc(incomeSearch)}" placeholder="খাত, নাম বা তারিখ দিয়ে সার্চ করুন..."
 oninput="incomeSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="incomeSearchInputFn('')">✕</span>
 </div>`;

  let body;
  if (incomes.length === 0) {
    body = `<div class="empty-state"><div class="ic">💰</div>এখনো কোনো আয় যোগ করা হয়নি<br><span style="font-size:12px;">উপরের একটি খাতে ক্লিক করে প্রথম আয় যোগ করুন</span></div>`;
  } else if (list.length === 0) {
    body = `<div class="no-match">🔍 এই সার্চে কোনো আয় পাওয়া যায়নি</div>`;
  } else {
    body = `<table class="tbl">
 <thead><tr><th>তারিখ</th><th>খাত</th><th>কার কাছ থেকে</th><th>মোবাইল</th><th>বিবরণ</th><th class="r">পরিমাণ</th><th></th></tr></thead>
 <tbody>${list
   .slice()
   .sort((a, b) => new Date(b.date) - new Date(a.date))
   .map(
     (i) => `
 <tr>
 <td>${new Date(i.date).toLocaleDateString("bn-BD")}</td>
 <td>${incomeCategoryIcon(i.categoryId)} ${esc(i.categoryName)}</td>
 <td>${esc(i.personName)}</td>
 <td>${telHtml(i.personPhone) || "—"}</td>
 <td>${esc(i.note) || "—"}</td>
 <td class="num r mono" style="color:var(--green);">${fmt(i.amount)}</td>
 <td class="tbl-actions">
 <button onclick="openReceiptModal('income', ${i.id})">রশিদ</button>
 <button onclick="editIncomePrompt(${i.id})">এডিট</button>
 <button style="color:var(--red);" onclick="deleteIncomePrompt(${i.id})">মুছুন</button>
 </td>
 </tr>`,
   )
   .join("")}
 </tbody></table>`;
  }

  return statCards + catGrid + searchBar + body;
}
/* ============================================================
 খরচের হিসাব (EXPENSES)
 ============================================================ */
function expenseSwitchTab(tab) {
  expenseTab = tab;
  expenseSearch = "";
  expensePersonFilter = null;
  render();
}
function expenseSearchInputFn(val) {
  expenseSearch = val;
  render();
  const el = document.getElementById("expenseSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}
function expensePersonTotal(personId) {
  return expenses
    .filter((e) => e.personId === personId)
    .reduce((s, e) => s + e.amount, 0);
}
function expenseCategoryIcon(catId) {
  const c = expenseCategories.find((x) => x.id === catId);
  return c ? c.icon : "💸";
}
function expenseCategoryName(catId) {
  const c = expenseCategories.find((x) => x.id === catId);
  return c ? c.name : "অন্যান্য";
}

function renderExpenses() {
  const now = new Date();
  const thisMonthKey = monthKeyOf(now);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const totalThisMonth = expenses
    .filter((e) => monthKeyOf(e.date) === thisMonthKey)
    .reduce((s, e) => s + e.amount, 0);

  const statCards = `
 <div class="stat-grid">
 <div class="stat-card" style="--accent:var(--rust)">
 <div class="lbl">এই মাসের মোট খরচ (${monthLabelOf(thisMonthKey)})</div><div class="val">${fmt(totalThisMonth)}</div>
 </div>
 <div class="stat-card" style="--accent:var(--steel-700)">
 <div class="lbl">সর্বমোট খরচ (সব সময়)</div><div class="val">${fmt(totalAll)}</div>
 </div>
 <div class="stat-card" style="--accent:var(--amber)">
 <div class="lbl">মোট এন্ট্রি</div><div class="val">${expenses.length}</div>
 </div>
 <div class="stat-card" style="--accent:var(--green)">
 <div class="lbl">মোট মানুষ</div><div class="val">${expensePeople.length}</div>
 </div>
 </div>`;

  const tabs = `
 <div class="tab-row">
 <button class="btn ${expenseTab === "entries" ? "btn-primary" : "btn-outline"}" onclick="expenseSwitchTab('entries')">🧾 খরচের তালিকা</button>
 <button class="btn ${expenseTab === "people" ? "btn-primary" : "btn-outline"}" onclick="expenseSwitchTab('people')">🧑‍🤝‍🧑 কে কত পেয়েছে</button>
 </div>`;

  if (expenseTab === "people") {
    return statCards + tabs + renderExpensePeopleTab();
  }
  return statCards + tabs + renderExpenseEntriesTab();
}

function renderExpenseEntriesTab() {
  const catGrid = `
 <div class="mgmt-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">একটি খাতে ক্লিক করে দ্রুত নতুন খরচ যোগ করুন</div>
 </div>
 <div class="brand-grid" style="margin-bottom:22px;">
 ${expenseCategories
   .map(
     (c) => `
 <button class="cat-tile" onclick="openAddExpenseModal(${c.id})">
 <div class="cic">${c.icon}</div><div class="cname">${esc(c.name)}</div>
 </button>`,
   )
   .join("")}
 <button class="cat-tile add-cat" onclick="addExpenseCategoryPrompt()">
 <div class="cic">➕</div><div class="cname">নতুন খাত</div>
 </button>
 </div>`;

  const q = expenseSearch.trim().toLowerCase();
  const period = listPeriod.expenses || "all";
  let list = expenses.filter((e) =>
    inSelectedPeriodAnchored(e.date, period, getPeriodAnchor("expenses")),
  );
  if (expensePersonFilter !== null)
    list = list.filter((e) => e.personId === expensePersonFilter);
  if (q !== "") {
    list = list.filter((e) => {
      const dateStr = new Date(e.date).toLocaleDateString("bn-BD", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const hay = (
        e.categoryName +
        " " +
        e.personName +
        " " +
        (e.note || "") +
        " " +
        dateStr
      ).toLowerCase();
      return hay.includes(q);
    });
  }

  const periodBar = periodTabsHtml("expenses");
  const filterBanner =
    expensePersonFilter !== null
      ? (() => {
          const p = expensePeople.find((x) => x.id === expensePersonFilter);
          return `<div class="back-row">
 <button class="btn btn-outline" onclick="expensePersonFilter=null; render();">← সব খরচ দেখুন</button>
 <div class="cur-brand">${p ? esc(p.name) : ""} — এর খরচ</div>
 </div>`;
        })()
      : "";

  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="expenseSearchInput" value="${esc(expenseSearch)}" placeholder="খাত, মানুষের নাম বা তারিখ দিয়ে সার্চ করুন..."
 oninput="expenseSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="expenseSearchInputFn('')">✕</span>
 </div>`;

  let body;
  if (expenses.length === 0) {
    body = `<div class="empty-state"><div class="ic">💸</div>এখনো কোনো খরচ যোগ করা হয়নি<br><span style="font-size:12px;">উপরের একটি খাতে ক্লিক করে প্রথম খরচ যোগ করুন</span></div>`;
  } else if (list.length === 0) {
    body = `<div class="no-match">🔍 এই সময়ে/সার্চে কোনো খরচ পাওয়া যায়নি</div>`;
  } else {
    body = `<table class="tbl">
 <thead><tr><th>তারিখ</th><th>খাত</th><th>কাকে</th><th>বিবরণ</th><th class="r">পরিমাণ</th><th></th></tr></thead>
 <tbody>${list
   .slice()
   .sort((a, b) => new Date(b.date) - new Date(a.date))
   .map(
     (e) => `
 <tr>
 <td>${new Date(e.date).toLocaleDateString("bn-BD")}</td>
 <td>${expenseCategoryIcon(e.categoryId)} ${esc(e.categoryName)}</td>
 <td>${esc(e.personName) || "—"}</td>
 <td>${esc(e.note) || "—"}</td>
 <td class="num r mono">${fmt(e.amount)}</td>
 <td class="tbl-actions">
 <button onclick="openReceiptModal('expense', ${e.id})">রশিদ</button>
 <button onclick="editExpensePrompt(${e.id})">এডিট</button>
 <button style="color:var(--red);" onclick="deleteExpensePrompt(${e.id})">মুছুন</button>
 </td>
 </tr>`,
   )
   .join("")}
 </tbody></table>`;
  }

  return catGrid + periodBar + filterBanner + searchBar + body;
}

function renderExpensePeopleTab() {
  const toolbar = `
 <div class="ledger-toolbar">
 <div style="font-size:13px;color:var(--steel-500);">প্রতিটি মানুষের নামে এ পর্যন্ত মোট কত টাকা খরচ হয়েছে তার সারাংশ</div>
 <button class="btn btn-primary" onclick="addPersonPrompt()">+ নতুন মানুষ যুক্ত করুন</button>
 </div>`;

  if (expensePeople.length === 0) {
    return (
      toolbar +
      `<div class="empty-state"><div class="ic">🧑‍🤝‍🧑</div>এখনো কোনো মানুষ যুক্ত করা হয়নি<br><span style="font-size:12px;">"+ নতুন মানুষ যুক্ত করুন" চেপে শুরু করুন, অথবা খরচ যোগ করার সময় নতুন নাম লিখলে এখানে স্বয়ংক্রিয়ভাবে যুক্ত হয়ে যাবে</span></div>`
    );
  }

  const rows = expensePeople
    .map((p, idx) => {
      const total = expensePersonTotal(p.id);
      const cnt = expenses.filter((e) => e.personId === p.id).length;
      return `<div class="person-row">
 <div class="ledger-serial">${idx + 1}</div>
 <div class="ledger-info">
 <div class="lname">${esc(p.name)}</div>
   <div class="lmeta">${[esc(p.address), telHtml(p.phone), esc(p.note)].filter(Boolean).join(" · ") || "কোনো তথ্য নেই"} · ${cnt} টি খরচ এন্ট্রি</div>
 </div>
 <div class="ledger-due">
 <div class="amt" style="color:var(--steel-900);">${fmt(total)}</div>
 <div class="lbl">সর্বমোট পেয়েছে</div>
 </div>
 <button class="btn btn-outline" onclick="viewPersonExpenses(${p.id})">বিস্তারিত</button>
 <button class="btn btn-primary" onclick="openAddExpenseModal(null, ${p.id})">+ নতুন খরচ</button>
 </div>`;
    })
    .join("");

  return toolbar + `<div class="ledger-list">${rows}</div>`;
}

function addExpenseCategoryPrompt() {
  openModal(
    "নতুন খাত যোগ করুন",
    `
 <div class="field"><label>খাতের নাম</label><input type="text" id="newCatName" placeholder="যেমনঃ চাঁদা, মেরামত"></div>
 <div class="field"><label>আইকন (ইমোজি, ঐচ্ছিক)</label><input type="text" id="newCatIcon" placeholder="💸" value="💸"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewExpenseCategory()">যোগ করুন</button>
 `,
  );
}
function saveNewExpenseCategory() {
  const name = document.getElementById("newCatName").value.trim();
  if (!name) {
    showToast("খাতের নাম আবশ্যক");
    return;
  }
  if (expenseCategories.some((c) => c.name === name)) {
    showToast("এই খাত আগে থেকেই আছে");
    return;
  }
  const icon = document.getElementById("newCatIcon").value.trim() || "💸";
  expenseCategories.push({ id: expenseCatNextId++, name, icon });
  closeModal();
  render();
  showToast("নতুন খাত যুক্ত হয়েছে");
  persistShopData();
}

function addPersonPrompt() {
  openModal(
    "নতুন মানুষ যুক্ত করুন",
    `
  <div class="field"><label>নাম</label><input type="text" id="newPersonName" placeholder="যেমনঃ মোঃ রহিম"></div>
 <div class="field"><label>ঠিকানা (ঐচ্ছিক)</label><input type="text" id="newPersonAddress" placeholder="যেমনঃ বাজার রোড, সাভার"></div>
 <div class="field"><label>মোবাইল নাম্বার (ঐচ্ছিক)</label><input type="text" id="newPersonPhone" placeholder="01xxx-xxxxxx"></div>
 <div class="field"><label>পরিচয়/নোট (ঐচ্ছিক)</label><input type="text" id="newPersonNote" placeholder="যেমনঃ কর্মচারী, সাপ্লায়ার, দোকান মালিক"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewPerson()">যুক্ত করুন</button>
 `,
  );
}
function saveNewPerson() {
  const name = document.getElementById("newPersonName").value.trim();
  if (!name) {
    showToast("নাম আবশ্যক");
    return;
  }
  expensePeople.push({
    id: expensePersonNextId++,
    name,
    address: document.getElementById("newPersonAddress").value.trim(),
    phone: document.getElementById("newPersonPhone").value.trim(),
    note: document.getElementById("newPersonNote").value.trim(),
  });
  closeModal();
  render();
  showToast("নতুন মানুষ যুক্ত হয়েছে");
  persistShopData();
}

function openAddExpenseModal(categoryId, presetPersonId) {
  const catOptions = expenseCategories
    .map(
      (c) =>
        `<option value="${c.id}" ${categoryId === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)}</option>`,
    )
    .join("");
  const personOptions = expensePeople
    .map(
      (p) =>
        `<option value="${p.id}" ${presetPersonId === p.id ? "selected" : ""}>${esc(p.name)}${p.phone ? " · " + esc(p.phone) : ""}</option>`,
    )
    .join("");
  openModal(
    "নতুন খরচ যোগ করুন",
    `
 <div class="field"><label>খাত</label><select id="expCategory">${catOptions}</select></div>
 <div class="field">
 <label>কাকে দেওয়া হলো</label>
 <select id="expPersonSelect" onchange="expensePersonSelectChange(this.value)">
 <option value="">— নতুন নাম লিখুন —</option>
 ${personOptions}
 </select>
 </div>
 <div id="expNewPersonWrap" style="${presetPersonId ? "display:none;" : ""}">
 <div class="field"><label>নাম</label><input type="text" id="expPersonName" placeholder="যেমনঃ মোঃ করিম"></div>
 </div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="expAmount" min="0" value="0"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="expDate" value="${toDateInputValue(new Date())}"></div>
 <div class="field"><label>বিবরণ/নোট (ঐচ্ছিক)</label><input type="text" id="expNote" placeholder="যেমনঃ জুলাই মাসের বেতন"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveNewExpense()">খরচ যোগ করুন</button>
 `,
  );
  if (presetPersonId) {
    expensePersonSelectChange(String(presetPersonId));
  }
}
function expensePersonSelectChange(val) {
  const wrap = document.getElementById("expNewPersonWrap");
  if (!wrap) return;
  wrap.style.display = val ? "none" : "";
}
function saveNewExpense() {
  const catId = parseInt(document.getElementById("expCategory").value);
  const personSelectVal = document.getElementById("expPersonSelect").value;
  const amount = Math.max(
    0,
    parseInt(document.getElementById("expAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const expDate = dateFromInput(document.getElementById("expDate").value);
  const note = document.getElementById("expNote").value.trim();

  let personId, personName;
  if (personSelectVal) {
    const p = expensePeople.find((x) => x.id == personSelectVal);
    personId = p.id;
    personName = p.name;
  } else {
    const typedName = document.getElementById("expPersonName").value.trim();
    if (!typedName) {
      showToast("কাকে দেওয়া হলো তা লিখুন বা বাছাই করুন");
      return;
    }
    let existing = expensePeople.find((p) => p.name === typedName);
    if (!existing) {
      existing = {
        id: expensePersonNextId++,
        name: typedName,
        phone: "",
        note: "",
      };
      expensePeople.push(existing);
    }
    personId = existing.id;
    personName = existing.name;
  }

  const cat = expenseCategories.find((c) => c.id === catId);
  const expense = {
    id: expenseNextId++,
    date: expDate,
    categoryId: catId,
    categoryName: cat ? cat.name : "অন্যান্য",
    personId,
    personName,
    amount,
    note,
  };
  expenses.push(expense);
  logActivity(
    "খরচ যোগ",
    `${personName} কে ${fmt(amount)} (${expense.categoryName})${note ? " · " + note : ""}`,
  );
  closeModal();
  showToast("খরচ যোগ হয়েছে");
  render();
  persistShopData();
}

function editExpensePrompt(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  const catOptions = expenseCategories
    .map(
      (c) =>
        `<option value="${c.id}" ${e.categoryId === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)}</option>`,
    )
    .join("");
  const personOptions = expensePeople
    .map(
      (p) =>
        `<option value="${p.id}" ${e.personId === p.id ? "selected" : ""}>${esc(p.name)}${p.phone ? " · " + esc(p.phone) : ""}</option>`,
    )
    .join("");
  openModal(
    "খরচ এডিট করুন",
    `
 <div class="field"><label>খাত</label><select id="editExpCategory">${catOptions}</select></div>
 <div class="field"><label>কাকে দেওয়া হলো</label><select id="editExpPerson">${personOptions}</select></div>
 <div class="field"><label>পরিমাণ (৳)</label><input type="number" id="editExpAmount" min="0" value="${e.amount}"></div>
 <div class="field"><label>তারিখ</label><input type="date" id="editExpDate" value="${toDateInputValue(e.date)}"></div>
 <div class="field"><label>বিবরণ/নোট (ঐচ্ছিক)</label><input type="text" id="editExpNote" value="${esc(e.note || "")}"></div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="saveExpenseEdit(${id})">সংরক্ষণ করুন</button>
 `,
  );
}
function saveExpenseEdit(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  const catId = parseInt(document.getElementById("editExpCategory").value);
  const personId = parseInt(document.getElementById("editExpPerson").value);
  const amount = Math.max(
    0,
    parseInt(document.getElementById("editExpAmount").value) || 0,
  );
  if (amount <= 0) {
    showToast("সঠিক পরিমাণ লিখুন");
    return;
  }
  const cat = expenseCategories.find((c) => c.id === catId);
  const person = expensePeople.find((p) => p.id === personId);
  e.categoryId = catId;
  e.categoryName = cat ? cat.name : e.categoryName;
  e.personId = personId;
  e.personName = person ? person.name : e.personName;
  e.amount = amount;
  e.date = dateFromInput(document.getElementById("editExpDate").value);
  e.note = document.getElementById("editExpNote").value.trim();
  closeModal();
  render();
  showToast("খরচ আপডেট হয়েছে");
  persistShopData();
}
function deleteExpensePrompt(id) {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  openModal(
    "খরচ মুছবেন?",
    `
 <p style="font-size:13.5px;">${esc(e.personName)}-কে দেওয়া <b class="mono">${fmt(e.amount)}</b> টাকার (${esc(e.categoryName)}) এই এন্ট্রিটি মুছে ফেলা হবে। এই কাজ ফিরিয়ে নেওয়া যাবে না।</p>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" onclick="requestPasswordConfirm('খরচের এন্ট্রি মুছুন', () => deleteExpenseConfirmed(${id}))">হ্যাঁ, মুছুন</button>
 `,
  );
}
function deleteExpenseConfirmed(id) {
  const e = expenses.find((x) => x.id === id);
  if (e) {
    moveToTrash(
      "expense",
      `${e.personName} · ${e.categoryName}`,
      fmt(e.amount),
      e,
    );
  }
  expenses = expenses.filter((x) => x.id !== id);
  closeModal();
  render();
  showToast("খরচ ট্র্যাশে সরানো হয়েছে — চাইলে ফিরিয়ে আনতে পারবেন");
  persistShopData();
}

let personExpensePeriod = "all";
function setPersonExpensePeriod(personId, period) {
  personExpensePeriod = period;
  viewPersonExpenses(personId);
}
function viewPersonExpenses(personId) {
  const p = expensePeople.find((x) => x.id === personId);
  if (!p) return;
  const period = personExpensePeriod;
  const list = expenses
    .filter((e) => e.personId === personId && inSelectedPeriod(e.date, period))
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = list.reduce((s, e) => s + e.amount, 0);
  const periodBar = `<div class="tab-row" style="margin-bottom:12px;">
 ${[
   ["day", "দিন"],
   ["month", "মাস"],
   ["year", "বছর"],
   ["all", "সব সময়"],
 ]
   .map(
     ([key, label]) =>
       `<button class="btn ${period === key ? "btn-primary" : "btn-outline"}" style="padding:7px 14px;font-size:12.5px;" onclick="setPersonExpensePeriod(${personId}, '${key}')">${label}</button>`,
   )
   .join("")}
 </div>`;
  const rows =
    list.length === 0
      ? `<div class="no-match">এই সময়ে কোনো খরচ নেই</div>`
      : list
          .map(
            (e) => `
 <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--steel-100);font-size:13px;">
 <div>
 <div style="font-weight:600;">${expenseCategoryIcon(e.categoryId)} ${esc(e.categoryName)} · ${new Date(e.date).toLocaleDateString("bn-BD")}</div>
 <div style="color:var(--steel-500);font-size:12px;">${esc(e.note) || "কোনো নোট নেই"}</div>
 </div>
 <div style="text-align:right;">
 <div class="mono" style="font-weight:700;">${fmt(e.amount)}</div>
 <button class="btn btn-outline" style="margin-top:4px;padding:4px 10px;font-size:11px;" onclick="openReceiptModal('expense', ${e.id})">রশিদ</button>
 </div>
 </div>`,
          )
          .join("");
  openModal(
    `খরচের বিস্তারিত — ${esc(p.name)}`,
    `
 ${periodBar}
 <div style="background:var(--steel-100);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13.5px;display:flex;justify-content:space-between;">
 <span>এই সময়ে সর্বমোট পেয়েছে</span><b class="mono">${fmt(total)}</b>
 </div>
 ${rows}
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বন্ধ করুন</button>
 <button class="btn btn-primary" onclick="closeModal(); openAddExpenseModal(null, ${personId});">+ নতুন খরচ (যেকোনো তারিখ দিয়ে)</button>
 `,
  );
}

function buildExpenseReceiptHtml(e) {
  const shopContactLine = [
    esc(SHOP_ADDRESS),
    SHOP_PHONE ? "ফোনঃ " + esc(SHOP_PHONE) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `
 <div class="invoice-box">
 <div class="ihead">
 <h2>${esc(SHOP_NAME)}</h2>
 ${shopContactLine ? `<p>${shopContactLine}</p>` : ""}
 <p>খরচের রশিদ #${e.id} · ${new Date(e.date).toLocaleDateString("bn-BD")}</p>
 </div>
 <table class="itbl">
 <thead><tr><th>বিবরণ</th><th class="r">পরিমাণ</th></tr></thead>
 <tbody>
 <tr><td>খাত</td><td class="r">${expenseCategoryIcon(e.categoryId)} ${esc(e.categoryName)}</td></tr>
 <tr><td>যাকে দেওয়া হয়েছে</td><td class="r">${esc(e.personName)}</td></tr>
 ${e.note ? `<tr><td>নোট</td><td class="r">${esc(e.note)}</td></tr>` : ""}
 </tbody>
 </table>
 <div class="itotal"><span>প্রদত্ত পরিমাণ</span><span>${fmt(e.amount)}</span></div>
 </div>`;
}

/* ============================================================
 ক্যাশ মেমো হিস্ট্রি
 ============================================================ */
function renderInvoices() {
  const q = invoiceSearch.trim().toLowerCase();
  const period = listPeriod.invoices || "all";
  const searchBar = `
 <div class="search-bar ${q ? "has-val" : ""}">
 <span class="sic">🔍</span>
 <input type="text" id="invoiceSearchInput" value="${invoiceSearch}" placeholder="নাম, মোবাইল নাম্বার বা তারিখ দিয়ে সার্চ করুন (যেমনঃ ২১ জুলাই)"
 oninput="invoiceSearchInputFn(this.value)" autocomplete="off">
 <span class="sclear" onclick="invoiceSearchInputFn('')">✕</span>
 </div>`;

  if (invoices.length === 0)
    return `<div class="empty-state"><div class="ic">🗂️</div>এখনো কোনো ক্যাশ মেমো তৈরি হয়নি<br><span style="font-size:12px;">"বিক্রয়" থেকে প্রথম ক্যাশ মেমো তৈরি করুন</span></div>`;

  const filtered = invoices.filter((inv) => {
    if (
      !inSelectedPeriodAnchored(inv.date, period, getPeriodAnchor("invoices"))
    )
      return false;
    if (q === "") return true;
    const dateStr = new Date(inv.date).toLocaleDateString("bn-BD", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const hay = (
      inv.customer +
      " " +
      (inv.customerPhone || "") +
      " " +
      dateStr +
      " " +
      inv.id
    ).toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0)
    return (
      periodTabsHtml("invoices") +
      searchBar +
      `<div class="no-match">🔍 এই সময়ে/সার্চে কোনো ক্যাশ মেমো পাওয়া যায়নি</div>`
    );

  return (
    periodTabsHtml("invoices") +
    searchBar +
    `<table class="tbl">
 <thead><tr><th>ক্যাশ মেমো</th><th>ক্রেতা</th><th>মোবাইল</th><th>তারিখ</th><th>আইটেম</th><th class="r">সর্বমোট</th><th class="r">বাকি</th><th></th></tr></thead>
 <tbody>${filtered
   .slice()
   .reverse()
   .map(
     (inv) => `
 <tr style="${inv.cancelled ? "opacity:0.55;" : ""}">
 <td class="num mono">#${inv.id}${inv.cancelled ? ' <span class="pill low">বাতিল</span>' : ""}</td><td>${esc(inv.customer)}</td><td class="num mono">${telHtml(inv.customerPhone) || "—"}</td>
 <td>${new Date(inv.date).toLocaleDateString("bn-BD")}</td>
 <td>${inv.items.length} টি</td>
 <td class="num mono">${fmt(inv.total)}</td>
 <td class="num mono" style="color:${inv.due > 0 ? "var(--red)" : "var(--green)"}">${fmt(inv.due)}</td>
  <td class="tbl-actions"><button onclick="printInvoice(invoices.find(x=>x.id===${inv.id}))">প্রিন্ট/ডাউনলোড</button>${!inv.cancelled ? `<button style="margin-left:10px;" onclick="editInvoicePrompt(${inv.id})">✏️ এডিট</button><button style="margin-left:10px;" onclick="returnPrompt(${inv.id})">↩️ রিটার্ন</button><button style="margin-left:10px;color:var(--red);" onclick="cancelInvoicePrompt(${inv.id})">❌ বাতিল</button>` : ""}</td>
 </tr>`,
   )
   .join("")}
 </tbody></table>`
  );
}
function invoiceSearchInputFn(val) {
  invoiceSearch = val;
  render();
  const el = document.getElementById("invoiceSearchInput");
  if (el) {
    el.focus();
    const p = el.value.length;
    el.setSelectionRange(p, p);
  }
}

/* ============================================================
 রিটার্ন / এক্সচেঞ্জ ব্যবস্থাপনা
 ============================================================ */
function returnPrompt(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  const itemsHtml = inv.items
    .map(
      (it, idx) => `
 <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--steel-100);font-size:13px;">
 <div style="flex:1;">
    <div style="font-weight:600;">${esc(it.brand)}${itemLabelText(it.brand, it.mm, it.size)}</div>
 <div style="color:var(--steel-500);font-size:11.5px;">বিক্রিত ${it.qty} পিস @ ${fmt(it.sellPrice)}</div>
 </div>
 <div style="display:flex; align-items:center; gap:6px;">
 <button type="button" onclick="returnQtyStep(${invId}, ${idx}, -1, ${it.qty})" style="width:32px;height:32px;border-radius:9px;border:1.5px solid var(--steel-100);background:white;font-size:17px;font-weight:700;cursor:pointer;color:var(--red);">−</button>
 <input type="number" id="retQty${idx}" min="0" max="${it.qty}" value="0" placeholder="০"
 style="width:52px;text-align:center;padding:7px 4px;border:1.5px solid var(--steel-100);border-radius:9px;font-size:14px;font-weight:700;" oninput="returnRecalc(${invId})">
 <button type="button" onclick="returnQtyStep(${invId}, ${idx}, 1, ${it.qty})" style="width:32px;height:32px;border-radius:9px;border:1.5px solid var(--steel-100);background:white;font-size:17px;font-weight:700;cursor:pointer;color:var(--green);">+</button>
 </div>
 </div>`,
    )
    .join("");

  openModal(
    `রিটার্ন — ক্যাশ মেমো #${inv.id}`,
    `
 <div style="font-size:12.5px;color:var(--steel-500);margin-bottom:10px;">যে পণ্যগুলো ফেরত নিচ্ছেন তার পাশে − / + চেপে পরিমাণ ঠিক করুন (০ মানে ফেরত নয়)</div>
 ${itemsHtml}
 <div class="field" style="margin-top:14px;"><label><input type="checkbox" id="retRestock" checked style="width:auto;margin-right:6px;"> স্টকে আবার যোগ করুন</label></div>
 ${
   inv.custId
     ? `<div class="field"><label>ফেরতের পদ্ধতি</label>
 <select id="retMethod"><option value="due">গ্রাহকের বাকি থেকে বিয়োগ করুন</option><option value="cash">নগদ ফেরত দিয়েছেন</option></select></div>`
     : `<div style="font-size:12px;color:var(--steel-500);margin-top:6px;">এটি নগদ বিক্রয় ছিল — ফেরত নগদে দেওয়া হয়েছে বলে রেকর্ড হবে</div>`
 }
 <div style="background:linear-gradient(135deg,var(--steel-900),var(--ink)); border-radius:12px; padding:16px 18px; margin-top:14px; color:white;">
 <div style="font-size:12px; color:rgba(255,255,255,0.75);">গ্রাহক মোট ফেরত পাবেন</div>
 <div style="font-size:26px; font-weight:800; margin-top:4px; font-family:'JetBrains Mono',monospace;" id="retTotal">৳0</div>
 </div>
 `,
    `
 <button class="btn btn-outline" onclick="closeModal()">বাতিল</button>
 <button class="btn btn-primary" onclick="processReturn(${invId})">রিটার্ন সম্পন্ন করুন</button>
 `,
  );
}
function returnQtyStep(invId, idx, delta, maxQty) {
  const el = document.getElementById("retQty" + idx);
  if (!el) return;
  let val = Math.max(0, Math.min(maxQty, (parseInt(el.value) || 0) + delta));
  el.value = val;
  returnRecalc(invId);
}
function returnRecalc(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  let total = 0;
  inv.items.forEach((it, idx) => {
    const qtyEl = document.getElementById("retQty" + idx);
    if (!qtyEl) return;
    const q = Math.min(it.qty, Math.max(0, parseInt(qtyEl.value) || 0));
    total += q * it.sellPrice;
  });
  const totalEl = document.getElementById("retTotal");
  if (totalEl) totalEl.textContent = fmt(total);
}
function processReturn(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  const restock = document.getElementById("retRestock").checked;
  const methodEl = document.getElementById("retMethod");
  const method = methodEl ? methodEl.value : "cash";
  let items = [],
    total = 0;
  inv.items.forEach((it, idx) => {
    const qtyEl = document.getElementById("retQty" + idx);
    const q = qtyEl
      ? Math.min(it.qty, Math.max(0, parseInt(qtyEl.value) || 0))
      : 0;
    if (q > 0) {
      items.push({
        brand: it.brand,
        mm: it.mm,
        size: it.size,
        qty: q,
        amount: q * it.sellPrice,
      });
      total += q * it.sellPrice;
      if (
        restock &&
        inventory[it.brand] &&
        inventory[it.brand][it.mm] &&
        inventory[it.brand][it.mm][it.size]
      ) {
        inventory[it.brand][it.mm][it.size].stock += q;
      }
    }
  });
  if (items.length === 0) {
    showToast("অন্তত একটি পণ্যের পরিমাণ লিখুন");
    return;
  }

  if (inv.custId && method === "due") {
    const cust = ledger.find((l) => l.id === inv.custId);
    if (cust) cust.due = Math.max(0, cust.due - total);
  }

  const ret = {
    id: returnNextId++,
    invoiceId: inv.id,
    date: new Date(),
    customer: inv.customer,
    items,
    total,
    restocked: restock,
    method: inv.custId ? method : "cash",
  };
  returns.push(ret);

  closeModal();
  render();
  showToast(`রিটার্ন সম্পন্ন হয়েছে — ${fmt(total)} টাকার পণ্য`);
  logActivity(
    "রিটার্ন প্রসেস করা হয়েছে",
    `ক্যাশ মেমো #${inv.id} · ${inv.customer} · ${fmt(total)} টাকা`,
  );
  persistShopData();
}
function renderReturns() {
  if (returns.length === 0)
    return `<div class="empty-state"><div class="ic">↩️</div>এখনো কোনো রিটার্ন হয়নি<br><span style="font-size:12px;">"ক্যাশ মেমো হিস্ট্রি" পেজে গিয়ে যেকোনো ক্যাশ মেমোে "রিটার্ন" বাটনে চাপুন</span></div>`;
  const period = listPeriod.returns || "all";
  const filteredReturns = returns.filter((r) =>
    inSelectedPeriodAnchored(r.date, period, getPeriodAnchor("returns")),
  );
  if (filteredReturns.length === 0)
    return (
      periodTabsHtml("returns") +
      `<div class="no-match">এই সময়ে কোনো রিটার্ন নেই</div>`
    );
  return (
    periodTabsHtml("returns") +
    `<table class="tbl">
 <thead><tr><th>রিটার্ন</th><th>ক্যাশ মেমো</th><th>ক্রেতা</th><th>তারিখ</th><th>পণ্য</th><th class="r">মোট</th><th>পদ্ধতি</th><th>স্টক</th></tr></thead>
 <tbody>${filteredReturns
   .slice()
   .reverse()
   .map(
     (r) => `
 <tr>
 <td class="num mono">#${r.id}</td><td class="num mono">#${r.invoiceId}</td><td>${esc(r.customer)}</td>
 <td>${new Date(r.date).toLocaleDateString("bn-BD")}</td>
 <td>${r.items.reduce((s, i) => s + i.qty, 0)} পিস</td>
 <td class="num mono">${fmt(r.total)}</td>
 <td>${r.method === "due" ? "বাকি থেকে সমন্বয়" : "নগদ ফেরত"}</td>
 <td>${r.restocked ? "✅ যোগ হয়েছে" : "—"}</td>
 </tr>`,
   )
   .join("")}
 </tbody></table>`
  );
}

/* ============================================================
 দৈনিক হিসাব
 ============================================================ */
function renderDaily() {
  const days = {};
  invoices.forEach((inv) => {
    if (inv.cancelled) return;
    const k = dayKey(inv.date);
    if (!days[k])
      days[k] = {
        sales: 0,
        collected: 0,
        discount: 0,
        dueGiven: 0,
        expense: 0,
        purchase: 0,
        txCount: 0,
      };
    days[k].sales += inv.total;
    days[k].collected += inv.paid;
    days[k].dueGiven += inv.due;
    days[k].txCount++;
  });
  payments.forEach((p) => {
    const k = dayKey(p.date);
    if (!days[k])
      days[k] = {
        sales: 0,
        collected: 0,
        discount: 0,
        dueGiven: 0,
        expense: 0,
        purchase: 0,
        txCount: 0,
      };
    days[k].collected += p.amount;
    days[k].discount += p.discount;
    days[k].txCount++;
  });
  expenses.forEach((e) => {
    const k = dayKey(e.date);
    if (!days[k])
      days[k] = {
        sales: 0,
        collected: 0,
        discount: 0,
        dueGiven: 0,
        expense: 0,
        purchase: 0,
        txCount: 0,
      };
    days[k].expense += e.amount;
    days[k].txCount++;
  });
  purchases.forEach((p) => {
    const k = dayKey(p.date);
    if (!days[k])
      days[k] = {
        sales: 0,
        collected: 0,
        discount: 0,
        dueGiven: 0,
        expense: 0,
        purchase: 0,
        txCount: 0,
      };
    days[k].purchase += p.cost;
    days[k].txCount++;
  });

  const sortedKeys = Object.keys(days).sort((a, b) => b.localeCompare(a));

  if (!dailySelectedDate) {
    const todayStr = toDateInputValue(new Date());
    const now = new Date();
    const curMonthKey = monthKeyOf(now);
    const curYearKey = String(now.getFullYear());

    const filteredKeys = sortedKeys.filter((k) => {
      if (dailyOverviewPreset === "day") return k === todayStr;
      if (dailyOverviewPreset === "month") return k.slice(0, 7) === curMonthKey;
      if (dailyOverviewPreset === "year") return k.slice(0, 4) === curYearKey;
      return true; // 'all'
    });

    const totals = filteredKeys.reduce(
      (acc, k) => {
        const d = days[k];
        acc.sales += d.sales;
        acc.purchase += d.purchase;
        acc.collected += d.collected;
        acc.expense += d.expense;
        acc.dueGiven += d.dueGiven;
        acc.txCount += d.txCount;
        return acc;
      },
      {
        sales: 0,
        purchase: 0,
        collected: 0,
        expense: 0,
        dueGiven: 0,
        txCount: 0,
      },
    );

    const presetTabs = `
 <div class="tab-row" style="margin-bottom:14px;">
 <button class="btn ${dailyOverviewPreset === "day" ? "btn-primary" : "btn-outline"}" onclick="dailyOverviewSetPreset('day')">দিন</button>
 <button class="btn ${dailyOverviewPreset === "month" ? "btn-primary" : "btn-outline"}" onclick="dailyOverviewSetPreset('month')">মাস</button>
 <button class="btn ${dailyOverviewPreset === "year" ? "btn-primary" : "btn-outline"}" onclick="dailyOverviewSetPreset('year')">বছর</button>
 <button class="btn ${dailyOverviewPreset === "all" ? "btn-primary" : "btn-outline"}" onclick="dailyOverviewSetPreset('all')">সব সময়</button>
 </div>`;

    const totalsPanel = `
 <div class="stat-grid" style="grid-template-columns:repeat(5,1fr); margin-bottom:16px;">
 <div class="stat-card" style="--accent:var(--rust)"><div class="lbl">মোট বিক্রয়</div><div class="val">${fmt(totals.sales)}</div></div>
 <div class="stat-card" style="--accent:var(--steel-700)"><div class="lbl">মোট ক্রয়</div><div class="val">${fmt(totals.purchase)}</div></div>
 <div class="stat-card" style="--accent:var(--green)"><div class="lbl">মোট আদায়</div><div class="val">${fmt(totals.collected)}</div></div>
 <div class="stat-card" style="--accent:var(--amber)"><div class="lbl">মোট খরচ</div><div class="val">${fmt(totals.expense)}</div></div>
 <div class="stat-card" style="--accent:var(--red)"><div class="lbl">নতুন বাকি</div><div class="val">${fmt(totals.dueGiven)}</div></div>
 </div>`;

    const datePicker = `
 <div class="panel" style="margin-bottom:16px; display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;">
 <div class="field" style="margin-bottom:0; flex:1; min-width:180px;">
 <label>যেকোনো তারিখ সরাসরি দেখুন (সেদিন লেনদেন না থাকলেও)</label>
 <input type="date" id="dailyDatePicker" value="${todayStr}" max="${todayStr}">
 </div>
 <button class="btn btn-primary" onclick="openDailyDetail(document.getElementById('dailyDatePicker').value)">দেখুন</button>
 </div>`;

    if (filteredKeys.length === 0) {
      return (
        presetTabs +
        totalsPanel +
        datePicker +
        `<div class="empty-state"><div class="ic">📅</div>এই সময়ে কোনো লেনদেন নেই<br><span style="font-size:12px;">উপরে তারিখ বেছে "দেখুন" চাপুন, অথবা বিক্রয়/পেমেন্ট/খরচ/ক্রয় নিলে সেই তারিখ এখানে তালিকায় দেখা যাবে</span></div>`
      );
    }

    return (
      presetTabs +
      totalsPanel +
      datePicker +
      `
 <div style="font-size:13px;color:var(--steel-500);margin-bottom:14px;">লেনদেন হয়েছে এমন দিনগুলোর তালিকা — যেকোনোটিতে ক্লিক করে বিস্তারিত দেখুন</div>
 ${filteredKeys
   .map((k) => {
     const d = days[k];
     return `<div class="day-card" onclick="openDailyDetail('${k}')">
 <div>
 <div class="dname">${dayLabel(k)}</div>
 <div class="dmeta">${d.txCount} টি লেনদেন</div>
 </div>
 <div class="day-stats">
 <div><div class="dv" style="color:var(--rust);">${fmt(d.sales)}</div><div class="dl">মোট বিক্রয়</div></div>
 <div><div class="dv" style="color:var(--steel-700);">${fmt(d.purchase)}</div><div class="dl">মোট ক্রয়</div></div>
 <div><div class="dv" style="color:var(--green);">${fmt(d.collected)}</div><div class="dl">মোট আদায়</div></div>
 <div><div class="dv" style="color:var(--amber);">${fmt(d.expense)}</div><div class="dl">মোট খরচ</div></div>
 <div><div class="dv" style="color:var(--red);">${fmt(d.dueGiven)}</div><div class="dl">নতুন বাকি</div></div>
 </div>
 </div>`;
   })
   .join("")}`
    );
  }

  const k = dailySelectedDate;
  const d = days[k] || {
    sales: 0,
    collected: 0,
    discount: 0,
    dueGiven: 0,
    expense: 0,
    purchase: 0,
    txCount: 0,
  };
  const dayInvoices = invoices.filter((inv) => dayKey(inv.date) === k);
  const dayPayments = payments.filter((p) => dayKey(p.date) === k);
  const dayExpenses = expenses.filter((e) => dayKey(e.date) === k);
  const dayPurchases = purchases.filter((p) => dayKey(p.date) === k);
  const combined = [
    ...dayInvoices.map((inv) => ({
      t: new Date(inv.date).getTime(),
      html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag sale">বিক্রয়</span>${esc(inv.customer)}${inv.customerPhone ? " · " + telHtml(inv.customerPhone) : ""}</div>
 <div class="txmeta">ক্যাশ মেমো #${inv.id} · ${inv.items.length} টি পণ্য · মোট ${fmt(inv.total)} · পরিশোধিত ${fmt(inv.paid)}${inv.due > 0 ? " · নতুন বাকি " + fmt(inv.due) : " · সম্পূর্ণ নগদ"}</div>
 </div>
 <button class="btn btn-outline" onclick="openCashboxMemoDetail(${inv.id})">দেখুন</button>
 </div>`,
    })),
    ...dayPayments.map((p) => ({
      t: new Date(p.date).getTime(),
      html: `
 <div class="day-tx">
 <div>
  <div class="txname"><span class="tx-tag payment">জমা</span>${esc(p.custName)}${p.custPhone ? " · " + telHtml(p.custPhone) : ""}</div>
 <div class="txmeta">রশিদ #${p.id} · জমা ${fmt(p.amount)}${p.discount > 0 ? " · ছাড় " + fmt(p.discount) : ""} · বাকি ছিল ${fmt(p.dueBefore)} → এখন ${fmt(p.dueAfter)}${p.note ? " · " + esc(p.note) : ""}</div>
 </div>
 <button class="btn btn-outline" onclick="viewPaymentReceipt(${p.id})">দেখুন</button>
 </div>`,
    })),
    ...dayExpenses.map((e) => ({
      t: new Date(e.date).getTime(),
      html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag expense">খরচ</span>${esc(e.personName)} · ${expenseCategoryIcon(e.categoryId)} ${esc(e.categoryName)}</div>
 <div class="txmeta">খরচ ${fmt(e.amount)}${e.note ? " · " + esc(e.note) : ""}</div>
 </div>
 <button class="btn btn-outline" onclick="openReceiptModal('expense', ${e.id})">দেখুন</button>
 </div>`,
    })),
    ...dayPurchases.map((p) => ({
      t: new Date(p.date).getTime(),
      html: `
 <div class="day-tx">
 <div>
 <div class="txname"><span class="tx-tag expense">ক্রয়</span>${esc(p.brand)} · ${p.mm}মি:লি: · ${p.size}ফুট</div>
 <div class="txmeta">${p.banQty} বান · খরচ ${fmt(p.cost)} · ${p.pieces} পিস স্টকে যোগ হয়েছে</div>
 </div>
 </div>`,
    })),
  ].sort((a, b) => b.t - a.t);

  return `
 <div class="back-row">
 <button class="btn btn-outline" onclick="dailySelectedDate=null; render(); scrollContentTop();">← সব তারিখ</button>
 <div class="cur-brand">${dayLabel(k)}</div>
 </div>
 <div class="stat-grid" style="grid-template-columns:repeat(5,1fr);">
 <div class="stat-card" style="--accent:var(--rust)"><div class="lbl">মোট বিক্রয়</div><div class="val">${fmt(d.sales)}</div></div>
 <div class="stat-card" style="--accent:var(--steel-700)"><div class="lbl">মোট ক্রয়</div><div class="val">${fmt(d.purchase)}</div></div>
 <div class="stat-card" style="--accent:var(--green)"><div class="lbl">মোট আদায়</div><div class="val">${fmt(d.collected)}</div></div>
 <div class="stat-card" style="--accent:var(--amber)"><div class="lbl">মোট খরচ</div><div class="val">${fmt(d.expense)}</div></div>
 <div class="stat-card" style="--accent:var(--red)"><div class="lbl">নতুন বাকি</div><div class="val">${fmt(d.dueGiven)}</div></div>
 </div>
 ${combined.length === 0 ? `<div class="no-match">এই দিনে কোনো লেনদেন নেই</div>` : combined.map((x) => x.html).join("")}
 `;
}
function dailyOverviewSetPreset(p) {
  dailyOverviewPreset = p;
  render();
}
function openDailyDetail(k) {
  if (!k) return;
  dailySelectedDate = k;
  render();
  pushBackStep();
  scrollContentTop();
}

/* ============================================================
 লাভ-ক্ষতি (PROFIT & LOSS)
 ============================================================ */
function yearKey(d) {
  return String(new Date(d).getFullYear());
}
function monthKey(d) {
  return toDateInputValue(d).slice(0, 7);
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
  });
}
function yearLabel(key) {
  return bnDigits(key) + " সাল";
}
function profitLevelLabel(type, key) {
  if (type === "year") return yearLabel(key);
  if (type === "month") return monthLabel(key);
  return dayLabel(key);
}
function profitGroupKey(inv, type) {
  if (type === "year") return yearKey(inv.date);
  if (type === "month") return monthKey(inv.date);
  return dayKey(inv.date);
}
function profitComputeMetrics(list) {
  let sales = 0,
    cogs = 0,
    discount = 0,
    deliveryExpense = 0;
  list.forEach((inv) => {
    const itemsRevenue =
      inv.itemsSubtotal != null
        ? inv.itemsSubtotal
        : inv.items.reduce((s, it) => s + it.qty * it.sellPrice, 0);
    const itemCogs = inv.items.reduce(
      (s, it) => s + it.qty * (it.buyPrice || 0),
      0,
    );
    sales += itemsRevenue;
    cogs += itemCogs;
    discount += inv.discount || 0;
    deliveryExpense += (inv.delivery || 0) + (inv.expenseAmt || 0);
  });
  const grossProfit = sales - cogs;
  const netProfit = grossProfit;
  const margin = sales > 0 ? (netProfit / sales) * 100 : 0;
  return {
    sales,
    cogs,
    discount,
    deliveryExpense,
    grossProfit,
    netProfit,
    margin,
    invCount: list.length,
  };
}
function invoiceProfitInfo(inv) {
  const itemsRevenue =
    inv.itemsSubtotal != null
      ? inv.itemsSubtotal
      : inv.items.reduce((s, it) => s + it.qty * it.sellPrice, 0);
  const itemCogs = inv.items.reduce(
    (s, it) => s + it.qty * (it.buyPrice || 0),
    0,
  );
  const gross = itemsRevenue - itemCogs;
  const net = gross;
  const total = inv.total || 0;
  const dueRatio = total > 0 ? Math.min(1, Math.max(0, inv.due / total)) : 0;
  const pendingProfit = net * dueRatio;
  const realizedProfit = net - pendingProfit;
  return { itemsRevenue, itemCogs, gross, net, realizedProfit, pendingProfit };
}
function profitFilteredInvoices() {
  let list = invoices.filter((inv) => !inv.cancelled);
  profitDrillPath.forEach((step) => {
    list = list.filter((inv) => profitGroupKey(inv, step.type) === step.key);
  });
  return list;
}
function profitSwitchTab(tab) {
  profitTab = tab;
  profitDrillPath = [];
  render();
  scrollContentTop();
}
function profitDrillInto(type, key) {
  profitDrillPath.push({ type, key });
  render();
  pushBackStep();
  scrollContentTop();
}
function profitDrillTo(index) {
  profitDrillPath = profitDrillPath.slice(0, index + 1);
  render();
  scrollContentTop();
}

function metricCardsHtml(m) {
  return `
 <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px;">
 <div class="stat-card" style="--accent:var(--steel-700)"><div class="lbl">পণ্য বিক্রয়</div><div class="val" style="font-size:16px;word-break:break-word;">${fmt(m.sales)}</div></div>
 <div class="stat-card" style="--accent:var(--amber)"><div class="lbl">ক্রয়মূল্য (COGS)</div><div class="val" style="font-size:16px;word-break:break-word;">${fmt(m.cogs)}</div></div>
 <div class="stat-card" style="--accent:${m.grossProfit >= 0 ? "var(--green)" : "var(--red)"}"><div class="lbl">গ্রস মুনাফা</div><div class="val" style="font-size:16px;word-break:break-word;">${fmt(m.grossProfit)}</div></div>
  <div class="stat-card" style="--accent:var(--steel-500)"><div class="lbl">ছাড় (তথ্যের জন্য, লাভে প্রভাব ফেলে না)</div><div class="val" style="font-size:16px;word-break:break-word;">${fmt(m.discount)}</div></div>
 <div class="stat-card" style="--accent:${m.netProfit >= 0 ? "var(--green)" : "var(--red)"}"><div class="lbl">নিট মুনাফা</div><div class="val" style="font-size:16px;word-break:break-word;color:${m.netProfit >= 0 ? "var(--green)" : "var(--red)"}">${fmt(m.netProfit)}</div></div>
 </div>
 <div class="panel" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
 <div style="font-size:13px;color:var(--steel-500);">
 ${m.invCount} টি ক্যাশ মেমো · মুনাফার হার (মার্জিন) <b class="mono" style="color:${m.netProfit >= 0 ? "var(--green)" : "var(--red)"}">${m.margin.toFixed(1)}%</b>
 ${m.deliveryExpense > 0 ? ` · ডেলিভারি/অন্যান্য চার্জ ${fmt(m.deliveryExpense)} (নিরপেক্ষ, মুনাফায় ধরা হয়নি)` : ""}
 </div>
 </div>`;
}
function profitBreadcrumbHtml() {
  let html = `<span class="crumb-btn" onclick="profitDrillTo(-1)">সব ${profitTab === "yearly" ? "বছর" : profitTab === "monthly" ? "মাস" : "দিন"}</span>`;
  profitDrillPath.forEach((d, i) => {
    html += ` <span>›</span> <span class="crumb-btn" onclick="profitDrillTo(${i})">${profitLevelLabel(d.type, d.key)}</span>`;
  });
  return `<div class="breadcrumb">${html}</div>`;
}
function renderProfit() {
  const LEVEL_SETS = {
    daily: ["day"],
    monthly: ["month", "day"],
    yearly: ["year", "month", "day"],
  };
  const levels = LEVEL_SETS[profitTab];
  const depth = profitDrillPath.length;

  const tabsHtml = `
 <div style="display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap;">
 <button class="btn ${profitTab === "daily" ? "btn-primary" : "btn-outline"}" onclick="profitSwitchTab('daily')">📅 দৈনিক</button>
 <button class="btn ${profitTab === "monthly" ? "btn-primary" : "btn-outline"}" onclick="profitSwitchTab('monthly')">🗓️ মাসিক</button>
 <button class="btn ${profitTab === "yearly" ? "btn-primary" : "btn-outline"}" onclick="profitSwitchTab('yearly')">📈 বার্ষিক</button>
 </div>`;

  const totalQuickProfit = quickSales.reduce((s, q) => s + (q.profit || 0), 0);
  const totalQuickRevenue = quickSales.reduce(
    (s, q) => s + (q.totalAmount || 0),
    0,
  );
  const quickProfitPanel =
    totalQuickRevenue > 0
      ? `
 <div class="panel" style="margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
 <div style="font-size:13px;color:var(--steel-500);">⚡ দ্রুত বিক্রি থেকে (ক্যাশ মেমো ছাড়া) — বিক্রয় ${fmt(totalQuickRevenue)}</div>
 <b class="mono" style="font-size:16px;color:var(--green);">লাভ ${fmt(totalQuickProfit)}</b>
 </div>`
      : "";

  if (invoices.length === 0) {
    return (
      tabsHtml +
      quickProfitPanel +
      `<div class="empty-state"><div class="ic">📈</div>এখনো কোনো বিক্রয় হয়নি<br><span style="font-size:12px;">"বিক্রয়" থেকে ক্যাশ মেমো তৈরি হলে এখানে লাভ-ক্ষতির হিসাব দেখা যাবে</span></div>`
    );
  }

  const filteredSoFar = profitFilteredInvoices();
  const overallMetrics = profitComputeMetrics(filteredSoFar);
  const breadcrumb = depth > 0 ? profitBreadcrumbHtml() : "";

  if (depth >= levels.length) {
    const rows =
      filteredSoFar.length === 0
        ? `<tr><td colspan="7" class="no-match">এই সময়ে কোনো ক্যাশ মেমো নেই</td></tr>`
        : filteredSoFar
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((inv) => {
              const itemsRevenue =
                inv.itemsSubtotal != null
                  ? inv.itemsSubtotal
                  : inv.items.reduce((s, it) => s + it.qty * it.sellPrice, 0);
              const itemCogs = inv.items.reduce(
                (s, it) => s + it.qty * (it.buyPrice || 0),
                0,
              );
              const gross = itemsRevenue - itemCogs;
              const net = gross - (inv.discount || 0);
              return `<tr>
 <td class="num mono">#${inv.id}</td>
 <td>${esc(inv.customer)}</td>
 <td>${new Date(inv.date).toLocaleDateString("bn-BD")}</td>
 <td class="num mono">${fmt(itemsRevenue)}</td>
 <td class="num mono">${fmt(itemCogs)}</td>
 <td class="num mono" style="color:${net >= 0 ? "var(--green)" : "var(--red)"}">${fmt(net)}</td>
 <td class="tbl-actions"><button onclick="profitInvoiceDetail(${inv.id})">বিস্তারিত</button></td>
 </tr>`;
            })
            .join("");
    return (
      tabsHtml +
      quickProfitPanel +
      breadcrumb +
      metricCardsHtml(overallMetrics) +
      `
 <table class="tbl">
 <thead><tr><th>ক্যাশ মেমো</th><th>ক্রেতা</th><th>তারিখ</th><th>বিক্রয়</th><th>ক্রয়মূল্য</th><th>নিট মুনাফা</th><th></th></tr></thead>
 <tbody>${rows}</tbody>
 </table>`
    );
  }

  const showLevel = levels[depth];
  const groups = {};
  filteredSoFar.forEach((inv) => {
    const k = profitGroupKey(inv, showLevel);
    if (!groups[k]) groups[k] = [];
    groups[k].push(inv);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (sortedKeys.length === 0) {
    return (
      tabsHtml +
      quickProfitPanel +
      breadcrumb +
      `<div class="no-match">এই পরিসরে কোনো বিক্রয় নেই</div>`
    );
  }

  const cards = sortedKeys
    .map((k) => {
      const m = profitComputeMetrics(groups[k]);
      return `<div class="day-card" onclick="profitDrillInto('${showLevel}','${k}')">
 <div>
 <div class="dname">${profitLevelLabel(showLevel, k)}</div>
 <div class="dmeta">${m.invCount} টি ক্যাশ মেমো · মার্জিন ${m.margin.toFixed(1)}%</div>
 </div>
 <div class="day-stats">
 <div><div class="dv" style="color:var(--steel-700);">${fmt(m.sales)}</div><div class="dl">বিক্রয়</div></div>
 <div><div class="dv" style="color:var(--amber);">${fmt(m.cogs)}</div><div class="dl">ক্রয়মূল্য</div></div>
 <div><div class="dv" style="color:${m.netProfit >= 0 ? "var(--green)" : "var(--red)"};">${fmt(m.netProfit)}</div><div class="dl">নিট মুনাফা</div></div>
 </div>
 </div>`;
    })
    .join("");

  return (
    tabsHtml +
    quickProfitPanel +
    breadcrumb +
    metricCardsHtml(overallMetrics) +
    `
 <div style="font-size:13px;color:var(--steel-500);margin-bottom:14px;">যেকোনো ${showLevel === "year" ? "বছরে" : showLevel === "month" ? "মাসে" : "দিনে"} ক্লিক করে আরও ভেতরে গিয়ে বিস্তারিত দেখুন</div>
 ${cards}`
  );
}
function profitInvoiceDetail(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;
  const rows = inv.items
    .map((it) => {
      const rev = it.qty * it.sellPrice;
      const cost = it.qty * (it.buyPrice || 0);
      const profit = rev - cost;
      return `<tr>
 <td>${esc(inv_item_label_(it))}</td>
 <td class="r">${it.qty}</td>
 <td class="r">${fmt(it.buyPrice || 0)}</td>
 <td class="r">${fmt(it.sellPrice)}</td>
 <td class="r" style="color:${profit >= 0 ? "var(--green)" : "var(--red)"}">${fmt(profit)}</td>
 </tr>`;
    })
    .join("");
  const itemsRevenue =
    inv.itemsSubtotal != null
      ? inv.itemsSubtotal
      : inv.items.reduce((s, it) => s + it.qty * it.sellPrice, 0);
  const itemCogs = inv.items.reduce(
    (s, it) => s + it.qty * (it.buyPrice || 0),
    0,
  );
  const gross = itemsRevenue - itemCogs;
  const net = gross - (inv.discount || 0);
  openModal(
    `মুনাফা বিস্তারিত — ক্যাশ মেমো #${inv.id}`,
    `
 <div style="font-size:12.5px;color:var(--steel-500);margin-bottom:10px;">ক্রেতা: ${esc(inv.customer)} · ${new Date(inv.date).toLocaleDateString("bn-BD")}</div>
 <table class="itbl">
 <thead><tr><th>পণ্য</th><th class="r">পরিমাণ</th><th class="r">ক্রয়মূল্য</th><th class="r">বিক্রয়মূল্য</th><th class="r">মুনাফা</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 <div class="isubrow"><span>পণ্যের সাবটোটাল (বিক্রয়)</span><span>${fmt(itemsRevenue)}</span></div>
 <div class="isubrow"><span>মোট ক্রয়মূল্য</span><span>${fmt(itemCogs)}</span></div>
  <div class="isubrow"><span>গ্রস মুনাফা</span><span>${fmt(gross)}</span></div>
 <div class="itotal"><span>নিট মুনাফা</span><span style="color:${net >= 0 ? "var(--green)" : "var(--red)"}">${fmt(net)}</span></div>
 ${inv.discount > 0 ? `<div style="font-size:11px;color:var(--steel-500);margin-top:8px;">এই মেমোতে ${fmt(inv.discount)} টাকা ছাড় দেওয়া হয়েছে — গ্রাহকের বিল থেকে বাদ গেছে, কিন্তু মুনাফার হিসাব থেকে বাদ যায়নি।</div>` : ""}
 ${inv.delivery || inv.expenseAmt ? `<div style="font-size:11.5px;color:var(--steel-500);margin-top:10px;">ডেলিভারি/অন্যান্য চার্জ ${fmt((inv.delivery || 0) + (inv.expenseAmt || 0))} গ্রাহকের কাছ থেকে নেওয়া হয়েছে কিন্তু এখানে নিরপেক্ষ (pass-through) ধরা হয়েছে বলে মুনাফায় যোগ করা হয়নি।</div>` : ""}
 `,
    `<button class="btn btn-outline" onclick="closeModal()">বন্ধ করুন</button>`,
  );
}
function inv_item_label_(it) {
  return `${it.brand}${itemLabelText(it.brand, it.mm, it.size)}`;
}

/* ============================================================
 ব্যবসার রিপোর্ট (BUSINESS REPORT)
 ============================================================ */
/* ============================================================
 ক্যাশবক্স — সব ক্যাশ ইন/আউট এক জায়গায়
 ============================================================ */
function cashboxGetRange() {
  const now = new Date();
  if (cashboxPreset === "today") return { from: dayKey(now), to: dayKey(now) };
  if (cashboxPreset === "month")
    return { from: monthKeyOf(now) + "-01", to: dayKey(now) };
  if (cashboxPreset === "year")
    return { from: now.getFullYear() + "-01-01", to: dayKey(now) };
  if (cashboxPreset === "all") return { from: null, to: null };
  return { from: cashboxFrom, to: cashboxTo };
}
function cashboxSetPreset(p) {
  cashboxPreset = p;
  render();
}
function cashboxSetCustom() {
  cashboxFrom = document.getElementById("cbFromInput").value || null;
  cashboxTo = document.getElementById("cbToInput").value || null;
  cashboxPreset = "custom";
  render();
}
function cashboxSetFilter(f) {
  cashboxFilter = f;
  render();
}
function renderCashbox() {
  const range = cashboxGetRange();

  let txns = [];
  invoices.forEach((inv) => {
    if (inv.cancelled) return;
    if (!reportInRange(inv.date, range.from, range.to)) return;
    if (inv.paid > 0)
      txns.push({
        t: new Date(inv.date).getTime(),
        date: inv.date,
        dir: "in",
        cat: "sale",
        label: `বিক্রয় — ${inv.customer}`,
        detail: `ক্যাশ মেমো #${inv.id}`,
        amount: inv.paid,
        invoiceId: inv.id,
      });
  });
  payments.forEach((p) => {
    if (!reportInRange(p.date, range.from, range.to)) return;
    txns.push({
      t: new Date(p.date).getTime(),
      date: p.date,
      dir: "in",
      cat: "due",
      label: `বাকি আদায় — ${p.custName}`,
      detail: `রশিদ #${p.id}${p.method ? " · " + p.method : ""}`,
      amount: p.amount,
    });
  });
  purchases.forEach((pu) => {
    if (!reportInRange(pu.date, range.from, range.to)) return;
    txns.push({
      t: new Date(pu.date).getTime(),
      date: pu.date,
      dir: "out",
      cat: "purchase",
      label: `কেনা — ${pu.brand}`,
      detail: `${pu.mm}মি:লি: · ${pu.size}ফুট · ${pu.banQty} বান`,
      amount: pu.cost,
    });
  });
  expenses.forEach((e) => {
    if (!reportInRange(e.date, range.from, range.to)) return;
    txns.push({
      t: new Date(e.date).getTime(),
      date: e.date,
      dir: "out",
      cat: "expense",
      label: `খরচ — ${e.personName}`,
      detail: `${expenseCategoryIcon(e.categoryId)} ${e.categoryName}${e.note ? " · " + e.note : ""}`,
      amount: e.amount,
    });
  });
  quickSales.forEach((q) => {
    if (!reportInRange(q.date, range.from, range.to)) return;
    txns.push({
      t: new Date(q.date).getTime(),
      date: q.date,
      dir: "in",
      cat: "quickprofit",
      label: `দ্রুত বিক্রি${q.name ? " — " + q.name : ""}`,
      detail: q.profit > 0 ? `লাভ ${fmt(q.profit)}` : "ক্যাশ মেমো ছাড়া বিক্রি",
      amount: q.totalAmount,
    });
  });
  incomes.forEach((i) => {
    if (!reportInRange(i.date, range.from, range.to)) return;
    txns.push({
      t: new Date(i.date).getTime(),
      date: i.date,
      dir: "in",
      cat: "otherincome",
      label: `আয় — ${i.personName}`,
      detail: `${incomeCategoryIcon(i.categoryId)} ${i.categoryName}${i.note ? " · " + i.note : ""}`,
      amount: i.amount,
    });
  });

  const totalIn = txns
    .filter((x) => x.dir === "in")
    .reduce((s, x) => s + x.amount, 0);
  const totalOut = txns
    .filter((x) => x.dir === "out")
    .reduce((s, x) => s + x.amount, 0);
  const balance = totalIn - totalOut;

  const filterMap = {
    all: null,
    in: "in",
    out: "out",
    sale: "sale",
    due: "due",
    expense: "expense",
    purchase: "purchase",
  };
  const filtered = txns
    .filter((x) => {
      if (cashboxFilter === "all") return true;
      if (cashboxFilter === "in" || cashboxFilter === "out")
        return x.dir === cashboxFilter;
      return x.cat === cashboxFilter;
    })
    .sort((a, b) => b.t - a.t);

  const filterChips = [
    ["all", "সব"],
    ["in", "ক্যাশ ইন"],
    ["out", "ক্যাশ আউট"],
    ["sale", "বিক্রি"],
    ["due", "বাকি আদায়"],
    ["quickprofit", "দ্রুত বিক্রি"],
    ["expense", "খরচ"],
    ["purchase", "কেনা"],
    ["otherincome", "আয়"],
  ]
    .map(
      ([key, label]) =>
        `<button class="btn ${cashboxFilter === key ? "btn-primary" : "btn-outline"}" style="padding:7px 13px;font-size:12.5px;" onclick="cashboxSetFilter('${key}')">${label}</button>`,
    )
    .join("");

  const presetBar = `
 <div class="tab-row">
 <button class="btn ${cashboxPreset === "today" ? "btn-primary" : "btn-outline"}" onclick="cashboxSetPreset('today')">দিন</button>
 <button class="btn ${cashboxPreset === "month" ? "btn-primary" : "btn-outline"}" onclick="cashboxSetPreset('month')">মাস</button>
 <button class="btn ${cashboxPreset === "year" ? "btn-primary" : "btn-outline"}" onclick="cashboxSetPreset('year')">বছর</button>
 <button class="btn ${cashboxPreset === "all" ? "btn-primary" : "btn-outline"}" onclick="cashboxSetPreset('all')">সব সময়</button>
 </div>
 <div class="panel" style="margin-bottom:16px; display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;">
 <div class="field" style="margin-bottom:0;"><label>শুরুর তারিখ (কাস্টম)</label><input type="date" id="cbFromInput" value="${cashboxFrom || ""}"></div>
 <div class="field" style="margin-bottom:0;"><label>শেষের তারিখ (কাস্টম)</label><input type="date" id="cbToInput" value="${cashboxTo || ""}"></div>
 <button class="btn btn-primary" onclick="cashboxSetCustom()">প্রয়োগ করুন</button>
 </div>`;

  const rows =
    filtered.length === 0
      ? `<div class="no-match">এই সময়ে/ফিল্টারে কোনো লেনদেন নেই</div>`
      : filtered
          .map(
            (x) => `
 <div class="day-tx" ${x.invoiceId ? `style="cursor:pointer;" onclick="openCashboxMemoDetail(${x.invoiceId})"` : ""}>
 <div>
 <div class="txname"><span class="tx-tag ${x.dir === "in" ? "payment" : "expense"}">${x.dir === "in" ? "ক্যাশ ইন" : "ক্যাশ আউট"}</span>${esc(x.label)}${x.invoiceId ? ' <span style="font-size:10.5px;color:var(--steel-500);">· বিস্তারিত দেখতে চাপুন</span>' : ""}</div>
 <div class="txmeta">${esc(x.detail)} · ${new Date(x.date).toLocaleDateString("bn-BD")}</div>
 </div>
 <div class="mono" style="font-weight:700; color:${x.dir === "in" ? "var(--green)" : "var(--red)"};">${x.dir === "in" ? "+" : "−"} ${fmt(x.amount)}</div>
 </div>`,
          )
          .join("");

  return `
 ${presetBar}
 <div class="dash-hero" style="margin-bottom:16px;">
 <div class="dh-label">ব্যালেন্স (নির্বাচিত সময়ে)</div>
 <div class="dh-val">${fmt(balance)}</div>
 <div class="dh-sub" style="grid-template-columns:1fr 1fr;">
 <div>ক্যাশ ইন<b style="color:#bff0d5;">${fmt(totalIn)}</b></div>
 <div>ক্যাশ আউট<b style="color:#ffc9bd;">${fmt(totalOut)}</b></div>
 </div>
 </div>
 <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">${filterChips}</div>
 ${rows}`;
}

/* ============================================================
 মেমো বিস্তারিত — ক্যাশবক্স/দৈনিক হিসাব থেকে ক্লিক করলে একটা মেমোর
 সম্পূর্ণ তথ্য (গ্রাহক, লাভ-ক্ষতি, রিটার্ন, ডিলিট) একসাথে দেখায়
 ============================================================ */
function openCashboxMemoDetail(invId) {
  const inv = invoices.find((x) => x.id === invId);
  if (!inv) return;

  const info = invoiceProfitInfo(inv);
  const profitColor = info.net >= 0 ? "var(--green)" : "var(--red)";

  const itemsRows = inv.items
    .map(
      (it) => `
 <tr>
  <td>${esc(it.brand)}${itemLabelText(it.brand, it.mm, it.size)}</td>
 <td class="r">${it.qty}</td>
 <td class="r">${fmt(it.sellPrice)}</td>
 <td class="r">${fmt(it.qty * it.sellPrice)}</td>
 </tr>`,
    )
    .join("");

  const relatedReturns = returns.filter((r) => r.invoiceId === invId);
  const totalReturned = relatedReturns.reduce((s, r) => s + r.total, 0);
  const returnedRows = relatedReturns
    .map(
      (r) => `
 <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--steel-100);font-size:12.5px;">
 <span>↩️ রিটার্ন #${r.id} · ${new Date(r.date).toLocaleDateString("bn-BD")}</span>
 <b class="mono" style="color:var(--red);">− ${fmt(r.total)}</b>
 </div>`,
    )
    .join("");
  const netAfterReturn = inv.total - totalReturned;

  const cancelledBanner = inv.cancelled
    ? `<div style="background:#FCEBE9;color:var(--red);border-radius:8px;padding:10px 14px;font-size:12.5px;text-align:center;font-weight:700;margin-bottom:12px;">❌ এই ক্যাশ মেমোটি বাতিল করা হয়েছে</div>`
    : "";

  const body = `
 ${cancelledBanner}
 <div style="background:var(--paper); border-radius:12px; padding:14px 16px; margin-bottom:14px;">
 <div style="font-weight:700; font-size:15px;">${esc(inv.customer)}</div>
 <div style="font-size:12.5px; color:var(--steel-500); margin-top:6px; line-height:1.9;">
 ${inv.customerPhone ? `📞 ${telHtml(inv.customerPhone)}<br>` : ""}
 ${inv.customerAddress ? `📍 ${esc(inv.customerAddress)}<br>` : ""}
 🧾 ক্যাশ মেমো #${inv.id} · ${new Date(inv.date).toLocaleDateString("bn-BD")}${inv.salesBy ? " · বিক্রয়কারীঃ " + esc(inv.salesBy) : ""}
 </div>
 </div>
 <table class="itbl">
 <thead><tr><th>পণ্য</th><th class="r">পরিমাণ</th><th class="r">দর</th><th class="r">মোট</th></tr></thead>
 <tbody>${itemsRows}</tbody>
 </table>
 <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:2px solid var(--ink); font-weight:700; font-size:14px; margin-top:2px;">
 <span>মূল বিল</span><span class="mono">${fmt(inv.total)}</span>
 </div>
 <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12.5px; color:var(--steel-500);">
 <span>পেলাম</span><span class="mono">${fmt(inv.paid)}</span>
 </div>
 ${inv.due > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12.5px; color:var(--red);"><span>বাকি</span><span class="mono">${fmt(inv.due)}</span></div>` : ""}
 ${
   relatedReturns.length
     ? `
 <div style="margin-top:14px;">
 <div style="font-size:12.5px; font-weight:600; color:var(--steel-700); margin-bottom:6px;">↩️ এই মেমোতে রিটার্ন হয়েছে</div>
 ${returnedRows}
 <div style="display:flex; justify-content:space-between; padding-top:8px; font-weight:700; font-size:14px;">
 <span>রিটার্নের পর নিট বিল</span><span class="mono" style="color:var(--rust);">${fmt(netAfterReturn)}</span>
 </div>
 </div>`
     : ""
 }
 <div style="background:${info.net >= 0 ? "rgba(60,122,84,0.1)" : "rgba(196,60,45,0.1)"}; border-radius:12px; padding:14px 16px; margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
 <span style="font-size:13px; font-weight:600; color:${profitColor};">${info.net >= 0 ? "✅ এই মেমোতে লাভ হয়েছে" : "⚠️ এই মেমোতে ক্ষতি হয়েছে"}</span>
 <b class="mono" style="font-size:19px; color:${profitColor};">${fmt(Math.abs(info.net))}</b>
 </div>
 `;

  const footer = `
 <button class="btn btn-outline" onclick="closeModal()">বন্ধ করুন</button>
 ${!inv.cancelled ? `<button class="btn btn-outline" onclick="closeModal(); editInvoicePrompt(${inv.id});">✏️ এডিট করুন</button>` : ""}
 <button class="btn btn-outline" onclick="closeModal(); returnPrompt(${inv.id});">↩️ রিটার্ন করুন</button>
 ${!inv.cancelled ? `<button class="btn btn-outline" style="color:var(--red);border-color:var(--red);" onclick="closeModal(); cancelInvoicePrompt(${inv.id});">🗑️ ক্যাশ মেমো ডিলিট/বাতিল</button>` : ""}
 <button class="btn btn-primary" onclick="closeModal(); printInvoice(invoices.find(x=>x.id===${inv.id}));">🖨️ প্রিন্ট/ডাউনলোড</button>
 `;

  openModal(`মেমো বিস্তারিত — #${inv.id}`, body, footer);
}

function reportGetRange() {
  const now = new Date();
  if (reportPreset === "today") {
    const k = reportSelectedDay || dayKey(now);
    return { from: k, to: k };
  }
  if (reportPreset === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    return { from: dayKey(monday), to: dayKey(now) };
  }
  if (reportPreset === "month") {
    return { from: monthKeyOf(now) + "-01", to: dayKey(now) };
  }
  if (reportPreset === "year") {
    return { from: now.getFullYear() + "-01-01", to: dayKey(now) };
  }
  if (reportPreset === "all") {
    return { from: null, to: null };
  }
  return { from: reportFrom, to: reportTo };
}
function reportInRange(dateVal, from, to) {
  const k = dayKey(dateVal);
  if (from && k < from) return false;
  if (to && k > to) return false;
  return true;
}
function reportSetPreset(p) {
  reportPreset = p;
  if (p === "today") reportSelectedDay = dayKey(new Date());
  render();
}
function reportDayNav(delta) {
  const cur = reportSelectedDay || dayKey(new Date());
  const [y, m, d] = cur.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + delta);
  reportSelectedDay = dayKey(base);
  reportPreset = "today";
  render();
}
function reportSetCustom() {
  reportFrom = document.getElementById("reportFromInput").value || null;
  reportTo = document.getElementById("reportToInput").value || null;
  reportPreset = "custom";
  render();
}
function renderBusinessReport() {
  const range = reportGetRange();
  const filteredInv = invoices.filter(
    (inv) => !inv.cancelled && reportInRange(inv.date, range.from, range.to),
  );
  const filteredPurch = purchases.filter((p) =>
    reportInRange(p.date, range.from, range.to),
  );
  const filteredExp = expenses.filter((e) =>
    reportInRange(e.date, range.from, range.to),
  );
  const filteredPay = payments.filter((p) =>
    reportInRange(p.date, range.from, range.to),
  );

  const cashSaleAmount = filteredInv.reduce((s, inv) => s + inv.paid, 0);
  const dueCollectedAmount = filteredPay.reduce((s, p) => s + p.amount, 0);
  const filteredIncomes = incomes.filter((i) =>
    reportInRange(i.date, range.from, range.to),
  );
  const otherIncome = filteredIncomes.reduce((s, i) => s + i.amount, 0);
  const cashPurchaseAmount = filteredPurch.reduce((s, p) => s + p.cost, 0);
  const supplierDuePaid = 0;
  const otherExpenseAmount = filteredExp.reduce((s, e) => s + e.amount, 0);
  const overallBalance =
    cashSaleAmount +
    dueCollectedAmount +
    otherIncome -
    (cashPurchaseAmount + supplierDuePaid + otherExpenseAmount);

  let productCashProfit = 0,
    productDueProfit = 0,
    productTotalProfit = 0;
  filteredInv.forEach((inv) => {
    const info = invoiceProfitInfo(inv);
    productCashProfit += info.realizedProfit;
    productDueProfit += info.pendingProfit;
    productTotalProfit += info.net;
  });

  const custProfitMap = {};
  filteredInv.forEach((inv) => {
    const key = inv.custId != null ? "c" + inv.custId : "n:" + inv.customer;
    if (!custProfitMap[key])
      custProfitMap[key] = {
        name: inv.customer,
        phone: inv.customerPhone,
        sales: 0,
        cash: 0,
        due: 0,
        net: 0,
        invCount: 0,
      };
    const info = invoiceProfitInfo(inv);
    custProfitMap[key].sales += info.itemsRevenue;
    custProfitMap[key].cash += info.realizedProfit;
    custProfitMap[key].due += info.pendingProfit;
    custProfitMap[key].net += info.net;
    custProfitMap[key].invCount += 1;
  });
  const custProfitRows = Object.values(custProfitMap).sort(
    (a, b) => b.net - a.net,
  );

  let totalStockPieces = 0,
    totalStockValue = 0;
  Object.values(inventory).forEach((mmObj) =>
    Object.values(mmObj).forEach((szObj) =>
      Object.values(szObj).forEach((v) => {
        totalStockPieces += v.stock;
        totalStockValue += v.stock * v.buy;
      }),
    ),
  );
  const totalDueOutstanding = ledger.reduce((s, l) => s + l.due, 0);
  const totalPurchasePieces = filteredPurch.reduce((s, p) => s + p.pieces, 0);

  const brandSales = {};
  filteredInv.forEach((inv) =>
    inv.items.forEach((it) => {
      if (!brandSales[it.brand]) brandSales[it.brand] = { qty: 0, revenue: 0 };
      brandSales[it.brand].qty += it.qty;
      brandSales[it.brand].revenue += it.qty * it.sellPrice;
    }),
  );
  const brandRows = Object.entries(brandSales)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(
      ([b, v]) => `
 <tr><td>${esc(b)}</td><td class="num r mono">${v.qty}</td><td class="num r mono">${fmt(v.revenue)}</td></tr>`,
    )
    .join("");

  const rangeLabel =
    {
      today: "আজকের",
      week: "এই সপ্তাহের",
      month: "এই মাসের",
      year: "এই বছরের",
      all: "সর্বমোট (সব সময়ের)",
      custom: "নির্বাচিত সময়ের",
    }[reportPreset] || "নির্বাচিত সময়ের";

  const presetBar = `
 <div class="tab-row">
 <button class="btn ${reportPreset === "today" ? "btn-primary" : "btn-outline"}" onclick="reportSetPreset('today')">দিন</button>
 <button class="btn ${reportPreset === "week" ? "btn-primary" : "btn-outline"}" onclick="reportSetPreset('week')">এই সপ্তাহ</button>
 <button class="btn ${reportPreset === "month" ? "btn-primary" : "btn-outline"}" onclick="reportSetPreset('month')">এই মাস</button>
 <button class="btn ${reportPreset === "year" ? "btn-primary" : "btn-outline"}" onclick="reportSetPreset('year')">এই বছর</button>
 <button class="btn ${reportPreset === "all" ? "btn-primary" : "btn-outline"}" onclick="reportSetPreset('all')">সর্বমোট</button>
 </div>
 ${
   reportPreset === "today"
     ? `
 <div class="panel" style="margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
 <button class="btn btn-outline" onclick="reportDayNav(-1)">← আগের দিন</button>
 <div style="font-weight:700; font-family:'Baloo Da 2'; font-size:15px;">${dayLabel(reportSelectedDay || dayKey(new Date()))}</div>
 <button class="btn btn-outline" onclick="reportDayNav(1)">পরের দিন →</button>
 </div>`
     : ""
 }
 <div class="panel" style="margin-bottom:18px; display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;">
 <div class="field" style="margin-bottom:0;"><label>শুরুর তারিখ (কাস্টম)</label><input type="date" id="reportFromInput" value="${reportFrom || ""}"></div>
 <div class="field" style="margin-bottom:0;"><label>শেষের তারিখ (কাস্টম)</label><input type="date" id="reportToInput" value="${reportTo || ""}"></div>
 <button class="btn btn-primary" onclick="reportSetCustom()">প্রয়োগ করুন</button>
 </div>`;

  const ledgerRowHtml = (label, sub, val, color) => `
 <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--steel-100);font-size:13.5px;gap:10px;">
 <span>${label}${sub ? ` <span style="color:var(--steel-500);font-size:11.5px;">(${sub})</span>` : ""}</span>
 <b class="mono" style="color:${color}; white-space:nowrap;">${fmt(val)}</b>
 </div>`;

  const generalReportPanel = `
 <div class="panel" style="margin-bottom:16px;">
 <h3>সাধারণ বিক্রি রিপোর্ট</h3>
 ${ledgerRowHtml("নগদ বেচা", "কাস্টমার বাকি বাদে", cashSaleAmount, "var(--green)")}
 ${ledgerRowHtml("কাস্টমার থেকে বাকির টাকা পেয়েছেন", "", dueCollectedAmount, "var(--green)")}
 ${ledgerRowHtml("অন্যান্য আয়", "", otherIncome, "var(--green)")}
 ${ledgerRowHtml("নগদ কেনা", "সাপ্লায়ার বাকি বাদে", cashPurchaseAmount, "var(--red)")}
 ${ledgerRowHtml("সাপ্লায়ারকে বাকির টাকা দিয়েছেন", "", supplierDuePaid, "var(--red)")}
 ${ledgerRowHtml("অন্যান্য খরচ", "", otherExpenseAmount, "var(--red)")}
 <div style="display:flex;justify-content:space-between;padding:12px 0 2px;margin-top:6px;border-top:2px solid var(--ink);font-size:15.5px;font-weight:700;">
 <span>সর্বমোট ব্যালেন্স</span>
 <span class="mono" style="color:${overallBalance >= 0 ? "var(--green)" : "var(--red)"}">${fmt(overallBalance)}</span>
 </div>
 <div style="font-size:11px;color:var(--steel-500);margin-top:4px;">(মোট বিক্রি + কাস্টমারের বাকির টাকা + অন্যান্য আয়) − (মোট কেনা + সাপ্লায়ারের বাকির টাকা + অন্যান্য খরচ)</div>
 </div>
 <div class="panel" style="margin-bottom:16px;">
  <h3>পণ্য বিক্রি থেকে লাভ <span style="font-weight:400;font-size:11px;color:var(--steel-500);">(বিক্রিত পণ্যের বিক্রয়মূল্য − ক্রয়মূল্য; ছাড়/ডেলিভারি/অন্যান্য চার্জ এতে ধরা হয় না)</span></h3>
 <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
 <div>
 <div style="font-size:11.5px;color:var(--steel-500);">নগদ টাকা</div>
 <div class="mono" style="font-size:17px;font-weight:700;color:var(--green);">${fmt(Math.round(productCashProfit))}</div>
 </div>
 <div>
 <div style="font-size:11.5px;color:var(--steel-500);">বাকি</div>
 <div class="mono" style="font-size:17px;font-weight:700;color:var(--amber);">${fmt(Math.round(productDueProfit))}</div>
 </div>
 <div>
 <div style="font-size:11.5px;color:var(--steel-500);">মোট</div>
 <div class="mono" style="font-size:17px;font-weight:700;color:${productTotalProfit >= 0 ? "var(--green)" : "var(--red)"};">${fmt(Math.round(productTotalProfit))}</div>
 </div>
 </div>
 <div style="font-size:11.5px;color:var(--steel-500);margin-top:12px;">⚠️ বাকিতে বিক্রি করা পণ্যের লাভ যতক্ষণ না ক্রেতা টাকা পরিশোধ করছেন ততক্ষণ তা উপরের "সর্বমোট ব্যালেন্স"-এ যুক্ত হয় না — শুধু সম্ভাব্য/অপেক্ষমাণ লাভ হিসেবে এখানে দেখানো হচ্ছে। গ্রাহক টাকা শোধ করা মাত্র এটি স্বয়ংক্রিয়ভাবে "নগদ টাকা" কলামে চলে আসবে।</div>
 </div>`;

  const custProfitPanel = `
 <div class="panel" style="margin-bottom:16px;">
 <h3>ক্রেতা অনুযায়ী লাভ-ক্ষতি <span style="font-weight:400;font-size:11px;color:var(--steel-500);">(নির্বাচিত সময়ে যিনি যা কিনেছেন তার উপর ভিত্তি করে)</span></h3>
 ${
   custProfitRows.length === 0
     ? `<div class="no-match" style="padding:16px;">এই সময়ে কোনো বিক্রয় নেই</div>`
     : `
 <table class="tbl">
 <thead><tr><th>ক্রেতা</th><th class="r">ক্যাশ মেমো</th><th class="r">বিক্রয়</th><th class="r">নগদ লাভ</th><th class="r">বাকি (অপেক্ষমাণ) লাভ</th><th class="r">মোট লাভ/ক্ষতি</th></tr></thead>
 <tbody>${custProfitRows
   .map(
     (c) => `
 <tr>
 <td>${esc(c.name)}${c.phone ? " · " + telHtml(c.phone) : ""}</td>
 <td class="num r mono">${c.invCount}</td>
 <td class="num r mono">${fmt(Math.round(c.sales))}</td>
 <td class="num r mono" style="color:var(--green)">${fmt(Math.round(c.cash))}</td>
 <td class="num r mono" style="color:${c.due > 0.5 ? "var(--amber)" : "var(--steel-500)"}">${fmt(Math.round(c.due))}</td>
 <td class="num r mono" style="color:${c.net >= 0 ? "var(--green)" : "var(--red)"};font-weight:700;">${fmt(Math.round(c.net))}</td>
 </tr>`,
   )
   .join("")}
 </tbody></table>`
 }
 <div style="font-size:11px;color:var(--steel-500);margin-top:10px;">"বাকি (অপেক্ষমাণ) লাভ" কলামের টাকা যতক্ষণ না ঐ ক্রেতা পরিশোধ করছেন ততক্ষণ ব্যবসার মোট (নগদ) লাভে যোগ হয় না।</div>
 </div>`;

  return `
 ${presetBar}
 <div style="font-size:13.5px; color:var(--steel-500); margin-bottom:14px;">📋 <b style="color:var(--ink);">${rangeLabel}</b> ব্যবসার সারসংক্ষেপ</div>
 ${generalReportPanel}
 ${custProfitPanel}
 <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:6px;">
 <div class="panel">
 <h3>বর্তমান দোকানের অবস্থা (সার্বক্ষণিক)</h3>
 <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--steel-100);font-size:13.5px;"><span>মোট স্টক (পিস)</span><b class="mono">${totalStockPieces}</b></div>
 <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--steel-100);font-size:13.5px;"><span>স্টকের ক্রয়মূল্য (মোট মূলধন)</span><b class="mono">${fmt(totalStockValue)}</b></div>
 <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--steel-100);font-size:13.5px;"><span>নির্বাচিত সময়ে মোট ক্রয়কৃত পিস</span><b class="mono">${totalPurchasePieces}</b></div>
 <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13.5px;"><span>গ্রাহকের কাছে মোট বাকি পাওনা</span><b class="mono" style="color:var(--red);">${fmt(totalDueOutstanding)}</b></div>
 </div>
 <div class="panel">
 <h3>ব্র্যান্ড অনুযায়ী বিক্রয় (নির্বাচিত সময়ে)</h3>
 ${brandRows ? `<table class="tbl"><thead><tr><th>ব্র্যান্ড</th><th class="r">পিস</th><th class="r">বিক্রয়</th></tr></thead><tbody>${brandRows}</tbody></table>` : `<div class="no-match" style="padding:16px;">এই সময়ে কোনো বিক্রয় নেই</div>`}
 </div>
 </div>`;
}

/* ============================================================
 স্টাফ ও কার্যক্রম লগ
 ============================================================ */
/* ============================================================
 AI সহকারী (শুধু মালিক — বর্তমানে প্রিভিউ, টোকেন সিস্টেম শীঘ্রই)
 ============================================================ */
function renderAIAssistant() {
  const features = [
    "📊 বিক্রয় ও লাভের ট্রেন্ড বিশ্লেষণ করে বলে দিবে",
    "📦 কোন পণ্যের স্টক কম, কী অর্ডার করা দরকার তা জানিয়ে দিবে",
    "📒 বাকি আদায়ের জন্য রিমাইন্ডার মেসেজ নিজে লিখে দিবে",
    "💬 বাংলায় প্রশ্ন করলেই দোকানের হিসাব ঘেঁটে উত্তর দিবে",
  ];
  return `
 <div class="panel" style="max-width:640px;margin:0 auto 16px;text-align:center;background:linear-gradient(135deg,var(--steel-900),var(--ink));border:none;">
 <div style="width:64px;height:64px;margin:0 auto 14px;border-radius:18px;background:linear-gradient(135deg,var(--rust),var(--amber));display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 10px 26px rgba(190,74,34,0.35);">🤖</div>
 <h3 style="font-size:19px;margin-bottom:6px;color:white;">AI সহকারী</h3>
 <div style="font-size:13px;color:var(--steel-300);line-height:1.7;max-width:440px;margin:0 auto;">আপনার দোকানের স্টক, বিক্রয়, বাকি — সবকিছু বিশ্লেষণ করে প্রশ্নের উত্তর দিবে এবং পরামর্শ দিবে। শুধু দোকানের মালিক এই ফিচারটি ব্যবহার করতে পারবেন।</div>
 </div>
 <div class="panel" style="max-width:640px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
 <div>
 <div style="font-size:12px;color:var(--steel-500);font-weight:600;">আপনার AI টোকেন ব্যালেন্স</div>
 <div class="mono" style="font-size:24px;font-weight:700;color:var(--rust);margin-top:2px;">০ টোকেন</div>
 </div>
 <button class="btn btn-primary" onclick="buyAiTokens()">🪙 টোকেন কিনুন</button>
 </div>
 <div class="panel" style="max-width:640px;margin:0 auto 16px;">
 <h3>এই ফিচারটি কী করতে পারবে</h3>
 <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:10px;">
 ${features.map((t) => `<div style="background:var(--paper);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;">${t}</div>`).join("")}
 </div>
 </div>
 <div class="panel" style="max-width:640px;margin:0 auto;">
 <h3>চ্যাট প্রিভিউ</h3>
 <div style="background:var(--paper);border-radius:10px;padding:14px;margin-top:10px;filter:blur(2.5px);opacity:0.6;pointer-events:none;user-select:none;">
 <div style="background:white;border-radius:8px;padding:9px 12px;font-size:13px;margin-bottom:8px;max-width:80%;box-shadow:0 1px 3px rgba(0,0,0,0.06);">এই মাসে কোন ব্র্যান্ডের টিন সবচেয়ে বেশি বিক্রি হয়েছে?</div>
 <div style="background:var(--rust);color:white;border-radius:8px;padding:9px 12px;font-size:13px;margin-left:auto;max-width:80%;">এই মাসে আকিজ ব্র্যান্ডের টিন সবচেয়ে বেশি বিক্রি হয়েছে — মোট ৪২ পিস, গত মাসের চেয়ে ১৮% বেশি।</div>
 </div>
 <div style="margin-top:12px;">
 <input type="text" placeholder="প্রশ্ন লিখুন..." disabled style="width:100%;padding:12px 14px;border-radius:9px;border:1.5px solid var(--steel-100);background:var(--steel-100);color:var(--steel-500);">
 <div style="text-align:center;font-size:11.5px;color:var(--steel-500);margin-top:8px;">🔒 টোকেন কিনলে চ্যাট চালু হয়ে যাবে</div>
 </div>
 </div>`;
}
function buyAiTokens() {
  showToast("টোকেন কেনার সিস্টেম শীঘ্রই চালু হবে");
}

function renderStaff() {
  const staffRows =
    staffList
      .map(
        (s) => `
 <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--steel-100);font-size:13.5px;flex-wrap:wrap;gap:8px;">
 <div>
 <div style="font-weight:700;">${esc(s.full_name)}</div>
 </div> 
 <div style="display:flex;gap:8px;">
 <button class="btn btn-outline" onclick="editStaffPrompt('${s.id}')">পরিচালনা করুন</button>
 </div>
 </div>`,
      )
      .join("") ||
    `<div class="no-match">এখনো কোনো স্টাফ যুক্ত করা হয়নি</div>`;

  const logRows =
    activityLog
      .slice(0, 150)
      .map(
        (a) => `
 <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--steel-100);font-size:13px;gap:10px;">
 <div>
 <div><b>${esc(a.staffName)}</b> — ${esc(a.action)}</div>
 ${a.detail ? `<div style="color:var(--steel-500);font-size:11.5px;margin-top:2px;">${esc(a.detail)}</div>` : ""}
 </div>
 <div class="mono" style="font-size:11px;color:var(--steel-500);white-space:nowrap;">${new Date(a.date).toLocaleString("bn-BD")}</div>
 </div>`,
      )
      .join("") ||
    `<div class="no-match">এখনো কোনো কার্যক্রম রেকর্ড হয়নি</div>`;

  return `
 <div class="panel" style="margin-bottom:18px;">
 <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
 <h3 style="margin-bottom:0;">স্টাফ তালিকা (অ্যাপ অ্যাক্সেস)</h3>
 <button class="btn btn-primary" onclick="addStaffPrompt()">+ নতুন স্টাফ</button>
 </div>
 ${staffRows}
 </div>
 <div class="panel">
 <h3>কার্যক্রমের লগ <span style="font-weight:400;font-size:11px;color:var(--steel-500);">(সাম্প্রতিক ১৫০টি — কে কখন কী করেছে)</span></h3>
 ${logRows}
 </div>`;
}

/* ============================================================
 MODAL / TOAST HELPERS
 ============================================================ */
/* ============================================================
 পাসওয়ার্ড কনফার্মেশন — যেকোনো ডিলিট করার আগে বাধ্যতামূলক
 (মালিক বা স্টাফ যেই হোন না কেন, নিজের লগইন পাসওয়ার্ড দিতে হবে)
 ============================================================ */
let __pwConfirmCallback = null;
function requestPasswordConfirm(actionLabel, onConfirm) {
  __pwConfirmCallback = onConfirm;
  openModal(
    "🔒 পাসওয়ার্ড দিয়ে নিশ্চিত করুন",
    `
 <div style="font-size:12.5px;color:var(--steel-500);margin-bottom:14px;line-height:1.6;">"${esc(actionLabel)}" — এই কাজটা করার আগে নিজের লগইন পাসওয়ার্ড দিয়ে নিশ্চিত করুন। মালিক বা স্টাফ যেই হোন না কেন এটা লাগবে।</div>
 <div class="field"><label>পাসওয়ার্ড</label><input type="password" id="pwConfirmInput" placeholder="আপনার লগইন পাসওয়ার্ড" onkeydown="if(event.key==='Enter') verifyPasswordAndProceed();"></div>
 <div id="pwConfirmError" style="color:var(--red); font-size:12px; display:none; margin-top:-8px; margin-bottom:10px;"></div>
 `,
    `
 <button class="btn btn-outline" onclick="__pwConfirmCallback=null; closeModal();">বাতিল</button>
 <button class="btn btn-primary" style="background:var(--red);" id="pwConfirmBtn" onclick="verifyPasswordAndProceed()">নিশ্চিত করুন</button>
 `,
  );
  setTimeout(() => {
    const el = document.getElementById("pwConfirmInput");
    if (el) el.focus();
  }, 50);
}
async function verifyPasswordAndProceed() {
  const pwdEl = document.getElementById("pwConfirmInput");
  const errEl = document.getElementById("pwConfirmError");
  const btn = document.getElementById("pwConfirmBtn");
  const pwd = pwdEl ? pwdEl.value : "";
  if (!pwd) {
    if (errEl) {
      errEl.textContent = "পাসওয়ার্ড লিখুন";
      errEl.style.display = "block";
    }
    return;
  }
  if (!currentUser || !currentUser.email) {
    showToast("ইউজার তথ্য পাওয়া যায়নি — আবার লগইন করুন");
    return;
  }
  if (btn) btn.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: currentUser.email,
      password: pwd,
    });
    if (error) {
      if (errEl) {
        errEl.textContent = "❌ পাসওয়ার্ড সঠিক নয়, আবার চেষ্টা করুন";
        errEl.style.display = "block";
      }
      if (btn) btn.disabled = false;
      return;
    }
    const cb = __pwConfirmCallback;
    __pwConfirmCallback = null;
    closeModal();
    if (typeof cb === "function") cb();
  } catch (e) {
    if (errEl) {
      errEl.textContent = "যাচাই করা যায়নি — আবার চেষ্টা করুন";
      errEl.style.display = "block";
    }
    if (btn) btn.disabled = false;
  }
}

function openModal(title, body, foot) {
  document.getElementById("modalBox").innerHTML = `
 <div class="modal-head"><h3>${title}</h3><span class="modal-close" onclick="closeModal()">✕</span></div>
 <div class="modal-body">${body}</div>
 <div class="modal-foot">${foot}</div>`;
  document.getElementById("modalOverlay").classList.add("active");
  pushBackStep();
}
function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
}
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
