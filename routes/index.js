const express = require('express');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');


/* GET home page. */
function showIndex(req, res, next){
    res.locals.siteSection='home';
    res.render('index', { title: config.get('app.name') });
}

async function getRoom(req, res, next){
    const code = req.params.code;
    try {
        const room = await req.models.room.getByCode(code);
        if(!room){
            return res.json({success:false, error:'invalid code'});
        }
        if (!room.active){
            return res.json({success:false, error:'room is not active'});
        }
        return res.json({success:true, url:room.url});
    } catch (err){
        return res.json({success:false, error:err.message});

    }
}

const router = express.Router();

router.get('/', showIndex);
router.get('/code/:code', getRoom);

module.exports = router;
