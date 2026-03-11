let express = require('express');
let router = express.Router();
let kycController = require('../controllers/kycController.js')
let helper = require("../helper/helper.js")


router.post('/upload_kyc_details', helper.app_maintenance, helper.auth, kycController.saveKycDetails);

router.post('/addBankDetails', helper.app_maintenance, helper.auth, kycController.addBankDetails);

router.post('/getBankList', helper.app_maintenance, kycController.getBankList);

router.post('/saveKycAndBankDetails', helper.app_maintenance, helper.auth, kycController.saveKycAndBankDetails);

router.post('/getSingleKycDetail', helper.app_maintenance, helper.auth, kycController.getSingleKycDetail);

module.exports = router;
