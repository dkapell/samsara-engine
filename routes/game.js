const express = require('express');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');
const gameValidator = require('../lib/gameValidator');
const script = require('../lib/script');
const stripAnsi = require('strip-ansi');


async function getGamePage(req, res, next){
    return res.render('game/default', { title: config.get('app.name') });
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
        await Promise.all(
            gamestates.map( async gamestate => {
                gamestate.transitions = await gameEngine.getTransitionsFrom(gamestate);
                gamestate.player_count = (await req.models.player.find({gamestate_id: gamestate.id})).length;
                return gamestate;
            })
        );
        res.json({
            gamestates: gamestates,
            triggers: await req.models.trigger.list(),
            codes: await req.models.code.list()
        });

    } catch(err){
        res.json({success:false, error:err});
    }
}

async function verifyScript(req, res, next){
    try {
        const inputScript = req.body.script;
        const verified = await script.verify(inputScript, 'stylish');
        if (!verified.verified){
            verified.errors = stripAnsi(verified.errors).trim();
        }
        res.json(verified);
    } catch (err) {
        res.json({verified:false, errors:err});
    }
}

function showChat(req, res, next){
    res.locals.includeChatSidebar = false;
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Chat'
    };
    res.render('game/chat');
}

const router = express.Router();

router.get('/', getGamePage);
router.get('/validator', permission('gm'), validateGame);
router.get('/graph', permission('gm'), showGraph);
router.get('/graph/data', permission('gm'), getGraphData);
router.post('/script/verify', permission('creator'), verifyScript);
router.get('/chat', permission('gm'), showChat);

module.exports = router;

