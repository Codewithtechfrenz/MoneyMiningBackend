

const nodemailer = require("nodemailer");
const db = require("../models/db"); // Your DB helper
const moment = require("moment");

 exports.sendMailWithTemplate = async (toEmail, templateName, replacements = {}) => {
    try {

        // 1️⃣ Validate email
        if (!toEmail) {
            return { status: 0, message: "Recipient email is required" };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(toEmail)) {
            return { status: 0, message: "Invalid email format" };
        }

        // 2️⃣ Fetch template from DB
        const templateQuery = `SELECT subject, template 
                               FROM mo_mail_template 
                               WHERE template_name = ? LIMIT 1`;

        const templateResult = await new Promise((resolve, reject) => {
            db.mainDb(templateQuery, [templateName], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (!templateResult || templateResult.length === 0) {
            return { status: 0, message: "Template not found" };
        }

        let { subject, template } = templateResult[0];

        // 3️⃣ Replace placeholders dynamically
        // Example: {{OTP}}, {{USERNAME}}
        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, "g");
            template = template.replace(regex, replacements[key]);
        });

        // 4️⃣ Create transporter
        if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
            return { status: 0, message: "SMTP credentials missing" };
        }

        const transporter = nodemailer.createTransport({
            host: "smtp-relay.brevo.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.BREVO_USER,
                pass: process.env.BREVO_PASS,
            }
        });

        // 5️⃣ Send email
        const info = await transporter.sendMail({
            from: '"Money Mining India" <noreply@moneymining.co.in>',
            to: toEmail,
            subject: subject,
            html: template
        });

        if (!info || !info.messageId) {
            return { status: 0, message: "Email not accepted by server" };
        }

        return {
            status: 1,
            message: "Email sent successfully",
            messageId: info.messageId
        };

    } catch (err) {
        console.error("sendMailWithTemplate error:", err);
        return { status: 0, message: "Email sending failed", error: err.message };
    }
};

// module.exports = sendMailWithTemplate;




// require("dotenv").config();
 
// const nodemailer = require("nodemailer");
// const db = require("../models/db");
 
// // Create SMTP transporter
// const transporter = nodemailer.createTransport({
//     host: "smtp-relay.brevo.com",
//     port: 587,
//     secure: false,
//     pool: true,
//     maxConnections: 5,
//     maxMessages: 100,
//     auth: {
//         user: process.env.BREVO_USER,
//         pass: process.env.BREVO_PASS,
//     }
// });
 
// // optional startup verification
// transporter.verify()
//   .then(() => console.log("SMTP ready"))
//   .catch(err => console.error("SMTP error:", err));
 
 
// const sendMailWithTemplate = async (toEmail, templateName, replacements = {}) => {
//     try {
 
//         if (!toEmail) {
//             return { status: 0, message: "Recipient email is required" };
//         }
 
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
//         if (!emailRegex.test(toEmail)) {
//             return { status: 0, message: "Invalid email format" };
//         } 
 
// const templateQuery = `
//             SELECT subject, template
//             FROM mo_mail_template
//             WHERE template_name = ?
//             LIMIT 1
//         `;
 
//         const templateResult = await new Promise((resolve, reject) => {
//             db.mainDb(templateQuery, [templateName], (err, results) => {
//                 if (err) return reject(err);
//                 resolve(results);
//             });
//         });
 
//         if (!templateResult || templateResult.length === 0) {
//             return { status: 0, message: "Template not found" };
//         }
 
//         let { subject, template } = templateResult[0];
 
//         Object.keys(replacements).forEach((key) => {
//             const regex = new RegExp(`{{${key}}}`, "g");
//             template = template.replace(regex, replacements[key]);
//         });
 
//         const info = await transporter.sendMail({
//             from: '"Money Mining India" <noreply@moneymining.co.in>',
//             to: toEmail,
//             subject: subject,
//             html: template
//         });
 
//         return {
//             status: 1,
//             message: "Email sent successfully",
//             messageId: info.messageId
//         }; 
 
// } catch (err) {
 
//         console.error("sendMailWithTemplate error:", err);
 
//         return {
//             status: 0,
//             message: "Email sending failed",
//             error: err.message
//         };
//     }
// };
 
 
// // export function
// module.exports = { sendMailWithTemplate };