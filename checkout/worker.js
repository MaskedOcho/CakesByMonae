// Cake'd By Mone'T checkout helper (Cloudflare Worker).
//
// POST /checkout  customer's order -> Stripe Checkout for the deposit (priced here from menu.js, never from the browser)
// GET  /order     ?session=cs_...  -> is the deposit paid? + the order as stored with Stripe
// POST /balance   (Mone'T, needs ADMIN_KEY) -> one-time Stripe payment link for the remaining balance
// POST /refund    (Mone'T, needs ADMIN_KEY) -> refund the deposit in full when she declines
import { CONFIG, PRODUCTS, CUSTOM, HOLIDAY, cartTotal, lineText, encodeOrder, decodeOrder } from "./menu.gen.mjs";

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const { pathname, searchParams } = new URL(req.url);
      let out;
      if (req.method === "POST" && pathname === "/checkout") out = await checkout(await body(req), env);
      else if (req.method === "GET" && pathname === "/order") out = await order(searchParams.get("session"), env);
      else if (req.method === "POST" && pathname === "/balance") out = await balance(await body(req), env);
      else if (req.method === "POST" && pathname === "/refund") out = await refund(await body(req), env);
      else throw new HttpError(404, "Not found");
      return json(out, 200, cors);
    } catch (e) {
      return json({ error: e instanceof HttpError ? e.message : "Something went wrong. Please try again." }, e.status || 500, cors);
    }
  },
};

// ----- Customer: start the deposit payment -----
async function checkout(input, env) {
  const o = cleanOrder(input, env);
  if (!o.i.length) throw new HttpError(400, "Add a treat from the menu to pay a deposit");
  const total = cartTotal(o.i.map(([p, f, q]) => ({ p, f, q })));
  const depositCents = Math.round(total * CONFIG.depositPercent); // total in dollars * pct% = cents
  if (depositCents < 50) throw new HttpError(400, "Order total is too small for a card deposit");

  const code = orderCode();
  const items = o.i.map(([p, f, q]) => lineText({ p, f, q })).join(", ");
  const meta = { order_code: code, customer: o.n, pickup: `${o.d} ${o.t}`, items: items.slice(0, 500), ...chunks(encodeOrder(o)) };
  const session = await stripe(env, "checkout/sessions", {
    mode: "payment",
    customer_email: o.e,
    client_reference_id: code,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: depositCents,
        product_data: { name: `${CONFIG.depositPercent}% deposit: Cake'd By Mone'T order ${code}`, description: items.slice(0, 1000) },
      },
    }],
    payment_intent_data: { description: `Deposit, order ${code}: ${items}`.slice(0, 1000), metadata: meta },
    metadata: meta,
    success_url: `${env.SITE_URL}/?paid={CHECKOUT_SESSION_ID}#order`,
    cancel_url: `${env.SITE_URL}/?canceled=1#order`,
  });
  return { url: session.url };
}

// ----- Anyone with the session id (the customer's return link, Mone'T's review link) -----
async function order(sessionId, env) {
  const s = await getSession(sessionId, env);
  if (s.payment_status !== "paid") return { paid: false };
  const o = decodeOrder(unchunk(s.metadata));
  const charge = s.payment_intent?.latest_charge;
  return {
    paid: true,
    code: s.metadata.order_code,
    order: o,
    total: cartTotal(o.i.map(([p, f, q]) => ({ p, f, q }))),
    deposit: s.amount_total / 100,
    refunded: (charge?.amount_refunded || 0) / 100,
  };
}

// ----- Mone'T: remaining balance link -----
async function balance(input, env) {
  admin(input, env);
  const s = await getSession(input.session, env);
  if (s.payment_status !== "paid") throw new HttpError(400, "The deposit for this order isn't paid");
  const cents = Math.round(Number(input.amount) * 100);
  if (!(cents >= 50 && cents <= 1_000_000)) throw new HttpError(400, "Balance must be between $0.50 and $10,000");
  const code = s.metadata.order_code;
  const price = await stripe(env, "prices", {
    currency: "usd",
    unit_amount: cents,
    product_data: { name: `Remaining balance: Cake'd By Mone'T order ${code}` },
  });
  const link = await stripe(env, "payment_links", {
    line_items: [{ price: price.id, quantity: 1 }],
    restrictions: { completed_sessions: { limit: 1 } }, // link stops working once it's paid
    metadata: { order_code: code, deposit_session: s.id },
    payment_intent_data: { description: `Balance, order ${code}`, metadata: { order_code: code } },
  });
  return { url: link.url };
}

// ----- Mone'T: decline = full deposit refund -----
async function refund(input, env) {
  admin(input, env);
  const s = await getSession(input.session, env);
  const pi = s.payment_intent?.id;
  if (s.payment_status !== "paid" || !pi) throw new HttpError(400, "The deposit for this order isn't paid");
  if (s.payment_intent.latest_charge?.refunded) return { refunded: s.amount_total / 100, already: true };
  const r = await stripe(env, "refunds", { payment_intent: pi, metadata: { order_code: s.metadata.order_code, reason: "declined" } },
    { "Idempotency-Key": `refund-${pi}` });
  return { refunded: r.amount / 100, status: r.status };
}

// ----- Helpers -----
function cleanOrder(input, env) {
  const s = (v, max) => String(v ?? "").trim().slice(0, max);
  const o = { n: s(input.n, 80), ph: s(input.ph, 30), e: s(input.e, 120), d: s(input.d, 10), t: s(input.t, 5), no: s(input.no, 1000), r: input.r ? 1 : 0, i: [] };
  if (!o.n || !o.ph || !o.t || !/^\S+@\S+\.\S+$/.test(o.e) || !/^\d{4}-\d{2}-\d{2}$/.test(o.d)) {
    throw new HttpError(400, "Please add your name, phone, email, pickup date and time");
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: env.TIME_ZONE || "America/New_York" });
  if (o.d < today) throw new HttpError(400, "That pickup date has already passed");
  for (const line of (Array.isArray(input.i) ? input.i : []).slice(0, 50)) {
    const [p, f, q] = Array.isArray(line) ? line : [];
    const prod = PRODUCTS[p];
    if (!prod || !Object.hasOwn(PRODUCTS, p)) throw new HttpError(400, "Something in your order isn't on the menu anymore");
    if (f !== CUSTOM[0] && !prod.flavors.some(([slug]) => slug === f)) throw new HttpError(400, "One of those flavors isn't available");
    if (prod.holiday && today > HOLIDAY.ends) throw new HttpError(400, "The holiday specials have ended. Please remove them from your order");
    o.i.push([p, f, Math.min(500, Math.max(1, Math.floor(Number(q)) || 1))]);
  }
  return o;
}

function admin(input, env) {
  const a = String(input?.key ?? ""), b = String(env.ADMIN_KEY ?? "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  if (!b || diff) throw new HttpError(401, "Wrong passcode");
}

async function getSession(id, env) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(id))) throw new HttpError(400, "Missing or invalid order link");
  return stripe(env, `checkout/sessions/${id}?expand[]=payment_intent.latest_charge`, null, {}, "GET");
}

async function stripe(env, path, params, headers = {}, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_KEY}`, ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...headers },
    body: params ? new URLSearchParams(flatten(params)) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.log("Stripe error", path, data.error?.message);
    throw new HttpError(res.status === 404 ? 404 : 502, res.status === 404 ? "Order not found" : "Payment service error. Please try again.");
  }
  return data;
}

// { a: { b: [ { c: 1 } ] } } -> { "a[b][0][c]": "1" }  (Stripe's form encoding)
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") flatten(v, key, out); else out[key] = String(v);
  }
  return out;
}

// Stripe metadata values max out at 500 characters, so the full order is split across keys
function chunks(str) {
  const out = {};
  for (let i = 0; i * 490 < str.length; i++) out[`order_${i}`] = str.slice(i * 490, (i + 1) * 490);
  return out;
}
function unchunk(meta) {
  let s = "";
  for (let i = 0; meta[`order_${i}`]; i++) s += meta[`order_${i}`];
  return s;
}

function orderCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => abc[b % abc.length]).join("");
}

async function body(req) {
  try { return await req.json(); } catch { throw new HttpError(400, "Bad request"); }
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
