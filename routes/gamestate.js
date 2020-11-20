const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET gamestates listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Gamestates'
    };
    try {
        const gamestates = await req.models.gamestate.list();
        res.locals.gamestates = await Promise.all(
            gamestates.map( async gamestate => {
                if (gamestate.imagemap_id){
                    gamestate.imagemap = await req.models.imagemap.get(gamestate.imagemap_id);
                }
                return gamestate;
            })
        );
        res.render('gamestate/list', { pageTitle: 'Gamestates' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    try{
        const gamestate = await req.models.gamestate.get(req.params.id);
        if(gamestate.imagemap_id){
            gamestate.imagemap = await req.models.imagemap.get(gamestate.imagemap_id);
            if (!_.isArray(gamestate.imagemap.map)){
                gamestate.imagemap.map = [];
            }
            gamestate.imagemap.image = await req.models.image.get(gamestate.imagemap.image_id);
        }
        gamestate.transitions = {
            to: await req.models.transition.find({to_state_id:req.params.id}),
            from: await req.models.transition.find({from_state_id:req.params.id})
        };
        res.locals.gamestate = gamestate;
        res.locals.gamestates = await req.models.gamestate.list();
        res.locals.player_groups = await req.models.player_group.list();
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/gamestate', name: 'Gamestates'},
            ],
            current: gamestate.name
        };
        res.locals.rooms = _.indexBy(await req.models.room.list(), 'id');
        res.render('gamestate/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.gamestate = {
        name: null,
        description: null,
        imagemap_id: null,
        allow_codes: true,
        start: false,
        special: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/gamestate', name: 'Gamestates'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'gamestateData')){
        res.locals.gamestate = req.session.gamestateData;
        delete req.session.gamestateData;
    }
    try{
        res.locals.imagemaps = (await req.models.imagemap.list()).filter(imagemap => {return !imagemap.template;});
        res.locals.rooms = await req.models.room.list();
        res.render('gamestate/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const gamestate = await req.models.gamestate.get(id);
        gamestate.rooms = _.pluck(gamestate.rooms, 'id').map(id => {return id.toString();});
        res.locals.gamestate = gamestate;
        if (_.has(req.session, 'gamestateData')){
            res.locals.gamestate = req.session.gamestateData;
            delete req.session.gamestateData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/gamestate', name: 'Gamestates'},
            ],
            current: 'Edit: ' + gamestate.name
        };
        res.locals.imagemaps = (await req.models.imagemap.list()).filter(imagemap => {return !imagemap.template;});
        res.locals.rooms = await req.models.room.list();
        res.render('gamestate/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const gamestate = req.body.gamestate;
    req.session.gamestateData = gamestate;
    if (!_.has(gamestate, 'allow_codes')){
        gamestate.allow_codes = false;
    }
    if (!_.has(gamestate, 'special')){
        gamestate.special = false;
    }
    if(Number(gamestate.imagemap_id) === -1){
        gamestate.imagemap_id = null;
    }
    if (!gamestate.rooms){
        gamestate.rooms = [];
    } else if(!_.isArray(gamestate.rooms)){
        gamestate.rooms = [gamestate.rooms];
    }

    try{
        if (gamestate.start){
            const current = await req.models.gamestate.getStart();
            if (current){
                current.start = false;
                await req.models.gamestate.update(current.id, current);
            }
        }
        await req.models.gamestate.create(gamestate);
        delete req.session.gamestateData;
        req.flash('success', 'Created Gamestate ' + gamestate.name);
        res.redirect('/gamestate');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/gamestate/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const gamestate = req.body.gamestate;
    req.session.gamestateData = gamestate;
    if (!_.has(gamestate, 'allow_codes')){
        gamestate.allow_codes = false;
    }
    if (!_.has(gamestate, 'special')){
        gamestate.special = false;
    }
    if(Number(gamestate.imagemap_id) === -1){
        gamestate.imagemap_id = null;
    }
    if (!gamestate.rooms){
        gamestate.rooms = [];
    } else if(!_.isArray(gamestate.rooms)){
        gamestate.rooms = [gamestate.rooms];
    }

    try {
        if (gamestate.start){
            const current = await req.models.gamestate.getStart();
            if (current){
                current.start = false;
                await req.models.gamestate.update(current.id, current);
            }
        }
        await req.models.gamestate.update(id, gamestate);
        delete req.session.gamestateData;
        req.flash('success', 'Updated Gamestate ' + gamestate.name);
        res.redirect('/gamestate');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/gamestate/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.gamestate.delete(id);
        req.flash('success', 'Removed Gamestate');
        res.redirect('/gamestate');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='config';
    next();
});

router.get('/', list);
router.get('/new', permission('creator'), csrf(), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', permission('creator'), csrf(), showEdit);
router.post('/', permission('creator'), csrf(), create);
router.put('/:id', permission('creator'), csrf(), update);
router.delete('/:id', permission('creator'), remove);

module.exports = router;
