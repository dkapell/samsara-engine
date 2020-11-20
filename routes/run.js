const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');

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

        const users = await Promise.all(
            players.map( async player => {
                const user = await req.models.user.get(player.user_id);
                user.gamestate = await gameEngine.getGameState(user.id);
                if (!user.gamestate){
                    return user;
                }
                if (user.gamestate.player.group_id){
                    user.gamestate.player.group = await req.models.player_group.get(user.gamestate.player.group_id);
                }
                user.player = user.gamestate.player;
                return user;
            })
        );
        res.locals.users = users.filter(user => { return user.type === 'player';});
        res.locals.gamestates = await req.models.gamestate.listSpecial();
        res.locals.csrfToken = req.csrfToken();
        res.render('run/show');

    } catch(err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.run = {
        name: null,
        current: false,
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

        await req.models.run.create(run);

        delete req.session.runData;
        req.flash('success', 'Created Run ' + run.name);
        res.redirect('/run');
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

        await req.models.run.update(id, run);
        delete req.session.runData;
        req.flash('success', 'Updated run ' + run.name);
        res.redirect('/run');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/run/'+id));

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
                return gameEngine.changeState(player.user_id, initialState.id, 0);
            })
        );
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
        if (!state) { throw new Error('State not found'); }
        await Promise.all(
            players.map( async player => {
                return gameEngine.changeState(player.user_id, state.id, 0);
            })
        );
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
router.post('/', permission('admin'), csrf(), create);
router.put('/:id', permission('admin'), csrf(), update);
router.delete('/:id', permission('admin'), remove);

module.exports = router;
