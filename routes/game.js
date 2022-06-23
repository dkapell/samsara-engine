const express = require('express');
const config = require('config');
const _ = require('underscore');
const async = require('async');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');
const gameValidator = require('../lib/gameValidator');
const scriptRunner = require('../lib/scriptRunner');
const stripAnsi = require('strip-ansi');


async function getGamePage(req, res, next){
    return res.render('game/default', { title: req.game.name});
}

async function validateGame(req, res, next){
    res.locals.siteSection = 'config';
    res.locals.validation = await gameValidator.validate(req.game.id);
    res.render('game/validate');
}

function showGraph(req, res, next){
    res.render('game/graph');
}

async function getGraphData(req, res, next){
    try{
        const screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        const run = await req.models.run.getCurrent(req.game.id);
        await async.each(screens,  async screen => {
            screen.transitions = await gameEngine.getTransitionsFrom(screen);
            screen.player_count = (await req.models.player.find({screen_id: screen.id, run_id: run.id})).length;
            return screen;
        });
        res.json({
            screens: screens,
            triggers: await req.models.trigger.find({game_id: req.game.id}),
            codes: await req.models.code.find({game_id: req.game.id})
        });

    } catch(err){
        res.json({success:false, error:err});
    }
}

async function verifyScript(req, res, next){
    try {
        const inputScript = req.body.script;
        const verified = await scriptRunner.verify(inputScript, 'stylish');
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

function getGameCss(req, res, next){
    res.setHeader('content-type', 'text/css');
    res.send(req.game.css);
}

const router = express.Router();

router.get('/', getGamePage);
router.get('/css', getGameCss);
router.get('/validator', permission('gm'), validateGame);
router.get('/graph', permission('gm'), showGraph);
router.get('/graph/data', permission('gm'), getGraphData);
router.post('/script/verify', permission('creator'), verifyScript);
router.get('/chat', permission('gm'), showChat);

module.exports = router;

