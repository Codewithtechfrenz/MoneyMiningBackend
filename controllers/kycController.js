const { Validator } = require("node-input-validator");
const db = require('../models/db')


exports.saveKycDetails = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId; // from auth middleware

        const validate = new Validator(reqData, {
            aadhaar_number: 'required|minLength:12|maxLength:12',
            aadhaar_front_image: 'required',
            aadhaar_back_image: 'required',
            pan_number: 'required|minLength:10|maxLength:10',
            pan_image: 'required'
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
                message: error_message
            });
        }

        // 🔍 Check if KYC already exists
        const checkQuery = "SELECT id FROM mo_kyc_details WHERE user_id = ?";
        db.mainDb(checkQuery, [userId], (checkErr, checkData) => {
            if (checkErr) {
                console.log("KYC check error:", checkErr);
                return res.json({ status: 0, message: "Error occurred while checking KYC" });
            }

            if (checkData.length > 0) {
                // ✅ Update existing record
                const updateQuery = `
                    UPDATE mo_kyc_details SET  aadhaar_number = ?, aadhaar_front_image = ?, aadhaar_back_image = ?, pan_number = ?, pan_image = ?, updated_at = NOW() WHERE user_id = ?`;
                const params = [
                    reqData.aadhaar_number,
                    reqData.aadhaar_front_image,
                    reqData.aadhaar_back_image,
                    reqData.pan_number,
                    reqData.pan_image,
                    userId
                ];

                db.mainDb(updateQuery, params, (err, result) => {
                    if (err) {
                        console.log("KYC update error:", err);
                        return res.json({ status: 0, message: "Error updating KYC details" });
                    }

                    return res.json({ status: 1, message: "KYC details updated successfully" });
                });

            } else {
                // ✅ Insert new record
                const insertQuery = `
                    INSERT INTO mo_kyc_details
                        (user_id, aadhaar_number, aadhaar_front_image, aadhaar_back_image, pan_number, pan_image)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                const params = [
                    userId,
                    reqData.aadhaar_number,
                    reqData.aadhaar_front_image,
                    reqData.aadhaar_back_image,
                    reqData.pan_number,
                    reqData.pan_image
                ];

                db.mainDb(insertQuery, params, (err, result) => {
                    if (err) {
                        console.log("KYC insert error:", err);
                        return res.json({ status: 0, message: "Error saving KYC details" });
                    }

                    return res.json({ status: 1, message: "KYC details saved successfully" });
                });
            }
        });

    } catch (err) {
        console.log("saveKycDetails error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};




exports.addBankDetails = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId;

        const validate = new Validator(reqData, {
            acc_no: 'required|minLength:9|maxLength:30',
            ifsc_code: 'required|minLength:11|maxLength:11',
            bank_image: 'required'
        });

        const matched = await validate.check();
        if (!matched) {
            let msg = '';
            Object.values(validate.errors).forEach(e => {
                msg += (msg ? ', ' : '') + e.message;
            });
            return res.json({ status: 0, message: msg });
        }

        // check if bank already exists
        const checkQuery = "SELECT id FROM mo_bank_details WHERE user_id = ?";
        db.mainDb(checkQuery, [userId], (err, data) => {
            if (err) {
                return res.json({ status: 0, message: "Error checking bank details" });
            }

            if (data.length > 0) {
                // 🔁 Update
                const updateQuery = `
                    UPDATE mo_bank_details
                    SET acc_no=?, ifsc_code=?, bank_image=?,
                        bank_status=0, reject_reason=NULL
                    WHERE user_id=?
                `;
                db.mainDb(updateQuery, [
                    reqData.acc_no,
                    reqData.ifsc_code,
                    reqData.bank_image,
                    userId
                ], () => {
                    db.mainDb(
                        "UPDATE mo_user_info SET is_bank_verified=0 WHERE id=?",
                        [userId]
                    );
                    return res.json({ status: 1, message: "Bank details updated, pending verification" });
                });
            } else {
                // ➕ Insert
                const insertQuery = `
                    INSERT INTO mo_bank_details
                    (user_id, acc_no, ifsc_code, bank_image)
                    VALUES (?, ?, ?, ?)
                `;
                db.mainDb(insertQuery, [
                    userId,
                    reqData.acc_no,
                    reqData.ifsc_code,
                    reqData.bank_image
                ], () => {
                    return res.json({ status: 1, message: "Bank details added, pending verification" });
                });
            }
        });

    } catch (err) {
        console.log("addBankDetails error:", err);
        return res.json({ status: 0, message: "Something went wrong" });
    }
};










exports.saveKycAndBankDetails = async (req, res) => {
    try {
        const reqData = req.body;
        const userId = req.user.userId || 5;

        // ✅ Validate both KYC + Bank fields
        const validate = new Validator(reqData, {
            aadhaar_number: 'required|minLength:12|maxLength:12',
            aadhaar_front_image: 'required',
            aadhaar_back_image: 'required',
            pan_number: 'required|minLength:10|maxLength:10',
            pan_image: 'required',
            acc_no: 'required|minLength:9|maxLength:30',
            ifsc_code: 'required|minLength:11|maxLength:11',
            bank_image: 'required'
        });

        const matched = await validate.check();

        if (!matched) {
            let error_message = '';
            Object.values(validate.errors).forEach(e => {
                error_message += (error_message ? ', ' : '') + e.message;
            });

            return res.json({
                status: 0,
                message: error_message
            });
        }

        // 🔎 CHECK KYC
        const checkKycQuery = "SELECT id FROM mo_kyc_details WHERE user_id = ?";
        db.mainDb(checkKycQuery, [userId], (kycErr, kycData) => {
            if (kycErr) {
                return res.json({ status: 0, message: "Error checking KYC" });
            }

            const handleBank = () => {
                // 🔎 CHECK BANK
                const checkBankQuery = "SELECT id FROM mo_bank_details WHERE user_id = ?";
                db.mainDb(checkBankQuery, [userId], (bankErr, bankData) => {
                    if (bankErr) {
                        return res.json({ status: 0, message: "Error checking Bank details" });
                    }

                    if (bankData.length > 0) {
                        // 🔁 UPDATE BANK
                        const updateBankQuery = `
                            UPDATE mo_bank_details
                            SET acc_no=?, ifsc_code=?, bank_image=?,
                                bank_status=0, reject_reason=NULL
                            WHERE user_id=?
                        `;
                        db.mainDb(updateBankQuery, [
                            reqData.acc_no,
                            reqData.ifsc_code,
                            reqData.bank_image,
                            userId
                        ], () => {
                            db.mainDb(
                                "UPDATE mo_user_info SET is_bank_verified=0 WHERE id=?",
                                [userId]
                            );
                            return res.json({ status: 1, message: "KYC & Bank details updated successfully, pending verification" });
                        });

                    } else {
                        // ➕ INSERT BANK
                        const insertBankQuery = `
                            INSERT INTO mo_bank_details
                            (user_id, acc_no, ifsc_code, bank_image)
                            VALUES (?, ?, ?, ?)
                        `;
                        db.mainDb(insertBankQuery, [
                            userId,
                            reqData.acc_no,
                            reqData.ifsc_code,
                            reqData.bank_image
                        ], () => {
                            return res.json({ status: 1, message: "KYC & Bank details saved successfully, pending verification" });
                        });
                    }
                });
            };

            if (kycData.length > 0) {
                // 🔁 UPDATE KYC
                const updateKycQuery = `
                    UPDATE mo_kyc_details 
                    SET aadhaar_number=?, aadhaar_front_image=?, 
                        aadhaar_back_image=?, pan_number=?, 
                        pan_image=?, updated_at=NOW()
                    WHERE user_id=?
                `;
                db.mainDb(updateKycQuery, [
                    reqData.aadhaar_number,
                    reqData.aadhaar_front_image,
                    reqData.aadhaar_back_image,
                    reqData.pan_number,
                    reqData.pan_image,
                    userId
                ], (err) => {
                    if (err) {
                        return res.json({ status: 0, message: "Error updating KYC" });
                    }
                    handleBank();
                });

            } else {
                // ➕ INSERT KYC
                const insertKycQuery = `
                    INSERT INTO mo_kyc_details
                    (user_id, aadhaar_number, aadhaar_front_image, 
                     aadhaar_back_image, pan_number, pan_image)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.mainDb(insertKycQuery, [
                    userId,
                    reqData.aadhaar_number,
                    reqData.aadhaar_front_image,
                    reqData.aadhaar_back_image,
                    reqData.pan_number,
                    reqData.pan_image
                ], (err) => {
                    if (err) {
                        console.log("err: ", err);
                        return res.json({ status: 0, message: "Error saving KYC" });
                    }
                    handleBank();
                });
            }
        });

    } catch (err) {
        console.log("saveKycAndBankDetails error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};






exports.getSingleKycDetail = async (req, res) => {
    try {
        const reqData = req.body;
        const user_id = req.user.userId
        console.log("user_id: ", user_id);
        // ✅ Validation
        // const validate = new Validator(reqData, {
        //     user_id: 'required|integer'
        // });

        // const matched = await validate.check();
        // if (!matched) {
        //     let error_message = '';
        //     Object.keys(validate.errors).forEach((key) => {
        //         if (validate.errors[key].message) {
        //             error_message += (error_message ? ', ' : '') + validate.errors[key].message;
        //         }
        //     });
        //     return res.json({ status: 0, message: error_message });
        // }

        const query = `SELECT  
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
    b.reject_reason AS bank_reject_reason

FROM mo_user_info u
LEFT JOIN mo_kyc_details k 
    ON u.id = k.user_id
LEFT JOIN mo_bank_details b
    ON u.id = b.user_id
WHERE u.id = ?;
`;

        db.mainDb(query, [user_id], (err, data) => {
            if (err) {
                console.log("Single KYC detail error:", err);
                return res.json({ status: 0, message: "Error fetching KYC detail" });
            }

            if (!data || data.length === 0) {
                return res.json({ status: 0, message: "KYC detail not found for this user" });
            }

            return res.json({ status: 1, data: data[0] });
        });

    } catch (err) {
        console.log("getSingleKycDetail error:", err);
        return res.json({ status: 0, message: "Something went wrong!..Try again later.." });
    }
};
