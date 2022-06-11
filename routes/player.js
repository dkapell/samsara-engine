const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const async = require('async');
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
        const players = (await req.models.user.find(req.game.id)).filter(user => {
            return user.type === 'player';
        });
        res.locals.users = await async.map(players, async user => {
            user.screen = await gameEngine.getScreen(user.id, req.game.id);
            user.player = user.screen.player;
            user.connected = _.indexOf(req.app.locals.gameServer.allClients, user.id) !== -1;

            user.triggers = (await req.models.player.getTriggers(user.player.id)).map(trigger => {
                delete trigger.actions;
                delete trigger.condition;
                return trigger;
            });

            return user;
        });

        res.locals.runs = _.indexBy(await req.models.run.find({game_id: req.game.id}), 'id');
        res.locals.groups = _.indexBy(await req.models.group.find({game_id: req.game.id}), 'id');
        res.locals.triggers = await req.models.trigger.find({game_id: req.game.id});

        res.render('player/list', { pageTitle: 'Players' });
    } catch (err){
        next(err);
    }
}

async function assumePlayer(req, res, next){
    try{
        const user = await req.models.user.get(req.game.id, req.params.id);
        if (!user){
            req.flash('error', 'No User Found');
            return res.redirect('/player');
        }
        if (user.type !== 'player'){
            req.flash('error', 'User is not a player');
            return res.redirect('/player');
        }
        user.player = await req.models.player.find({game_id: req.game.id, user_id: user.id});
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
        const user = await req.models.user.get(req.game.id, req.params.id);
        if (!user){
            throw new Error ('User not found');
        }
        const changed = await gameEngine.nextScreen(user.id, req.game.id);
        if (changed){
            await req.app.locals.gameServer.sendScreen(user.id, req.game.id);
            await req.app.locals.gameServer.sendLocationUpdate(user.player.run_id, null, null);
        }
        res.json({success:true});
        gameEngine.updateTriggers(user.id, req.game.id);
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function sendToast(req, res, next){
    try{
        const user = await req.models.user.get(req.game.id, req.params.id);
        if (!user){
            throw new Error ('User not found');
        }
        req.app.locals.gameServer.sendToast(req.body.message, {
            duration: req.body.duration,
            userId: user.id,
            from: req.body.from && req.body.from !== ''?req.body.from:null
        }, req.game.id);
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function runTrigger(req, res, next){
    try{
        const user = await req.models.user.get(req.game.id, req.params.id);
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

        await req.app.locals.gameServer.runTrigger(trigger, user, req.game.id);
        await req.app.locals.gameServer.sendPlayerUpdate(res.game.id);

        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function resetInkStories(req, res, next){
    try{
        const user = await req.models.user.get(req.game.id, req.params.id);
        if (!user){
            throw new Error ('User not found');
        }
        const inkScreens = await req.models.ink_state.find({player_id: user.player.id});
        await async.each(inkScreens, async (ink_state) => {
            return req.models.ink_state.delete(ink_state.id);
        });
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
router.put('/:id/resetInk', csrf(), permission('admin'), resetInkStories);
router.put('/:id/trigger/:triggerid', csrf(), permission('gm'), runTrigger);

module.exports = router;
