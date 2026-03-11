const { Validator } = require("node-input-validator");
const db = require('../models/db')
const moment = require('moment');
const updatedTime = moment().format("YYYY-MM-DD HH:mm:ss");


// Item Master
exports.createItems = async (req, res) => {
    try {
        let reqData = req.body;

        const validate = new Validator(reqData, {
            item_code: 'required|minLength:1|maxLength:100',
            item_name: 'required',
            category: 'required',
            uom: 'required',
            cost_price: 'required',
            selling_price: 'required',
            quantity: 'required',
            reorder_days: 'required',
            status: 'required'
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

            let selectQuery = "SELECT * FROM item_master WHERE item_name = ? AND is_deleted != 0"
            await db.mainDb(selectQuery, reqData.item_name, async (selectErr, selectData) => {
                console.log("selectErr: ", selectErr);
                if (selectErr) {
                    return res.json({
                        status: 0,
                        message: "Error ouccured when get item data"
                    });
                } else if (selectData.length > 0) {
                    return res.json({
                        status: 0,
                        message: "This item already exist"
                    });
                } else {

                    let query = "INSERT INTO item_master SET ?;"

                    let insertObj = {
                        item_code: reqData.item_code,
                        item_name: reqData.item_name,
                        category: reqData.category,
                        uom: reqData.uom,
                        cost_price: reqData.cost_price,
                        selling_price: reqData.selling_price,
                        quantity: reqData.quantity,
                        reorder_days: reqData.reorder_days,
                        status: reqData.status
                    }


                    await db.mainDb(query, insertObj, async (insertErr, insertData) => {
                        console.log("insertErr: ", insertErr);
                        console.log("insertData: ", insertData);
                        if (insertErr || !insertData) {
                            return res.json({
                                status: 0,
                                message: "Error ouccured when insert user data"
                            });
                        } else if (insertData.affectedRows == 1) {
                            return res.json({
                                status: 1,
                                message: "Item insert successfully"
                            });
                        } else {
                            return res.json({
                                status: 0,
                                message: "Item details can't insert"
                            });
                        }
                    })
                }

            })

        }


    } catch (err) {
        console.log("Error in createAccount: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};



exports.editItems = async (req, res) => {
    try {
        let reqData = req.body;
        let validate = {}
        let type = reqData.type

        if (type != "" && (type == "edit" || type == "stock" || type == "delete")) {

            if (type == "edit") {
                validate = new Validator(reqData, {
                    id: 'required',
                    item_code: 'required|minLength:1|maxLength:100',
                    item_name: 'required',
                    category: 'required',
                    uom: 'required',
                    cost_price: 'required',
                    selling_price: 'required',
                    quantity: 'required',
                    reorder_days: 'required'
                });
            }

            if (type == "stock") {
                validate = new Validator(reqData, {
                    id: 'required',
                    total_stocks: 'required',
                    current_stocks: 'required'

                });
            }

            if (type == "delete") {
                validate = new Validator(reqData, {
                    id: 'required',
                });
            }

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

                let selectQuery = "SELECT * FROM item_master WHERE id = ?"
                await db.mainDb(selectQuery, reqData.id, async (selectErr, selectData) => {
                    console.log("selectErr: ", selectErr);
                    if (selectErr) {
                        return res.json({
                            status: 0,
                            message: "Error ouccured when get item data"
                        });
                    } else if (selectData.length == 0) {
                        return res.json({
                            status: 0,
                            message: "This item not found"
                        });
                    } else {

                        let query = "UPDATE item_master SET ? WHERE id = ?;"
                        let updateObj = {}

                        if (type == "edit") {
                            updateObj = {
                                item_code: reqData.item_code,
                                item_name: reqData.item_name,
                                category: reqData.category,
                                uom: reqData.uom,
                                cost_price: reqData.cost_price,
                                selling_price: reqData.selling_price,
                                quantity: reqData.quantity,
                                reorder_days: reqData.reorder_days,
                                status: reqData.status,
                                updated_at: updatedTime
                            }
                        }

                        if (type == "delete") {
                            updateObj = {
                                is_deleted: 1,
                                updated_at: updatedTime
                            }
                        }

                        if (type == "stock") {
                            updateObj = {
                                total_stocks: reqData.total_stocks,
                                current_stocks: reqData.current_stocks,
                                updated_at: updatedTime
                            }
                        }


                        await db.mainDb(query, [updateObj, reqData.id], async (updatetErr, updatetData) => {
                            console.log("updatetErr: ", updatetErr);
                            console.log("updatetData: ", updatetData);
                            if (updatetErr || !updatetData) {
                                return res.json({
                                    status: 0,
                                    message: "Error ouccured when updatet user data"
                                });
                            } else if (updatetData.affectedRows == 1) {
                                return res.json({
                                    status: 1,
                                    message: "Item has been updated successfully"
                                });
                            } else {
                                return res.json({
                                    status: 0,
                                    message: "Item details can't update"
                                });
                            }
                        })
                    }

                })

            }
        } else {
            return res.json({
                status: 0,
                message: "Type field is mandatory"
            });
        }

    } catch (err) {
        console.log("Error in createAccount: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};




exports.getItemList = async (req, res) => {
    try {
        // 1️⃣ First query — get all items
        const itemQuery = "SELECT * FROM item_master WHERE is_deleted = 0;";
        const items = await new Promise((resolve, reject) => {
            db.mainDb(itemQuery, "", (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        });

        if (!items || items.length === 0) {
            return res.json({
                status: 0,
                message: "No items found."
            });
        }

        // 2️⃣ Second query — get total sales count grouped by product_name
        const salesQuery = `
      SELECT 
        product_name, 
        SUM(quantity) AS total_sales_count
      FROM ma_sales_history
      GROUP BY product_name;
    `;
        const salesData = await new Promise((resolve, reject) => {
            db.mainDb(salesQuery, "", (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        });

        // 3️⃣ Map sales counts into a lookup object for quick access
        const salesMap = {};
        for (const sale of salesData) {
            salesMap[sale.product_name] = Number(sale.total_sales_count) || 0;
        }

        // 4️⃣ Merge items with sales counts
        const finalData = items.map(item => ({
            ...item,
            total_sales_count: salesMap[item.item_name] || 0,
            // current_stocks: item.current_stocks - (salesMap[item.item_name] || 0)
            current_stocks: item.current_stocks

        }));

        // 5️⃣ Respond with merged result
        return res.json({
            status: 1,
            message: "Items listed successfully.",
            data: finalData
        });

    } catch (err) {
        console.error("Error in getItemList:", err);
        return res.json({
            status: 0,
            message: "Something went wrong!.. Try again later..",
            error: err.message
        });
    }
};





// UOM Master


exports.createUoms = async (req, res) => {
    try {
        let reqData = req.body;

        const validate = new Validator(reqData, {
            name: 'required|minLength:1|maxLength:100',
            uom: 'required',
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

            let selectQuery = "SELECT * FROM ma_uom WHERE name = ? AND is_deleted != 1"
            await db.mainDb(selectQuery, reqData.name, async (selectErr, selectData) => {
                console.log("selectErr: ", selectErr);
                if (selectErr) {
                    return res.json({
                        status: 0,
                        message: "Error ouccured when get UOM data"
                    });
                } else if (selectData.length > 0) {
                    return res.json({
                        status: 0,
                        message: "This UOM already exist"
                    });
                } else {

                    let query = "INSERT INTO ma_uom SET ?;"

                    let insertObj = {
                        name: reqData.name,
                        uom: reqData.uom
                    }


                    await db.mainDb(query, insertObj, async (insertErr, insertData) => {
                        console.log("insertErr: ", insertErr);
                        console.log("insertData: ", insertData);
                        if (insertErr || !insertData) {
                            return res.json({
                                status: 0,
                                message: "Error ouccured when insert uom data"
                            });
                        } else if (insertData.affectedRows == 1) {
                            return res.json({
                                status: 1,
                                message: "UOM data insert successfully"
                            });
                        } else {
                            return res.json({
                                status: 0,
                                message: "UOM details can't insert"
                            });
                        }
                    })
                }

            })

        }


    } catch (err) {
        console.log("Error when adding UOM: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};



exports.editUoms = async (req, res) => {
    try {
        let reqData = req.body;
        console.log("reqData: ", reqData);

        let validate = {}


        let type = reqData.type

        if (type != "") {

            if (type == "edit") {
                validate = new Validator(reqData, {
                    id: 'required',
                    name: 'required|minLength:1|maxLength:100',
                    uom: 'required'
                });
            }


            if (type == "delete") {
                validate = new Validator(reqData, {
                    id: 'required',
                });
            }


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

                let selectQuery = "SELECT * FROM ma_uom WHERE id = ?"
                await db.mainDb(selectQuery, reqData.id, async (selectErr, selectData) => {
                    console.log("selectErr: ", selectErr);
                    if (selectErr) {
                        return res.json({
                            status: 0,
                            message: "Error ouccured when get UOM data"
                        });
                    } else if (selectData.length == 0) {
                        return res.json({
                            status: 0,
                            message: "This UOM not found"
                        });
                    } else {

                        let query = "UPDATE ma_uom SET ? WHERE id = ?;"

                        let updateObj = {}

                        if (type == "edit") {
                            updateObj = {
                                name: reqData.name,
                                uom: reqData.uom,
                                updated_at: updatedTime
                            }
                        }

                        if (type == "delete") {
                            updateObj = {
                                is_deleted: 1,
                                updated_at: updatedTime
                            }
                        }

                        await db.mainDb(query, [updateObj, reqData.id], async (updatetErr, updatetData) => {
                            console.log("updatetErr: ", updatetErr);
                            console.log("updatetData: ", updatetData);
                            if (updatetErr || !updatetData) {
                                return res.json({
                                    status: 0,
                                    message: "Error ouccured when updatet UOM data"
                                });
                            } else if (updatetData.affectedRows == 1) {
                                return res.json({
                                    status: 1,
                                    message: "Uom has been updated successfully"
                                });
                            } else {
                                return res.json({
                                    status: 0,
                                    message: "Uom details can't update"
                                });
                            }
                        })
                    }

                })

            }

        } else {
            return res.json({
                status: 0,
                message: "Type field is mandatory"
            });
        }


    } catch (err) {
        console.log("Error in Uom: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};


exports.getUomList = async (req, res) => {
    try {
        let reqData = req.body;

        let selectQuery = "SELECT * FROM ma_uom WHERE is_deleted = 0;"
        await db.mainDb(selectQuery, "", async (selectErr, selectData) => {
            console.log("selectErr: ", selectErr);
            if (selectErr) {
                return res.json({
                    status: 0,
                    message: "Error ouccured when get item data"
                });
            } else if (selectData.length == 0) {
                return res.json({
                    status: 0,
                    message: "No data found"
                });
            } else {

                return res.json({
                    status: 1,
                    message: "Items listed successfully",
                    data: selectData
                });
            }

        })

    } catch (err) {
        console.log("Error in createAccount: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};







// Category Master


exports.createCategory = async (req, res) => {
    try {
        let reqData = req.body;

        const validate = new Validator(reqData, {
            name: 'required|minLength:1|maxLength:100',
            category: 'required',
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

            let selectQuery = "SELECT * FROM ma_category WHERE name = ? AND is_deleted != 1"
            await db.mainDb(selectQuery, reqData.name, async (selectErr, selectData) => {
                console.log("selectErr: ", selectErr);
                if (selectErr) {
                    return res.json({
                        status: 0,
                        message: "Error ouccured when get category data"
                    });
                } else if (selectData.length > 0) {
                    return res.json({
                        status: 0,
                        message: "This category already exist"
                    });
                } else {

                    let query = "INSERT INTO ma_category SET ?;"

                    let insertObj = {
                        name: reqData.name,
                        category: reqData.category
                    }


                    await db.mainDb(query, insertObj, async (insertErr, insertData) => {
                        console.log("insertErr: ", insertErr);
                        console.log("insertData: ", insertData);
                        if (insertErr || !insertData) {
                            return res.json({
                                status: 0,
                                message: "Error ouccured when insert category data"
                            });
                        } else if (insertData.affectedRows == 1) {
                            return res.json({
                                status: 1,
                                message: "category data insert successfully"
                            });
                        } else {
                            return res.json({
                                status: 0,
                                message: "category details can't insert"
                            });
                        }
                    })
                }

            })

        }


    } catch (err) {
        console.log("Error when adding UOM: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};



exports.editCategory = async (req, res) => {
    try {
        let reqData = req.body;
        let validate = {}
        let type = reqData.type

        if (type != "") {

            if (type == "edit") {
                validate = new Validator(reqData, {
                    id: 'required',
                    name: 'required|minLength:1|maxLength:100',
                    category: 'required'
                });
            }

            if (type == "delete") {
                validate = new Validator(reqData, {
                    id: 'required',
                });
            }




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

                let selectQuery = "SELECT * FROM ma_category WHERE id = ?"
                await db.mainDb(selectQuery, reqData.id, async (selectErr, selectData) => {
                    console.log("selectErr: ", selectErr);
                    if (selectErr) {
                        return res.json({
                            status: 0,
                            message: "Error ouccured when get category data"
                        });
                    } else if (selectData.length == 0) {
                        return res.json({
                            status: 0,
                            message: "This category not found"
                        });
                    } else {

                        let query = "UPDATE ma_category SET ? WHERE id = ?;"

                        let updateObj = {}

                        if (type == "edit") {
                            updateObj = {
                                name: reqData.name,
                                category: reqData.category,
                                updated_at: updatedTime
                            }
                        }
                        if (type == "delete") {
                            updateObj = {
                                is_deleted: 1,
                                updated_at: updatedTime
                            }
                        }
                        await db.mainDb(query, [updateObj, reqData.id], async (updatetErr, updatetData) => {
                            console.log("updatetErr: ", updatetErr);
                            console.log("updatetData: ", updatetData);
                            if (updatetErr || !updatetData) {
                                return res.json({
                                    status: 0,
                                    message: "Error ouccured when updatet category data"
                                });
                            } else if (updatetData.affectedRows == 1) {
                                return res.json({
                                    status: 1,
                                    message: "category has been updated successfully"
                                });
                            } else {
                                return res.json({
                                    status: 0,
                                    message: "category details can't update"
                                });
                            }
                        })
                    }

                })

            }



        } else {

            return res.json({
                status: 0,
                message: "Type field is mandatory"
            });
        }

    } catch (err) {
        console.log("Error in Uom: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};




exports.getCategoryList = async (req, res) => {
    try {
        let reqData = req.body;

        let selectQuery = "SELECT * FROM ma_category WHERE is_deleted = 0;"
        await db.mainDb(selectQuery, "", async (selectErr, selectData) => {
            console.log("selectErr: ", selectErr);
            if (selectErr) {
                return res.json({
                    status: 0,
                    message: "Error ouccured when get category data"
                });
            } else if (selectData.length == 0) {
                return res.json({
                    status: 0,
                    message: "No data found"
                });
            } else {

                return res.json({
                    status: 1,
                    message: "category listed successfully",
                    data: selectData
                });
            }

        })

    } catch (err) {
        console.log("Error in createAccount: ", err);
        return res.json({
            status: 0,
            message: "Something went wrong!..Try again later.."
        });
    }
};




// Sales



// exports.createSalesItem = async (req, res) => {
//     try {
//         const salesArray = req.body;

//         if (!Array.isArray(salesArray) || salesArray.length === 0) {
//             return res.json({
//                 status: 0,
//                 message: "Request data must be a non-empty array."
//             });
//         }

//         // 1️⃣ Validate all items
//         for (const [index, item] of salesArray.entries()) {
//             const validate = new Validator(item, {
//                 sales_id: 'required',
//                 customer_name: 'required',
//                 customer_address: 'required',
//                 product_name: 'required',
//                 description: 'required',
//                 quantity: 'required|numeric|min:1',
//                 unit_price: 'required|numeric|min:0',
//                 tax: 'required|numeric|min:0',
//                 total: 'required|numeric|min:0'
//             });

//             const matched = await validate.check();
//             if (!matched) {
//                 let msg = Object.values(validate.errors).map(e => e.message).join(', ');
//                 return res.json({
//                     status: 0,
//                     message: `Validation failed for item ${index + 1}: ${msg}`
//                 });
//             }
//         }

//         // 2️⃣ Sum up total quantity per product_name
//         const productTotals = {};
//         for (const item of salesArray) {
//             const name = item.product_name;
//             productTotals[name] = (productTotals[name] || 0) + Number(item.quantity);
//         }

//         // 3️⃣ Check stock for all products
//         const insufficientItems = [];

//         for (const [productName, totalQty] of Object.entries(productTotals)) {
//             const stockQuery = "SELECT current_stocks FROM item_master WHERE item_name = ? AND is_deleted != 1;";
//             const stockData = await new Promise((resolve) => {
//                 db.mainDb(stockQuery, [productName], (err, result) => {
//                     if (err) return resolve({ error: err });
//                     if (!result || result.length === 0) return resolve({ notFound: true });
//                     resolve({ stock: result[0].current_stocks });
//                 });
//             });

//             if (stockData.error) {
//                 return res.json({
//                     status: 0,
//                     message: `Error checking stock for ${productName}: ${stockData.error.message}`
//                 });
//             }

//             if (stockData.notFound || stockData.stock < totalQty) {
//                 insufficientItems.push({
//                     product_name: productName,
//                     available: stockData.notFound ? 0 : stockData.stock,
//                     requested: totalQty
//                 });
//             }
//         }

//         // 4️⃣ Abort everything if any product lacks stock
//         if (insufficientItems.length > 0) {
//             return res.json({
//                 status: 0,
//                 message: "Insufficient stock for one or more items. No sales recorded.",
//                 insufficientItems
//             });
//         }

//         // 5️⃣ All good → insert all records and update stocks
//         let insertedCount = 0;
//         let updatedCount = 0;

//         // Insert all sales
//         for (const item of salesArray) {
//             const insertQuery = "INSERT INTO ma_sales_history SET ?;";
//             const insertObj = {
//                 sales_id: item.sales_id,
//                 customer_name: item.customer_name,
//                 customer_address: item.customer_address,
//                 product_name: item.product_name,
//                 description: item.description,
//                 quantity: item.quantity,
//                 unit_price: item.unit_price,
//                 tax: item.tax,
//                 total: item.total
//             };

//             await new Promise((resolve) => {
//                 db.mainDb(insertQuery, insertObj, (err, data) => {
//                     if (!err && data.affectedRows === 1) insertedCount++;
//                     resolve();
//                 });
//             });
//         }


//         // ✅ Response
//         return res.json({
//             status: 1,
//             message: `${insertedCount} sale(s) inserted successfully.`
//         });

//     } catch (err) {
//         console.error("Error in createSalesItem:", err);
//         return res.json({
//             status: 0,
//             message: "Something went wrong!.. Try again later.",
//             error: err.message
//         });
//     }
// };




exports.createSalesItem = async (req, res) => {
    try {
        const salesArray = req.body;

        if (!Array.isArray(salesArray) || salesArray.length === 0) {
            return res.json({
                status: 0,
                message: "Request data must be a non-empty array."
            });
        }

        // 1️⃣ Validate all items
        for (const [index, item] of salesArray.entries()) {
            const validate = new Validator(item, {
                sales_id: 'required',
                customer_name: 'required',
                customer_address: 'required',
                product_name: 'required',
                description: 'required',
                quantity: 'required|numeric|min:1',
                unit_price: 'required|numeric|min:0',
                tax: 'required|numeric|min:0',
                total: 'required|numeric|min:0'
            });

            const matched = await validate.check();
            if (!matched) {
                let msg = Object.values(validate.errors).map(e => e.message).join(', ');
                return res.json({
                    status: 0,
                    message: `Validation failed for item ${index + 1}: ${msg}`
                });
            }
        }

        // 2️⃣ Sum up total quantity per product_name
        const productTotals = {};
        for (const item of salesArray) {
            const name = item.product_name;
            productTotals[name] = (productTotals[name] || 0) + Number(item.quantity);
        }

        // 3️⃣ Check stock for all products
        const insufficientItems = [];

        for (const [productName, totalQty] of Object.entries(productTotals)) {
            const stockQuery = "SELECT current_stocks FROM item_master WHERE item_name = ? AND is_deleted != 1;";
            const stockData = await new Promise((resolve) => {
                db.mainDb(stockQuery, [productName], (err, result) => {
                    if (err) return resolve({ error: err });
                    if (!result || result.length === 0) return resolve({ notFound: true });
                    resolve({ stock: result[0].current_stocks });
                });
            });

            if (stockData.error) {
                return res.json({
                    status: 0,
                    message: `Error checking stock for ${productName}: ${stockData.error.message}`
                });
            }

            if (stockData.notFound || stockData.stock < totalQty) {
                insufficientItems.push({
                    product_name: productName,
                    available: stockData.notFound ? 0 : stockData.stock,
                    requested: totalQty
                });
            }
        }

        // 4️⃣ Abort everything if any product lacks stock
        if (insufficientItems.length > 0) {
            return res.json({
                status: 0,
                message: "Insufficient stock for one or more items. No sales recorded.",
                insufficientItems
            });
        }

        // 5️⃣ All good → insert all records and update stocks
        let insertedCount = 0;
        let updatedCount = 0;

        for (const item of salesArray) {
            const insertQuery = "INSERT INTO ma_sales_history SET ?;";
            const insertObj = {
                sales_id: item.sales_id,
                customer_name: item.customer_name,
                customer_address: item.customer_address,
                product_name: item.product_name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                tax: item.tax,
                total: item.total
            };

            // Insert Sale
            await new Promise((resolve) => {
                db.mainDb(insertQuery, insertObj, (err, data) => {
                    if (!err && data.affectedRows === 1) insertedCount++;
                    resolve();
                });
            });

            // Update Stock After Insert
            const updateStockQuery = `
                UPDATE item_master 
                SET current_stocks = current_stocks - ? 
                WHERE item_name = ? AND is_deleted != 1;
            `;

            await new Promise((resolve) => {
                db.mainDb(updateStockQuery, [item.quantity, item.product_name], (err, data) => {
                    if (!err && data.affectedRows === 1) updatedCount++;
                    resolve();
                });
            });
        }

        // ✅ Response
        return res.json({
            status: 1,
            message: `${insertedCount} sale(s) inserted & stocks updated successfully.`
        });

    } catch (err) {
        console.error("Error in createSalesItem:", err);
        return res.json({
            status: 0,
            message: "Something went wrong!.. Try again later.",
            error: err.message
        });
    }
};



exports.getSalesList = async (req, res) => {
    try {
        const { from_date, to_date } = req.body;

        // 🕒 Optional date filters
        let whereClause = "";
        const params = [];

        if (from_date && to_date) {
            whereClause = "WHERE DATE(created_at) BETWEEN ? AND ?";
            params.push(from_date, to_date);
        } else if (from_date) {
            whereClause = "WHERE DATE(created_at) >= ?";
            params.push(from_date);
        } else if (to_date) {
            whereClause = "WHERE DATE(created_at) <= ?";
            params.push(to_date);
        }

        const selectQuery = `
      SELECT 
        sales_id,
        customer_name,
        customer_address,
        product_name,
        description,
        quantity,
        unit_price,
        tax,
        total,
        created_at
      FROM ma_sales_history
      ${whereClause}
      ORDER BY sales_id DESC;
    `;

        const salesData = await new Promise((resolve, reject) => {
            db.mainDb(selectQuery, params, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        });

        if (!salesData || salesData.length === 0) {
            return res.json({
                status: 0,
                message: "No sales data found for the given date range."
            });
        }

        // 🧠 Group sales by sales_id + customer info
        const groupedSales = {};

        for (const row of salesData) {
            const saleId = row.sales_id;

            if (!groupedSales[saleId]) {
                groupedSales[saleId] = {
                    sales_id: saleId,
                    customer_name: row.customer_name,
                    customer_address: row.customer_address,
                    data: [],
                    grand_total: 0
                };
            }

            groupedSales[saleId].data.push({
                product_name: row.product_name,
                description: row.description,
                quantity: row.quantity,
                unit_price: row.unit_price,
                tax: row.tax,
                total: row.total
            });

            groupedSales[saleId].grand_total += Number(row.total);
        }

        // 🧾 Convert to array
        const result = Object.values(groupedSales);

        return res.json({
            status: 1,
            message: "Sales list fetched successfully.",
            data: result
        });

    } catch (err) {
        console.error("Error in getSalesList:", err);
        return res.json({
            status: 0,
            message: "Something went wrong!.. Try again later.",
            error: err.message
        });
    }
};



exports.getDashboardStats = async (req, res) => {
    try {
        // 1️⃣ Query for active, inactive, and total item counts
        const itemQuery = `
      SELECT 
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_items,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive_items,
        COUNT(*) AS total_items
      FROM item_master
      WHERE is_deleted = 0;
    `;

        const itemData = await new Promise((resolve, reject) => {
            db.mainDb(itemQuery, "", (err, data) => {
                if (err) return reject(err);
                resolve(data[0]);
            });
        });

        const salesQuery = `
  SELECT 
    IFNULL(ROUND(SUM((quantity * unit_price) + ((quantity * unit_price) * (tax / 100)))), 0) AS monthly_sales
  FROM ma_sales_history
  WHERE MONTH(created_at) = MONTH(CURDATE())
    AND YEAR(created_at) = YEAR(CURDATE());
`;



        const salesData = await new Promise((resolve, reject) => {
            db.mainDb(salesQuery, "", (err, data) => {
                if (err) return reject(err);
                resolve(data[0]);
            });
        });

        // 3️⃣ Combine data
        const result = {
            active_items: itemData.active_items || 0,
            inactive_items: itemData.inactive_items || 0,
            total_items: itemData.total_items || 0,
            monthly_sales: parseFloat(salesData.monthly_sales || 0)
        };

        // ✅ Response
        return res.json({
            status: 1,
            message: "Dashboard data fetched successfully",
            data: result
        });

    } catch (err) {
        console.error("Error in getDashboardStats:", err);
        return res.json({
            status: 0,
            message: "Something went wrong!.. Try again later.",
            error: err.message
        });
    }
};
