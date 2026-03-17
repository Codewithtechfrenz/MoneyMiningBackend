const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const nodemailer = require("nodemailer");
const db = require("../models/db");
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
        user: (process.env.BREVO_USER || "").trim(),
        pass: (process.env.BREVO_PASS || "").trim(),
    }
}); 
transporter.verify()
    .then(() => console.log("SMTP ready and authenticated"))
    .catch(err => {
        console.error("SMTP Verification Failed:", err.message);
        if (!process.env.BREVO_USER) {
            console.error("   Reason: BREVO_USER is undefined. check your .env path.");
        }
    }); 
const sendMailWithTemplate = async (toEmail, templateName, replacements = {}) => {
    try {
 
        if (!toEmail) {
            return { status: 0, message: "Recipient email is required" };
        }
 
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
        if (!emailRegex.test(toEmail)) {
            return { status: 0, message: "Invalid email format" };
        } 
const templateQuery = `
            SELECT subject, template
            FROM mo_mail_template
            WHERE template_name = ?
            LIMIT 1
        `;
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
        Object.keys(replacements).forEach((key) => {
            const regex = new RegExp(`{{${key}}}`, "g");
            template = template.replace(regex, replacements[key]);
        });
        const info = await transporter.sendMail({
            from: '"Money Mining India" <no-reply@moneymining.co.in>',
            to: toEmail,
            subject: subject,
            html: template
        });
        return {
            status: 1,
            message: "Email sent successfully",
            messageId: info.messageId
        }; 
} catch (err) {
        console.error("sendMailWithTemplate error:", err);
        return {
            status: 0,
            message: "Email sending failed",
            error: err.message
        };
    }
};
module.exports = { sendMailWithTemplate };
