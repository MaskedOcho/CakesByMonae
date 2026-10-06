// ===== Edit these to match the real page =====
const CONFIG = {
  phone: "+13869652713",
  phoneDisplay: "386-965-2713",
  instagram: "cakedbymonet", // Instagram handle without the @ (confirm exact spelling)
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

// ----- Links / basics -----
const igUrl = `https://instagram.com/${CONFIG.instagram}`;
$("#igLink").href = igUrl;
$("#dmLink").href = `https://ig.me/m/${CONFIG.instagram}`;
$("#igFooter").href = igUrl;
$("#igFooter").textContent = `@${CONFIG.instagram}`;
$("#yr").textContent = new Date().getFullYear();

const nav = $(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 60);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ----- Hero: Higgsfield video if present, else the neon cake build -----
const hero = $(".hero");
const video = $("#heroVideo");
video.addEventListener("canplay", () => hero.classList.add("has-video"), { once: true });
video.querySelector("source").addEventListener("error", () => video.remove());

const cake = $(".cake");
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(() => {
    if (hero.classList.contains("has-video")) return;
    cake.classList.remove("building");
    void cake.offsetWidth; // restart animations
    cake.classList.add("building");
  }, 10000);
}

// ----- Menu cards -----
function card(product, slug, name, extraButtons = "") {
  const p = PRODUCTS[product];
  const fig = document.createElement("figure");
  fig.className = "flavor";
  fig.innerHTML = `<img src="${p.img(slug)}" alt="${name} ${p.short.toLowerCase()}" loading="lazy" />
    ${extraButtons || `<button class="add" data-p="${product}" data-f="${slug}">+ Add</button>`}`;
  return fig;
}

const cupGrid = $('[data-menu="cupcakes"]');
FLAVORS.forEach(([s, n]) => cupGrid.append(card("cupcake", s, n)));
const any = document.createElement("figure");
any.className = "flavor any";
any.innerHTML = `<div><div class="cup">🧁</div><p>Or any flavor<br />that's not listed!</p><a href="#order">Request it ♡</a></div>`;
cupGrid.append(any);

const brGrid = $('[data-menu="brownies"]');
PRODUCTS.brownie.flavors.forEach(([s, n]) => {
  const isLoaded = PRODUCTS.loaded.flavors.some(([ls]) => ls === s);
  const btns = isLoaded
    ? `<span class="loaded">Loaded available</span>
       <button class="add" data-p="brownie" data-f="${s}" style="top:2.4rem">+ Regular $4</button>
       <button class="add" data-p="loaded" data-f="${s}" style="top:4.8rem">+ Loaded $6</button>`
    : "";
  brGrid.append(card("brownie", s, n, btns));
});

const miniGrid = $('[data-menu="minicakes"]');
FLAVORS.forEach(([s, n]) => miniGrid.append(card("mini", s, n)));

// ----- Cart -----
let cart = [];
try { cart = JSON.parse(localStorage.getItem("caked-cart")) || []; } catch {}
const save = () => { try { localStorage.setItem("caked-cart", JSON.stringify(cart)); } catch {} };

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

function addToCart(product, flavor, qty = 1) {
  const line = cart.find((l) => l.p === product && l.f === flavor);
  if (line) line.q += qty; else cart.push({ p: product, f: flavor, q: qty });
  renderCart();
  toast(`Added ${qty} ${flavorName(product, flavor)} ${PRODUCTS[product].short}${qty > 1 ? "s" : ""} ♡`);
}

function totals() {
  const counts = {};
  cart.forEach((l) => (counts[l.p] = (counts[l.p] || 0) + l.q));
  let sum = 0;
  for (const [p, n] of Object.entries(counts)) sum += bestPrice(PRODUCTS[p].tiers, n);
  return { sum, count: cart.reduce((a, l) => a + l.q, 0) };
}

function renderCart() {
  const ul = $("#cart");
  ul.innerHTML = "";
  if (!cart.length) {
    ul.innerHTML = `<li class="empty">Tap <b>+ Add</b> on any treat above, or add it here.</li>`;
  }
  cart.forEach((l, i) => {
    const p = PRODUCTS[l.p];
    const li = document.createElement("li");
    const img = l.f === CUSTOM[0] ? "" : `<img src="${p.img(l.f)}" alt="" />`;
    li.innerHTML = `${img}<span class="name">${flavorName(l.p, l.f)}<small>${p.label}</small></span>
      <span class="qty"><button type="button" data-i="${i}" data-d="-1" aria-label="Fewer">−</button><span>${l.q}</span><button type="button" data-i="${i}" data-d="1" aria-label="More">+</button></span>
      <button type="button" class="rm" data-rm="${i}" aria-label="Remove">✕</button>`;
    ul.append(li);
  });
  const { sum, count } = totals();
  $("#total").textContent = money(sum);
  const nc = $("#navCount");
  nc.hidden = !count;
  nc.textContent = count;
  save();
}

$("#cart").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.rm) cart.splice(+b.dataset.rm, 1);
  else {
    const l = cart[+b.dataset.i];
    l.q += +b.dataset.d;
    if (l.q < 1) cart.splice(+b.dataset.i, 1);
  }
  renderCart();
});

document.addEventListener("click", (e) => {
  const b = e.target.closest(".flavor .add");
  if (b) addToCart(b.dataset.p, b.dataset.f);
});

// Add row selects
const itemSel = $("#addItem"), flavorSel = $("#addFlavor");
Object.entries(PRODUCTS).forEach(([k, p]) => itemSel.add(new Option(p.label, k)));
function fillFlavors() {
  flavorSel.innerHTML = "";
  const list = [...PRODUCTS[itemSel.value].flavors];
  if (itemSel.value === "cupcake" || itemSel.value === "mini") list.push(CUSTOM);
  list.forEach(([s, n]) => flavorSel.add(new Option(n, s)));
}
itemSel.addEventListener("change", fillFlavors);
fillFlavors();
$("#addBtn").addEventListener("click", () => {
  const q = Math.max(1, parseInt($("#addQty").value, 10) || 1);
  addToCart(itemSel.value, flavorSel.value, q);
  $("#addQty").value = 1;
});

renderCart();

// ----- Submit: text the order -----
$("#orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const d = Object.fromEntries(new FormData(f));
  const msg = $("#formMsg");
  if (!d.name || !d.date) { msg.textContent = "Please add your name and pickup date ♡"; return; }
  if (!cart.length && !d.notes.trim()) { msg.textContent = "Add a treat or describe your custom order ♡"; return; }

  const lines = cart.map((l) => `• ${l.q} × ${flavorName(l.p, l.f)} ${PRODUCTS[l.p].short}${l.q > 1 ? "s" : ""}`);
  const text = [
    `Hi Mone'T! New order from ${d.name} 🧁`,
    `Date needed: ${d.date}`,
    ...(lines.length ? ["", ...lines, `Est. total: ${money(totals().sum)}`] : []),
    ...(d.notes.trim() ? ["", `Notes: ${d.notes.trim()}`] : []),
  ].join("\n");

  const isPhone = matchMedia("(pointer: coarse)").matches;
  if (isPhone) {
    location.href = `sms:${CONFIG.phone}?&body=${encodeURIComponent(text)}`;
    msg.textContent = "Opening your messages… just hit send ♡";
  } else {
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = `Order copied! Text or DM it to ${CONFIG.phoneDisplay} ♡`;
    } catch {
      msg.textContent = `Text your order to ${CONFIG.phoneDisplay} ♡`;
    }
  }
});

// ----- Toast -----
let toastTimer;
function toast(t) {
  const el = $("#toast");
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
