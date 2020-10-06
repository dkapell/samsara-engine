var express = require('express');

/* GET home page. */
function showIndex(req, res, next){
    res.locals.siteSection='home';
    res.render('index', { title: 'Express' });
}

var router = express.Router();

router.get('/', showIndex);

module.exports = router;
