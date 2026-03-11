// // Bring MY into the app
// const mysql = require("mysql");
// // const config = require("../config/config");
// // const common = require("../helpers/common");
// const { exec } = require("child_process");


// exports.mainDb = async function (maria, values, callback) {
//     var pool = mysql.createPool({
//         "connectionLimit": 50000,
//         "connectTimeout": 30 * 60 * 60 * 1000,
//         "acquireTimeout": 60 * 60 * 1000,
//         "timeout": 60 * 60 * 1000,
//         "multipleStatements": true,
//         host: "localhost",
//         user: "root",
//         password: "Newest@123",
//         database: "moneymine"
//     });

//     pool.getConnection((err, connection) => {
//         if (err) {

//             if (process.env.NODE_ENV == 'local' || process.env.NODE_ENV === undefined) {

//             } else {

//                 if (err.code == "PROTOCOL_CONNECTION_LOST") {
//                     pool.end();
//                     wallet_data(maria);
//                 }
//                 exec('service mariadb restart - connector', (error, stdout, stderr) => {
//                     if (error) {

//                         console.error(`exec error2: 12348`);
//                     }
//                     console.log(`stdout2: 584287`);
//                 });
//             }

//             throw err;
//         } else {

//             connection.query(maria, values, function (error, results, fields) {
//                 connection.release();
//                 pool.end();
//                 callback(error, results);

//             })
//         }

//     })
// }


const mysql = require("mysql");

// Create pool once
// const pool = mysql.createPool({
//     connectionLimit: 50,          // 50 is enough, 50k is insane
//     connectTimeout: 30 * 1000,    // 30 sec
//     acquireTimeout: 60 * 1000,    // 1 min
//     timeout: 60 * 1000,
//     multipleStatements: true,
//     host: "localhost",
//     user: "root",
//     password: "",
//     database: "moneymine"
// });


const pool = mysql.createPool({
    
    host: "3.111.113.161",

    user: "nodeuser",

    password: "NodePassword123!",

    database: "money_mining",

    port: 3306,

    connectionLimit: 50,

    multipleStatements: true

});
 


// Main DB query function (callback-style)
exports.mainDb = async function (query, values, callback) {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("DB Connection Error:", err);
            return callback(err, null);
        }

        connection.query(query, values, (error, results, fields) => {
            connection.release();  // always release back to pool
            return callback(error, results);
        });
    });
};

// Optional: Close pool when app shuts down
exports.closePool = () => {
    pool.end(err => {
        if (err) console.error("Error closing pool:", err);
    });
};



exports.mainDbForCron = function (query, values = []) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                console.error("DB Connection Error:", err);
                return reject(err);
            }

            connection.query(query, values, (error, results) => {
                connection.release();
                if (error) return reject(error);
                resolve(results);
            });
        });
    });
};