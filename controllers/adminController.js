const { Validator } = require("node-input-validator");
const db = require('../models/db')
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require('dotenv').config();
const mailhelper = require("../helper/mailHelper")
const moment = require('moment');

const Razorpay = require("razorpay");
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const validate = new Validator(req.body, {
            email: 'required|email',
            password: 'required'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');

            return res.json({ status: 0, message: msg });
        }

        const selectQuery = "SELECT * FROM mo_admin_info WHERE email = ?";
        await db.mainDb(selectQuery, email, async (err, data) => {
            console.log("data: ", data);
            if (err) {
                return res.json({ status: 0, message: "DB error" });
            }

            if (data.length === 0) {
                return res.json({ status: 0, message: "admin not found" });
            }

            if (data[0].password !== password) {
                return res.json({ status: 0, message: "Invalid password" });
            }

            // 🔐 Generate OTP & Token
            const otp = Math.floor(100000 + Math.random() * 900000); // 6 digit
            const token = crypto.randomBytes(32).toString("hex");
            const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min
            console.log("expiry: ", expiry);


            // let replaceble = {
            //     USERNAME: data[0].username,
            //     OTP: otp
            // }

            // let mailStatus = await mailhelper.sendMailWithTemplate(email, "login_otp", replaceble)
            // if (mailStatus.status == 1) {

            const updateQuery = `
                UPDATE mo_admin_info 
                SET otp=?, token=?, otp_expiry=? 
                WHERE id=?
            `;

            await db.mainDb(updateQuery, [otp, token, expiry, data[0].id], () => {

                // TODO: send OTP via email/SMS
                console.log("OTP:", otp);

                return res.json({
                    status: 1,
                    message: "OTP sent successfully",
                    token: token
                });
            });
            // } else {
            //     return res.json({
            //         status: 0,
            //         message: "Error while send mail for login..."
            //     });
            // }
        });

    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};



exports.adminLoginVerify = async (req, res) => {
    try {
        const { token, otp } = req.body;

        const validate = new Validator(req.body, {
            token: 'required',
            otp: 'required'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');
            return res.json({ status: 0, message: msg });
        }

        const query = `
            SELECT * FROM mo_admin_info 
            WHERE token=? AND otp=?
        `;

        await db.mainDb(query, [token, otp], async (err, data) => {
            if (err) {
                return res.json({ status: 0, message: "DB error" });
            }

            if (data.length === 0) {
                return res.json({ status: 0, message: "Invalid OTP or token" });
            }

            if (new Date(data[0].otp_expiry) < new Date()) {
                return res.json({ status: 0, message: "OTP expired" });
            }

            // ✅ Create JWT
            const jwtToken = jwt.sign(
                { userId: data[0].id, email: data[0].email, mblno: data[0].mblno },
                // process.env.JWT_SECRET,
                "ADMINSECRET@KEY",
                { expiresIn: "7d" }
            );
            const token = crypto.randomBytes(32).toString("hex");

            // Clear OTP & token
            const clearQuery = `
                UPDATE mo_admin_info 
                SET otp=NULL, token= ?, otp_expiry=NULL
                WHERE id=?
            `;
            await db.mainDb(clearQuery, [token, data[0].id]);

            return res.json({
                status: 1,
                message: "Login successful",
                jToken: `Bearer ${jwtToken}`,
                token: token
            });
        });

    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};

// exports.getUserDetails = async (req, res) => {
//     try {
//         const reqData = req.body;

//         // ✅ Validation
//         const validate = new Validator(reqData, {
//             pageNo: 'integer|min:1',
//             pageSize: 'integer|min:1',
//             search: 'string'
//         });

//         const matched = await validate.check();
//         if (!matched) {
//             let error_message = '';
//             Object.keys(validate.errors).forEach((key) => {
//                 if (validate.errors[key].message) {
//                     error_message += (error_message ? ', ' : '') + validate.errors[key].message;
//                 }
//             });
//             return res.json({ status: 0, message: error_message });
//         }

//         const page = parseInt(reqData.pageNo) || 1;
//         const limit = parseInt(reqData.pageSize) || 10;
//         const offset = (page - 1) * limit;

//         let whereConditions = [];
//         let queryParams = [];

//         // ✅ Optional search by username, email, or mobile
//         if (reqData.search) {
//             const searchValue = `%${reqData.search}%`;
//             whereConditions.push("(username LIKE ? OR email LIKE ? OR mblno LIKE ?)");
//             queryParams.push(searchValue, searchValue, searchValue);
//         }

//         const whereClause = whereConditions.length > 0
//             ? `WHERE ${whereConditions.join(" AND ")}`
//             : "";

//         const query = `
//             SELECT 
//                 id AS user_id,
//                 username,
//                 email,
//                 mblno,
//                 is_kyc_verified,
//                 is_bank_verified,
//                 created_at
//             FROM mo_user_info
//             ${whereClause}
//             ORDER BY created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         queryParams.push(limit, offset);

//         await db.mainDb(query, queryParams, (err, data) => {
//             if (err) {
//                 console.error("Get user list error:", err);
//                 return res.json({ status: 0, message: "Error fetching user list" });
//             }

//             return res.json({
//                 status: 1,
//                 page,
//                 pageSize: limit,
//                 totalRecords: data.length,
//                 data
//             });
//         });

//     } catch (err) {
//         console.error("getUserList error:", err);
//         return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
//     }
// };


exports.getUserDetails = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'integer|min:1',
            pageSize: 'integer|min:1',
            search: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo) || 1;
        const limit = parseInt(reqData.pageSize) || 10;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Optional search by username, email, or mobile
        if (reqData.search) {
            const searchValue = `%${reqData.search}%`;
            whereConditions.push("(u.username LIKE ? OR u.email LIKE ? OR u.mblno LIKE ?)");
            queryParams.push(searchValue, searchValue, searchValue);
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(" AND ")}`
            : "";

        const query = `
            SELECT 
                u.id AS user_id,
                u.username,
                u.email,
                u.mblno,
                u.is_kyc_verified,
                u.is_bank_verified,
                u.created_at,
                IFNULL(w.main_wallet, 0) AS main_wallet,
                IFNULL(w.wallet, 0) AS wallet,
                IFNULL(SUM(od.amount), 0) AS total_deposited
            FROM mo_user_info u
            LEFT JOIN mo_user_wallet w ON u.id = w.user_id
            LEFT JOIN mo_order_details od 
                ON u.id = od.user_id AND od.order_status = 'paid'
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);

        await db.mainDb(query, queryParams, (err, data) => {
            if (err) {
                console.error("Get user list error:", err);
                return res.json({ status: 0, message: "Error fetching user list" });
            }

            return res.json({
                status: 1,
                page,
                pageSize: limit,
                totalRecords: data.length,
                data
            });
        });

    } catch (err) {
        console.error("getUserList error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};


exports.adminInfo = async (req, res) => {
    try {

        const userId = req.user.userId;

        if (!userId) {
            return res.json({
                status: 0,
                message: "Invalid admin"
            });
        }

        const startDate = moment().startOf("day").format("YYYY-MM-DD HH:mm:ss");
        const endDate = moment().endOf("day").format("YYYY-MM-DD HH:mm:ss");

        const finalQuery = `

    SELECT id, username, email, mblno AS mobile
    FROM mo_admin_info
    WHERE id = ?;

    SELECT COUNT(*) AS total_users
    FROM mo_user_info;

    SELECT IFNULL(SUM(amount),0) AS total_deposit
    FROM mo_order_details
    WHERE order_status = 'paid';

    SELECT IFNULL(SUM(amount),0) AS total_withdraw
    FROM mo_user_withdrawals
    WHERE status = 'approved';

    SELECT IFNULL(SUM(profit_amount),0) AS total_roi
    FROM mo_wallet_daily_profit;

    SELECT IFNULL(SUM(bonus_amount),0) AS total_ref_roi
    FROM mo_wallet_daily_profit_from_ref;

    SELECT IFNULL(SUM(amount),0) AS today_deposit
    FROM mo_order_details
    WHERE order_status = 'paid'
    AND created_at BETWEEN ? AND ?;

    SELECT IFNULL(SUM(amount),0) AS today_withdraw
    FROM mo_user_withdrawals
    WHERE status = 'approved'
    AND created_at BETWEEN ? AND ?;

    SELECT IFNULL(SUM(profit_amount),0) AS today_roi
    FROM mo_wallet_daily_profit
    WHERE created_at BETWEEN ? AND ?;

    SELECT IFNULL(SUM(bonus_amount),0) AS today_ref_roi
    FROM mo_wallet_daily_profit_from_ref
    WHERE created_at BETWEEN ? AND ?;

    `;

        const params = [
            userId,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate
        ];

        db.mainDb(finalQuery, params, (err, results) => {

            if (err) {
                console.log(err);
                return res.json({
                    status: 0,
                    message: "Database error"
                });
            }

            const total_roi = Number(results[4][0].total_roi);
            const total_ref_roi = Number(results[5][0].total_ref_roi);
            const today_roi = Number(results[8][0].today_roi);
            const today_ref_roi = Number(results[9][0].today_ref_roi);

            const finalData = {

                admin: results[0][0],

                total_users: results[1][0].total_users,

                total_deposit: results[2][0].total_deposit,
                total_withdraw: results[3][0].total_withdraw,

                total_roi: total_roi,
                total_ref_roi: total_ref_roi,

                today_deposit: results[6][0].today_deposit,
                today_withdraw: results[7][0].today_withdraw,

                today_roi: today_roi,
                today_ref_roi: today_ref_roi,

                TOTAL_ROI: total_roi + total_ref_roi,
                TODAY_ROI: today_roi + today_ref_roi

            };

            return res.json({
                status: 1,
                message: "Admin dashboard info fetched successfully",
                data: finalData
            });

        });

    } catch (err) {
        console.log("Admin info error:", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};


exports.verifyKyc = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Basic validation
        const validate = new Validator(reqData, {
            user_id: 'required|integer',
            aadhaar_status: 'required|integer|in:0,1,2',
            pan_status: 'required|integer|in:0,1,2'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.values(validate.errors).forEach(e => {
                error_message += (error_message ? ', ' : '') + e.message;
            });
            return res.json({ status: 0, message: error_message });
        }

        const { user_id, aadhaar_status, pan_status, aadhaar_reject_reason, pan_reject_reason } = reqData;

        // ✅ Conditional validation manually
        if (aadhaar_status == 2 && (!aadhaar_reject_reason || aadhaar_reject_reason.trim() === "")) {
            return res.json({ status: 0, message: "aadhaar_reject_reason is required when aadhaar_status is rejected" });
        }
        if (pan_status == 2 && (!pan_reject_reason || pan_reject_reason.trim() === "")) {
            return res.json({ status: 0, message: "pan_reject_reason is required when pan_status is rejected" });
        }

        // 🔍 Update KYC status
        const updateQuery = `
            UPDATE mo_kyc_details
            SET 
                aadhaar_status = ?,
                pan_status = ?,
                aadhaar_reject_reason = ?,
                pan_reject_reason = ?,
                updated_at = NOW()
            WHERE user_id = ?
        `;

        const params = [
            aadhaar_status,
            pan_status,
            aadhaar_reject_reason || null,
            pan_reject_reason || null,
            user_id
        ];

        await db.mainDb(updateQuery, params, async (err, result) => {
            if (err) {
                console.log("KYC admin update error:", err);
                return res.json({ status: 0, message: "Error updating KYC status" });
            }

            // 🔄 Update is_kyc_verified in user table
            let isVerified = 0; // pending
            if (aadhaar_status == 1 && pan_status == 1) isVerified = 1;
            if (aadhaar_status == 2 || pan_status == 2) isVerified = 2; // rejected
            console.log("isVerified: ", isVerified);

            await db.mainDb(
                "UPDATE mo_user_info SET is_kyc_verified=? WHERE id=?",
                [isVerified, user_id],
                (err2, result2) => {
                    console.log("result2: ", result2);
                    if (err2) {
                        console.log("Update is_kyc_verified error:", err2);
                        return res.json({ status: 0, message: "Error updating user KYC status" });
                    }

                    return res.json({
                        status: 1,
                        message: "KYC verification updated successfully",
                        is_kyc_verified: isVerified
                    });
                }
            );
        });

    } catch (err) {
        console.log("verifyKycAdmin error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};



// exports.getKycList = async (req, res) => {
//     try {
//         const reqData = req.body;

//         // ✅ Validation
//         const validate = new Validator(reqData, {
//             pageNo: 'integer|min:1',
//             pageSize: 'integer|min:1',
//             kycStatus: 'integer|in:0,1,2',       // 0-pending,1-verified,2-rejected
//             bankStatus: 'integer|in:0,1,2',
//             isKycVerified: 'integer|in:0,1',
//             search: 'string',
//             fromDate: 'date',
//             toDate: 'date'
//         });

//         const matched = await validate.check();
//         if (!matched) {
//             let error_message = '';
//             Object.keys(validate.errors).forEach((key) => {
//                 if (validate.errors[key].message) {
//                     error_message += (error_message ? ', ' : '') + validate.errors[key].message;
//                 }
//             });
//             return res.json({ status: 0, message: error_message });
//         }

//         const page = parseInt(reqData.pageNo) || 1;
//         const limit = parseInt(reqData.pageSize) || 10;
//         const offset = (page - 1) * limit;

//         let whereConditions = [];
//         let queryParams = [];

//         // ✅ Filters

//         if (reqData.kycStatus !== undefined) {
//             whereConditions.push("(k.aadhaar_status = ? OR k.pan_status = ?)");
//             queryParams.push(reqData.kycStatus, reqData.kycStatus);
//         }

//         if (reqData.bankStatus !== undefined) {
//             whereConditions.push("b.bank_status = ?");
//             queryParams.push(reqData.bankStatus);
//         }

//         if (reqData.isKycVerified !== undefined) {
//             whereConditions.push("u.is_kyc_verified = ?");
//             queryParams.push(reqData.isKycVerified);
//         }

//         if (reqData.search) {
//             whereConditions.push("(u.username LIKE ? OR u.email LIKE ? OR u.mblno LIKE ?)");
//             const searchValue = `%${reqData.search}%`;
//             queryParams.push(searchValue, searchValue, searchValue);
//         }

//         if (reqData.fromDate && reqData.toDate) {
//             whereConditions.push("DATE(k.updated_at) BETWEEN ? AND ?");
//             queryParams.push(reqData.fromDate, reqData.toDate);
//         }

//         const whereClause = whereConditions.length > 0
//             ? `WHERE ${whereConditions.join(" AND ")}`
//             : "";

//         const query = `
//             SELECT 
//                 u.id AS user_id,
//                 u.username,
//                 u.email,
//                 u.mblno,
//                 u.is_kyc_verified,
//                 u.is_bank_verified,

//                 k.aadhaar_status,
//                 k.pan_status,
//                 k.aadhaar_number,
//                 k.pan_number,
//                 k.aadhaar_front_image,
//                 k.aadhaar_back_image,
//                 k.pan_image,
//                 k.aadhaar_reject_reason,
//                 k.pan_reject_reason,
//                 k.updated_at AS kyc_updated_at,

//                 b.acc_no,
//                 b.ifsc_code,
//                 b.bank_image,
//                 b.bank_status,
//                 b.reject_reason AS bank_reject_reason,
//                 b.updated_at AS bank_updated_at

//             FROM mo_user_info u
//             LEFT JOIN mo_kyc_details k ON u.id = k.user_id
//             LEFT JOIN mo_bank_details b ON u.id = b.user_id
//             ${whereClause}
//             ORDER BY k.updated_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         queryParams.push(limit, offset);

//         await db.mainDb(query, queryParams, (err, data) => {
//             if (err) {
//                 console.log("KYC list error:", err);
//                 return res.json({ status: 0, message: "Error fetching KYC list" });
//             }

//             return res.json({
//                 status: 1,
//                 page,
//                 pageSize: limit,
//                 totalRecords: data.length,
//                 data
//             });
//         });

//     } catch (err) {
//         console.log("getKycList error:", err);
//         return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
//     }
// };


exports.userKycListAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1',
            status: 'required|in:pending,verified,rejected,all',
            email: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                error_message += (error_message ? ', ' : '') + validate.errors[key].message;
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Map human-readable status to numeric in DB
        const statusMap = {
            pending: 0,
            verified: 1,
            rejected: 2
        };

        if (reqData.status !== 'all') {
            // ✅ Apply status filter on Aadhaar OR PAN
            whereConditions.push('(kyc.aadhaar_status = ? OR kyc.pan_status = ?)');
            queryParams.push(statusMap[reqData.status]);
            queryParams.push(statusMap[reqData.status]);
        }

        // ✅ Email filter (optional)
        if (reqData.email && reqData.email.trim() !== '') {
            whereConditions.push('ui.email LIKE ?');
            queryParams.push(`%${reqData.email.trim()}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ✅ Count query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_user_info ui
            LEFT JOIN mo_kyc_details kyc ON kyc.user_id = ui.id
            ${whereClause}
        `;

        db.mainDb(countQuery, queryParams, (err, countResult) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching KYC count" });
            }

            const totalRecords = countResult[0].total;

            // ✅ Data query
            // const dataQuery = `
            //     SELECT 
            //         ui.id,
            //         ui.username,
            //         ui.email,
            //         ui.mblno,
            //         kyc.aadhaar_status,
            //         kyc.pan_status,
            //         kyc.created_at AS kyc_created_at,
            //         kyc.updated_at AS kyc_updated_at
            //     FROM mo_user_info ui
            //     LEFT JOIN mo_kyc_details kyc ON kyc.user_id = ui.id
            //     ${whereClause}
            //     ORDER BY kyc.created_at DESC
            //     LIMIT ? OFFSET ?
            // `;

            const dataQuery = `
    SELECT 
        ui.id,
        ui.username,
        ui.email,
        ui.mblno,
        kyc.aadhaar_status,
        kyc.pan_status,
        kyc.created_at AS kyc_created_at,
        kyc.updated_at AS kyc_updated_at
    FROM mo_user_info ui
    LEFT JOIN mo_kyc_details kyc ON kyc.user_id = ui.id
    ${whereClause ? whereClause + ' AND' : ' WHERE'}
    kyc.aadhaar_status IS NOT NULL
    AND kyc.pan_status IS NOT NULL
    ORDER BY kyc.created_at DESC
    LIMIT ? OFFSET ?
`;

            const finalParams = [...queryParams, limit, offset];

            db.mainDb(dataQuery, finalParams, (err, data) => {
                if (err) {
                    return res.json({ status: 0, message: "Error fetching KYC list" });
                }

                // ✅ Map numeric status to human-readable text
                const formattedData = data.map(user => ({
                    ...user,
                    aadhaar_status_text:
                        user.aadhaar_status === 1 ? 'verified' :
                            user.aadhaar_status === 2 ? 'rejected' : 'pending',
                    pan_status_text:
                        user.pan_status === 1 ? 'verified' :
                            user.pan_status === 2 ? 'rejected' : 'pending'
                }));

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    data: formattedData
                });
            });
        });

    } catch (err) {
        console.error("userKycListAdmin error:", err);
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};

// exports.userBankVerificationListAdmin = async (req, res) => {
//     try {
//         const reqData = req.body;

//         const validate = new Validator(reqData, {
//             pageNo: 'required|integer|min:1',
//             pageSize: 'required|integer|min:1',
//             status: 'required|in:pending,approved,rejected,all',
//             email: 'string'
//         });

//         const matched = await validate.check();
//         if (!matched) {
//             let error_message = '';
//             Object.keys(validate.errors).forEach((key) => {
//                 error_message += (error_message ? ', ' : '') + validate.errors[key].message;
//             });
//             return res.json({ status: 0, message: error_message });
//         }

//         const page = parseInt(reqData.pageNo);
//         const limit = parseInt(reqData.pageSize);
//         const offset = (page - 1) * limit;

//         let whereConditions = [];
//         let queryParams = [];

//         // ✅ Status Mapping
//         if (reqData.status !== 'all') {
//             const statusMap = {
//                 pending: 0,
//                 approved: 1,
//                 rejected: 2
//             };
//             whereConditions.push('is_bank_verified = ?');
//             queryParams.push(statusMap[reqData.status]);
//         }

//         // ✅ Email Filter
//         if (reqData.email && reqData.email.trim() !== '') {
//             whereConditions.push('email LIKE ?');
//             queryParams.push(`%${reqData.email.trim()}%`);
//         }

//         const whereClause = whereConditions.length > 0
//             ? 'WHERE ' + whereConditions.join(' AND ')
//             : '';

//         const countQuery = `
//             SELECT COUNT(*) as total
//             FROM mo_user_info
//             ${whereClause}
//         `;

//         db.mainDb(countQuery, queryParams, (err, countResult) => {
//             if (err) {
//                 return res.json({ status: 0, message: "Error fetching bank verification count" });
//             }

//             const totalRecords = countResult[0].total;

//             const dataQuery = `
//                 SELECT 
//                     id,
//                     username,
//                     email,
//                     mblno,
//                     is_bank_verified,
//                     created_at
//                 FROM mo_user_info
//                 ${whereClause}
//                 ORDER BY created_at DESC
//                 LIMIT ? OFFSET ?
//             `;

//             const finalParams = [...queryParams, limit, offset];

//             db.mainDb(dataQuery, finalParams, (err, data) => {
//                 if (err) {
//                     return res.json({ status: 0, message: "Error fetching bank verification list" });
//                 }

//                 return res.json({
//                     status: 1,
//                     page,
//                     pageSize: limit,
//                     totalRecords,
//                     totalPages: Math.ceil(totalRecords / limit),
//                     data
//                 });
//             });
//         });

//     } catch (err) {
//         return res.json({ status: 0, message: "Something went wrong!" });
//     }
// };


exports.userBankVerificationListAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        const validate = new Validator(reqData, {
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1',
            status: 'required|in:pending,approved,rejected,all',
            email: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                error_message += (error_message ? ', ' : '') + validate.errors[key].message;
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Status Filter
        if (reqData.status !== 'all') {
            const statusMap = { pending: 0, approved: 1, rejected: 2 };
            whereConditions.push('b.bank_status = ?');
            queryParams.push(statusMap[reqData.status]);
        }

        // ✅ Email Filter
        if (reqData.email && reqData.email.trim() !== '') {
            whereConditions.push('u.email LIKE ?');
            queryParams.push(`%${reqData.email.trim()}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ✅ Count Query: only users with bank details
        const countQuery = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM mo_user_info u
            INNER JOIN mo_bank_details b ON b.user_id = u.id
            ${whereClause}
        `;

        db.mainDb(countQuery, queryParams, (err, countResult) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching bank verification count" });
            }

            const totalRecords = countResult[0].total;

            // ✅ Data Query: only users with bank details
            const dataQuery = `
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.mblno,
                    b.bank_status,
                    b.acc_no,
                    b.ifsc_code,
                    b.fund_account_id,
                    b.reject_reason,
                    b.created_at AS bank_created_at,
                    b.updated_at AS bank_updated_at
                FROM mo_user_info u
                INNER JOIN mo_bank_details b ON b.user_id = u.id
                ${whereClause}
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const finalParams = [...queryParams, limit, offset];

            db.mainDb(dataQuery, finalParams, (err, data) => {
                if (err) {
                    return res.json({ status: 0, message: "Error fetching bank verification list" });
                }

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    data
                });
            });
        });

    } catch (err) {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};


exports.getSingleKycDetail = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            user_id: 'required|integer|min:1'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });
            return res.json({ status: 0, message: error_message });
        }

        const query = `
            SELECT 
                u.id AS user_id, 
                u.username,
                u.email,
                u.mblno,
                u.is_kyc_verified,
                u.is_bank_verified,

                -- KYC details
                k.aadhaar_status,
                k.pan_status,
                k.aadhaar_number,
                k.pan_number,
                k.aadhaar_front_image,
                k.aadhaar_back_image,
                k.pan_image,
                k.aadhaar_reject_reason,
                k.pan_reject_reason,
                k.updated_at AS kyc_updated_at,

                -- Bank details
                b.acc_no,
                b.ifsc_code,
                b.bank_image,
                b.bank_status,
                b.reject_reason AS bank_reject_reason,
                b.updated_at AS bank_updated_at

            FROM mo_user_info u
            LEFT JOIN mo_kyc_details k ON u.id = k.user_id
            LEFT JOIN mo_bank_details b ON u.id = b.user_id
            WHERE u.id = ?
        `;

        await db.mainDb(query, [reqData.user_id], (err, data) => {
            if (err) {
                console.log("Single KYC detail error:", err);
                return res.json({ status: 0, message: "Error fetching KYC detail" });
            }

            if (!data || data.length === 0) {
                return res.json({ status: 0, message: "User not found" });
            }

            const user = data[0];

            // ✅ Optional: Mask sensitive data
            const maskNumber = (num, visible = 4) => {
                if (!num) return null;
                return num.slice(0, -visible).replace(/./g, 'X') + num.slice(-visible);
            };

            // ✅ Status mapping
            const statusMap = {
                0: "Pending",
                1: "Verified",
                2: "Rejected"
            };

            const responseData = {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                mobile: user.mblno,

                verification_status: {
                    kyc_verified: user.is_kyc_verified,
                    bank_verified: user.is_bank_verified
                },

                kyc_details: {
                    aadhaar_status: statusMap[user.aadhaar_status] || null,
                    pan_status: statusMap[user.pan_status] || null,
                    aadhaar_number: maskNumber(user.aadhaar_number),
                    pan_number: user.pan_number,
                    aadhaar_front_image: user.aadhaar_front_image,
                    aadhaar_back_image: user.aadhaar_back_image,
                    pan_image: user.pan_image,
                    aadhaar_reject_reason: user.aadhaar_reject_reason,
                    pan_reject_reason: user.pan_reject_reason,
                    updated_at: user.kyc_updated_at
                },

                bank_details: {
                    account_number: maskNumber(user.acc_no),
                    ifsc_code: user.ifsc_code,
                    bank_image: user.bank_image,
                    bank_status: statusMap[user.bank_status] || null,
                    reject_reason: user.bank_reject_reason,
                    updated_at: user.bank_updated_at
                }
            };

            return res.json({ status: 1, data: responseData });
        });

    } catch (err) {
        console.log("getSingleKycDetail error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};


// exports.verifyBankAdmin = async (req, res) => {
//     try {
//         const reqData = req.body;

//         // ✅ Basic validation
//         const validate = new Validator(reqData, {
//             user_id: 'required|integer',
//             bank_status: 'required|integer|in:0,1,2'
//         });

//         const matched = await validate.check();
//         if (!matched) {
//             let msg = '';
//             Object.values(validate.errors).forEach(e => {
//                 msg += (msg ? ', ' : '') + e.message;
//             });
//             return res.json({ status: 0, message: msg });
//         }

//         const { user_id, bank_status, reject_reason } = reqData;

//         // ✅ Conditional validation: reject_reason required if bank_status is rejected (2)
//         if (bank_status == 2 && (!reject_reason || reject_reason.trim() === "")) {
//             return res.json({ status: 0, message: "reject_reason is required when bank_status is rejected" });
//         }

//         // 🔄 Update bank table
//         const updateBankQuery = `
//             UPDATE mo_bank_details
//             SET bank_status = ?, reject_reason = ?, updated_at = NOW()
//             WHERE user_id = ?
//         `;
//         await db.mainDb(updateBankQuery, [
//             bank_status,
//             reject_reason || null,
//             user_id
//         ], async (err) => {
//             if (err) {
//                 console.log("verifyBankAdmin DB error:", err);
//                 return res.json({ status: 0, message: "Error updating bank status" });
//             }

//             // 🔄 Sync to user table
//             const updateUserQuery = `
//                 UPDATE mo_user_info
//                 SET is_bank_verified = ?
//                 WHERE id = ?
//             `;
//             await db.mainDb(updateUserQuery, [bank_status, user_id], (err2) => {
//                 if (err2) {
//                     console.log("verifyBankAdmin user update error:", err2);
//                     return res.json({ status: 0, message: "Error updating user bank status" });
//                 }

//                 return res.json({
//                     status: 1,
//                     message: "Bank verification updated successfully",
//                     is_bank_verified: bank_status
//                 });
//             });
//         });

//     } catch (err) {
//         console.log("verifyBankAdmin error:", err);
//         return res.json({ status: 0, message: "Something went wrong" });
//     }
// };



exports.adminOtp = async (req, res) => {
    try {


        const query = `
            SELECT otp FROM mo_admin_info WHERE id = 1`;

        await db.mainDb(query, "", (err, data) => {
            if (err) {
                return res.json({ status: 0, message: "DB error" });
            } else {

                return res.json({
                    status: 1,
                    OTP: data[0].otp
                });
            }

        });

    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};




exports.depositList = async (req, res) => {
    try {
        // 1️⃣ Input validation
        const v = new Validator(req.body, {
            status: 'sometimes|integer|in:0,1,2',  // Only 0,1,2 allowed
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1|max:100',
            search: 'sometimes|string|maxLength:100'
        });

        const matched = await v.check();
        if (!matched) {
            let error_message = '';
            Object.values(v.errors).forEach(e => {
                error_message += (error_message ? ', ' : '') + e.message;
            });
            return res.status(400).json({ success: false, message: error_message });
        }

        // 2️⃣ Extract values
        const pageNo = parseInt(req.body.pageNo);
        const pageSize = parseInt(req.body.pageSize);
        const search = req.body.search;
        let whereClauses = [];
        let queryParams = [];

        // Status mapping: 0=pending, 1=completed, 2=failed
        if (req.body.status !== undefined) {
            const statusMap = { 0: 'created', 1: 'paid', 2: 'failed' };
            const status = statusMap[req.body.status];
            whereClauses.push('order_status = ?');
            queryParams.push(status);
        }

        // Search by order_id, receipt, payment_id
        if (search) {
            whereClauses.push('(order_id LIKE ? OR receipt LIKE ? OR payment_id LIKE ?)');
            const searchValue = `%${search}%`;
            queryParams.push(searchValue, searchValue, searchValue);
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
        const offset = (pageNo - 1) * pageSize;

        // 3️⃣ Fetch paginated results
        const dataQuery = `
            SELECT id, user_id, amount, currency, receipt, order_id, order_status, order_created_at, created_at, payment_id
            FROM mo_order_details
            ${whereSQL}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...queryParams, pageSize, offset];

        db.mainDb(dataQuery, dataParams, (err, results) => {
            if (err) {
                console.error('DB fetch error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            // 4️⃣ Total count for pagination
            const countQuery = `SELECT COUNT(*) as total FROM mo_order_details ${whereSQL}`;
            db.mainDb(countQuery, queryParams, (err, countResult) => {
                if (err) {
                    console.error('DB count error:', err);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }

                const total = countResult[0].total;
                return res.json({
                    success: true,
                    pageNo,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize),
                    data: results
                });
            });
        });

    } catch (err) {
        console.error('depositList error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



exports.moveWalletAmount = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Input validation
        const validate = new Validator(reqData, {
            user_id: 'required|integer',
            amount: 'required|numeric|min:10.00',
            wallet_req_id: 'required|integer'
        });

        const matched = await validate.check();

        if (!matched) {
            let error_message = '';
            Object.values(validate.errors).forEach(e => {
                error_message += (error_message ? ', ' : '') + e.message;
            });
            return res.json({ status: 0, message: error_message });
        }

        const { user_id, amount, wallet_req_id } = reqData;

        // ✅ Decimal validation
        const amountRegex = /^\d+(\.\d{1,2})?$/;
        if (!amountRegex.test(amount)) {
            return res.json({
                status: 0,
                message: "Amount must be valid number with max 2 decimal places"
            });
        }

        const numericAmount = parseFloat(amount);

        // 1️⃣ Check wallet request
        const requestResult = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT * FROM mo_wallet_request WHERE id = ? AND user_id = ?`,
                [wallet_req_id, user_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (!requestResult.length) {
            return res.json({ status: 0, message: "Wallet request not found" });
        }

        const requestData = requestResult[0];

        console.log("requestData.status: ", requestData.status);
        if (requestData.status != 'pending') {
            return res.json({ status: 0, message: "Request already processed" });
        }

        if (parseFloat(requestData.amount) !== numericAmount) {
            return res.json({ status: 0, message: "Amount mismatch with request" });
        }

        // 2️⃣ Fetch current balances
        const walletResult = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT main_wallet, wallet FROM mo_user_wallet WHERE user_id = ?`,
                [user_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (!walletResult.length) {
            return res.json({ status: 0, message: 'Wallet not found for user' });
        }

        const beforeMain = parseFloat(walletResult[0].main_wallet);
        const beforeWallet = parseFloat(walletResult[0].wallet);

        if (beforeMain < numericAmount) {
            return res.json({ status: 0, message: 'Insufficient main_wallet balance' });
        }

        const afterMain = beforeMain - numericAmount;
        const afterWallet = beforeWallet + numericAmount;

        // 3️⃣ Update balances
        await new Promise((resolve, reject) => {
            db.mainDb(
                `UPDATE mo_user_wallet 
                 SET main_wallet = ?, wallet = ?, updated_at = NOW() 
                 WHERE user_id = ?`,
                [afterMain, afterWallet, user_id],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 4️⃣ Update request status → approved
        await new Promise((resolve, reject) => {
            db.mainDb(
                `UPDATE mo_wallet_request 
                 SET status = 'approved', updated_at = NOW() 
                 WHERE id = ?`,
                [wallet_req_id],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 5️⃣ Insert logs (optional)
        await new Promise((resolve, reject) => {
            db.mainDb(
                `INSERT INTO mo_user_wallet_access
                (user_id, wallet_type, transaction_type, amount, before_balance, after_balance, source, reference_id, remarks)
                VALUES (?, 'main_wallet', 'debit', ?, ?, ?, 'api', ?, ?)`,
                [user_id, numericAmount, beforeMain, afterMain, `wallet_req_id_${wallet_req_id}`, 'Moved via request approval'],
                (err) => err ? reject(err) : resolve()
            );
        });

        await new Promise((resolve, reject) => {
            db.mainDb(
                `INSERT INTO mo_user_wallet_access
                (user_id, wallet_type, transaction_type, amount, before_balance, after_balance, source, reference_id, remarks)
                VALUES (?, 'wallet', 'credit', ?, ?, ?, 'api', ?, ?)`,
                [user_id, numericAmount, beforeWallet, afterWallet, `wallet_req_id_${wallet_req_id}`, 'Received via request approval'],
                (err) => err ? reject(err) : resolve()
            );
        });

        return res.json({
            status: 1,
            message: `Successfully approved request and moved ₹${numericAmount}`,
            data: {
                main_wallet: { before: beforeMain, after: afterMain },
                wallet: { before: beforeWallet, after: afterWallet }
            }
        });

    } catch (err) {
        console.error('Move wallet error:', err);
        return res.json({ status: 0, message: 'Internal server error' });
    }
};


exports.userWalletRequestListAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1',
            status: 'required|in:pending,approved,rejected,all',
            email: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Status filter
        if (reqData.status !== 'all') {
            whereConditions.push('wr.status = ?');
            queryParams.push(reqData.status);
        }

        // ✅ Email filter (if not empty)
        if (reqData.email && reqData.email.trim() !== "") {
            whereConditions.push('ui.email LIKE ?');
            queryParams.push(`%${reqData.email.trim()}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ✅ Count Query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_wallet_request wr
            LEFT JOIN mo_user_info ui ON ui.id = wr.user_id
            ${whereClause}
        `;

        db.mainDb(countQuery, queryParams, (err, countResult) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching count" });
            }

            const totalRecords = countResult[0].total;

            // ✅ Data Query
            const dataQuery = `
                SELECT 
                    wr.*,
                    ui.username,
                    ui.email,
                    ui.mblno
                FROM mo_wallet_request wr
                LEFT JOIN mo_user_info ui ON ui.id = wr.user_id
                ${whereClause}
                ORDER BY wr.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const finalParams = [...queryParams, limit, offset];

            db.mainDb(dataQuery, finalParams, (err, data) => {
                if (err) {
                    return res.json({ status: 0, message: "Error fetching wallet list" });
                }

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    data
                });
            });
        });

    } catch (err) {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};


// exports.approveWithdraw = async (req, res) => {
//     try {
//         const { withdrawal_id } = req.body;

//         if (!withdrawal_id) {
//             return res.json({ status: 0, message: "Withdrawal ID required" });
//         }

//         // 1️⃣ Get withdrawal request
//         const withdrawalRows = await new Promise((resolve, reject) => {
//             db.mainDb(
//                 `SELECT * FROM mo_user_withdrawals WHERE id = ?`,
//                 [withdrawal_id],
//                 (err, rows) => err ? reject(err) : resolve(rows)
//             );
//         });

//         if (!withdrawalRows.length) {
//             return res.json({ status: 0, message: "Withdrawal not found" });
//         }

//         const withdrawal = withdrawalRows[0];

//         if (withdrawal.status !== "pending") {
//             return res.json({ status: 0, message: "Withdrawal already processed" });
//         }

//         const user_id = withdrawal.user_id;
//         const amount = parseFloat(withdrawal.amount);

//         // 2️⃣ Check hold balance
//         const walletRows = await new Promise((resolve, reject) => {
//             db.mainDb(
//                 `SELECT hold FROM mo_user_wallet WHERE user_id = ?`,
//                 [user_id],
//                 (err, rows) => err ? reject(err) : resolve(rows)
//             );
//         });

//         if (!walletRows.length) {
//             return res.json({ status: 0, message: "Wallet not found" });
//         }

//         if (parseFloat(walletRows[0].hold) < amount) {
//             return res.json({ status: 0, message: "Insufficient hold balance" });
//         }

//         // 3️⃣ Get verified bank details
//         const bankRows = await new Promise((resolve, reject) => {
//             db.mainDb(
//                 `SELECT * FROM mo_bank_details WHERE user_id = ? AND bank_status = 1`,
//                 [user_id],
//                 (err, rows) => err ? reject(err) : resolve(rows)
//             );
//         });

//         if (!bankRows.length) {
//             return res.json({ status: 0, message: "No verified bank account found" });
//         }

//         const bank = bankRows[0];

//         let payout;

//         try {
//             // 4️⃣ Create payout from admin Razorpay account
//             payout = await razorpay.payouts.create({
//                 account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
//                 fund_account: {
//                     account_type: "bank_account",
//                     bank_account: {
//                         name: "User " + user_id,
//                         ifsc: bank.ifsc_code,
//                         account_number: bank.acc_no
//                     }
//                 },
//                 amount: amount * 100, // Razorpay expects paise
//                 currency: "INR",
//                 mode: "IMPS",
//                 purpose: "payout",
//                 queue_if_low_balance: true,
//                 reference_id: withdrawal.reference_id,
//                 narration: "User Withdrawal"
//             });
//         } catch (rzpError) {
//             console.error("Razorpay error:", rzpError);

//             const errorMessage =
//                 rzpError?.error?.description || rzpError?.message || "Razorpay API error";

//             // Update withdrawal as failed
//             await new Promise((resolve, reject) => {
//                 db.mainDb(
//                     `UPDATE mo_user_withdrawals 
//                      SET status = 'failed',
//                          razorpay_status = 'failed',
//                          remarks = ?,
//                          updated_at = NOW()
//                      WHERE id = ?`,
//                     [errorMessage, withdrawal_id],
//                     (err) => err ? reject(err) : resolve()
//                 );
//             });

//             return res.json({
//                 status: 0,
//                 message: "Razorpay payout failed",
//                 error: errorMessage
//             });
//         }

//         // 5️⃣ Save payout details (hold not deducted here)
//         await new Promise((resolve, reject) => {
//             db.mainDb(
//                 `UPDATE mo_user_withdrawals 
//                  SET status = 'approved',
//                      razorpay_payout_id = ?,
//                      razorpay_status = ?,
//                      remarks = 'Payout initiated',
//                      updated_at = NOW()
//                  WHERE id = ?`,
//                 [payout.id, payout.status, withdrawal_id],
//                 (err) => err ? reject(err) : resolve()
//             );
//         });

//         return res.json({
//             status: 1,
//             message: "Withdrawal approved & payout initiated",
//             payout_id: payout.id,
//             razorpay_status: payout.status
//         });

//     } catch (err) {
//         console.error("Internal server error:", err);
//         return res.json({
//             status: 0,
//             message: "Internal server error"
//         });
//     }
// };


exports.userWithdrawListAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1',
            status: 'required|in:pending,approved,rejected,all',
            email: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Status filter
        if (reqData.status !== 'all') {
            whereConditions.push('w.status = ?');
            queryParams.push(reqData.status);
        }

        // ✅ Email filter
        if (reqData.email && reqData.email.trim() !== "") {
            whereConditions.push('ui.email LIKE ?');
            queryParams.push(`%${reqData.email.trim()}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ✅ Count Query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_user_withdrawals w
            LEFT JOIN mo_user_info ui ON ui.id = w.user_id
            ${whereClause}
        `;

        db.mainDb(countQuery, queryParams, (err, countResult) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching count" });
            }

            const totalRecords = countResult[0].total;

            // ✅ Data Query
            const dataQuery = `
                SELECT 
                    w.*,
                    ui.username,
                    ui.email,
                    ui.mblno,
                    ui.is_kyc_verified,
                    ui.is_bank_verified
                FROM mo_user_withdrawals w
                LEFT JOIN mo_user_info ui ON ui.id = w.user_id
                ${whereClause}
                ORDER BY w.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const finalParams = [...queryParams, limit, offset];

            db.mainDb(dataQuery, finalParams, (err, data) => {
                if (err) {
                    return res.json({ status: 0, message: "Error fetching withdraw list" });
                }

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    data
                });
            });
        });

    } catch (err) {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};

exports.verifyBankAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        const validate = new Validator(reqData, {
            user_id: 'required|integer',
            bank_status: 'required|integer|in:0,1,2'
        });

        const matched = await validate.check();
        if (!matched) {
            let msg = '';
            Object.values(validate.errors).forEach(e => {
                msg += (msg ? ', ' : '') + e.message;
            });
            return res.json({ status: 0, message: msg });
        }

        const { user_id, bank_status, reject_reason } = reqData;

        if (bank_status === 2 && (!reject_reason || reject_reason.trim() === "")) {
            return res.json({ status: 0, message: "reject_reason is required when bank_status is rejected" });
        }

        // 1️⃣ Update bank details
        const updateBankQuery = `
      UPDATE mo_bank_details 
      SET bank_status=?, reject_reason=?, updated_at=NOW() 
      WHERE user_id=?
    `;
        db.mainDb(updateBankQuery, [bank_status, reject_reason || null, user_id], (err) => {
            if (err) {
                console.error("Bank update error:", err);
                return res.json({ status: 0, message: "Error updating bank status" });
            }

            // 2️⃣ Update user info
            const updateUserQuery = `UPDATE mo_user_info SET is_bank_verified=? WHERE id=?`;
            db.mainDb(updateUserQuery, [bank_status, user_id], (err2) => {
                if (err2) {
                    console.error("User update error:", err2);
                    return res.json({ status: 0, message: "Error updating user bank status" });
                }

                // 3️⃣ If verified, create Razorpay fund account
                if (bank_status == 1) {
                    db.mainDb(
                        `SELECT acc_no, ifsc_code FROM mo_bank_details WHERE user_id=?`,
                        [user_id],
                        async (err3, rows) => {
                            if (err3) {
                                console.error("Bank select error:", err3);
                                return res.json({ status: 0, message: "Error fetching bank details" });
                            }
                            if (!rows.length) return res.json({ status: 0, message: "Bank not found" });

                            const bank = rows[0];
                            let fund_account_id = null;

                            try {
                                const fundAccount = await razorpay.fundAccounts.create({
                                    account_type: "bank_account",
                                    bank_account: {
                                        name: "User " + user_id,
                                        ifsc: bank.ifsc_code,
                                        account_number: bank.acc_no
                                    },
                                    contact: { name: "User " + user_id }
                                });

                                fund_account_id = fundAccount.id;
                                console.log("fundAccount:==============> ", fundAccount);

                                // Save fund_account_id in DB
                                db.mainDb(
                                    `UPDATE mo_bank_details SET fund_account_id=? WHERE user_id=?`,
                                    [fund_account_id, user_id],
                                    (err4) => {
                                        if (err4) console.error("Fund account save error:", err4);
                                        return res.json({
                                            status: 1,
                                            message: "Bank verified & fund account created",
                                            is_bank_verified: bank_status,
                                            fund_account_id
                                        });
                                    }
                                );

                            } catch (rzpErr) {
                                console.error("Razorpay fund account error:", rzpErr);
                                return res.json({
                                    status: 1,
                                    message: "Bank verified but fund account creation failed",
                                    is_bank_verified: bank_status,
                                    fund_account_id: null
                                });
                            }
                        }
                    );
                } else {
                    return res.json({
                        status: 1,
                        message: bank_status === 2 ? "Bank rejected" : "Bank updated",
                        is_bank_verified: bank_status,
                        fund_account_id: null
                    });
                }

            });
        });

    } catch (err) {
        console.error("verifyBankAdmin error:", err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};





exports.approveWithdraw = (req, res) => {
    try {
        const { withdrawal_id } = req.body;
        if (!withdrawal_id) return res.json({ status: 0, message: "Withdrawal ID required" });

        // 1️⃣ Get withdrawal request
        db.mainDb(
            `SELECT * FROM mo_user_withdrawals WHERE id=?`,
            [withdrawal_id],
            (err, withdrawalRows) => {
                if (err) {
                    console.error("Withdrawal select error:", err);
                    return res.json({ status: 0, message: "Error fetching withdrawal" });
                }
                if (!withdrawalRows.length) return res.json({ status: 0, message: "Withdrawal not found" });

                const withdrawal = withdrawalRows[0];
                if (withdrawal.status !== "pending") return res.json({ status: 0, message: "Withdrawal already processed" });

                const user_id = withdrawal.user_id;
                const amount = parseFloat(withdrawal.amount);

                // 2️⃣ Check hold balance
                db.mainDb(
                    `SELECT hold FROM mo_user_wallet WHERE user_id=?`,
                    [user_id],
                    (err2, walletRows) => {
                        if (err2) {
                            console.error("Wallet select error:", err2);
                            return res.json({ status: 0, message: "Error fetching wallet" });
                        }
                        if (!walletRows.length) return res.json({ status: 0, message: "Wallet not found" });
                        if (parseFloat(walletRows[0].hold) < amount) return res.json({ status: 0, message: "Insufficient hold balance" });

                        // 3️⃣ Get fund account
                        db.mainDb(
                            `SELECT fund_account_id FROM mo_bank_details WHERE user_id=? AND bank_status=1`,
                            [user_id],
                            async (err3, bankRows) => {
                                if (err3) {
                                    console.error("Bank select error:", err3);
                                    return res.json({ status: 0, message: "Error fetching bank details" });
                                }
                                if (!bankRows.length || !bankRows[0].fund_account_id) {
                                    return res.json({ status: 0, message: "No verified fund account found" });
                                }

                                const fund_account_id = bankRows[0].fund_account_id;

                                // 4️⃣ Razorpay payout
                                let payout;
                                try {
                                    payout = await razorpay.payouts.create({
                                        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
                                        fund_account: fund_account_id,
                                        amount: amount * 100, // paise
                                        currency: "INR",
                                        mode: "IMPS",
                                        purpose: "payout",
                                        queue_if_low_balance: true,
                                        reference_id: withdrawal.reference_id,
                                        narration: "User Withdrawal"
                                    });
                                } catch (rzpErr) {
                                    console.error("Razorpay payout error:", rzpErr);
                                    const errorMessage = rzpErr?.error?.description || rzpErr?.message || "Razorpay API error";

                                    return db.mainDb(
                                        `UPDATE mo_user_withdrawals SET status='failed', razorpay_status='failed', remarks=?, updated_at=NOW() WHERE id=?`,
                                        [errorMessage, withdrawal_id],
                                        () => res.json({ status: 0, message: "Razorpay payout failed", error: errorMessage })
                                    );
                                }

                                // 5️⃣ Update withdrawal status
                                db.mainDb(
                                    `UPDATE mo_user_withdrawals SET status='approved', razorpay_payout_id=?, razorpay_status=?, remarks='Payout initiated', updated_at=NOW() WHERE id=?`,
                                    [payout.id, payout.status, withdrawal_id],
                                    (err4) => {
                                        if (err4) {
                                            console.error("Withdrawal update error:", err4);
                                            return res.json({ status: 0, message: "Error updating withdrawal" });
                                        }

                                        return res.json({
                                            status: 1,
                                            message: "Withdrawal approved & payout initiated",
                                            payout_id: payout.id,
                                            razorpay_status: payout.status
                                        });
                                    }
                                );

                            }
                        );

                    }
                );

            }
        );

    } catch (err) {
        console.error("approveWithdraw error:", err);
        return res.json({ status: 0, message: "Internal server error" });
    }
};




























/*
|--------------------------------------------------------------------------
| 1️⃣ Admin Ticket List (Pagination + Status)
|--------------------------------------------------------------------------
*/
// exports.ticketListAdmin = async (req, res) => {
//     try {
//         const reqData = req.body;

//         const page = parseInt(reqData.pageNo);
//         const limit = parseInt(reqData.pageSize);
//         const offset = (page - 1) * limit;

//         let where = "";
//         let params = [];

//         if (reqData.status && reqData.status != "all") {
//             where = "WHERE t.status=?";
//             params.push(reqData.status);
//         }

//         const countQuery = `
//             SELECT COUNT(*) as total
//             FROM mo_user_tickets t
//             ${where}
//         `;

//         db.mainDb(countQuery, params, (err, countRes) => {

//             const total = countRes[0].total;

//             const dataQuery = `
//                 SELECT t.*, u.username, u.email
//                 FROM mo_user_tickets t
//                 LEFT JOIN mo_user_info u ON u.id = t.user_id
//                 ${where}
//                 ORDER BY t.created_at DESC
//                 LIMIT ? OFFSET ?
//             `;

//             db.mainDb(dataQuery, [...params, limit, offset], (err2, data) => {
//                 console.log("err2: ", err2);
//                 console.log("data: ", data);
//                 return res.json({
//                     status: 1,
//                     totalRecords: total,
//                     totalPages: Math.ceil(total / limit),
//                     data
//                 });
//             });
//         });

//     } catch {
//         return res.json({ status: 0, message: "Something went wrong!" });
//     }
// };



exports.ticketListAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let where = [];
        let params = [];

        // ✅ Status filter
        if (reqData.status && reqData.status != "all") {
            where.push("t.status = ?");
            params.push(reqData.status);
        }

        // ✅ Email search filter
        if (reqData.email && reqData.email.trim() !== "") {
            where.push("u.email LIKE ?");
            params.push(`%${reqData.email.trim()}%`);
        }

        // Combine WHERE clause
        const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

        // ✅ Count query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_user_tickets t
            LEFT JOIN mo_user_info u ON u.id = t.user_id
            ${whereClause}
        `;

        db.mainDb(countQuery, params, (err, countRes) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching ticket count" });
            }

            const total = countRes[0].total;

            // ✅ Data query
            const dataQuery = `
                SELECT t.*, u.username, u.email
                FROM mo_user_tickets t
                LEFT JOIN mo_user_info u ON u.id = t.user_id
                ${whereClause}
                ORDER BY t.created_at DESC
                LIMIT ? OFFSET ?
            `;

            db.mainDb(dataQuery, [...params, limit, offset], (err2, data) => {
                if (err2) {
                    return res.json({ status: 0, message: "Error fetching ticket list" });
                }

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords: total,
                    totalPages: Math.ceil(total / limit),
                    data
                });
            });
        });

    } catch (err) {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};
























/*
|--------------------------------------------------------------------------
| 2️⃣ Admin Ticket Details (Full Conversation)
|--------------------------------------------------------------------------
*/
exports.ticketDetailsAdmin = (req, res) => {
    const { ticket_id } = req.body;

    const ticketQuery = `
        SELECT t.*, u.username, u.email
        FROM mo_user_tickets t
        LEFT JOIN mo_user_info u ON u.id = t.user_id
        WHERE t.id=?
    `;

    db.mainDb(ticketQuery, [ticket_id], (err, ticket) => {

        if (ticket.length === 0)
            return res.json({ status: 0, message: "Ticket not found" });

        const messageQuery = `
            SELECT *
            FROM mo_user_ticket_messages
            WHERE ticket_id=?
            ORDER BY created_at ASC
        `;

        db.mainDb(messageQuery, [ticket_id], (err2, messages) => {
            return res.json({
                status: 1,
                ticket: ticket[0],
                messages
            });
        });
    });
};


/*
|--------------------------------------------------------------------------
| 3️⃣ Admin Reply Ticket
|--------------------------------------------------------------------------
*/
exports.replyTicketAdmin = (req, res) => {
    const { ticket_id, message } = req.body;

    const checkQuery = `
        SELECT * FROM mo_user_tickets
        WHERE id=? AND status='open'
    `;

    db.mainDb(checkQuery, [ticket_id], (err, result) => {

        if (result.length === 0)
            return res.json({ status: 0, message: "Ticket closed or not found" });

        const insertMessage = `
            INSERT INTO mo_user_ticket_messages (ticket_id, sender, message)
            VALUES (?, 'admin', ?)
        `;

        db.mainDb(insertMessage, [ticket_id, message], (err2) => {
            return res.json({ status: 1, message: "Reply sent successfully" });
        });
    });
};


/*
|--------------------------------------------------------------------------
| 4️⃣ Close Ticket
|--------------------------------------------------------------------------
*/
exports.closeTicketAdmin = (req, res) => {
    const { ticket_id } = req.body;

    const updateQuery = `
        UPDATE mo_user_tickets
        SET status='closed'
        WHERE id=?
    `;

    db.mainDb(updateQuery, [ticket_id], () => {
        return res.json({ status: 1, message: "Ticket closed successfully" });
    });
};

/* 5️⃣ Search ticket by ID */
exports.searchTicket = (req, res) => {
    const { ticket_id } = req.body;

    const query = `SELECT * FROM mo_user_tickets WHERE id=?`;

    db.mainDb(query, [ticket_id], (err, ticket) => {
        if (ticket.length === 0) return res.json({ status: 0, message: "Not found" });

        const msgQuery = `SELECT * FROM mo_user_ticket_messages WHERE ticket_id=? ORDER BY created_at ASC`;

        db.mainDb(msgQuery, [ticket_id], (err2, messages) => {
            return res.json({
                status: 1,
                ticket: ticket[0],
                messages
            });
        });
    });
};



exports.userDailyWalletProfitAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1',
            email: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Email filter
        if (reqData.email && reqData.email.trim() !== "") {
            whereConditions.push('ui.email LIKE ?');
            queryParams.push(`%${reqData.email.trim()}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ✅ Count Query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_wallet_daily_profit wp
            LEFT JOIN mo_user_info ui ON ui.id = wp.user_id
            ${whereClause}
        `;

        db.mainDb(countQuery, queryParams, (err, countResult) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching count" });
            }

            const totalRecords = countResult[0].total;

            // ✅ Data Query
            const dataQuery = `
                SELECT 
                    wp.profit_amount AS wallet_profit,
                    wp.profit_date AS profit_date,
                    ui.username,
                    ui.email
                FROM mo_wallet_daily_profit wp
                LEFT JOIN mo_user_info ui ON ui.id = wp.user_id
                ${whereClause}
                ORDER BY wp.profit_date DESC
                LIMIT ? OFFSET ?
            `;

            const finalParams = [...queryParams, limit, offset];

            db.mainDb(dataQuery, finalParams, (err, data) => {
                if (err) {
                    return res.json({ status: 0, message: "Error fetching wallet profit list" });
                }

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    data
                });
            });
        });

    } catch (err) {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};






exports.userDailyReferralProfitAdmin = async (req, res) => {
    try {
        const reqData = req.body;

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'required|integer|min:1',
            pageSize: 'required|integer|min:1',
            email: 'string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach((key) => {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });
            return res.json({ status: 0, message: error_message });
        }

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // ✅ Email filter
        if (reqData.email && reqData.email.trim() !== "") {
            whereConditions.push('ui.email LIKE ?');
            queryParams.push(`%${reqData.email.trim()}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ✅ Count Query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_wallet_daily_profit_from_ref wpr
            LEFT JOIN mo_user_info ui ON wpr.referrer_id = ui.id
            ${whereClause}
        `;

        db.mainDb(countQuery, queryParams, (err, countResult) => {
            if (err) {
                return res.json({ status: 0, message: "Error fetching count" });
            }

            const totalRecords = countResult[0].total;

            // ✅ Data Query
            const dataQuery = `
                SELECT 
                    wpr.bonus_amount AS referral_bonus,
                    wpr.bonus_date AS bonus_date,
                    ui.username AS referred_username,
                    ui.email AS referred_email,
                    ref.username AS referrer_username,
                    ref.email AS referrer_email
                FROM mo_wallet_daily_profit_from_ref wpr
                LEFT JOIN mo_user_info ui ON wpr.referred_user_id = ui.id
                LEFT JOIN mo_user_info ref ON wpr.referrer_id = ref.id
                ${whereClause}
                ORDER BY wpr.bonus_date DESC
                LIMIT ? OFFSET ?
            `;

            const finalParams = [...queryParams, limit, offset];

            db.mainDb(dataQuery, finalParams, (err, data) => {
                if (err) {
                    return res.json({ status: 0, message: "Error fetching referral profit list" });
                }

                return res.json({
                    status: 1,
                    page,
                    pageSize: limit,
                    totalRecords,
                    totalPages: Math.ceil(totalRecords / limit),
                    data
                });
            });
        });

    } catch (err) {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};