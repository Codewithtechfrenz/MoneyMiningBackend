const jwt = require("jsonwebtoken");
const helper = {};


helper.auth = (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            return res.json({
                status: 0,
                message: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1]; // Bearer TOKEN

        if (!token) {
            return res.json({
                status: 0,
                message: "Invalid token format"
            });
        }

        jwt.verify(token, "ADMINSECRET@KEY", (err, decoded) => {
            if (err) {
                return res.json({
                    status: 0,
                    message: "Invalid or expired token"
                });
            }

            req.user = decoded; // attach user info
            next(); // ✅ allow request
        });

    } catch (err) {
        console.log("Auth error:", err);
        return res.json({
            status: 0,
            message: "Authentication failed"
        });
    }
};

module.exports = helper;
