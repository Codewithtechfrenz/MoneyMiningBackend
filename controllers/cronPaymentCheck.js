const Razorpay = require("razorpay");
const db = require("../models/db");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});





async function verifyPendingPayments() {
    console.log("⏳ Running payment verification cron...");

    try {
        // 1️⃣ Fetch all orders that are created or pending
        const orders = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT order_id, user_id, amount, order_status
                 FROM mo_order_details
                 WHERE order_status IN ('pending', 'created')`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        if (!orders.length) {
            console.log("ℹ️ No pending or created orders found");
            return;
        }

        for (const order of orders) {
            try {
                const { order_id, user_id, amount } = order;

                // 2️⃣ Fetch payments from Razorpay
                const payments = await razorpay.orders.fetchPayments(order_id);

                if (!payments.items || payments.items.length === 0) {
                    console.log(`ℹ️ No payments found for order ${order_id}`);
                    continue;
                }

                const capturedPayment = payments.items.find(p => p.status === "captured");
                const failedPayment = payments.items.find(p => p.status === "failed");

                // 3️⃣ Process captured payment
                if (capturedPayment) {
                    // Update order status to paid only if still pending/created
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_order_details 
                             SET order_status = 'paid', payment_id = ?
                             WHERE order_id = ? AND order_status IN ('pending','created')`,
                            [capturedPayment.id, order_id],
                            (err) => (err ? reject(err) : resolve())
                        );
                    });

                    // Fetch wallet balance
                    const walletResult = await new Promise((resolve, reject) => {
                        db.mainDb(
                            `SELECT main_wallet FROM mo_user_wallet WHERE user_id = ?`,
                            [user_id],
                            (err, rows) => (err ? reject(err) : resolve(rows))
                        );
                    });

                    const beforeBalance = walletResult.length > 0 ? parseFloat(walletResult[0].main_wallet) : 0;
                    const afterBalance = beforeBalance + parseFloat(amount);

                    // Update wallet
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_user_wallet SET main_wallet = ?, updated_at = NOW() WHERE user_id = ?`,
                            [afterBalance, user_id],
                            (err) => (err ? reject(err) : resolve())
                        );
                    });

                    // Insert wallet access log
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `INSERT INTO mo_user_wallet_access
                             (user_id, wallet_type, transaction_type, amount,
                              before_balance, after_balance, source, reference_id, remarks)
                             VALUES (?, 'main_wallet', 'credit', ?, ?, ?, 'cron', ?, ?)`,
                            [
                                user_id,
                                amount,
                                beforeBalance,
                                afterBalance,
                                capturedPayment.id,
                                `Payment for order ${order_id}`
                            ],
                            (err) => (err ? reject(err) : resolve())
                        );
                    });

                    console.log(`✅ Order ${order_id} processed successfully`);

                }
                // 4️⃣ Process failed payment
                else if (failedPayment) {
                    // Update order status to failed only if still pending/created
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_order_details
                             SET order_status = 'failed', payment_id = ?
                             WHERE order_id = ? AND order_status IN ('pending','created')`,
                            [failedPayment.id, order_id],
                            (err) => (err ? reject(err) : resolve())
                        );
                    });

                    console.log(`❌ Order ${order_id} marked as failed`);
                }
                // 5️⃣ Still pending
                else {
                    console.log(`ℹ️ Order ${order_id} is still pending`);
                }

            } catch (err) {
                console.error(`❌ Error processing order ${order.order_id}:`, err.message);
            }
        }

    } catch (err) {
        console.error("❌ DB fetch error:", err.message);
    }
}




async function verifyWithdrawal() {
    console.log("Checking Razorpay payout status...");

    try {

        const pendingWithdrawals = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT * FROM mo_user_withdrawals 
                 WHERE razorpay_status IN ('queued','processing')`,
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        for (const withdrawal of pendingWithdrawals) {

            try {

                const payout = await razorpay.payouts.fetch(
                    withdrawal.razorpay_payout_id
                );

                // ✅ SUCCESS CASE
                if (payout.status === "processed") {

                    // Deduct hold permanently
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_user_wallet 
                             SET hold = hold - ?, 
                                 updated_at = NOW()
                             WHERE user_id = ?`,
                            [withdrawal.amount, withdrawal.user_id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_user_withdrawals 
                             SET razorpay_status = 'success',
                                 updated_at = NOW()
                             WHERE id = ?`,
                            [withdrawal.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    console.log(`Withdrawal ${withdrawal.id} SUCCESS`);

                }

                // ❌ FAILED CASE
                else if (payout.status === "failed" || payout.status === "reversed") {

                    // Return hold back to wallet
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_user_wallet 
                             SET hold = hold - ?, 
                                 wallet = wallet + ?, 
                                 updated_at = NOW()
                             WHERE user_id = ?`,
                            [withdrawal.amount, withdrawal.amount, withdrawal.user_id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_user_withdrawals 
                             SET status = 'failed',
                                 razorpay_status = 'failed',
                                 updated_at = NOW()
                             WHERE id = ?`,
                            [withdrawal.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    console.log(`Withdrawal ${withdrawal.id} FAILED`);

                }

                // ⏳ STILL PROCESSING
                else {
                    await new Promise((resolve, reject) => {
                        db.mainDb(
                            `UPDATE mo_user_withdrawals 
                             SET razorpay_status = ?
                             WHERE id = ?`,
                            [payout.status, withdrawal.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                }

            } catch (rzpError) {
                console.error("Razorpay fetch error:", rzpError.message);
            }
        }

    } catch (err) {
        console.error("Cron error:", err.message);
    }
}


module.exports = { verifyPendingPayments, verifyWithdrawal };
// module.exports = verifyPendingPayments;