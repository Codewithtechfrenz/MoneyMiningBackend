let express = require('express');
let router = express.Router();
let itemController = require ('../controllers/exampleController.js')

router.get('/', function(req,res){
res.json({status:1})
});

router.post('/createItems', itemController.createItems);
router.post('/editItems', itemController.editItems);
router.post('/getItemList', itemController.getItemList);


router.post('/createUoms', itemController.createUoms);
router.post('/editUoms', itemController.editUoms);
router.post('/getUomList', itemController.getUomList);


router.post('/createCategory', itemController.createCategory);
router.post('/editCategory', itemController.editCategory);
router.post('/getCategoryList', itemController.getCategoryList);


router.post('/createSalesItem', itemController.createSalesItem);
router.post('/getSalesList', itemController.getSalesList);


router.post('/getDashboardStats', itemController.getDashboardStats);


module.exports = router;
