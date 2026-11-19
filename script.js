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

const MIN = CONFIG.minPerCategory;
const catCount = (product) => categoryCounts(cart)[PRODUCTS[product].cat] || 0;

// The first add in a category starts at the minimum, so nobody can pick fewer than 6
function addToCart(product, flavor, qty = 1) {
  const first = catCount(product) === 0 && qty < MIN;
  if (first) qty = MIN;
  const line = cart.find((l) => l.p === product && l.f === flavor);
  if (line) line.q += qty; else cart.push({ p: product, f: flavor, q: qty });
  renderCart();
  toast(`Added ${qty} ${flavorName(product, flavor)} ${PRODUCTS[product].short}${qty > 1 ? "s" : ""}${first ? ` (${MIN} minimum)` : ""} ♡`);
}

function totals() {
  return { sum: cartTotal(cart), count: cart.reduce((a, l) => a + l.q, 0) };
}

function renderCart() {
  const ul = $("#cart");
  ul.innerHTML = "";
  if (!cart.length) {
    ul.innerHTML = `<li class="empty">Tap <b>+ Add</b> on any treat above, or add it here.</li>`;
  }
  const counts = categoryCounts(cart);
  cart.forEach((l, i) => {
    const p = PRODUCTS[l.p];
    const li = document.createElement("li");
    const img = l.f === CUSTOM[0] ? "" : `<img src="${p.img(l.f)}" alt="" />`;
    // − can't take a category below the minimum; ✕ removes the whole line
    const left = counts[p.cat] - 1;
    const atMin = left > 0 && left < MIN;
    li.innerHTML = `${img}<span class="name">${flavorName(l.p, l.f)}<small>${p.label}</small></span>
      <span class="qty"><button type="button" data-i="${i}" data-d="-1" aria-label="Fewer"${atMin ? " disabled" : ""}>−</button><span>${l.q}</span><button type="button" data-i="${i}" data-d="1" aria-label="More">+</button></span>
      <button type="button" class="rm" data-rm="${i}" aria-label="Remove">✕</button>`;
    ul.append(li);
  });
  const short = minimumProblems(cart);
  $("#minNote").hidden = !short.length;
  $("#minNote").textContent = short.join(" · ");
  const { sum, count } = totals();
  $("#total").textContent = money(sum);
  $("#payNote").textContent = sum ? payText(sum, isCustomOrder(cart)) : "";
  const nc = $("#navCount");
  nc.hidden = !count;
  nc.textContent = count;
  save();
  fillQty();
}

$("#cart").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.rm) cart.splice(+b.dataset.rm, 1);
  else {
    const l = cart[+b.dataset.i];
    const d = +b.dataset.d;
    const left = catCount(l.p) + d;
    if (d < 0 && left > 0 && left < MIN) { toast(`Minimum ${MIN} ${CATEGORIES[PRODUCTS[l.p].cat]}. Tap ✕ to remove ♡`); return; }
    l.q += d;
    if (l.q < 1) cart.splice(+b.dataset.i, 1);
  }
  renderCart();
});

function payText(total, custom) {
  const plan = paymentPlan(total, custom);
  return plan.deposit
    ? `${custom ? "Custom order" : `Order of $${CONFIG.fullPayUnder}+`}: ${CONFIG.depositPercent}% non-refundable deposit (about ${cents(plan.due)}) to confirm, balance at pickup.`
    : `Orders under $${CONFIG.fullPayUnder} are paid in full to confirm.`;
}

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
// Quantity box starts at 6 for a category that isn't in the cart yet
function fillQty() {
  const min = catCount(itemSel.value) ? 1 : MIN;
  $("#addQty").min = min;
  $("#addQty").value = min;
}
itemSel.addEventListener("change", () => { fillFlavors(); fillQty(); });
fillFlavors();
$("#addBtn").addEventListener("click", () => {
  const q = Math.max(+$("#addQty").min, parseInt($("#addQty").value, 10) || 0);
  addToCart(itemSel.value, flavorSel.value, q);
  fillQty();
});

renderCart();

// ----- Booking: request -> Mone'T approves -> Stripe payment link -----
const orderForm = $("#orderForm");
const msg = $("#formMsg");
const dateInput = orderForm.elements.date;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = isoDate(new Date());
const noRush = new Date();
noRush.setDate(noRush.getDate() + CONFIG.noticeDays);
dateInput.min = today;
const isRush = (date) => date < isoDate(noRush);
const rushText = `Rush order (under ${CONFIG.noticeDays} days' notice)`;
$("#noticeNote").textContent = `Nothing is charged yet. Mone'T reviews your request, then sends your payment link. Your order is confirmed once your payment is verified.`;
$("#rushNote").textContent = `${rushText}: Mone'T may add a rush fee and will confirm your final price before you pay ♡`;
dateInput.addEventListener("input", () => {
  $("#rushNote").hidden = !dateInput.value || !isRush(dateInput.value);
});

const readForm = () => {
  const d = Object.fromEntries(new FormData(orderForm));
  for (const k in d) d[k] = d[k].trim();
  return d;
};

function problem(d, full = true) {
  if (!d.name || !d.date || (full && (!d.phone || !d.email || !d.time))) {
    return full ? "Please add your name, phone, email, pickup date and time ♡" : "Please add your name and pickup date ♡";
  }
  if (full && !/^\S+@\S+\.\S+$/.test(d.email)) return "That email doesn't look right ♡";
  if (d.date < today) return "That date has already passed. Please pick another day ♡";
  const day = new Date(d.date + "T12:00").getDay();
  if (CONFIG.closedDays.includes(day)) return `Mone'T doesn't bake on ${DAYS[day]}s. Please pick another day ♡`;
  if (!cart.length && !d.notes) return "Add a treat or describe your custom order ♡";
  const short = minimumProblems(cart);
  if (short.length) return `${short.join(". ")} ♡`;
  if (full && !orderForm.elements.agree.checked) return "Please check that you've read the ordering policies ♡";
  return "";
}

// FormNX link with everything filled in, plus a private review link for Mone'T
function requestLink(d) {
  const F = CONFIG.formFields;
  const review = new URL("review.html", location.href);
  review.hash = encodeOrder({ n: d.name, ph: d.phone, e: d.email, d: d.date, t: d.time, no: d.notes, r: isRush(d.date) ? 1 : 0, i: cart.map((l) => [l.p, l.f, l.q]) });
  const url = new URL(CONFIG.formUrl);
  const params = {
    [F.name]: d.name, [F.phone]: d.phone, [F.email]: d.email, [F.date]: d.date, [F.time]: prettyTime(d.time),
    [F.details]: [...(isRush(d.date) ? [rushText] : []), ...(cart.length ? cart.map(lineText) : ["Custom order (see notes)"])].join("\n"),
    [F.total]: totals().sum, [F.notes]: d.notes,
    [F.review]: review.href,
  };
  for (const [k, v] of Object.entries(params)) if (k && v !== "") url.searchParams.set(k, v);
  return url.href;
}

// Send the request to the Google Sheet backend. Status starts as "Received".
async function sendToBackend(d) {
  const submit = orderForm.querySelector('[type="submit"]');
  submit.disabled = true;
  msg.textContent = "Sending your request…";
  try {
    const res = await fetch(CONFIG.ordersApi, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // keeps it a simple request for Apps Script
      body: JSON.stringify({
        action: "create",
        order: {
          name: d.name, phone: d.phone, email: d.email, date: d.date, time: d.time, timeText: prettyTime(d.time), notes: d.notes,
          rush: isRush(d.date), custom: isCustomOrder(cart), estimate: totals().sum,
          items: cart.map((l) => [l.p, l.f, l.q]), lines: cart.map(lineText),
        },
      }),
    });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "failed");
    cart = [];
    orderForm.reset();
    fillFlavors();
    renderCart();
    $("#rushNote").hidden = true;
    out.id = String(out.id).replace(/[^A-Za-z0-9-]/g, "");
    const status = new URL(`status.html#${out.id}`, location.href).href;
    msg.innerHTML = `Request received! Your order number is <b>${out.id}</b>. Check your email. Mone'T will send your payment link after she reviews it. <a href="${status}">Track your order ♡</a>`;
  } catch (err) {
    msg.textContent = `Something went wrong sending your request. Please text your order to ${CONFIG.phoneDisplay} ♡`;
  } finally {
    submit.disabled = false;
  }
}

const dialog = $("#requestDialog");
orderForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const d = readForm();
  const err = problem(d);
  if (err) { msg.textContent = err; return; }
  msg.textContent = "";
  if (CONFIG.ordersApi) { sendToBackend(d); return; }
  const link = requestLink(d);
  $("#requestFrame").src = link;
  $("#requestTab").href = link;
  dialog.showModal();
});
$("#requestClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  $("#requestFrame").src = "about:blank";
  msg.textContent = "Once you tap Submit on the form, Mone'T will review your request and reach out ♡";
});

// Prefer to text? Same order as a message
$("#textBtn").addEventListener("click", async () => {
  const d = readForm();
  const err = problem(d, false);
  if (err) { msg.textContent = err; return; }

  const lines = cart.map((l) => `• ${lineText(l)}`);
  const text = [
    `Hi Mone'T! New order from ${d.name} 🧁`,
    `Date needed: ${d.date}${d.time ? ` at ${prettyTime(d.time)}` : ""}`,
    ...(isRush(d.date) ? [rushText] : []),
    ...(lines.length ? ["", ...lines, `Est. total: ${money(totals().sum)}`] : []),
    ...(d.notes ? ["", `Notes: ${d.notes}`] : []),
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
