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
    try {
        if (req.user && (req.user.type === 'player' || (req.session.assumed_user && req.session.assumed_user.type === 'player'))){
            const gamestate = await gameEngine.getGameState(req.session.assumed_user?req.session.assumed_user.id:req.user.id);
            res.locals.gamestate = gamestate;
            res.locals.rooms = _.indexBy(await req.models.room.list(), 'id');
            res.set('x-game-state', gamestate.current.id);
            return res.render('game/page');

        }
        return res.render('game/default', { title: config.get('app.name') });
    } catch(err){
        next(err);
    }
}

async function getRoom(req, res, next){
    const code = req.params.code;
    try {
        if (req.user && (req.user.type === 'player' || (req.session.assumed_user && req.session.assumed_user.type === 'player'))){
            const user = req.session.assumed_user?req.session.assumed_user:req.user;
            const result = await gameEngine.openCode(code, user.id);

            if(!result){
                throw new Error('Room not found');
            }

            if (result.room.url === 'stub'){
                return res.json({success:true, action:'load', url:'/stub/' + result.room.id});
            } else if (result.room.url === 'none'){
                return res.json({success:true, action:'reload'});
            } else {
                return res.json({success:true, action:'load', url:result.room.url});
            }
        } else {
            throw new Error('You are not a player');
        }
    } catch (err){
        console.trace(err);
        let retry = false;
        if (err.message === 'Room is not active'){
            retry = true;
        }
        return res.json({success:false, error:err.message, retry:retry});
    }
}

async function validateGame(req, res, next){
    res.locals.siteSection = 'config';
    res.locals.validation = await gameEngine.validate(1);
    res.render('game/validate');
}



const router = express.Router();

router.get('/', showIndex);
router.get('/game', getGamePage);
router.get('/code/:code', permission('player'), getRoom);
router.get('/game/validator', permission('gm'), validateGame);

module.exports = router;
