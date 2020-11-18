const express = require('express');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');


/* GET home page. */
function showIndex(req, res, next){
    res.locals.siteSection='home';
    res.render('index');
}

async function getGamePage(req, res, next){
    if (req.user.is_player || (req.session.assumed_user && req.session.assumed_user.is_player)){
        const gamestate = await gameEngine.getGameState(req.session.assumed_user?req.session.assumed_user.id:req.user.id);
        res.locals.gamestate = gamestate;
        res.locals.rooms = _.indexBy(await req.models.room.list(), 'id');
        res.set('x-game-state', gamestate.current.id);
        return res.render('game/page');

    }
    return res.render('game/default', { title: config.get('app.name') });
}

async function getRoom(req, res, next){
    const code = req.params.code;
    try {
        const room = await req.models.room.getByCode(code);
        if(!room){
            return res.json({success:false, error:'Invalid code', retry:true});
        }
        if (!room.active){
            return res.json({success:false, error:'Room is not active', retry:false});
        }
        if (room.url === 'stub'){
            return res.json({success:true, url:'/stub/' + room.id});
        } else {
            return res.json({success:true, url:room.url});
        }
    } catch (err){
        return res.json({success:false, error:err.message});

    }
}



const router = express.Router();

router.get('/', showIndex);
router.get('/game', getGamePage);
router.get('/code/:code', getRoom);

module.exports = router;
