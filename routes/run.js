const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const async = require('async');
const moment = require('moment');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');
const gameData = require('../lib/gameData');


/* GET runs listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Runs'
    };
    try {
        res.locals.runs = await async.map(await req.models.run.find({game_id: req.game.id}), async (run) => {
            run.players = await req.models.player.find({run_id: run.id});
            return run;
        });

        res.render('run/list', { pageTitle: 'Runs' });
    } catch (err){
        next(err);
    }
}

async function showCurrent(req, res, next){
    try{
        const run = await req.models.run.getCurrent(req.game.id);
        res.redirect('/run/' + run.id);
    } catch(err){
        next(err);
    }
}

async function show(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error('Invalid Run');
        }
        res.locals.run = run;


        const players = await req.models.player.find({run_id: req.params.id});
        let last = (new Date()).getTime();

        const users = await async.mapLimit(players, 5, async function(player){
            const user = await req.models.user.get(player.game_id, player.user_id);

            user.screen = await gameEngine.getScreen(user.id, req.game.id);

            if (!user.screen){
                return user;
            }
            for (const type of ['next', 'prev', 'current']){
                if (_.has(user.screen, type)){
                    delete user.screen[type].map;
                    delete user.screen[type].transitions;
                    delete user.screen[type].codes;
                    delete user.screen[type].image;
                }
            }
            user.screen.transitionTimeDelta = moment(player.statetime).fromNow();
            user.screen.transitionTime = moment(player.statetime).isSame(moment(), 'date')?moment(player.statetime).format('LT'):moment(player.statetime).format('lll');

            user.player = user.screen.player;

            user.triggers = (await req.models.player.getTriggers(player.id)).map(trigger => {
                delete trigger.actions;
                delete trigger.condition;
                return trigger;
            });

            return user;
        });

        if (req.query.api){
            return res.json({
                users: users,
                csrfToken: req.csrfToken()
            });
        }
        if (res.locals.run.current){
            res.locals.siteSection='gm';
        }
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.users = users
            .filter(user => { return user.type === 'player';})
            .sort((a, b) => {
                a.name.localeCompare(b.name);
            });
        res.locals.screens = await req.models.screen.listSpecial(req.game.id);
        res.locals.triggers = await req.models.trigger.find({game_id: req.game.id});
        res.locals.csrfToken = req.csrfToken();
        res.render('run/show');

    } catch(err){
        next(err);
    }
}

async function filter(arr, callback) {
    const fail = Symbol();
    return (await async.map(arr, async item => (await callback(item)) ? item : fail)).filter(i=>i!==fail);
}

function showNew(req, res, next){
    res.locals.run = {
        name: null,
        current: false,
        data: gameData.getStartData('run', req.game.id),
        show_stubs: true,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/run', name: 'Runs'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'runData')){
        res.locals.run = req.session.runData;
        delete req.session.runData;
    }
    res.render('run/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const run = await req.models.run.get(id);
        if (!run || run.game_id !== req.game.id){
            throw new Error('Invalid Run');
        }
        res.locals.run = run;
        if (_.has(req.session, 'runData')){
            res.locals.run = req.session.runData;
            delete req.session.runData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/run', name: 'Runs'},
            ],
            current: 'Edit: ' + run.name
        };

        res.render('run/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const run = req.body.run;

    req.session.runData = run;

    run.game_id = req.game.id;
    try{
        if (run.current){
            const current = await req.models.run.getCurrent(req.game.id);
            current.current = false;
            await req.models.run.update(current.id, current);
        }
        if (run.data){
            run.data = JSON.parse(run.data);
        } else {
            run.data = null;
        }
        if (!_.has(run, 'show_stubs')){
            run.show_stubs = false;
        }

        const id = await req.models.run.create(run);

        delete req.session.runData;
        req.flash('success', 'Created Run ' + run.name);
        res.redirect(`/run/${id}/`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/run/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const run = req.body.run;
    req.session.runData = run;

    try {
        const current = await req.models.run.get(id);
        if (!current){
            throw new Error('Invalid Document');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }
        if (run.current){
            const currentRun = await req.models.run.getCurrent(req.game.id);
            if (currentRun.id !== id){
                currentRun.current = false;
                await req.models.run.update(currentRun.id, currentRun);
            }
        }
        if (run.data){
            run.data = JSON.parse(run.data);
        } else {
            run.data = null;
        }

        if (!_.has(run, 'show_stubs')){
            run.show_stubs = false;
        }

        await req.models.run.update(id, run);
        delete req.session.runData;
        req.flash('success', 'Updated run ' + run.name);
        res.redirect(`/run/${id}/`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/run/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.run.get(id);
        if (!current){
            throw new Error('Invalid Document');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not delete record from different game');
        }
        await req.models.run.delete(id);
        req.flash('success', 'Removed Run');
        res.redirect('/run');
    } catch(err) {
        return next(err);
    }
}

async function resetRun(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.find({run_id: req.params.id});
        const initialScreen = await req.models.screen.getStart(req.game.id);
        await async.each(players, async player => {
            await gameEngine.changeScreen(player.user_id, req.game.id, initialScreen.id, 0);
            return req.app.locals.gameServer.sendScreen(player.user_id, req.game.id);
        });
        await req.app.locals.gameServer.sendLocationUpdate(run.id, null, initialScreen.id);
        await gameEngine.updateAllTriggers(req.game.id);
        await req.app.locals.gameServer.sendPlayerUpdate(req.game.id);
        res.json({success:true});

    } catch(err){
        console.trace(err);
        res.json({success:false, error: err.message});
    }
}

async function updateAllPlayers(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.find({run_id: req.params.id});
        const screen = await req.models.screen.get(req.body.screen_id);
        let group = false;
        if (!screen) { throw new Error('Screen not found'); }
        await async.each( players, async player => {
            if (req.body.group_id === '0' || _.findWhere(player.groups, {id: Number(req.body.group_id)})){
                await gameEngine.changeScreen(player.user_id, req.game.id, screen.id, 0, true);
                return req.app.locals.gameServer.sendScreen(player.user_id, req.game.id);
            }
        });
        await req.app.locals.gameServer.sendLocationUpdate(run.id, null, screen.id);
        await gameEngine.updateAllTriggers(req.game.id);
        await req.app.locals.gameServer.sendPlayerUpdate(req.game.id);
        res.json({success:true});

    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function advanceAll(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.find({run_id: req.params.id});
        await async.each(players, async player => {
            const changed = await gameEngine.nextScreen(player.user_id, req.game.id);
            if (changed){
                await req.app.locals.gameServer.sendScreen(player.user_id, req.game.id);
            }
            return;
        });
        await gameEngine.updateAllTriggers(req.game.id);
        await req.app.locals.gameServer.sendLocationUpdate(run.id, null, null);
        await req.app.locals.gameServer.sendPlayerUpdate(req.game.id);
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function toastAll(req, res, next){

    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.find({run_id: req.params.id});
        for(const player of players){
            req.app.locals.gameServer.sendToast(req.body.message, {
                duration: req.body.duration,
                userId: player.user_id,
                from:  req.body.from && req.body.from !== ''?req.body.from:null
            });
        }
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function runTriggerAll(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error ('Run not found');
        }
        const trigger = await req.models.trigger.get(req.params.triggerid);
        if (!trigger|| trigger.game_id !== req.game.id){
            throw new Error ('Trigger not found');
        }
        if (!trigger.run){
            throw new Error('Trigger not enabled for all players in a run');
        }
        const players = await req.models.player.find({run_id: req.params.id});
        await async.each(players, async player => {
            const user = await req.models.user.get(player.game_id, player.user_id);
            return req.app.locals.gameServer.runTrigger(trigger, user, req.game.id);
        });
        await req.app.locals.gameServer.sendPlayerUpdate(req.game.id);
        res.json({success:true});
    } catch(err){
        console.trace(err);
        res.json({success:false, error: err.message});
    }
}

async function resetInkStories(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run || run.game_id !== req.game.id){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.find({run_id: req.params.id});
        await async.each(players, async player => {
            const inkScreens = await req.models.ink_state.find({player_id: player.id});
            await async.each(inkScreens, async (ink_state) => {
                return req.models.ink_state.delete(ink_state.id);
            });
        });
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new',permission('admin'), csrf(), showNew);
router.get('/current', showCurrent);
router.get('/:id', csrf(), show);
router.get('/:id/edit', permission('admin'), csrf(), showEdit);
router.put('/:id/reset', permission('admin'), csrf(), resetRun);
router.put('/:id/screenChange', permission('admin'), csrf(), updateAllPlayers);
router.put('/:id/advance', csrf(), advanceAll);
router.put('/:id/toast', csrf(), toastAll);
router.put('/:id/trigger/:triggerid', csrf(), runTriggerAll);
router.put('/:id/resetInk', permission('admin'), csrf(), resetInkStories);
router.post('/', permission('admin'), csrf(), create);
router.put('/:id', permission('admin'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
