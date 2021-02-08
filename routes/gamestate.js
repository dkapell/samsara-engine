const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const mapParser = require('../lib/mapParser');
const gameEngine = require('../lib/gameEngine');

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
                if (gamestate.image_id){
                    gamestate.image = await req.models.image.get(gamestate.image_id);
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
        if(gamestate.image_id){
            gamestate.image = await req.models.image.get(gamestate.image_id);
            if (!_.isArray(gamestate.image.map)){
                gamestate.image.map = [];
            }
            gamestate.image.image = await req.models.image.get(gamestate.image.image_id);
        }
        const gamestates = (await req.models.gamestate.list());
        gamestate.transitions = {
            to: await gameEngine.getTransitionsTo(gamestate.id),
            from: await gameEngine.getTransitionsFrom(gamestate)
        };
        res.locals.gamestate = gamestate;
        res.locals.gamestates = gamestates;
        res.locals.images = await req.models.image.list();
        res.locals.documents = await req.models.document.list();
        res.locals.groups = await req.models.group.list();
        res.locals.links = await req.models.link.list();
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/gamestate', name: 'Gamestates'},
            ],
            current: gamestate.name
        };
        res.render('gamestate/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.gamestate = {
        name: null,
        description: null,
        image_id: null,
        map: [],
        start: false,
        finish: false,
        special: false,
        template:false,
        chat: false,
        show_count: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/gamestate', name: 'Gamestates'},
        ],
        current: 'New'
    };

    try{
        if (req.query.clone){
            const old = await req.models.gamestate.get(Number(req.query.clone));
            if (old){
                res.locals.gamestate = {
                    name: 'Copy of ' + old.name,
                    description: old.description?old.description:null,
                    image_id: old.image_id,
                    map: old.map?old.map:[],
                    start: false,
                    special: false,
                    template:false,
                    chat: old.chat,
                    show_count: old.show_count
                };
            }
            res.locals.clone = true;
        }

        if (_.has(req.session, 'gamestateData')){
            res.locals.gamestate = req.session.gamestateData;
            delete req.session.gamestateData;
        }
        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.images = await req.models.image.list();
        res.locals.codes = await req.models.code.list();
        res.locals.documents = await req.models.document.list();
        res.locals.links = await req.models.link.list();
        res.locals.groups = await req.models.group.list();
        res.locals.variables = await req.models.variable.list();
        res.locals.csrfToken = req.csrfToken();
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
        gamestate.codes = _.pluck(gamestate.codes, 'id').map(id => {return id.toString();});
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
        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.groups = await req.models.group.list();
        res.locals.images = await req.models.image.list();
        res.locals.links = await req.models.link.list();
        res.locals.codes = await req.models.code.list();
        res.locals.variables = await req.models.variable.list();
        res.locals.documents = await req.models.document.list();
        res.render('gamestate/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const gamestate = req.body.gamestate;
    req.session.gamestateData = gamestate;
    if (!_.has(gamestate, 'special')){
        gamestate.special = false;
    }
    if (!_.has(gamestate, 'finish')){
        gamestate.finish = false;
    }
    if (!_.has(gamestate, 'template')){
        gamestate.template = false;
    }
    if (!_.has(gamestate, 'chat')){
        gamestate.chat = false;
    }
    if (!_.has(gamestate, 'show_count')){
        gamestate.show_count = false;
    }
    if(Number(gamestate.image_id) === -1){
        gamestate.image_id = null;
    }
    if (!gamestate.codes){
        gamestate.codes = [];
    } else if(!_.isArray(gamestate.codes)){
        gamestate.codes = [gamestate.codes];
    }
    gamestate.map = await mapParser.parseMap(gamestate.map);

    try{
        if (gamestate.start){
            const current = await req.models.gamestate.getStart();
            if (current){
                current.start = false;
                await req.models.gamestate.update(current.id, current);
            }
        }
        const id = await req.models.gamestate.create(gamestate);
        delete req.session.gamestateData;
        req.flash('success', 'Created Gamestate ' + gamestate.name);
        res.redirect(`/gamestate/${id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/gamestate/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const gamestate = req.body.gamestate;
    req.session.gamestateData = gamestate;
    if (!_.has(gamestate, 'special')){
        gamestate.special = false;
    }
    if (!_.has(gamestate, 'finish')){
        gamestate.finish = false;
    }
    if (!_.has(gamestate, 'template')){
        gamestate.template = false;
    }
    if (!_.has(gamestate, 'chat')){
        gamestate.chat = false;
    }
    if (!_.has(gamestate, 'show_count')){
        gamestate.show_count = false;
    }
    if(Number(gamestate.image_id) === -1){
        gamestate.image_id = null;
    }
    if (!gamestate.codes){
        gamestate.codes = [];
    } else if(!_.isArray(gamestate.codes)){
        gamestate.codes = [gamestate.codes];
    }

    gamestate.map = await mapParser.parseMap(gamestate.map);


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
        res.redirect(`/gamestate/${id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/gamestate/${id}/edit`));

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
