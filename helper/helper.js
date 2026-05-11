const jwt = require("jsonwebtoken");
const db = require("../models/db.js")
let mailHelper = require("../helper/mailHelper")
const helper = {};

/* ================================
   APP MAINTENANCE MIDDLEWARE
================================ */
helper.app_maintenance = (req, res, next) => {
    try {
        const query = "SELECT is_maintenance FROM sitesetting LIMIT 1";

        db.mainDb(query, (err, data) => {
            if (err) {
                return res.json({
                    status: 0,
                    message: "Unable to check maintenance status"
                });
            }

            if (data.length && data[0].is_maintenance == 1) {
                return res.json({
                    status: 5,
                    message: "Site is under maintenance"
                });
            }

            next(); // ✅ allow request
        });

    } catch (err) {
        console.log("Maintenance error:", err);
        return res.json({
            status: 0,
            message: "Something went wrong"
        });
    }
};

/* ================================
   AUTH MIDDLEWARE (JWT)
================================ */
helper.auth = (req, res, next) => {

    // req.user = decoded; // attach user info
    // req.user = { userId:5 }
    // req.user.userId =5
    // console.log("req.user: ", req.user);
    // next(); // ✅ allow request
    // return
    try {

        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            return res.json({
                status: 6,
                message: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1]; // Bearer TOKEN

        if (!token) {
            return res.json({
                status: 6,
                message: "Invalid token format"
            });
        }

        jwt.verify(token, "SECRET@KEY", (err, decoded) => {
            if (err) {
                return res.json({
                    status: 6,
                    message: "Invalid or expired token"
                });
            }

            req.user = decoded; // attach user info
             req.body.userId = decoded.userId;
            console.log("req.user: ", req.user);
            next(); // ✅ allow request
        });

    } catch (err) {
        console.log("Auth error:", err);
        return res.json({
            status: 6,
            message: "Authentication failed"
        });
    }
};

module.exports = helper;
