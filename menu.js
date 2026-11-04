// ===== Edit these to match the real page =====
const CONFIG = {
  phone: "+13869652713",
  phoneDisplay: "386-965-2713",
  instagram: "cakedbymonet", // Instagram handle without the @ (confirm exact spelling)

  // Booking
  depositPercent: 50,  // deposit asked for once Mone'T approves
  noticeDays: 3,       // anything sooner is a rush order and may get a rush fee
  closedDays: [],      // days she doesn't bake: 0 = Sun, 1 = Mon … 6 = Sat
  formUrl: "https://fill.formnx.com/f/cake-d-by-monet-71dt44",
  // FormNX field names (from each field's settings in the form builder)
  formFields: {
    name: "name_field_1", phone: "phone_number_field_2", email: "email_field_6",
    date: "field_4", time: "field_5", details: "field_7", total: "field_8", notes: "field_10",
    review: "field_11", // hidden "Review Link" field
  },
};

const FLAVORS = [
  ["vanilla", "Vanilla"], ["chocolate", "Chocolate"], ["strawberry", "Strawberry"],
  ["cookies-cream", "Cookies & Cream"], ["red-velvet", "Red Velvet"], ["banana-pudding", "Banana Pudding"],
  ["funfetti", "Funfetti"], ["biscoff", "Biscoff"], ["carrot-cake", "Carrot Cake"],
  ["lemon", "Lemon"], ["key-lime", "Key Lime"],
];

// Each product: bundle price tiers [quantity, price], biggest first
const PRODUCTS = {
  cupcake: { label: "Cupcakes", short: "Cupcake", tiers: [[12, 36], [6, 18], [1, 3]], img: (f) => `assets/cupcake-${f}.jpg`,
             flavors: FLAVORS },
  brownie: { label: "Regular Brownies", short: "Brownie", tiers: [[12, 40], [4, 15], [1, 4]], img: (f) => `assets/brownie-${f}.jpg`,
             flavors: [["cookies-cream", "Cookies & Cream"], ["biscoff", "Biscoff"], ["chocolate", "Chocolate"], ["vanilla", "Vanilla"]] },
  loaded:  { label: "Loaded Brownies", short: "Loaded Brownie", tiers: [[12, 60], [4, 22], [1, 6]], img: (f) => `assets/brownie-${f}.jpg`,
             flavors: [["cookies-cream", "Cookies & Cream"], ["biscoff", "Biscoff"]] },
  mini:    { label: "Mini Cakes", short: "Mini Cake", tiers: [[12, 60], [6, 35], [1, 5]], img: (f) => `assets/mini-${f}.jpg`,
             flavors: FLAVORS },
};
const CUSTOM = ["custom", "Custom flavor (see notes)"];

const $ = (s) => document.querySelector(s);
const money = (n) => `$${n}`;

// Cheapest way to buy exactly n of a product using its bundle tiers
function bestPrice(tiers, n) {
  const best = [0];
  for (let i = 1; i <= n; i++) {
    best[i] = Infinity;
    for (const [q, price] of tiers) if (q <= i) best[i] = Math.min(best[i], best[i - q] + price);
  }
  return best[n];
}

function flavorName(product, slug) {
  if (slug === CUSTOM[0]) return CUSTOM[1];
  return PRODUCTS[product].flavors.find(([s]) => s === slug)?.[1] ?? slug;
}

// Cart lines are { p: product, f: flavor, q: quantity }
function cartTotal(lines) {
  const counts = {};
  lines.forEach((l) => (counts[l.p] = (counts[l.p] || 0) + l.q));
  let sum = 0;
  for (const [p, n] of Object.entries(counts)) if (PRODUCTS[p]) sum += bestPrice(PRODUCTS[p].tiers, n);
  return sum;
}

const lineText = (l) => `${l.q} × ${flavorName(l.p, l.f)} ${PRODUCTS[l.p].short}${l.q > 1 ? "s" : ""}`;

// "14:30" -> "2:30 PM"
function prettyTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Order <-> URL-safe text, so the review link carries the whole order
function encodeOrder(o) {
  const bytes = new TextEncoder().encode(JSON.stringify(o));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeOrder(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}
