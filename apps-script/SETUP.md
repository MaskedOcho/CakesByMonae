# Order system setup (free, about 15 minutes)

Orders are saved in a Google Sheet in Mone'T's Google account. Google Apps Script
sends the emails and the day-before pickup reminders. No server and no monthly cost.

## 1. Make the sheet and paste the script
1. Signed in as Mone'T (or the business Google account), create a new Google Sheet named **Cake'd By Mone'T Orders**.
2. In the sheet: **Extensions → Apps Script**.
3. Delete everything in `Code.gs` and paste in the contents of `apps-script/Code.gs` from this repo.
4. Edit `SETTINGS` at the top:
   - `PICKUP_INFO`: leave it empty. Pickup location and instructions vary, so Mone'T types them for each order in the dashboard before confirming.
   - `CASH_APP`: her $cashtag if she takes Cash App, or leave it empty.
   - `NOTIFY_EMAIL`: only if new-order alerts should go somewhere other than this Google account.
5. **Project Settings** (gear icon) → set the **Time zone** to hers (Eastern for 386).
6. Click **Save**.

## 2. Run setup once
1. In the function dropdown at the top, pick **setup** and click **Run**.
2. Google asks for permission (sheets, email, triggers). Click through. On the "Google hasn't verified this app" screen, click **Advanced → Go to (project name)**. It's her own script.
3. Open **Execution log** and copy the **dashboard key**. This is her password for `orders.html`.

This creates the **Orders** tab and a daily trigger that sends pickup reminders around 9 AM the day before.

## 3. Publish it as a web app
1. **Deploy → New deployment →** gear icon **→ Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
3. **Deploy**, then copy the **Web app URL** (ends in `/exec`).

## 4. Connect the website
In `menu.js`, paste the URL into `CONFIG.ordersApi`:
```js
ordersApi: "https://script.google.com/macros/s/XXXX/exec",
```
Commit and push. The site now sends orders to the sheet instead of the FormNX form.

## 5. Mone'T's phone
Open **cakedbymonet.com/orders.html**, paste the dashboard key once, and add it to her home screen.

## How an order flows
| Status | What happens |
|---|---|
| **Received** | Customer submits on the site. They get a "we got your request" email; Mone'T gets a new-order email with a button to open it. |
| **Pending Payment** | Mone'T sets the final price and pastes a Stripe link, then taps **Email payment request**. Under $75 (not custom): due in full. Custom or $75+: 50% non-refundable deposit, balance at pickup. |
| **Confirmed** | She checks Stripe or Cash App, then taps **Payment verified: confirm order**. The customer gets a confirmation with order details, payment status and pickup info. |
| Reminder | Sent automatically the day before pickup. Mone'T also gets a list of tomorrow's pickups and which balances to collect. |
| **Declined** | She can decline from Received or Pending Payment. |

After every step the dashboard also offers the same message as a text she can send in one tap.
Customers can check their status at `status.html` with their order number.

## Changing the script later
After editing `Code.gs`: **Deploy → Manage deployments →** pencil icon **→ Version: New version → Deploy**.
The URL stays the same. If the policy numbers change, update them in both `SETTINGS` (Code.gs) and `CONFIG` (menu.js).

## Limits
Free Gmail accounts can send about 100 emails a day, which covers a few dozen orders a day.
Text messages aren't automatic (that needs a paid service such as Twilio). The dashboard prepares each text for her to send.
