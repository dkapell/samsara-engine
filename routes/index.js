const express = require('express');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');
const gameValidator = require('../lib/gameValidator');


/* GET home page. */
function showIndex(req, res, next){
    res.locals.siteSection='home';
    if (req.game.id){
        res.render('index');
    } else {
        res.render('admin/index');
    }
}

const router = express.Router();

router.get('/', showIndex);

module.exports = router;
