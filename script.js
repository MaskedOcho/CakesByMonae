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

// ----- Thanksgiving specials -----
// Shown through the end of HOLIDAY.ends (local time), then the section, nav link and order options disappear.
const holidayEnd = new Date(HOLIDAY.ends + "T00:00");
holidayEnd.setDate(holidayEnd.getDate() + 1); // midnight after the last day
const holidayOn = new Date() < holidayEnd;
const OTHER_FLAVOR = [CUSTOM[0], "Other flavor (+$5, see notes)"];
if (!holidayOn) {
  document.querySelectorAll("[data-holiday]").forEach((el) => el.remove());
} else {
  document.querySelectorAll(".holiday-item select[data-flavors]").forEach((sel) => {
    [...HOLIDAY_FLAVORS, OTHER_FLAVOR].forEach(([s, n]) => sel.add(new Option(n, s)));
  });
  $("#thanksgiving").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const flavor = b.closest(".holiday-item").querySelector("select").value;
    addToCart(b.dataset.add, flavor);
    if (flavor === CUSTOM[0]) toast("Added ♡ Tell Mone'T your flavor in the order notes");
  });
}

// ----- Cart -----
let cart = [];
try { cart = JSON.parse(localStorage.getItem("caked-cart")) || []; } catch {}
cart = cart.filter((l) => PRODUCTS[l.p] && (holidayOn || !PRODUCTS[l.p].holiday)); // drop specials once they end
const save = () => { try { localStorage.setItem("caked-cart", JSON.stringify(cart)); } catch {} };

function addToCart(product, flavor, qty = 1) {
  const line = cart.find((l) => l.p === product && l.f === flavor);
  if (line) line.q += qty; else cart.push({ p: product, f: flavor, q: qty });
  renderCart();
  toast(`Added ${qty} ${flavorName(product, flavor)} ${shortName(product, qty)} ♡`);
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
  updateSubmit();
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
Object.entries(PRODUCTS).forEach(([k, p]) => { if (!p.holiday || holidayOn) itemSel.add(new Option(p.label, k)); });
function fillFlavors() {
  flavorSel.innerHTML = "";
  const p = PRODUCTS[itemSel.value];
  const list = [...p.flavors];
  if (p.holiday) list.push(OTHER_FLAVOR);
  else if (itemSel.value === "cupcake" || itemSel.value === "mini") list.push(CUSTOM);
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

// ----- Booking -----
// With CONFIG.checkoutUrl set: order -> customer pays the deposit on Stripe -> back here -> FormNX request
//   -> Mone'T accepts (sends a balance link) or declines (refunds the deposit) from review.html.
// Without it, or for a custom-only request with nothing in the cart: a free request, no deposit.
const orderForm = $("#orderForm");
const msg = $("#formMsg");
const submitBtn = orderForm.querySelector('[type="submit"]');
const dateInput = orderForm.elements.date;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = isoDate(new Date());
const noRush = new Date();
noRush.setDate(noRush.getDate() + CONFIG.noticeDays);
dateInput.min = today;
const isRush = (date) => date < isoDate(noRush);
const rushText = `Rush order (under ${CONFIG.noticeDays} days' notice)`;
const payOn = Boolean(CONFIG.checkoutUrl);
$("#noticeNote").textContent = payOn
  ? `To send your order you'll pay a ${CONFIG.depositPercent}% deposit by card through Stripe. If Mone'T can't take your order, your deposit is refunded in full. Once she accepts, she'll send you a link for the remaining balance. Deposits are non-refundable once your order is accepted.`
  : `Mone'T reviews every request before anything is charged, then texts or emails you a secure Stripe link for your ${CONFIG.depositPercent}% deposit. Deposits are non-refundable.`;
$("#rushNote").textContent = payOn
  ? `${rushText}: Mone'T may add a rush fee to your remaining balance ♡`
  : `${rushText}: Mone'T may add a rush fee and will confirm your final price before you pay ♡`;
if (payOn) $("#textBtn").style.display = "none"; // every menu order goes through the deposit
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
  return "";
}

// Compact order, the same shape the review link and the checkout helper use
const toOrder = (d) => ({ n: d.name, ph: d.phone, e: d.email, d: d.date, t: d.time, no: d.notes, r: isRush(d.date) ? 1 : 0, i: cart.map((l) => [l.p, l.f, l.q]) });

// FormNX link with everything filled in, plus a private review link for Mone'T
function requestLink(o, paid) {
  const F = CONFIG.formFields;
  const lines = o.i.map(([p, f, q]) => ({ p, f, q }));
  const review = new URL("review.html", location.href);
  review.hash = encodeOrder(paid ? { ...o, s: paid.session } : o);
  const details = [
    ...(paid ? [`DEPOSIT PAID: ${dollars(paid.deposit)} (order ${paid.code})`] : []),
    ...(o.r ? [rushText] : []),
    ...(lines.length ? lines.map(lineText) : ["Custom order (see notes)"]),
  ].join("\n");
  const url = new URL(CONFIG.formUrl);
  const params = {
    [F.name]: o.n, [F.phone]: o.ph, [F.email]: o.e, [F.date]: o.d, [F.time]: prettyTime(o.t),
    [F.details]: details, [F.total]: cartTotal(lines), [F.notes]: o.no, [F.review]: review.href,
  };
  for (const [k, v] of Object.entries(params)) if (k && v !== "" && v != null) url.searchParams.set(k, v);
  return url.href;
}

const dialog = $("#requestDialog");
let paidCode = "";
function openRequest(link, title = "Almost done! Check your info and tap Submit ♡") {
  $("#requestTitle").textContent = title;
  $("#requestFrame").src = link;
  $("#requestTab").href = link;
  dialog.showModal();
}
$("#requestClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  $("#requestFrame").src = "about:blank";
  if (!paidCode) {
    msg.textContent = "Once you tap Submit on the form, Mone'T will review your request and reach out ♡";
    return;
  }
  msg.innerHTML = `Thank you! Mone'T will review order <b>${paidCode}</b> and send your confirmation ♡<br />Didn't tap Submit? <button type="button" class="link-btn" id="reopenBtn">Reopen the form</button>`;
  $("#reopenBtn").addEventListener("click", () => {
    $("#requestFrame").src = $("#requestTab").href;
    dialog.showModal();
  });
});

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = readForm();
  const err = problem(d);
  if (err) { msg.textContent = err; return; }
  msg.textContent = "";
  const o = toOrder(d);
  if (!payOn || !o.i.length) return openRequest(requestLink(o));

  submitBtn.disabled = true;
  msg.textContent = "Taking you to secure checkout…";
  try {
    const res = await fetch(`${CONFIG.checkoutUrl}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) throw new Error(j.error || "Checkout isn't available right now");
    location.href = j.url;
  } catch (er) {
    msg.textContent = `${er.message}. Please try again, or call/text ${CONFIG.phoneDisplay} ♡`;
    submitBtn.disabled = false;
  }
});
addEventListener("pageshow", () => { submitBtn.disabled = false; }); // back from Stripe with the back button

// Back from Stripe: confirm the deposit, then send the order to Mone'T
const back = new URLSearchParams(location.search);
if (back.get("canceled")) msg.textContent = "Checkout canceled. Your order wasn't sent and you weren't charged ♡";
if (payOn && back.get("paid")) finishPaid(back.get("paid"));
async function finishPaid(session) {
  msg.textContent = "Confirming your deposit…";
  try {
    const res = await fetch(`${CONFIG.checkoutUrl}/order?session=${encodeURIComponent(session)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error);
    if (!j.paid) {
      msg.textContent = `We couldn't confirm your deposit yet. If you were charged, call/text ${CONFIG.phoneDisplay} ♡`;
      return;
    }
    cart = [];
    renderCart();
    paidCode = j.code;
    openRequest(requestLink(j.order, { session, code: j.code, deposit: j.deposit }),
      `Deposit of ${dollars(j.deposit)} paid ✓ Last step: tap Submit to send order ${j.code} to Mone'T ♡`);
  } catch {
    msg.textContent = `We couldn't load your order. If you were charged, call/text ${CONFIG.phoneDisplay} ♡`;
  }
}

// When deposits are on, the submit button shows the deposit amount (called from renderCart)
function updateSubmit() {
  const b = document.querySelector('#orderForm [type="submit"]');
  if (!b || !CONFIG.checkoutUrl) return;
  b.textContent = cart.length ? `Pay ${dollars(cartTotal(cart) * CONFIG.depositPercent / 100)} Deposit & Send Order ♡` : "Send Custom Request ♡";
}

// Prefer to text? Same order as a message (hidden when deposits are on)
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
