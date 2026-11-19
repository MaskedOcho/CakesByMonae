# Cake'd By Mone'T

Website for Cake'd By Mone'T: cupcakes, brownies, mini cakes & custom orders.
Sweet treats. Big happiness. ♡

Plain HTML/CSS/JS with no build step. Open `index.html` or host it on GitHub Pages.

## Files
- `index.html`: page layout
- `styles.css`: neon theme
- `menu.js`: settings, menu data and prices (shared by both pages)
- `script.js`: order cart and the order request
- `orders.html`: Mone'T's order dashboard (statuses, payment requests, confirming payments)
- `status.html`: customers check their order status with their order number
- `apps-script/`: the free Google Sheet backend (`Code.gs`) and its setup guide (`SETUP.md`)
- `review.html`: the old approval page, used only while `ordersApi` is empty (FormNX flow)
- `assets/`: logo and flavor photos
- `HIGGSFIELD.md`: prompts for the AI "cake builds itself" hero video

## Common edits
- **Instagram handle / phone:** `CONFIG` at the top of `menu.js`
- **Prices or flavors:** `PRODUCTS` and `FLAVORS` in `menu.js`
- **Minimum per category, full-pay limit, deposit %, days' notice, days off:** `CONFIG` in `menu.js` (and the same numbers in `SETTINGS` in `apps-script/Code.gs`)
- **Hero video:** add `assets/hero-cake-build.mp4` (made in Higgsfield AI). It replaces the animated cake automatically.

## Ordering policies
- At least 6 per category (cupcakes, brownies, mini cakes). Flavors can mix; regular and loaded brownies count together; categories can't be combined. The cart won't go below 6.
- Regular orders under $75 are paid in full. Custom orders and orders $75+ pay a 50% non-refundable deposit, balance at pickup.
- An order is confirmed only after Mone'T verifies the payment.

## How booking works
Once `CONFIG.ordersApi` is set (see `apps-script/SETUP.md`):
1. **Received:** the customer submits on the site. The order lands in the Google Sheet; the customer gets a "we got it" email and Mone'T gets a new-order email.
2. **Pending Payment:** in `orders.html` she sets the final price, pastes a Stripe payment link and taps **Email payment request**. The amount due follows the payment policy.
3. **Confirmed:** after checking Stripe or Cash App, she taps **Payment verified: confirm order**. The customer gets a confirmation with order details, payment status and pickup info.
4. **Reminder:** emailed automatically the day before pickup. Mone'T gets a list of tomorrow's pickups.

Every step also gives her the same message ready to text.

### Before the backend is connected (FormNX flow)
1. The customer builds their order and taps **Request My Order**. The FormNX form opens in a popup with everything filled in, and they tap Submit.
2. FormNX emails Mone'T the request. The hidden **Review Link** field opens `review.html` with the whole order.
3. On the review page she sets the final price, makes a Stripe payment link for the deposit, pastes it in and taps **Text approval** or **Email approval**. Or she declines.
4. Nothing is charged until she approves and the customer pays the Stripe link. Deposits are non-refundable.

Pickups sooner than `noticeDays` are rush orders. The customer is told a rush fee may apply, and the review page flags the order and adds a **Rush fee** box.

FormNX field names live in `CONFIG.formFields`. If a field is added or rebuilt in FormNX, copy its new name from the field's settings.
