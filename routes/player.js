const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Players'
    };
    try {
        const players = (await req.models.user.list()).filter(user => {
            return user.type === 'player';
        });
        res.locals.users = await Promise.all(
            players.map( async user => {
                user.gamestate = await gameEngine.getGameState(user.id);
                user.player = user.gamestate.player;
                user.connected = _.indexOf(req.app.locals.gameServer.allClients, user.id) !== -1;
                user.triggers = await gameEngine.getTriggers(user.id);

                return user;
            })
        );
        res.locals.runs = _.indexBy(await req.models.run.list(), 'id');
        res.locals.groups = _.indexBy(await req.models.group.list(), 'id');
        res.locals.triggers = await req.models.trigger.list();

        res.render('player/list', { pageTitle: 'Players' });
    } catch (err){
        next(err);
    }
}

async function assumePlayer(req, res, next){
    try{
        const user = await req.models.user.get(req.params.id);
        if (!user){
            req.flash('error', 'No User Found');
            return res.redirect('/player');
        }
        if (user.type !== 'player'){
            req.flash('error', 'User is not a player');
            return res.redirect('/player');
        }
        user.player = await req.models.player.getByUserId(user.id);
        req.session.assumed_user = user;
        res.redirect('/');
    } catch (err) {
        next(err);
    }
}

function revertPlayer(req, res, next){
    delete req.session.assumed_user;
    res.redirect('/');
}

async function advance(req, res, next){
    try{
        const user = await req.models.user.get(req.params.id);
        if (!user){
            throw new Error ('User not found');
        }
        const changed = await gameEngine.nextState(user.id);
        if (changed){
            await req.app.locals.gameServer.sendGameState(user.id);
            await req.app.locals.gameServer.sendLocationUpdate(user.player.run_id, null, null);
        }
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function sendToast(req, res, next){
    try{
        const user = await req.models.user.get(req.params.id);
        if (!user){
            throw new Error ('User not found');
        }
        req.app.locals.gameServer.sendToast(req.body.message, {
            duration: req.body.duration,
            userId: user.id,
            from: req.body.from && req.body.from !== ''?req.body.from:null
        });
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function runTrigger(req, res, next){
    try{
        const user = await req.models.user.get(req.params.id);
        if (!user){
            throw new Error ('User not found');
        }
        const trigger = await req.models.trigger.get(req.params.triggerid);
        if (!trigger){
            throw new Error ('Trigger not found');
        }
        if (!trigger.player){
            throw new Error('Trigger not enabled for individual players');
        }

        await req.app.locals.gameServer.runTrigger(trigger, user);

        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', permission('gm'), list);
router.get('/revert', revertPlayer);
router.get('/:id/assume', csrf(), permission('gm'), assumePlayer);
router.put('/:id/advance', csrf(), permission('gm'), advance);
router.put('/:id/toast', csrf(), permission('gm'), sendToast);
router.put('/:id/trigger/:triggerid', csrf(), permission('gm'), runTrigger);

module.exports = router;
