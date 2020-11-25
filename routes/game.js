const express = require('express');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');
const gameValidator = require('../lib/gameValidator');

async function getGamePage(req, res, next){
    try {
        if (req.user && (req.user.type === 'player' || (req.session.assumed_user && req.session.assumed_user.type === 'player'))){
            const gamestate = await gameEngine.getGameState(req.session.assumed_user?req.session.assumed_user.id:req.user.id);
            res.locals.gamestate = gamestate;
            res.locals.links = _.indexBy(await req.models.link.list(), 'id');
            res.set('x-game-state', gamestate.current.id);
            if (gamestate.current.start || gamestate.current.finish){
                res.set('x-game-refresh', config.get('game.waitingRefreshTime'));
            } else {
                res.set('x-game-refresh', config.get('game.refreshTime'));
            }
            return res.render('game/page');

        }
        res.set('x-game-refresh', config.get('game.nonplayerRefreshTime'));
        return res.render('game/default', { title: config.get('app.name') });
    } catch(err){
        next(err);
    }
}

async function getLink(req, res, next){
    const code = req.params.code;
    try {
        if (req.user && (req.user.type === 'player' || (req.session.assumed_user && req.session.assumed_user.type === 'player'))){
            const user = req.session.assumed_user?req.session.assumed_user:req.user;
            const result = await gameEngine.openCode(code, user.id);

            if(!result){
                throw new Error(config.get('game.linkName') + ' not found');
            }

            if (result.link.url === 'stub'){
                return res.json({success:true, actions:[ {action:'load', url:'/stub/' + result.link.id}]});
            } else {
                return res.json({success:true, actions: [ {action:'load', url:result.link.url}]});
            }
        } else {
            throw new Error('You are not a player');
        }
    } catch (err){
        console.trace(err);
        let retry = false;
        if (err.message === config.get('game.linkName') + ' is not active'){
            retry = true;
        }
        return res.json({success:false, error:err.message, retry:retry});
    }
}

async function checkArea(req, res, next){
    const areaId = Number(req.params.id);
    try{
        if (req.user && (req.user.type === 'player' || (req.session.assumed_user && req.session.assumed_user.type === 'player'))){
            const user = req.session.assumed_user?req.session.assumed_user:req.user;
            const actions = await gameEngine.checkArea(areaId, user.id);
            if (actions){
                return res.json({success:true, actions: actions});
            }
            return res.json({success:true, actions: [{ action:'reload'}]});
        } else {
            throw new Error('You are not a player');
        }

    } catch(err){
        console.trace(err);
        let retry = false;
        if (err.message === config.get('game.linkName') + ' is not active'){
            retry = true;
        }
        return res.json({success:false, error:err.message, retry:retry});
    }

}

async function validateGame(req, res, next){
    res.locals.siteSection = 'config';
    res.locals.validation = await gameValidator.validate();
    res.render('game/validate');
}

function showGraph(req, res, next){
    res.render('game/graph');
}

async function getGraphData(req, res, next){
    try{
        const gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.gamestates = await Promise.all(
            gamestates.map( async gamestate => {
                gamestate.transitions = await gameEngine.getTransitionsFrom(gamestate);
                gamestate.player_count = (await req.models.player.find({gamestate_id: gamestate.id})).length;
                return gamestate;
            })
        );
        res.json(gamestates);
    } catch(err){
        res.json({success:false, error:err});
    }
}


const router = express.Router();

router.get('/', getGamePage);
router.get('/code/:code', permission('player'), getLink);
router.get('/area/:id', permission('player'), checkArea);
router.get('/validator', permission('gm'), validateGame);
router.get('/graph', permission('gm'), showGraph);
router.get('/graph/data', permission('gm'), getGraphData);

module.exports = router;
