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
- `assets/`: logo and flavor photos
- `HIGGSFIELD.md`: prompts for the AI "cake builds itself" hero video

## Common edits
- **Instagram handle / phone:** `CONFIG` at the top of `menu.js`
- **Prices or flavors:** `PRODUCTS` and `FLAVORS` in `menu.js`
- **Deposit %, days' notice, days off:** `CONFIG` in `menu.js`
- **Hero video:** add `assets/hero-cake-build.mp4` (made in Higgsfield AI). It replaces the animated cake automatically.

## How booking works
1. The customer builds their order and taps **Request My Order**. The FormNX form opens in a popup with everything filled in, and they tap Submit.
2. FormNX emails Mone'T the request. The hidden **Review Link** field opens `review.html` with the whole order.
3. On the review page she sets the final price, makes a Stripe payment link for the deposit, pastes it in and taps **Text approval** or **Email approval**. Or she declines.
4. Nothing is charged until she approves and the customer pays the Stripe link. Deposits are non-refundable.

Pickups sooner than `noticeDays` are rush orders. The customer is told a rush fee may apply, and the review page flags the order and adds a **Rush fee** box.

FormNX field names live in `CONFIG.formFields`. If a field is added or rebuilt in FormNX, copy its new name from the field's settings.
