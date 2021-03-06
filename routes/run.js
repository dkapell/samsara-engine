const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const moment = require('moment');
const async = require('async');
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
        res.locals.runs = await req.models.run.list();
        res.render('run/list', { pageTitle: 'Runs' });
    } catch (err){
        next(err);
    }
}

async function showCurrent(req, res, next){
    try{
        const run = await req.models.run.getCurrent();
        res.redirect('/run/' + run.id);
    } catch(err){
        next(err);
    }
}



async function show(req, res, next){
    try{
        res.locals.run = await req.models.run.get(req.params.id);
        const players = await req.models.player.listByRunId(req.params.id);
        let last = (new Date()).getTime();

        const users = await async.map(players, async function(player){
            const user = await req.models.user.get(player.user_id);

            user.gamestate = await gameEngine.getGameState(user.id);

            if (!user.gamestate){
                return user;
            }
            for (const type of ['next', 'prev', 'current']){
                if (_.has(user.gamestate, type)){
                    delete user.gamestate[type].map;
                    delete user.gamestate[type].transitions;
                    delete user.gamestate[type].codes;
                    delete user.gamestate[type].image;
                }
            }
            user.gamestate.transitionTimeDelta = moment(player.statetime).fromNow();
            user.gamestate.transitionTime = moment(player.statetime).isSame(moment(), 'date')?moment(player.statetime).format('LT'):moment(player.statetime).format('lll');

            user.player = user.gamestate.player;

            //user.connected = _.indexOf(req.app.locals.gameServer.allClients, player.user_id) !== -1;
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
        res.locals.groups = await req.models.group.list();
        res.locals.users = users
            .filter(user => { return user.type === 'player';})
            .sort((a, b) => {
                a.name.localeCompare(b.name);
            });
        res.locals.gamestates = await req.models.gamestate.listSpecial();
        res.locals.triggers = await req.models.trigger.list();
        res.locals.csrfToken = req.csrfToken();
        res.render('run/show');

    } catch(err){
        next(err);
    }
}

async function filter(arr, callback) {
    const fail = Symbol();
    return (await Promise.all(arr.map(async item => (await callback(item)) ? item : fail))).filter(i=>i!==fail);
}

function showNew(req, res, next){
    res.locals.run = {
        name: null,
        current: false,
        data: gameData.getStartData('run'),
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

    try{
        if (run.current){
            const current = await req.models.run.getCurrent();
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
        if (run.current){
            const current = await req.models.run.getCurrent();
            if (current.id !== id){
                current.current = false;
                await req.models.run.update(current.id, current);
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
        if (!run){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.listByRunId(req.params.id);
        const initialState = await req.models.gamestate.getStart();
        await Promise.all(
            players.map( async player => {
                await gameEngine.changeState(player.user_id, initialState.id, 0);
                return req.app.locals.gameServer.sendGameState(player.user_id);
            })
        );
        await req.app.locals.gameServer.sendLocationUpdate(run.id, null, initialState.id);
        await gameEngine.updateAllTriggers();
        res.json({success:true});

    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function updateAllPlayers(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.listByRunId(req.params.id);
        const state = await req.models.gamestate.get(req.body.state_id);
        let group = false;
        if (!state) { throw new Error('State not found'); }
        await Promise.all(
            players.map( async player => {
                if (req.body.group_id === '0' || _.findWhere(player.groups, {id: Number(req.body.group_id)})){
                    await gameEngine.changeState(player.user_id, state.id, 0, true);
                    return req.app.locals.gameServer.sendGameState(player.user_id);
                }
            })
        );
        await req.app.locals.gameServer.sendLocationUpdate(run.id, null, state.id);
        await gameEngine.updateAllTriggers();
        res.json({success:true});

    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function advanceAll(req, res, next){
    try{
        const run = await req.models.run.get(req.params.id);
        if (!run){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.listByRunId(req.params.id);
        await Promise.all(
            players.map( async player => {
                const changed = await gameEngine.nextState(player.user_id);
                if (changed){
                    await req.app.locals.gameServer.sendGameState(player.user_id);
                }
                return;
            })
        );
        await gameEngine.updateAllTriggers();
        await req.app.locals.gameServer.sendLocationUpdate(run.id, null, null);
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function toastAll(req, res, next){

    try{
        const run = await req.models.run.get(req.params.id);
        if (!run){
            throw new Error ('Run not found');
        }
        const players = await req.models.player.listByRunId(req.params.id);
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
        if (!run){
            throw new Error ('Run not found');
        }
        const trigger = await req.models.trigger.get(req.params.triggerid);
        if (!trigger){
            throw new Error ('Trigger not found');
        }
        if (!trigger.run){
            throw new Error('Trigger not enabled for all players in a run');
        }
        const players = await req.models.player.listByRunId(req.params.id);
        await Promise.all(
            players.map(async player => {
                const user = await req.models.user.get(player.user_id);
                return req.app.locals.gameServer.runTrigger(trigger, user);
            }));
        await req.app.locals.gameServer.sendPlayerUpdate();
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
router.put('/:id/stateChange', permission('admin'), csrf(), updateAllPlayers);
router.put('/:id/advance', csrf(), advanceAll);
router.put('/:id/toast', csrf(), toastAll);
router.put('/:id/trigger/:triggerid', csrf(), runTriggerAll);
router.post('/', permission('admin'), csrf(), create);
router.put('/:id', permission('admin'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
