const db = require("../models/db.js")


let updateData = exports.updateData = (tableName, setQuery, whereQuery) => {

    return new Promise((resolve, reject) => {

        const updateQuery = `UPDATE ${tableName} SET ${setQuery} ${whereQuery}`;

        db.mainDb(updateQuery, "", (updateErr, result) => {

            if (updateErr) {

                console.log("updateErr:", updateErr);
                return resolve({ status: 0, message: "DB error" });

            } else if (result && result.affectedRows == 0) {

                return resolve({
                    status: 0,
                    message: "Can't update",
                });

            } else if (result && result.affectedRows > 0) {

                return resolve({
                    status: 1,
                    message: "Updated successfully",
                    affectedRows: result.affectedRows
                });

            } else {
                
                return resolve({
                    status: 0,
                    message: "No rows updated"
                });

            }

        });

    });
};
