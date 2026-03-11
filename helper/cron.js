const cron = require('node-cron');
const db = require('../models/db'); // your existing db.js

let roiCron = async () => {
    console.log('--- Running Daily 0.3% Profit Cron ---', new Date());

    try {
        const allUsers = await db.mainDbForCron(`
            SELECT u.id AS user_id, uw.main_wallet, uw.wallet AS current_wallet
            FROM mo_user_info u
            JOIN mo_user_wallet uw ON u.id = uw.user_id
        `);

        for (const user of allUsers) {
            const userId = user.user_id;
            const dailyProfit = parseFloat((user.main_wallet * 0.003).toFixed(2));

            if (dailyProfit <= 0) {
                console.log(`SKIP: User ${userId} main_wallet <= 0, profit skipped`);
                continue;
            }

            const insertResult = await db.mainDbForCron(
                `INSERT IGNORE INTO mo_wallet_daily_profit
                 (user_id, main_wallet_balance, profit_percentage, profit_amount, profit_date)
                 VALUES (?, ?, 0.300, ?, CURDATE())`,
                [userId, user.main_wallet, dailyProfit]
            );

            if (insertResult.affectedRows === 0) {
                console.log(`SKIP: Daily profit already credited for user ${userId}`);
                continue;
            }

            const beforeBalance = user.current_wallet;
            const afterBalance = beforeBalance + dailyProfit;

            await db.mainDbForCron(
                `UPDATE mo_user_wallet SET wallet = ?, updated_at = NOW() WHERE user_id = ?`,
                [afterBalance, userId]
            );

            await db.mainDbForCron(
                `INSERT INTO mo_user_wallet_access
                 (user_id, wallet_type, transaction_type, amount, before_balance, after_balance, source, remarks, created_at)
                 VALUES (?, 'wallet', 'credit', ?, ?, ?, 'cron', 'Daily 0.3% profit', NOW())`,
                [userId, dailyProfit, beforeBalance, afterBalance]
            );

            console.log(`SUCCESS: Daily profit credited to user ${userId}: ${dailyProfit}`);
        }

    } catch (err) {
        console.error('ERROR in ROI Cron:', err);
    }
};


let refererCron = async () => {
    console.log('--- Running Referral Bonus 0.1% Cron ---', new Date());

    try {
        const referredUsers = await db.mainDbForCron(`
            SELECT u.id AS user_id, u.referred_from, uw.main_wallet, uw.wallet AS current_wallet
            FROM mo_user_info u
            JOIN mo_user_wallet uw ON u.id = uw.user_id
            WHERE u.referred_from IS NOT NULL
        `);

        if (!referredUsers || referredUsers.length === 0) {
            console.log('No referred users today.');
            return;
        }

        const allUsers = await db.mainDbForCron(`
            SELECT u.id AS user_id, u.referral_code, uw.main_wallet, uw.wallet AS current_wallet
            FROM mo_user_info u
            JOIN mo_user_wallet uw ON u.id = uw.user_id
        `);

        const referralMap = {};
        allUsers.forEach(u => referralMap[u.referral_code] = u);

        for (const user of referredUsers) {
            const userId = user.user_id;
            const referrer = referralMap[user.referred_from];

            if (!referrer) {
                console.log(`SKIP: Referrer for user ${userId} not found`);
                continue;
            }

            if (referrer.main_wallet < 10000) {
                console.log(`SKIP: Referrer ${referrer.user_id} main_wallet < 10000, bonus skipped`);
                continue;
            }

            const bonus = parseFloat((user.main_wallet * 0.001).toFixed(2));
            if (bonus <= 0) {
                console.log(`SKIP: User ${userId} main_wallet too low for referral bonus`);
                continue;
            }

            const refBefore = referrer.current_wallet;
            const refAfter = refBefore + bonus;

            // Update referrer wallet
            await db.mainDbForCron(
                `UPDATE mo_user_wallet SET wallet = ?, updated_at = NOW() WHERE user_id = ?`,
                [refAfter, referrer.user_id]
            );

            // Insert wallet access
            await db.mainDbForCron(
                `INSERT INTO mo_user_wallet_access
                 (user_id, wallet_type, transaction_type, amount, before_balance, after_balance, source, remarks, created_at)
                 VALUES (?, 'wallet', 'credit', ?, ?, ?, 'cron', 'Referral bonus 0.1% from referred user', NOW())`,
                [referrer.user_id, bonus, refBefore, refAfter]
            );

            // Insert into referral bonus table
            const insertRefBonus = await db.mainDbForCron(
                `INSERT IGNORE INTO mo_wallet_daily_profit_from_ref
                 (referrer_id, referred_user_id, referred_user_main_wallet, bonus_percentage, bonus_amount, bonus_date)
                 VALUES (?, ?, ?, 0.100, ?, CURDATE())`,
                [referrer.user_id, user.user_id, user.main_wallet, bonus]
            );

            if (insertRefBonus.affectedRows > 0) {
                console.log(`SUCCESS: Referral bonus credited to ${referrer.user_id} from user ${userId}: ${bonus}`);
            } else {
                console.log(`SKIP: Referral bonus already credited today for referrer ${referrer.user_id} from user ${userId}`);
            }

            // Update in-memory wallet
            referrer.current_wallet = refAfter;
        }

    } catch (err) {
        console.error('ERROR in Referral Cron:', err);
    }
};


// Run crons
roiCron();
refererCron();


cron.schedule('10 0 * * *', async () => {
  try {
    await roiCron();
    await refererCron();
    console.log("Cron completed");
  } catch (err) {
    console.error("Cron failed:", err);
  }
}, {
  timezone: "Asia/Kolkata"
});



