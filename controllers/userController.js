const { Validator } = require("node-input-validator");
const db = require('../models/db')
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const common = require("../helper/common")
const moment = require("moment");
const mailhelper = require("../helper/mailHelper")




exports.createAccount = async (req, res) => {
    try {
        let reqData = req.body;
        console.log("reqData: ", reqData);
        const refcode = req.query.refcode; // optional referral code from user
        console.log("Referral code received:", refcode);

        const validate = new Validator(reqData, {
            username: 'required|minLength:1|maxLength:20',
            email: 'required|email',
            mobile: 'required|integer|minLength:10|maxLength:10',
            mail_otp: 'required|integer|minLength:4|maxLength:4',
            mob_otp: 'required|integer|minLength:4|maxLength:4',
            password: 'required'
        });

        const matched = await validate.check();

        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors).forEach(function (key) {
                if (validate.errors[key].message) {
                    error_message += (error_message ? ', ' : '') + validate.errors[key].message;
                }
            });

            return res.json({
                status: 0,
                responseCode: 'fail',
                message: error_message
            });
        } else {
            let selectQuery = "SELECT email, mblno FROM mo_user_info WHERE email = ? OR mblno = ?";
            await db.mainDb(selectQuery, [reqData.email, reqData.mobile], async (selectErr, selectData) => {

                if (selectErr) {
                    return res.json({ status: 0, message: "Error occurred when getting user data" });
                } else if (selectData.length > 0) {

                    if (selectData[0].email === reqData.email) {
                        return res.json({ status: 0, message: "Mail id already exists" });
                    }
                    if (selectData[0].mblno === reqData.mobile) {
                        return res.json({ status: 0, message: "Mobile number already exists" });
                    }

                } else {

                    const usernamePrefix = reqData.username.substring(0, 2).toUpperCase();
                    const randomNumber = Math.floor(1000 + Math.random() * 9000); // 4-digit
                    let userReferralCode = `${usernamePrefix}${randomNumber}`;

                    // // If no username (just in case) or fail-safe, default to AD123456
                    // if (!userReferralCode) userReferralCode = "AD123456";
                    // ✅ Check if the given referral code exists in DB
                    let referredFrom = "AD123456";
                    if (refcode) {
                        let refQuery = "SELECT referral_code FROM mo_user_info WHERE referral_code = ? LIMIT 1";
                        await db.mainDb(refQuery, [refcode], async (refErr, refData) => {
                            if (!refErr && refData.length > 0) {
                                referredFrom = refcode; // valid referral
                            }
                        });
                    }



                    const selectQuery = `SELECT * FROM mo_mobile_otp_logs WHERE mob_no LIKE ? ORDER BY id DESC LIMIT 1;SELECT * FROM mo_mail_otp_logs WHERE mail_id LIKE ? ORDER BY id DESC LIMIT 1;`;

                    await db.mainDb(selectQuery, [reqData.mobile, reqData.email], async (err, data) => {
                        console.log("err: ", err);
                        // console.log("data:=============> ", data[1][0].otp);

                        if (err) {

                            return res.json({ status: 0, message: "DB error" });

                        } else if (data[0].length == 0) {

                            return res.json({ status: 0, message: "Send And Verify Mobile OTP first" });

                        } else if (data[1].length == 0) {

                            return res.json({ status: 0, message: "Send And Verify Mail OTP first" });

                        } else if (data[0][0].otp != reqData.mob_otp) {

                            return res.json({ status: 0, message: "Wrong Mobile OTP... Try after sometime" });

                        } else if (data[1][0].otp != reqData.mail_otp) {

                            return res.json({ status: 0, message: "Wrong Mail OTP... Try after sometime" });

                        } else if (data[0][0].is_verify != 1) {

                            return res.json({ status: 0, message: "Verify Mobile OTP first" });

                        } else if (data[1][0].is_verify != 1) {

                            return res.json({ status: 0, message: "Verify Mail OTP first" });

                        } else if (data[1][0].otp == reqData.mail_otp && data[0][0].otp == reqData.mob_otp) {

                            let updateUsedMailStatus = await common.updateData("mo_mail_otp_logs", "is_verify = 1", `WHERE id = ${data[1][0].id}`)

                            let updateUsedMobStatus = await common.updateData("mo_mobile_otp_logs", "is_verify = 1", `WHERE id = ${data[0][0].id}`)

                            // let replaceble = {
                            //     USERNAME: reqData.username,
                            // }

                            // let mailStatus = await mailhelper.sendMailWithTemplate(reqData.email, "create_acc", replaceble)


                            // if (mailStatus.status == 1) {

                                if (updateUsedMailStatus.status == 1 && updateUsedMobStatus.status == 1) {


                                    let insertQuery = "INSERT INTO mo_user_info SET ?";

                                    let insertObj = {
                                        username: reqData.username,
                                        email: reqData.email,
                                        mblno: reqData.mobile,
                                        password: reqData.password,
                                        referral_code: userReferralCode,
                                        referred_from: referredFrom
                                    };

                                    await db.mainDb(insertQuery, insertObj, async (insertErr, insertData) => {
                                        console.log("insertErr: ", insertErr);
                                        if (insertErr || !insertData) {

                                            return res.json({ status: 0, message: "Error occurred when inserting user data" });

                                            // } else if (insertData.affectedRows === 1) {

                                            //     return res.json({
                                            //         status: 1,
                                            //         message: "Account Created Successfully",
                                            //         referral_code: userReferralCode,
                                            //         referred_from: referredFrom
                                            //     });

                                            // } 
                                        } else if (insertData.affectedRows === 1) {

                                            const userId = insertData.insertId;

                                            let walletInsertQuery = "INSERT INTO mo_user_wallet SET ?";

                                            let walletObj = {
                                                user_id: userId,
                                                main_wallet: 0.00,
                                                wallet: 0.00,
                                                last_updated_by: userId,
                                                updated_at: new Date()
                                            };

                                            await db.mainDb(walletInsertQuery, walletObj, async (walletErr, walletData) => {

                                                if (walletErr || !walletData) {
                                                    return res.json({
                                                        status: 0,
                                                        message: "User created but wallet creation failed"
                                                    });
                                                }

                                                return res.json({
                                                    status: 1,
                                                    message: "Account Created Successfully",
                                                    referral_code: userReferralCode,
                                                    referred_from: referredFrom
                                                });

                                            });
                                        }
                                        else {

                                            return res.json({ status: 0, message: "Account details can't insert" });

                                        }

                                    });
                                } else {

                                    return res.json({ status: 0, message: "Update Error.. Try after sometime" });

                                }


                            // } else {
                            //     return res.json({
                            //         status: 0,
                            //         message: "Error while send mail for login..."
                            //     });
                            // }



                        } else {

                            return res.json({ status: 0, message: "Something went wrong" });

                        }
                    });

                }

            });
        }



    } catch (err) {
        console.log("Error in createAccount:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};





exports.login = async (req, res) => {
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

        const selectQuery = "SELECT * FROM mo_user_info WHERE email = ?";
        db.mainDb(selectQuery, email, async (err, data) => {
            if (err) {
                return res.json({ status: 0, message: "DB error" });
            }

            if (data.length === 0) {
                return res.json({ status: 0, message: "User not found" });
            }

            if (data[0].password !== password) {
                return res.json({ status: 0, message: "Invalid password" });
            }

            // 🔐 Generate OTP & Token
            const otp = 111111
            //const otp = Math.floor(100000 + Math.random() * 900000); // 6 digit
            const token = crypto.randomBytes(32).toString("hex");
            const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

            // let replaceble = {
            //     USERNAME: data[0].username,
            //     OTP: otp
            // }

            // let mailStatus = await mailhelper.sendMailWithTemplate(email, "login_otp", replaceble)
            // if (mailStatus.status == 1) {

                const updateQuery = ` UPDATE mo_user_info SET otp=?, token=?, otp_expiry=?  WHERE id=?`;

                db.mainDb(updateQuery, [otp, token, expiry, data[0].id], () => {

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



exports.loginVerify = async (req, res) => {
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
            SELECT * FROM mo_user_info 
            WHERE token=? AND otp=?
        `;

        db.mainDb(query, [token, otp], (err, data) => {
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
                "SECRET@KEY",
                { expiresIn: "7d" }
            );
            const token = crypto.randomBytes(32).toString("hex");

            // Clear OTP & token
            const clearQuery = `
                UPDATE mo_user_info 
                SET otp=NULL, token= ?, otp_expiry=NULL
                WHERE id=?
            `;
            db.mainDb(clearQuery, [token, data[0].id]);

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

exports.info = async (req, res) => {
    try {

        const userId = req.user.userId;

        if (!userId) {
            return res.json({
                status: 0,
                message: "Invalid user"
            });
        }

        // Today's start and end time
        const startDate = moment().startOf("day").format("YYYY-MM-DD HH:mm:ss");
        const endDate = moment().endOf("day").format("YYYY-MM-DD HH:mm:ss");

        const finalQuery = `

        SELECT 
            u.id,
            u.username,
            u.email,
            u.mblno,
            u.is_kyc_verified,
            u.is_bank_verified,
            u.referral_code,
            uw.main_wallet,
            uw.wallet,
            uw.hold
        FROM mo_user_info u
        JOIN mo_user_wallet uw ON u.id = uw.user_id
        WHERE u.id = ?;

        SELECT IFNULL(SUM(amount),0) AS total_deposit
        FROM mo_order_details
        WHERE user_id = ?
        AND order_status = 'paid';

        SELECT IFNULL(SUM(amount),0) AS total_withdraw
        FROM mo_user_withdrawals
        WHERE user_id = ?
        AND status = 'approved';

        SELECT IFNULL(SUM(profit_amount),0) AS total_roi
        FROM mo_wallet_daily_profit
        WHERE user_id = ?;

        SELECT IFNULL(SUM(bonus_amount),0) AS total_ref_roi
        FROM mo_wallet_daily_profit_from_ref
        WHERE referrer_id = ?;

        SELECT IFNULL(SUM(profit_amount),0) AS today_roi
        FROM mo_wallet_daily_profit
        WHERE user_id = ?
        AND created_at BETWEEN ? AND ?;

        SELECT IFNULL(SUM(bonus_amount),0) AS today_ref_roi
        FROM mo_wallet_daily_profit_from_ref
        WHERE referrer_id = ?
        AND created_at BETWEEN ? AND ?;

        `;

        const params = [
            userId,                     // user info
            userId,                     // deposit
            userId,                     // withdraw
            userId,                     // total roi
            userId,                     // total ref roi
            userId, startDate, endDate, // today roi
            userId, startDate, endDate  // today ref roi
        ];

        db.mainDb(finalQuery, params, (err, results) => {

            if (err) {
                console.log(err);
                return res.json({
                    status: 0,
                    message: "Database error"
                });
            }

            if (!results[0] || results[0].length === 0) {
                return res.json({
                    status: 0,
                    message: "User not found"
                });
            }

            const total_roi = Number(results[3][0].total_roi);
            const total_ref_roi = Number(results[4][0].total_ref_roi);
            const today_roi = Number(results[5][0].today_roi);
            const today_ref_roi = Number(results[6][0].today_ref_roi);

            const finalData = {
                ...results[0][0],

                total_deposit: results[1][0].total_deposit,
                total_withdraw: results[2][0].total_withdraw,

                total_roi_by_his_main_wallet: total_roi,
                total_ref_roi: total_ref_roi,

                today_roi_by_his_main_wallet: today_roi,
                today_ref_roi: today_ref_roi,

                TOTAL_ROI: total_roi + total_ref_roi,
                TODAY_ROI: today_roi + today_ref_roi
            };

            return res.json({
                status: 1,
                message: "User info fetched successfully",
                data: finalData
            });

        });

    } catch (err) {
        console.log("User info error:", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};

exports.send_mail_otp_register = async (req, res) => {
    try {
        const { email } = req.body;

        const validate = new Validator(req.body, {
            email: 'required|email'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');

            return res.json({ status: 0, message: msg });
        } else {

            const selectQuery = "SELECT * FROM mo_user_info WHERE email = ?";

            await db.mainDb(selectQuery, email, async (err, data) => {

                if (err) {

                    return res.json({ status: 0, message: "DB error" });

                } else if (data.length > 0) {

                    return res.json({ status: 0, message: "Mail id already exist" });

                } else {
                    const otp = 1111

                    // const otp = Math.floor(1000 + Math.random() * 9000); // 4 digit
                    const token = crypto.randomBytes(32).toString("hex");
                    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

                    // let replaceble = {
                    //     OTP: otp
                    // }

                    // let mailStatus = await mailhelper.sendMailWithTemplate(email, "signup_otp", replaceble)
                    // console.log("mailStatus: ", mailStatus);

                    // if (mailStatus.status == 1) {

                    const insertQuery = `INSERT INTO mo_mail_otp_logs SET mail_id = ?, otp=?, otp_expiry=?`;

                    await db.mainDb(insertQuery, [email, otp, expiry], (insertErr, insertData) => {
                        console.log("insertErr: ", insertErr);
                        console.log("insertData: ", insertData);

                        if (insertErr) {

                            return res.json({ status: 0, message: "DB error" });

                        } else {

                            return res.json({
                                status: 1,
                                message: "OTP sent successfully"
                            });
                        }
                    });
                    // } else {
                    //     return res.json({
                    //         status: 0,
                    //         message: "Error while send mail for sign up..."
                    //     });
                    // }

                }
            });
        }
    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};



exports.send_mob_otp_register = async (req, res) => {
    try {
        const { mob_no } = req.body;

        const validate = new Validator(req.body, {
            mob_no: 'required|minLength:10|maxLength:10'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');

            return res.json({ status: 0, message: msg });
        } else {

            const selectQuery = "SELECT * FROM mo_user_info WHERE mblno = ?";

            await db.mainDb(selectQuery, mob_no, async (err, data) => {

                if (err) {

                    return res.json({ status: 0, message: "DB error" });

                } else if (data.length > 0) {

                    return res.json({ status: 0, message: "Mobile number already exist" });

                } else {
                    const otp = 1111
                    //const otp = Math.floor(1000 + Math.random() * 9000); // 6 digit
                    const token = crypto.randomBytes(32).toString("hex");
                    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

                    const insertQuery = `INSERT INTO mo_mobile_otp_logs SET mob_no = ?, otp=?, otp_expiry=?`;

                    await db.mainDb(insertQuery, [mob_no, otp, expiry], (insertErr, insertData) => {
                        console.log("insertErr: ", insertErr);
                        console.log("insertData: ", insertData);

                        if (insertErr) {

                            return res.json({ status: 0, message: "DB error" });

                        } else {

                            return res.json({
                                status: 1,
                                message: "OTP sent successfully"
                            });
                        }
                    });
                }
            });
        }
    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};




exports.verify_mail_otp_register = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const validate = new Validator(req.body, {
            email: 'required|email',
            otp: 'required|minLength:4|maxLength:4'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');

            return res.json({ status: 0, message: msg });
        } else {

            const selectQuery = "SELECT * FROM `mo_mail_otp_logs` WHERE `mail_id` LIKE ? ORDER BY `id` DESC LIMIT 1";

            await db.mainDb(selectQuery, email, async (err, data) => {
                console.log("err: ", err);
                console.log("data:=============> ", data);

                if (err) {

                    return res.json({ status: 0, message: "DB error" });

                } else if (data.length == 0) {

                    return res.json({ status: 0, message: "No data found" });

                } else if (data[0].otp != otp) {

                    return res.json({ status: 0, message: "Wrong OTP... Try after sometime" });

                } else if (data[0].is_verify == 1) {

                    return res.json({ status: 1, message: "Already Verified" });

                } else if (data[0].otp == otp) {

                    let updateVerifyStatus = await common.updateData("mo_mail_otp_logs", "is_verify = 1", `WHERE id = ${data[0].id}`)
                    console.log("updateVerifyStatus: ", updateVerifyStatus);
                    if (updateVerifyStatus.status == 1) {

                        return res.json({ status: 1, message: "OTP Verified successfully" });

                    } else {

                        return res.json({ status: 0, message: "Update Error.. Try after sometime" });

                    }
                } else {

                    return res.json({ status: 0, message: "Something went wrong" });

                }
            });
        }
    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};



exports.verify_mobile_otp_register = async (req, res) => {
    try {
        const { mob_no, otp } = req.body;

        const validate = new Validator(req.body, {
            mob_no: 'required|minLength:10|maxLength:10',
            otp: 'required|minLength:4|maxLength:4'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');

            return res.json({ status: 0, message: msg });
        } else {

            const selectQuery = "SELECT * FROM `mo_mobile_otp_logs` WHERE `mob_no` LIKE ? ORDER BY `id` DESC LIMIT 1";

            await db.mainDb(selectQuery, mob_no, async (err, data) => {
                console.log("err: ", err);
                console.log("data:=============> ", data);

                if (err) {

                    return res.json({ status: 0, message: "DB error" });

                } else if (data.length == 0) {

                    return res.json({ status: 0, message: "No data found" });

                } else if (data[0].otp != otp) {

                    return res.json({ status: 0, message: "Wrong OTP... Try after sometime" });

                } else if (data[0].is_verify == 1) {

                    return res.json({ status: 1, message: "Already Verified" });

                } else if (data[0].otp == otp) {

                    let updateVerifyStatus = await common.updateData("mo_mobile_otp_logs", "is_verify = 1", `WHERE id = ${data[0].id}`)
                    console.log("updateVerifyStatus: ", updateVerifyStatus);
                    if (updateVerifyStatus.status == 1) {

                        return res.json({ status: 1, message: "OTP Verified successfully" });

                    } else {

                        return res.json({ status: 0, message: "Update Error.. Try after sometime" });

                    }

                } else {

                    return res.json({ status: 0, message: "Something went wrong" });

                }
            });
        }
    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};




exports.getTestOtp = async (req, res) => {
    try {
        const { mob_no, email } = req.body;

        const validate = new Validator(req.body, {
            email: 'required',
            mob_no: 'required|minLength:10|maxLength:10'
        });

        if (!(await validate.check())) {
            let msg = Object.values(validate.errors)
                .map(e => e.message)
                .join(', ');

            return res.json({ status: 0, message: msg });
        } else {

            const selectQuery = `SELECT * FROM mo_mobile_otp_logs WHERE mob_no LIKE ? ORDER BY id DESC LIMIT 1;SELECT * FROM mo_mail_otp_logs WHERE mail_id LIKE ? ORDER BY id DESC LIMIT 1;`;

            await db.mainDb(selectQuery, [mob_no, email], async (err, data) => {

                if (err) {

                    return res.json({ status: 0, message: "DB error" });

                } else if (data.length == 0) {

                    return res.json({ status: 0, message: "No data found" });

                } else {

                    return res.json({ status: 1, message: "OTP is", data: data });

                }
            });
        }
    } catch (err) {
        console.log(err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};


exports.requestMoveWalletAmount = async (req, res) => {
    try {
        const user_id = 9;
        const { amount } = req.body;

        if (!amount) {
            return res.json({ status: 0, message: "Amount is required" });
        }

        if (typeof amount === "string" && amount.includes(",")) {
            return res.json({ status: 0, message: "Use dot (.) for decimal" });
        }
        const amountRegex = /^\d+(\.\d{1,2})?$/;
        if (!amountRegex.test(amount)) {
            return res.json({
                status: 0,
                message: "Amount must be valid number with max 2 decimal places"
            });
        }

        const numericAmount = parseFloat(amount);

        if (numericAmount < 10) {
            return res.json({ status: 0, message: "Minimum amount is 10" });
        }

        // Optional: check main_wallet balance
        const wallet = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT main_wallet FROM mo_user_wallet WHERE user_id = ?`,
                [user_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (!wallet.length) {
            return res.json({ status: 0, message: "Wallet not found" });
        }

        if (parseFloat(wallet[0].main_wallet) < numericAmount) {
            return res.json({ status: 0, message: "Insufficient balance" });
        }

        await new Promise((resolve, reject) => {
            db.mainDb(
                `INSERT INTO mo_wallet_request (user_id, amount) VALUES (?, ?)`,
                [user_id, numericAmount],
                (err) => err ? reject(err) : resolve()
            );
        });

        return res.json({
            status: 1,
            message: "Wallet move request submitted successfully"
        });

    } catch (err) {
        console.error(err);
        return res.json({ status: 0, message: "Internal server error" });
    }
};




exports.userDepositList = async (req, res) => {
    try {
        // 1️⃣ Input validation
        const v = new Validator(req.body, {
            status: 'sometimes|integer|in:0,1,2',       // optional
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

        // 2️⃣ Extract request values
        const userId = req.body.userId // Replace with actual authenticated user ID
        const pageNo = parseInt(req.body.pageNo);
        const pageSize = parseInt(req.body.pageSize);
        const search = req.body.search;

        let whereClauses = ['user_id = ?'];
        let queryParams = [userId];

        // Optional status filter
        if (req.body.status !== undefined) {
            const statusMap = { 0: 'created', 1: 'paid', 2: 'failed' };
            const status = statusMap[req.body.status];
            whereClauses.push('order_status = ?');
            queryParams.push(status);
        }

        // Optional search filter
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

            // 4️⃣ Get total count for pagination
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
        console.error('userDepositList error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



exports.userWalletRequestList = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId;
        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'integer|min:1',
            pageSize: 'integer|min:1'
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

        let queryParams = [];


        const query = `SELECT * FROM mo_wallet_request WHERE user_id = ${userId} ORDER BY created_at DESC  LIMIT ? OFFSET ? `;

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




exports.userWithdrawRequest = async (req, res) => {
    try {
        const user_id = req.user.userId;
        const { amount } = req.body;

        if (!amount) {
            return res.json({ status: 0, message: "Amount is required" });
        }

        if (typeof amount === "string" && amount.includes(",")) {
            return res.json({ status: 0, message: "Use dot (.) for decimal" });
        }

        const amountRegex = /^\d+(\.\d{1,2})?$/;
        if (!amountRegex.test(amount)) {
            return res.json({
                status: 0,
                message: "Amount must be valid number with max 2 decimal places"
            });
        }

        const numericAmount = parseFloat(amount);

        if (numericAmount < 10) {
            return res.json({ status: 0, message: "Minimum withdrawal amount is 10" });
        }

        // Get wallet balance
        const wallet = await new Promise((resolve, reject) => {
            db.mainDb(
                `SELECT wallet, hold FROM mo_user_wallet WHERE user_id = ?`,
                [user_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        if (!wallet.length) {
            return res.json({ status: 0, message: "Wallet not found" });
        }

        const currentWallet = parseFloat(wallet[0].wallet);

        if (currentWallet < numericAmount) {
            return res.json({ status: 0, message: "Insufficient wallet balance" });
        }

        // Update wallet: move wallet → hold
        await new Promise((resolve, reject) => {
            db.mainDb(
                `UPDATE mo_user_wallet 
                 SET wallet = wallet - ?, 
                     hold = hold + ?, 
                     updated_at = NOW()
                 WHERE user_id = ?`,
                [numericAmount, numericAmount, user_id],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Generate reference id
        const referenceId = "WD" + Date.now();

        // Insert withdrawal request
        await new Promise((resolve, reject) => {
            db.mainDb(
                `INSERT INTO mo_user_withdrawals 
                 (user_id, amount, reference_id, status) 
                 VALUES (?, ?, ?, 'pending')`,
                [user_id, numericAmount, referenceId],
                (err) => err ? reject(err) : resolve()
            );
        });

        return res.json({
            status: 1,
            message: "Withdraw request submitted successfully",
            reference_id: referenceId
        });

    } catch (err) {
        console.error(err);
        return res.json({ status: 0, message: "Internal server error" });
    }
};


exports.userWithdrawList = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId;
        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'integer|min:1',
            pageSize: 'integer|min:1'
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

        let queryParams = [];


        const query = `SELECT id, amount, status, reference_id, razorpay_payout_id, created_at razorpay_payout_id FROM mo_user_withdrawals WHERE user_id = ${userId} ORDER BY created_at DESC  LIMIT ? OFFSET ? `;

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

















/*
|--------------------------------------------------------------------------
| 1️⃣ Create Ticket
|--------------------------------------------------------------------------
*/
exports.createTicket = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.id;

        const validate = new Validator(reqData, {
            subject: 'required|string',
            message: 'required|string'
        });

        const matched = await validate.check();
        if (!matched) {
            let error_message = '';
            Object.keys(validate.errors.errors).forEach((key) => {
                error_message += validate.errors.errors[key][0] + ', ';
            });
            return res.json({ status: 0, message: error_message });
        }

        const insertTicket = `
            INSERT INTO mo_user_tickets (user_id, subject)
            VALUES (?, ?)
        `;

        db.mainDb(insertTicket, [userId, reqData.subject], (err, result) => {
            if (err) return res.json({ status: 0, message: "Ticket creation failed" });

            const ticketId = result.insertId;

            const insertMessage = `
                INSERT INTO mo_user_ticket_messages (ticket_id, sender, message)
                VALUES (?, 'user', ?)
            `;

            db.mainDb(insertMessage, [ticketId, reqData.message], (err2) => {
                if (err2) return res.json({ status: 0, message: "Message insert failed" });

                return res.json({
                    status: 1,
                    message: "Ticket created successfully",
                    ticketId
                });
            });
        });

    } catch {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};


/*
|--------------------------------------------------------------------------
| 2️⃣ User Reply Ticket
|--------------------------------------------------------------------------
*/
exports.replyTicket = async (req, res) => {
    try {
        const { ticket_id, message } = req.body;
        const userId = req.user.id;

        const checkQuery = `
            SELECT * FROM mo_user_tickets
            WHERE id=? AND user_id=? AND status='open'
        `;

        db.mainDb(checkQuery, [ticket_id, userId], (err, result) => {
            if (result.length === 0)
                return res.json({ status: 0, message: "Invalid or closed ticket" });

            const insertMessage = `
                INSERT INTO mo_user_ticket_messages (ticket_id, sender, message)
                VALUES (?, 'user', ?)
            `;

            db.mainDb(insertMessage, [ticket_id, message], (err2) => {
                if (err2)
                    return res.json({ status: 0, message: "Reply failed" });

                return res.json({ status: 1, message: "Reply sent successfully" });
            });
        });

    } catch {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};


/*
|--------------------------------------------------------------------------
| 3️⃣ User Ticket History (Pagination)
|--------------------------------------------------------------------------
*/
exports.userTicketList = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.id;

        const page = parseInt(reqData.pageNo);
        const limit = parseInt(reqData.pageSize);
        const offset = (page - 1) * limit;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM mo_user_tickets
            WHERE user_id=?
        `;

        db.mainDb(countQuery, [userId], (err, countRes) => {

            const total = countRes[0].total;

            const dataQuery = `
                SELECT *
                FROM mo_user_tickets
                WHERE user_id=?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            db.mainDb(dataQuery, [userId, limit, offset], (err2, data) => {
                return res.json({
                    status: 1,
                    totalRecords: total,
                    totalPages: Math.ceil(total / limit),
                    data
                });
            });
        });

    } catch {
        return res.json({ status: 0, message: "Something went wrong!" });
    }
};


/*
|--------------------------------------------------------------------------
| 4️⃣ View Single Ticket (Full History)
|--------------------------------------------------------------------------
*/
exports.ticketDetails = (req, res) => {
    const { ticket_id } = req.body;
    const userId = req.user.id;

    const ticketQuery = `
        SELECT * FROM mo_user_tickets
        WHERE id=? AND user_id=?
    `;

    db.mainDb(ticketQuery, [ticket_id, userId], (err, ticket) => {

        if (ticket.length === 0)
            return res.json({ status: 0, message: "Ticket not found" });

        const messageQuery = `
            SELECT * FROM mo_user_ticket_messages
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



/* 5️⃣ Optional: Search Ticket By ID 
exports.searchTicket = (req, res) => {
    const { ticket_id } = req.body;
    const userId = req.user.id;

    const query = `SELECT * FROM mo_user_tickets WHERE id=? AND user_id=?`;

    db.mainDb(query, [ticket_id, userId], (err, ticket) => {
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
};*/
exports.userDailyWalletProfit = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId;  // Get the user ID from authenticated user

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'integer|min:1',
            pageSize: 'integer|min:1'
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

        let queryParams = [];

        // SQL query to fetch daily wallet profits for the user
        const query = `
            SELECT 
                wp.profit_amount AS wallet_profit,
                wp.profit_date AS profit_date,
                u.username,
                u.email
            FROM 
                mo_wallet_daily_profit wp
            JOIN 
                mo_user_info u ON wp.user_id = u.id
            WHERE 
                wp.user_id = ?
            ORDER BY 
                wp.profit_date DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(userId, limit, offset);

        // Execute the query
        await db.mainDb(query, queryParams, (err, data) => {
            if (err) {
                console.error("Get user wallet profit error:", err);
                return res.json({ status: 0, message: "Error fetching wallet profit data" });
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
        console.error("userDailyWalletProfit error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};



exports.userDailyReferralProfit = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId;  // Get the user ID from authenticated user

        // ✅ Validation
        const validate = new Validator(reqData, {
            pageNo: 'integer|min:1',
            pageSize: 'integer|min:1'
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

        let queryParams = [];

        // SQL query to fetch daily referral profits for the user
        const query = `
            SELECT 
                wpr.bonus_amount AS referral_bonus,
                wpr.bonus_date AS bonus_date,
                u.username AS referred_username,
                u.email AS referred_email,
                ref.username AS referrer_username,
                ref.email AS referrer_email
            FROM 
                mo_wallet_daily_profit_from_ref wpr
            JOIN 
                mo_user_info u ON wpr.referred_user_id = u.id
            JOIN 
                mo_user_info ref ON wpr.referrer_id = ref.id
            WHERE 
                wpr.referrer_id = ?
            ORDER BY 
                wpr.bonus_date DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(userId, limit, offset);

        // Execute the query
        await db.mainDb(query, queryParams, (err, data) => {
            if (err) {
                console.error("Get user referral profit error:", err);
                return res.json({ status: 0, message: "Error fetching referral profit data" });
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
        console.error("userDailyReferralProfit error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};




exports.transactionHistory = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId;  // Get the user ID from authenticated user
        const type = reqData.type
        // ✅ Validation
        const validate = new Validator(reqData, {
            type: 'integer|min:1'
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
        } else {

            if (type == 1) { // deposit history

                try {
                    // 1️⃣ Input validation
                    const v = new Validator(req.body, {
                        status: 'sometimes|integer|in:0,1,2',       // optional
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

                    // 2️⃣ Extract request values
                    const userId = req.body.userId // Replace with actual authenticated user ID
                    const pageNo = parseInt(req.body.pageNo);
                    const pageSize = parseInt(req.body.pageSize);
                    const search = req.body.search;

                    let whereClauses = ['user_id = ?'];
                    let queryParams = [userId];

                    // Optional status filter
                    if (req.body.status !== undefined) {
                        const statusMap = { 0: 'created', 1: 'paid', 2: 'failed' };
                        const status = statusMap[req.body.status];
                        whereClauses.push('order_status = ?');
                        queryParams.push(status);
                    }

                    // Optional search filter
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

                        // 4️⃣ Get total count for pagination
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
                    console.error('userDepositList error:', err);
                    return res.status(500).json({ success: false, message: 'Internal server error' });
                }
            } else if (type == 2) { // withdarw history

                try {
                    const reqData = req.body;
                    const userId = req.user.userId;
                    // ✅ Validation
                    const validate = new Validator(reqData, {
                        pageNo: 'integer|min:1',
                        pageSize: 'integer|min:1'
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

                    let queryParams = [];


                    const query = `SELECT id, amount, status, reference_id, razorpay_payout_id, created_at razorpay_payout_id FROM mo_user_withdrawals WHERE user_id = ${userId} ORDER BY created_at DESC  LIMIT ? OFFSET ? `;

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
            } else if (type == 3) { // daily roi profit list

                try {
                    const reqData = req.body;
                    const userId = req.user.userId;  // Get the user ID from authenticated user

                    // ✅ Validation
                    const validate = new Validator(reqData, {
                        pageNo: 'integer|min:1',
                        pageSize: 'integer|min:1'
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

                    let queryParams = [];

                    // SQL query to fetch daily wallet profits for the user
                    const query = `
            SELECT 
                wp.profit_amount AS wallet_profit,
                wp.profit_date AS profit_date,
                u.username,
                u.email
            FROM 
                mo_wallet_daily_profit wp
            JOIN 
                mo_user_info u ON wp.user_id = u.id
            WHERE 
                wp.user_id = ?
            ORDER BY 
                wp.profit_date DESC
            LIMIT ? OFFSET ?
        `;

                    queryParams.push(userId, limit, offset);

                    // Execute the query
                    await db.mainDb(query, queryParams, (err, data) => {
                        if (err) {
                            console.error("Get user wallet profit error:", err);
                            return res.json({ status: 0, message: "Error fetching wallet profit data" });
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
                    console.error("userDailyWalletProfit error:", err);
                    return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
                }
            } else if (type == 4) { // roi history by his reffered users

                try {
                    const reqData = req.body;
                    const userId = req.user.userId;  // Get the user ID from authenticated user

                    // ✅ Validation
                    const validate = new Validator(reqData, {
                        pageNo: 'integer|min:1',
                        pageSize: 'integer|min:1'
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

                    let queryParams = [];

                    // SQL query to fetch daily referral profits for the user
                    const query = `
            SELECT 
                wpr.bonus_amount AS referral_bonus,
                wpr.bonus_date AS bonus_date,
                u.username AS referred_username,
                u.email AS referred_email,
                ref.username AS referrer_username,
                ref.email AS referrer_email
            FROM 
                mo_wallet_daily_profit_from_ref wpr
            JOIN 
                mo_user_info u ON wpr.referred_user_id = u.id
            JOIN 
                mo_user_info ref ON wpr.referrer_id = ref.id
            WHERE 
                wpr.referrer_id = ?
            ORDER BY 
                wpr.bonus_date DESC
            LIMIT ? OFFSET ?
        `;

                    queryParams.push(userId, limit, offset);

                    // Execute the query
                    await db.mainDb(query, queryParams, (err, data) => {
                        if (err) {
                            console.error("Get user referral profit error:", err);
                            return res.json({ status: 0, message: "Error fetching referral profit data" });
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
                    console.error("userDailyReferralProfit error:", err);
                    return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
                }
            } else if (type == 5) { // get wallet req list

                try {
                    const reqData = req.body;
                    const userId = req.user.userId;
                    // ✅ Validation
                    const validate = new Validator(reqData, {
                        pageNo: 'integer|min:1',
                        pageSize: 'integer|min:1'
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

                    let queryParams = [];


                    const query = `SELECT * FROM mo_wallet_request WHERE user_id = ${userId} ORDER BY created_at DESC  LIMIT ? OFFSET ? `;

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
            } else {
                return res.json({ status: 0, message: "Type error" });
            }
        }


    } catch (err) {
        console.error("userDailyReferralProfit error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};