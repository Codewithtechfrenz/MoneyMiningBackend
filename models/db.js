const mysql = require("mysql");

// Create pool once
const pool = mysql.createPool({
    host: "3.111.113.161",
    user: "nodeuser",
    password: "NodePassword123!",
    database: "money_mining",
    port: 3306,
    connectionLimit: 50,
    multipleStatements: true
});


// 🔥 CORE QUERY FUNCTION (handles everything)
function executeQuery(query, values = []) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                console.error("DB Connection Error:", err);
                return reject(err);
            }

            connection.query(query, values, (error, results) => {
                connection.release();

                if (error) {
                    console.error("DB Query Error:", error);
                    return reject(error);
                }

                resolve(results);
            });
        });
    });
}


// ✅ MAIN FUNCTION (supports BOTH styles)
exports.mainDb = function (query, values = [], callback) {

    // Promise style
    if (typeof callback !== "function") {
        return executeQuery(query, values);
    }

    // Callback style
    executeQuery(query, values)
        .then(result => callback(null, result))
        .catch(err => callback(err, null));
};


// ✅ KEEP OLD FUNCTION FOR CRON (NO BREAKING CHANGES)
exports.mainDbForCron = function (query, values = []) {
    return executeQuery(query, values);
};


// Optional: Close pool
exports.closePool = () => {
    pool.end(err => {
        if (err) console.error("Error closing pool:", err);
        else console.log("MySQL pool closed");
    });
};
