/**
 * Cake'd By Mone'T: order backend (Google Apps Script, free).
 *
 * Saves every order request in the "Orders" sheet, tracks its status
 * (Received -> Pending Payment -> Confirmed, or Declined), emails customers,
 * and sends pickup reminders the day before. Setup steps: apps-script/SETUP.md
 */

// ===== Edit these =====
const SETTINGS = {
  SITE_URL: "https://cakedbymonet.com",
  BUSINESS: "Cake'd By Mone'T",
  PHONE: "386-965-2713",
  NOTIFY_EMAIL: "",        // where new-order alerts go. Empty = the Google account running this script
  PICKUP_INFO: "Mone'T will text you the pickup address. Call or text 386-965-2713 with any questions.",
  CASH_APP: "",            // e.g. "$CakedByMonet" to also offer Cash App. Empty = payment link only
  MIN_PER_CATEGORY: 6,     // keep these three the same as CONFIG in menu.js
  FULL_PAY_UNDER: 75,
  DEPOSIT_PERCENT: 50,
  REMINDER_HOUR: 9,        // reminders go out around this hour, the day before pickup
};
// ======================

const SHEET = "Orders";
const STATUS = { RECEIVED: "Received", PENDING: "Pending Payment", CONFIRMED: "Confirmed", DECLINED: "Declined" };
const CATEGORY = { cupcake: "cupcakes", brownie: "brownies", loaded: "brownies", mini: "mini cakes" };
const HEADERS = [
  "ID", "Created", "Status", "Name", "Phone", "Email", "Pickup Date", "Pickup Time", "Items", "Item Data", "Notes",
  "Rush", "Custom", "Estimate", "Total", "Rush Fee", "Payment Type", "Amount Due", "Balance At Pickup", "Payment Link",
  "Payment Requested At", "Amount Paid", "Payment Method", "Paid At", "Confirmation Sent", "Reminder Sent", "Declined At",
];

// ----- One-time setup: run this once from the editor -----
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat("@"); // keep dates and phones as plain text
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  const statusCol = HEADERS.indexOf("Status") + 1;
  sh.getRange(2, statusCol, sh.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.values(STATUS), true).build());

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_KEY")) props.setProperty("ADMIN_KEY", newId_(24));

  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "sendReminders").forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("sendReminders").timeBased().everyDays(1).atHour(SETTINGS.REMINDER_HOUR).create();

  Logger.log("Setup done. Mone'T's dashboard key: " + props.getProperty("ADMIN_KEY"));
}

// ----- Web app -----
function doGet(e) {
  const p = (e && e.parameter) || {};
  return handle_(() => {
    if (p.action === "status") return statusFor_(p.id);
    requireKey_(p.key);
    if (p.action === "list") return { orders: readAll_().map(adminView_).reverse() };
    if (p.action === "get") return { order: adminView_(mustFind_(p.id)) };
    throw new Error("Unknown action");
  });
}

function doPost(e) {
  return handle_(() => {
    const p = JSON.parse(e.postData.contents);
    if (p.action === "create") return createOrder_(p.order || {});
    requireKey_(p.key);
    if (p.action === "requestPayment") return requestPayment_(p);
    if (p.action === "markPaid") return markPaid_(p);
    if (p.action === "decline") return decline_(p);
    throw new Error("Unknown action");
  });
}

function handle_(fn) {
  let out;
  try { out = Object.assign({ ok: true }, fn()); } catch (err) { out = { ok: false, error: err.message }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function requireKey_(key) {
  if (!key || key !== PropertiesService.getScriptProperties().getProperty("ADMIN_KEY")) throw new Error("Wrong dashboard key");
}

// ----- Actions -----
function createOrder_(o) {
  const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 200);
  const name = clean(o.name, 80), phone = clean(o.phone, 30), email = clean(o.email, 120), date = clean(o.date, 10);
  if (!name || !phone || !email || !date) throw new Error("Missing name, phone, email or pickup date");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Bad email");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today_()) throw new Error("Bad pickup date");

  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 50)
    .filter((i) => Array.isArray(i) && CATEGORY[i[0]])
    .map((i) => [i[0], clean(i[1], 40), Math.max(1, Math.min(500, parseInt(i[2], 10) || 0))]);
  const notes = clean(o.notes, 2000);
  if (!items.length && !notes) throw new Error("Empty order");
  const counts = {};
  items.forEach((i) => (counts[CATEGORY[i[0]]] = (counts[CATEGORY[i[0]]] || 0) + i[2]));
  Object.keys(counts).forEach((c) => {
    if (counts[c] < SETTINGS.MIN_PER_CATEGORY) throw new Error("Minimum " + SETTINGS.MIN_PER_CATEGORY + " " + c);
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let order;
  try {
    const ids = readAll_().map((r) => r.ID);
    let id;
    do { id = "CM-" + newId_(6); } while (ids.indexOf(id) >= 0);
    order = {
      ID: id, Created: now_(), Status: STATUS.RECEIVED, Name: name, Phone: phone, Email: email,
      "Pickup Date": date, "Pickup Time": clean(o.timeText, 20),
      Items: (Array.isArray(o.lines) ? o.lines : []).map((l) => clean(l, 120)).join("\n") || "Custom order (see notes)",
      "Item Data": JSON.stringify(items), Notes: notes,
      Rush: o.rush ? "Yes" : "", Custom: o.custom || !items.length || items.some((i) => i[1] === "custom") ? "Yes" : "",
      Estimate: money_(Number(o.estimate) || 0),
    };
    save_(order);
  } finally {
    lock.releaseLock();
  }

  mail_(order.Email, "We got your order request ♡ (" + order.ID + ")", page_("Order request received",
    "<p>Hi " + esc_(first_(order)) + "! Thank you for your order request.</p>" +
    statusLine_(order) + details_(order) +
    "<p><b>Nothing is charged yet.</b> Mone'T will review your request and send your payment link. " +
    "Your order is <b>confirmed only after your payment is verified</b>.</p>" + policies_() + trackButton_(order)));

  mail_(SETTINGS.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
    "New order request: " + order.Name + ", " + prettyDate_(order["Pickup Date"]) + (order.Rush ? " (RUSH)" : ""),
    page_("New order request", details_(order) + "<p>Phone: " + esc_(order.Phone) + "<br>Email: " + esc_(order.Email) + "</p>" +
      button_(SETTINGS.SITE_URL + "/orders.html#" + order.ID, "Review & send payment request")), order.Email);

  return { id: order.ID };
}

function requestPayment_(p) {
  const o = mustFind_(p.id);
  if (o.Status !== STATUS.RECEIVED && o.Status !== STATUS.PENDING) throw new Error("This order is already " + o.Status);
  const link = String(p.payLink || "").trim();
  if (!link && !SETTINGS.CASH_APP) throw new Error("Add a payment link");
  if (link && !/^https:\/\//.test(link)) throw new Error("The payment link should start with https://");
  const price = Math.max(0, Number(p.total) || 0);
  const fee = Math.max(0, Number(p.rushFee) || 0);
  if (!price) throw new Error("Set the order price");
  const total = round_(price + fee);
  const custom = !!p.custom;
  const plan = plan_(total, custom);

  Object.assign(o, {
    Total: money_(total), "Rush Fee": fee ? money_(fee) : "", Custom: custom ? "Yes" : "",
    "Payment Type": plan.deposit ? SETTINGS.DEPOSIT_PERCENT + "% deposit" : "Paid in full",
    "Amount Due": money_(plan.due), "Balance At Pickup": money_(plan.balance),
    "Payment Link": link, "Payment Requested At": now_(), Status: STATUS.PENDING,
  });
  save_(o);

  mail_(o.Email, "Payment needed to confirm your order (" + o.ID + ")", page_("Your order is approved! One last step",
    "<p>Hi " + esc_(first_(o)) + "! Mone'T approved your order request.</p>" + statusLine_(o) + details_(o) +
    moneyTable_(o) + payButtons_(o) +
    "<p><b>Your order and pickup date are not confirmed until your payment is verified.</b> " +
    "You'll get a confirmation email once it is." + (plan.deposit ? " Deposits are non-refundable." : "") + "</p>" + trackButton_(o)));

  return { order: adminView_(o), text: smsPayment_(o) };
}

function markPaid_(p) {
  const o = mustFind_(p.id);
  if (o.Status !== STATUS.PENDING) throw new Error("Only orders waiting on payment can be confirmed (this one is " + o.Status + ")");
  const amount = round_(Number(p.amount) || 0);
  if (!amount) throw new Error("Enter the amount you received");
  Object.assign(o, {
    "Amount Paid": money_(amount), "Payment Method": String(p.method || "").slice(0, 40),
    "Paid At": now_(), Status: STATUS.CONFIRMED,
    "Balance At Pickup": money_(Math.max(0, round_(num_(o.Total) - amount))),
  });
  o["Confirmation Sent"] = mail_(o.Email, "Your order is confirmed! 🎉 (" + o.ID + ")", page_("Your order is confirmed! 🎉",
    "<p>Hi " + esc_(first_(o)) + "! Your payment was received and your order is officially confirmed.</p>" +
    statusLine_(o) + details_(o) + paymentStatus_(o) + pickup_(o) +
    "<p>You'll get a reminder the day before pickup. Thank you so much ♡ Mone'T</p>" + trackButton_(o))) ? now_() : "";
  save_(o);
  return { order: adminView_(o), text: smsConfirm_(o) };
}

function decline_(p) {
  const o = mustFind_(p.id);
  if (o.Status === STATUS.DECLINED) throw new Error("Already declined");
  o.Status = STATUS.DECLINED;
  o["Declined At"] = now_();
  save_(o);
  const message = String(p.message || "").trim() ||
    "Thank you so much for your order request! Unfortunately Mone'T isn't able to take this one. She'd love to bake for you another time ♡";
  mail_(o.Email, "Your " + SETTINGS.BUSINESS + " order request (" + o.ID + ")", page_("About your order request",
    "<p>Hi " + esc_(first_(o)) + ",</p><p>" + esc_(message).replace(/\n/g, "<br>") + "</p>"));
  return { order: adminView_(o), text: "Hi " + first_(o) + ", " + message };
}

// ----- Daily reminders (runs automatically from the trigger setup() made) -----
function sendReminders() {
  const tomorrow = Utilities.formatDate(new Date(Date.now() + 864e5), tz_(), "yyyy-MM-dd");
  const due = readAll_().filter((o) => o.Status === STATUS.CONFIRMED && o["Pickup Date"] === tomorrow && !o["Reminder Sent"]);
  due.forEach((o) => {
    const sent = mail_(o.Email, "Pickup reminder: tomorrow" + (o["Pickup Time"] ? " at " + o["Pickup Time"] : "") + " ♡",
      page_("See you tomorrow! 🧁", "<p>Hi " + esc_(first_(o)) + "! Just a reminder that your order is ready for pickup tomorrow.</p>" +
        details_(o) + paymentStatus_(o) + pickup_(o)));
    if (sent) { o["Reminder Sent"] = now_(); save_(o); }
  });
  if (due.length) {
    mail_(SETTINGS.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(), "Tomorrow's pickups (" + due.length + ")",
      page_("Tomorrow's pickups", due.map((o) => details_(o) + "<p>" + esc_(o.Name) + " · " + esc_(o.Phone) +
        (num_(o["Balance At Pickup"]) > 0 ? " · <b>collect " + esc_(o["Balance At Pickup"]) + "</b>" : " · paid in full") +
        "<br>Reminder email " + (o["Reminder Sent"] ? "sent ✓" : "NOT sent, text them") + "</p><hr>").join("")));
  }
}

// ----- Views -----
function statusFor_(id) {
  const o = find_(String(id || "").trim().toUpperCase());
  if (!o) throw new Error("Order not found");
  const view = {
    id: o.ID, status: o.Status, first: first_(o), date: o["Pickup Date"], dateText: prettyDate_(o["Pickup Date"]), time: o["Pickup Time"],
    items: o.Items, estimate: o.Estimate, total: o.Total, rushFee: o["Rush Fee"], paymentType: o["Payment Type"],
    due: o["Amount Due"], balance: o["Balance At Pickup"], paid: o["Amount Paid"],
  };
  if (o.Status === STATUS.PENDING) { view.payLink = o["Payment Link"]; view.cashApp = SETTINGS.CASH_APP; }
  if (o.Status === STATUS.CONFIRMED) view.pickupInfo = SETTINGS.PICKUP_INFO;
  return { order: view };
}

function adminView_(o) {
  const v = {};
  HEADERS.forEach((h) => (v[h] = o[h] || ""));
  try { v.items = JSON.parse(o["Item Data"] || "[]"); } catch (e) { v.items = []; }
  v.dateText = prettyDate_(o["Pickup Date"]);
  return v;
}

// ----- Email pieces -----
function page_(title, body) {
  return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222;line-height:1.5">' +
    '<h2 style="color:#e0218a;margin-bottom:4px">' + esc_(title) + "</h2>" + body +
    '<p style="color:#888;font-size:13px;margin-top:24px">' + esc_(SETTINGS.BUSINESS) + " · " + esc_(SETTINGS.PHONE) + "</p></div>";
}
function statusLine_(o) {
  const steps = [STATUS.RECEIVED, STATUS.PENDING, STATUS.CONFIRMED];
  return '<p style="margin:12px 0">Order <b>' + esc_(o.ID) + "</b> · Status: " + steps.map((s) =>
    s === o.Status ? '<b style="background:#e0218a;color:#fff;padding:2px 8px;border-radius:10px">' + s + "</b>" : '<span style="color:#aaa">' + s + "</span>"
  ).join(" → ") + "</p>";
}
function details_(o) {
  return '<table style="border-collapse:collapse;margin:10px 0">' +
    row_("Order", esc_(o.Items).replace(/\n/g, "<br>")) +
    (o.Notes ? row_("Notes", esc_(o.Notes).replace(/\n/g, "<br>")) : "") +
    row_("Pickup", esc_(prettyDate_(o["Pickup Date"]) + (o["Pickup Time"] ? " at " + o["Pickup Time"] : ""))) + "</table>";
}
function moneyTable_(o) {
  return '<table style="border-collapse:collapse;margin:10px 0">' +
    (o["Rush Fee"] ? row_("Rush fee", esc_(o["Rush Fee"])) : "") + row_("Total", esc_(o.Total)) +
    row_(o["Payment Type"] === "Paid in full" ? "Due now (paid in full)" : "Due now (" + esc_(o["Payment Type"]) + ")", "<b>" + esc_(o["Amount Due"]) + "</b>") +
    (num_(o["Balance At Pickup"]) > 0 ? row_("Balance due at pickup", esc_(o["Balance At Pickup"])) : "") + "</table>";
}
function paymentStatus_(o) {
  const bal = num_(o["Balance At Pickup"]);
  return '<table style="border-collapse:collapse;margin:10px 0">' + row_("Total", esc_(o.Total)) +
    row_("Payment", bal > 0 ? "Deposit paid: <b>" + esc_(o["Amount Paid"]) + "</b>" : "<b>Paid in full</b> (" + esc_(o["Amount Paid"]) + ")") +
    (bal > 0 ? row_("Due at pickup", "<b>" + esc_(o["Balance At Pickup"]) + "</b>") : "") + "</table>";
}
function pickup_(o) {
  return "<p><b>Pickup:</b> " + esc_(prettyDate_(o["Pickup Date"]) + (o["Pickup Time"] ? " at " + o["Pickup Time"] : "")) +
    "<br>" + esc_(SETTINGS.PICKUP_INFO) + "</p>";
}
function payButtons_(o) {
  return (o["Payment Link"] ? button_(o["Payment Link"], "Pay " + o["Amount Due"] + " securely") : "") +
    (SETTINGS.CASH_APP ? "<p>Or Cash App <b>" + esc_(o["Amount Due"]) + "</b> to <b>" + esc_(SETTINGS.CASH_APP) + "</b> with your order number <b>" + esc_(o.ID) + "</b> in the note.</p>" : "");
}
function policies_() {
  return '<p style="font-size:13px;color:#555">Orders under $' + SETTINGS.FULL_PAY_UNDER + " are paid in full. Custom orders and orders $" +
    SETTINGS.FULL_PAY_UNDER + " or more need a " + SETTINGS.DEPOSIT_PERCENT + "% non-refundable deposit, with the balance due at pickup.</p>";
}
function trackButton_(o) { return '<p><a href="' + SETTINGS.SITE_URL + "/status.html#" + o.ID + '" style="color:#e0218a">Check your order status</a></p>'; }
function button_(href, label) {
  return '<p><a href="' + esc_(href) + '" style="display:inline-block;background:#e0218a;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:24px">' + esc_(label) + "</a></p>";
}
function row_(k, v) { return '<tr><td style="padding:4px 14px 4px 0;color:#777;vertical-align:top">' + k + '</td><td style="padding:4px 0">' + v + "</td></tr>"; }

// ----- Text messages Mone'T can send by hand -----
function smsPayment_(o) {
  return "Hi " + first_(o) + "! Your " + SETTINGS.BUSINESS + " order " + o.ID + " is approved 🎉\n" +
    o.Items + "\nPickup: " + prettyDate_(o["Pickup Date"]) + (o["Pickup Time"] ? " at " + o["Pickup Time"] : "") +
    "\nTotal: " + o.Total + "\nDue now (" + o["Payment Type"].toLowerCase() + "): " + o["Amount Due"] +
    (o["Payment Link"] ? "\nPay here: " + o["Payment Link"] : "") + (SETTINGS.CASH_APP ? "\nOr Cash App " + SETTINGS.CASH_APP + " (note: " + o.ID + ")" : "") +
    "\nYour order is confirmed once payment is verified." + (o["Payment Type"] === "Paid in full" ? "" : " Deposits are non-refundable.") + " ♡ Mone'T";
}
function smsConfirm_(o) {
  const bal = num_(o["Balance At Pickup"]);
  return "Hi " + first_(o) + "! Payment received, your order " + o.ID + " is CONFIRMED 🎉\n" + o.Items +
    "\nPickup: " + prettyDate_(o["Pickup Date"]) + (o["Pickup Time"] ? " at " + o["Pickup Time"] : "") +
    "\n" + (bal > 0 ? "Deposit paid: " + o["Amount Paid"] + ". Balance due at pickup: " + o["Balance At Pickup"] : "Paid in full: " + o["Amount Paid"]) +
    "\n" + SETTINGS.PICKUP_INFO + "\nThank you ♡ Mone'T";
}

// ----- Sheet helpers -----
function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
  if (!sh) throw new Error("Run setup() first");
  return sh;
}
function readAll_() {
  const values = sheet_().getDataRange().getDisplayValues();
  const head = values[0];
  return values.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => (o[h] = r[j]));
    return o;
  }).filter((o) => o.ID);
}
function find_(id) { return id ? readAll_().filter((o) => o.ID === id)[0] : null; }
function mustFind_(id) { const o = find_(id); if (!o) throw new Error("Order not found"); return o; }
function save_(o) {
  const sh = sheet_();
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = head.map((h) => (o[h] == null ? "" : String(o[h])));
  if (o._row) sh.getRange(o._row, 1, 1, row.length).setValues([row]);
  else { sh.appendRow(row); o._row = sh.getLastRow(); }
}

// ----- Small helpers -----
function plan_(total, custom) {
  const deposit = custom || total >= SETTINGS.FULL_PAY_UNDER;
  const due = deposit ? round_(total * SETTINGS.DEPOSIT_PERCENT / 100) : total;
  return { deposit: deposit, due: due, balance: round_(total - due) };
}
function mail_(to, subject, html, replyTo) {
  try {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: SETTINGS.BUSINESS, replyTo: replyTo || SETTINGS.NOTIFY_EMAIL || undefined });
    return true;
  } catch (err) {
    console.error("Email to " + to + " failed: " + err.message);
    return false;
  }
}
function tz_() { return Session.getScriptTimeZone(); }
function today_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd"); }
function now_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd HH:mm"); }
function prettyDate_(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
  return m ? Utilities.formatDate(new Date(+m[1], +m[2] - 1, +m[3], 12), tz_(), "EEEE, MMMM d") : d;
}
function first_(o) { return String(o.Name || "").split(" ")[0]; }
function round_(n) { return Math.round(n * 100) / 100; }
function num_(s) { return Number(String(s || "").replace(/[^0-9.]/g, "")) || 0; }
function money_(n) { return "$" + round_(n).toFixed(2); }
function esc_(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function newId_(n) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
