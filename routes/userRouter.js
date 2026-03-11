let express = require('express');
let router = express.Router();
let userController = require('../controllers/userController.js')
let helper = require("../helper/helper.js")
/* GET users listing. */
router.get('/', function (req, res) {
    res.json({ status: 1, message: "working" })
});

router.post('/createAccount', userController.createAccount);
router.post('/login', userController.login);
router.post('/loginVerify', userController.loginVerify);


router.post('/send_mail_otp_register', userController.send_mail_otp_register);
router.post('/send_mob_otp_register', userController.send_mob_otp_register);

router.post('/verify_mail_otp_register', userController.verify_mail_otp_register);
router.post('/verify_mobile_otp_register', userController.verify_mobile_otp_register);

router.post('/getTestOtp', userController.getTestOtp);


router.post('/info', helper.app_maintenance, helper.auth, userController.info);

router.post('/requestMoveWalletAmount', helper.app_maintenance, helper.auth, userController.requestMoveWalletAmount);



router.post('/userDepositList', helper.app_maintenance, helper.auth, userController.userDepositList);
router.post('/userWalletRequestList', helper.app_maintenance, helper.auth, userController.userWalletRequestList);


router.post('/userWithdrawRequest', helper.app_maintenance, helper.auth, userController.userWithdrawRequest);

router.post('/userWithdrawList', helper.app_maintenance, helper.auth, userController.userWithdrawList);


router.post('/userDailyWalletProfit', helper.app_maintenance, helper.auth, userController.userDailyWalletProfit);

router.post('/userDailyReferralProfit', helper.app_maintenance, helper.auth, userController.userDailyReferralProfit);

router.post('/transactionHistory', helper.app_maintenance, helper.auth, userController.transactionHistory);
















// TICKET ROUTES
router.post('/createTicket',
    helper.app_maintenance,
    helper.auth,
    userController.createTicket
);

router.post('/replyTicket',
    helper.app_maintenance,
    helper.auth,
    userController.replyTicket
);

router.post('/userTicketList',
    helper.app_maintenance,
    helper.auth,
    userController.userTicketList
);

router.post('/ticketDetails',
    helper.app_maintenance,
    helper.auth,
    userController.ticketDetails
);

// router.post('/searchTicket',
//     helper.app_maintenance,
//     helper.auth,
//     userController.searchTicket
// );


module.exports = router;
