# Cake'd By Mone'T

Website for Cake'd By Mone'T: cupcakes, brownies, mini cakes & custom orders.
Sweet treats. Big happiness. ♡

Plain HTML/CSS/JS with no build step. Open `index.html` or host it on GitHub Pages.

## Files
- `index.html`: page layout
- `styles.css`: neon theme
- `menu.js`: settings, menu data and prices (shared by both pages)
- `script.js`: order cart and the order request
- `review.html`: Mone'T's private page for approving or declining a request
- `checkout/`: Cloudflare Worker that takes the deposit through Stripe (see setup below)
- `assets/`: logo and flavor photos
- `HIGGSFIELD.md`: prompts for the AI "cake builds itself" hero video

## Common edits
- **Instagram handle / phone:** `CONFIG` at the top of `menu.js`
- **Prices or flavors:** `PRODUCTS` and `FLAVORS` in `menu.js`
- **Deposit %, days' notice, days off:** `CONFIG` in `menu.js`
- **Hero video:** add `assets/hero-cake-build.mp4` (made in Higgsfield AI). It replaces the animated cake automatically.

## How booking works (deposit up front)
Turned on when `CONFIG.checkoutUrl` in `menu.js` points at the checkout helper (`checkout/`, a Cloudflare Worker).

1. The customer builds their order and taps **Pay $X Deposit & Send Order**. The helper prices the cart from `menu.js` (never from the browser) and sends them to Stripe Checkout for `depositPercent` of the menu total.
2. After paying they come back to the site. The FormNX form opens filled in, starting with "DEPOSIT PAID: $X (order CODE)", and they tap Submit. (Stripe also emails Mone'T about the payment, with the items in the description, in case someone pays and never taps Submit.)
3. The **Review Link** in the FormNX email opens `review.html`. It checks the deposit with Stripe and shows the order as it was paid for.
4. **Accept:** she adds any rush fee or price change, taps **Create balance link** (needs her passcode), then texts or emails the confirmation with the remaining balance and its one-time Stripe link.
5. **Decline:** she taps **Refund the deposit in full**, then sends the decline message.

Custom-only requests (nothing from the menu in the cart) skip the deposit and work the old way: she prices them and sends a payment link by hand. With `checkoutUrl` empty the whole site goes back to that old way.

## Setting up the checkout helper (one time)
1. In Mone'T's Stripe: Developers → API keys → **Create restricted key** with **Write** on Checkout Sessions, Prices, Products, Payment Links and Refunds, and **Read** on PaymentIntents and Charges.
2. Free Cloudflare account, then in `checkout/`: `npx wrangler login`
3. `npx wrangler secret put STRIPE_KEY` (paste the restricted key) and `npx wrangler secret put ADMIN_KEY` (her review-page passcode)
4. `npx wrangler deploy`, then put the printed `https://…workers.dev` URL in `CONFIG.checkoutUrl`
5. Changing prices or `depositPercent` in `menu.js`? Run `npx wrangler deploy` again so the helper charges the new prices.

Pickups sooner than `noticeDays` are rush orders. The customer is told a rush fee may apply, and the review page flags the order and adds a **Rush fee** box.

FormNX field names live in `CONFIG.formFields`. If a field is added or rebuilt in FormNX, copy its new name from the field's settings.
