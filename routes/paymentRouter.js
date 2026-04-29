// const express = require('express');
// const router = express.Router();
// const crypto = require('crypto');

// let paymentsController = require('../controllers/paymentsController')
// let helper = require("../helper/helper.js")
// const cron = require("node-cron");
// let cronHelper = require("../helper/cron.js")
// const { verifyPendingPayments, verifyWithdrawal } = require("../controllers/cronPaymentCheck.js");

// // Every 5 minutes
// cron.schedule("*/5 * * * *", () => {
//     verifyPendingPayments();
//     verifyWithdrawal();
// });
// // verifyPendingPayments();

// router.post('/createOrder', helper.app_maintenance, paymentsController.createOrder);


// router.post('/webhook', express.json({ type: 'application/json' }), async (req, res) => {
//     try {
//         const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//         const signature = req.headers['x-razorpay-signature'];
//         const body = JSON.stringify(req.body);

//         // 1️⃣ Verify Razorpay signature
//         const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
//         if (signature !== expectedSignature) {
//             console.warn("⚠️ Invalid Razorpay webhook signature");
//             return res.status(400).send('Invalid signature');
//         }

//         const event = req.body.event;
//         const payload = req.body.payload;

//         // 2️⃣ Handle captured payments
//         if (event === 'payment.captured') {
//             const payment = payload.payment.entity;
//             const { order_id, id: payment_id } = payment;

//             console.log(`🔔 Payment captured for order ${order_id}`);

//             // Fetch order
//             const orderResult = await new Promise((resolve, reject) => {
//                 db.mainDb(`SELECT user_id, amount, order_status FROM mo_order_details WHERE order_id = ?`, [order_id], (err, rows) => {
//                     if (err) reject(err);
//                     else resolve(rows);
//                 });
//             });

//             if (orderResult.length === 0) {
//                 console.warn(`⚠️ Order ${order_id} not found`);
//                 return res.status(404).send('Order not found');
//             }

//             const order = orderResult[0];
//             if (order.order_status === 'paid') {
//                 console.log(`⚠️ Order ${order_id} already processed`);
//                 return res.status(200).send('Already processed');
//             }

//             const user_id = order.user_id;
//             const amount = parseFloat(order.amount);

//             // Update order status
//             await new Promise((resolve, reject) => {
//                 db.mainDb(`UPDATE mo_order_details SET order_status='paid', payment_id=? WHERE order_id=? AND order_status != 'paid'`, [payment_id, order_id], (err) => {
//                     if (err) reject(err);
//                     else resolve();
//                 });
//             });

//             // Fetch wallet
//             const walletResult = await new Promise((resolve, reject) => {
//                 db.mainDb(`SELECT main_wallet FROM mo_user_wallet WHERE user_id = ?`, [user_id], (err, rows) => {
//                     if (err) reject(err);
//                     else resolve(rows);
//                 });
//             });

//             if (!walletResult || walletResult.length === 0) {
//                 console.error(`❌ Wallet not found for user ${user_id}`);
//                 return res.status(500).send('Wallet not found');
//             }

//             const beforeBalance = parseFloat(walletResult[0].main_wallet);
//             const afterBalance = beforeBalance + amount;

//             // Update wallet
//             await new Promise((resolve, reject) => {
//                 db.mainDb(`UPDATE mo_user_wallet SET main_wallet=?, updated_at=NOW() WHERE user_id=?`, [afterBalance, user_id], (err) => {
//                     if (err) reject(err);
//                     else resolve();
//                 });
//             });

//             // Insert wallet access log
//             await new Promise((resolve, reject) => {
//                 db.mainDb(
//                     `INSERT INTO mo_user_wallet_access (user_id, wallet_type, transaction_type, amount, before_balance, after_balance, source, reference_id, remarks)
//                      VALUES (?, 'main_wallet', 'credit', ?, ?, ?, 'razorpay', ?, ?)`,
//                     [user_id, amount, beforeBalance, afterBalance, payment_id, `Payment for order ${order_id}`],
//                     (err) => {
//                         if (err) reject(err);
//                         else resolve();
//                     }
//                 );
//             });

//             console.log(`✅ Order ${order_id} paid & wallet credited`);
//             return res.status(200).send('OK');

//         }
//         // 3️⃣ Handle failed payments
//         else if (event === 'payment.failed') {
//             const payment = payload.payment.entity;
//             const { order_id, id: payment_id } = payment;

//             console.log(`❌ Payment failed for order ${order_id}`);

//             // Update order status to failed
//             await new Promise((resolve, reject) => {
//                 db.mainDb(
//                     `UPDATE mo_order_details SET order_status='failed', payment_id=? WHERE order_id=? AND order_status != 'paid'`,
//                     [payment_id, order_id],
//                     (err) => {
//                         if (err) reject(err);
//                         else resolve();
//                     }
//                 );
//             });

//             console.log(`✅ Order ${order_id} marked as failed`);
//             return res.status(200).send('OK');
//         }
//         // 4️⃣ Ignore other events
//         else {
//             console.log(`ℹ️ Webhook event ignored: ${event}`);
//             return res.status(200).send('Ignored');
//         }

//     } catch (err) {
//         console.error("Webhook processing error:", err);
//         return res.status(500).send('Internal server error');
//     }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();

let paymentsController = require('../controllers/paymentsController');
let helper = require("../helper/helper.js");


// ================= USER ROUTES =================

// Create manual payment (UTR + proof)
router.post(
    '/createOrder',
    helper.app_maintenance,
    paymentsController.createOrder
);

// ================= ADMIN ROUTES =================

// Approve payment
router.post(
    '/approvePayment',
    paymentsController.approvePayment
);

// Reject payment
router.post(
    '/rejectPayment',
    paymentsController.rejectPayment
);


module.exports = router;