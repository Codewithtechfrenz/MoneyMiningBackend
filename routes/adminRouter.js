let express = require('express');
let router = express.Router();
let adminController = require('../controllers/adminController.js')
let adminhelper = require("../helper/adminhelper.js")
/* GET users listing. */
router.get('/', function (req, res) {
    res.json({ status: 1 })
});

router.post('/adminLogin', adminController.adminLogin);
router.post('/adminLoginVerify', adminController.adminLoginVerify);
router.get('/adminOtp', adminController.adminOtp);



router.post('/adminInfo', adminhelper.auth, adminController.adminInfo);

router.post('/getUserDetails', adminhelper.auth, adminController.getUserDetails);

// router.post('/getKycList', adminhelper.auth, adminController.getKycList);

router.post('/userKycListAdmin', adminController.userKycListAdmin);

router.post('/userBankVerificationListAdmin', adminController.userBankVerificationListAdmin);

router.post('/getSingleKycDetail', adminhelper.auth, adminController.getSingleKycDetail);


router.post('/verifyKyc', adminhelper.auth, adminController.verifyKyc);
router.post('/verifyBankAdmin', adminController.verifyBankAdmin);


router.post('/depositList', adminController.depositList);
router.post('/moveWalletAmount', adminController.moveWalletAmount);

router.post('/userWalletRequestListAdmin', adminController.userWalletRequestListAdmin);

router.post('/userWithdrawListAdmin', adminController.userWithdrawListAdmin);

router.post('/approveWithdraw', adminController.approveWithdraw);

router.post('/userDailyWalletProfitAdmin', adminController.userDailyWalletProfitAdmin);

router.post('/userDailyReferralProfitAdmin', adminController.userDailyReferralProfitAdmin);





















// TICKET ROUTES (Admin)
router.post('/ticketListAdmin',
    // adminhelper.auth,
    adminController.ticketListAdmin
);

router.post('/ticketDetailsAdmin',
    // adminhelper.auth,
    adminController.ticketDetailsAdmin
);

router.post('/replyTicketAdmin',
    // adminhelper.auth,
    adminController.replyTicketAdmin
);

router.post('/closeTicketAdmin',
    // adminhelper.auth,
    adminController.closeTicketAdmin
);

//router.post('/searchTicketAdmin',
// adminhelper.auth,
//adminController.searchTicket
//);





module.exports = router;
