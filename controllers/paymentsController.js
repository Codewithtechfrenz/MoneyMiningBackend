

const express = require('express');
const router = express.Router();
const db = require('../models/db');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
// ==================== CREATE ORDER ====================
exports.createOrder = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.body.userId || 5;  // Replace with actual authenticated user ID


        const amountRegex = /^\d+(\.\d{1,2})?$/;
        const amountInPaise = reqData.amount * 100;
        const receiptId = `receipt_${Math.floor(Math.random() * 10000)}`;


        if (!reqData.amount || reqData.amount <= 0) {

            return res.json({ status: 0, message: "Amount must be greater than 0" });

        } else if (!amountRegex.test(amountInPaise)) {
            return res.json({
                status: 0,
                message: "Amount must be valid number with max 2 decimal places"
            });
        } else {
            const order = await razorpay.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: receiptId
            });

            const insertQuery = `INSERT INTO mo_order_details 
            (user_id, amount, currency, receipt, order_id, order_status, order_created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;

            db.mainDb(insertQuery, [
                userId,
                order.amount,
                order.currency,
                order.receipt,
                order.id,
                order.status,
                order.created_at
            ], (err, result) => {
                if (err) {
                    console.error("DB Insert Error:", err);
                    return res.json({ status: 0, message: "Database error" });
                }
                if (result.affectedRows === 0) {
                    return res.json({ status: 0, message: "Order not saved" });
                }
                return res.json({ status: 1, message: "Order created successfully", data: order });
            });
        }

    } catch (error) {
        console.error("Create Order Error:", error);
        return res.json({ status: 0, message: "Internal server error" });
    }
};

// ==================== RAZORPAY WEBHOOK ====================

