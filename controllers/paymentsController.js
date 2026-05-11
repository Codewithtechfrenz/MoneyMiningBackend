

// const express = require('express');
// const router = express.Router();
// const db = require('../models/db');
// const crypto = require('crypto');
// const razorpay = require('../config/razorpay');
// // ==================== CREATE ORDER ====================
// exports.createOrder = async (req, res) => {
//     try {
//         const reqData = req.body;
//         const userId = req.body.userId || 5;  // Replace with actual authenticated user ID


//         const amountRegex = /^\d+(\.\d{1,2})?$/;
//         const amountInPaise = reqData.amount * 100;
//         const receiptId = `receipt_${Math.floor(Math.random() * 10000)}`;


//         if (!reqData.amount || reqData.amount <= 0) {

//             return res.json({ status: 0, message: "Amount must be greater than 0" });

//         } else if (!amountRegex.test(amountInPaise)) {
//             return res.json({
//                 status: 0,
//                 message: "Amount must be valid number with max 2 decimal places"
//             });
//         } else {
//             const order = await razorpay.orders.create({
//                 amount: amountInPaise,
//                 currency: 'INR',
//                 receipt: receiptId
//             });

//             const insertQuery = `INSERT INTO mo_order_details 
//             (user_id, amount, currency, receipt, order_id, order_status, order_created_at)
//             VALUES (?, ?, ?, ?, ?, ?, ?)`;

//             db.mainDb(insertQuery, [
//                 userId,
//                 order.amount,
//                 order.currency,
//                 order.receipt,
//                 order.id,
//                 order.status,
//                 order.created_at
//             ], (err, result) => {
//                 if (err) {
//                     console.error("DB Insert Error:", err);
//                     return res.json({ status: 0, message: "Database error" });
//                 }
//                 if (result.affectedRows === 0) {
//                     return res.json({ status: 0, message: "Order not saved" });
//                 }
//                 return res.json({ status: 1, message: "Order created successfully", data: order });
//             });
//         }

//     } catch (error) {
//         console.error("Create Order Error:", error);
//         return res.json({ status: 0, message: "Internal server error" });
//     }
// };

// // ==================== RAZORPAY WEBHOOK ====================




const db = require('../models/db');

// ================= CREATE ORDER (MANUAL PAYMENT) =================
exports.createOrder = async (req, res) => {
    try {
        const { amount, utr_id, proof_image } = req.body;
        const userId = req.body.userId; // Replace with auth user

        if (!amount || amount <= 0) {
            return res.json({ status: 0, message: "Amount must be greater than 0" });
        }

        if (!utr_id) {
            return res.json({ status: 0, message: "UTR / Transaction ID required" });
        }

        if (!proof_image) {
            return res.json({ status: 0, message: "Payment proof image required" });
        }

        // Check duplicate UTR
        const existing = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT id FROM mo_order_details WHERE utr_id = ?`,
                [utr_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (existing.length > 0) {
            return res.json({ status: 0, message: "Duplicate UTR not allowed" });
        }

        const order_id = `manual_${Date.now()}`;
        const receipt = `receipt_${Math.floor(Math.random() * 10000)}`;

        const insertQuery = `
            INSERT INTO mo_order_details 
            (user_id, amount, currency, receipt, order_id, order_status, order_created_at, payment_id, utr_id, proof_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.mainDb(insertQuery, [
            userId,
            amount,
            'INR',
            receipt,
            order_id,
            'pending',
            new Date().toISOString(),
            null,
            utr_id,
            proof_image
        ], (err, result) => {
            if (err) {
                console.error("DB Insert Error:", err);
                return res.json({ status: 0, message: "Database error" });
            }

            return res.json({
                status: 1,
                message: "Payment submitted. Awaiting admin verification",
                order_id: order_id
            });
        });

    } catch (error) {
        console.error("Create Order Error:", error);
        return res.json({ status: 0, message: "Internal server error" });
    }
};


// ================= APPROVE PAYMENT =================
exports.approvePayment = async (req, res) => {
    try {
        const { order_id } = req.body;

        if (!order_id) {
            return res.json({ status: 0, message: "order_id required" });
        }

        const orderResult = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT * FROM mo_order_details WHERE order_id=?`,
                [order_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (orderResult.length === 0) {
            return res.json({ status: 0, message: "Order not found" });
        }

        const order = orderResult[0];

        if (order.order_status === 'paid') {
            return res.json({ status: 0, message: "Already approved" });
        }

        const user_id = order.user_id;
        const amount = parseFloat(order.amount);

        // Update order status
        await new Promise((resolve, reject) => {
            db.mainDb(
                `UPDATE mo_order_details 
                 SET order_status='paid', payment_id=? 
                 WHERE order_id=? AND order_status!='paid'`,
                [`manual_${Date.now()}`, order_id],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Fetch wallet
        const walletResult = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT main_wallet FROM mo_user_wallet WHERE user_id=?`,
                [user_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (!walletResult || walletResult.length === 0) {
            return res.json({ status: 0, message: "Wallet not found" });
        }

        const beforeBalance = parseFloat(walletResult[0].main_wallet);
        const afterBalance = beforeBalance + amount;

        // Update wallet
        await new Promise((resolve, reject) => {
            db.mainDb(
                `UPDATE mo_user_wallet 
                 SET main_wallet=?, updated_at=NOW() 
                 WHERE user_id=?`,
                [afterBalance, user_id],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Log transaction
        await new Promise((resolve, reject) => {
            db.mainDb(
                `INSERT INTO mo_user_wallet_access 
                (user_id, wallet_type, transaction_type, amount, before_balance, after_balance, source, reference_id, remarks)
                VALUES (?, 'main_wallet', 'credit', ?, ?, ?, 'manual', ?, ?)`,
                [
                    user_id,
                    amount,
                    beforeBalance,
                    afterBalance,
                    order_id,
                    'Manual payment approved'
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        return res.json({
            status: 1,
            message: "Payment approved & wallet credited"
        });

    } catch (err) {
        console.error("Approve Error:", err);
        return res.json({ status: 0, message: "Error approving payment" });
    }
};


// ================= REJECT PAYMENT =================
exports.rejectPayment = async (req, res) => {
    try {
        const { order_id, rejected_reason } = req.body;

        if (!order_id) {
            return res.json({ status: 0, message: "order_id required" });
        }

        if (!rejected_reason) {
            return res.json({ status: 0, message: "Rejection reason required" });
        }

        // Check order exists
        const orderResult = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT order_status FROM mo_order_details WHERE order_id=?`,
                [order_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (orderResult.length === 0) {
            return res.json({ status: 0, message: "Order not found" });
        }

        if (orderResult[0].order_status !== 'pending') {
            return res.json({ status: 0, message: "Only pending orders can be rejected" });
        }

        // Update with rejection reason
        await new Promise((resolve, reject) => {
            db.mainDb(
                `UPDATE mo_order_details 
                 SET order_status='rejected', rejected_reason=? 
                 WHERE order_id=?`,
                [rejected_reason, order_id],
                (err) => err ? reject(err) : resolve()
            );
        });

        return res.json({
            status: 1,
            message: "Payment rejected successfully"
        });

    } catch (err) {
        console.error("Reject Error:", err);
        return res.json({ status: 0, message: "Error rejecting payment" });
    }
};

