const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const async = require('async');
const permission = require('../lib/permission');
const mapParser = require('../lib/mapParser');
const gameEngine = require('../lib/gameEngine');

/* GET screens listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Screens'
    };
    try {
        const screens = await req.models.screen.find({game_id: req.game.id});
        res.locals.screens = await async.map(screens, async screen => {
            if (screen.image_id){
                screen.image = await req.models.image.get(screen.image_id);
                if (screen.image.game_id !== req.game.id){
                    throw new Error('Invalid image for screen');
                }
            }
            return screen;
        });
        res.render('screen/list', { pageTitle: 'Screens' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    try{
        const screen = await req.models.screen.get(req.params.id);
        if (!screen || screen.game_id !== req.game.id){
            throw new Error('Invalid Screen');
        }
        if(screen.image_id){
            screen.image = await req.models.image.get(screen.image_id);
            if (screen.image.game_id !== req.game.id){
                throw new Error('Invalid image for screen');
            }
            if (!_.isArray(screen.image.map)){
                screen.image.map = [];
            }
            //screen.image.image = await req.models.image.get(screen.image_id);
        }
        const screens = (await req.models.screen.find({game_id: req.game.id}));
        screen.transitions = {
            to: await gameEngine.getTransitionsTo(screen),
            from: await gameEngine.getTransitionsFrom(screen)
        };
        res.locals.screen = screen;
        res.locals.screens = screens;
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/screen', name: 'Screens'},
            ],
            current: screen.name
        };
        res.render('screen/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.screen = {
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
        show_name: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/screen', name: 'Screens'},
        ],
        current: 'New'
    };

    try{
        if (req.query.clone){
            const old = await req.models.screen.get(Number(req.query.clone));
            if (old && old.game_id === req.game.id){
                res.locals.screen = {
                    name: 'Copy of ' + old.name,
                    description: old.description?old.description:null,
                    image_id: old.image_id,
                    map: old.map?old.map:[],
                    start: false,
                    special: false,
                    template:false,
                    chat: old.chat,
                    show_count: old.show_count,
                    show_name: old.show_name
                };
            }
            res.locals.clone = true;
        }

        if (_.has(req.session, 'screenData')){
            res.locals.screen = req.session.screenData;
            delete req.session.screenData;
        }
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.codes = await req.models.code.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.variables = await req.models.variable.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.locals.csrfToken = req.csrfToken();
        res.render('screen/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const screen = await req.models.screen.get(id);
        if (!screen || screen.game_id !== req.game.id){
            throw new Error('Invalid Screen');
        }
        screen.codes = _.pluck(screen.codes, 'id').map(id => {return id.toString();});
        res.locals.screen = screen;
        if (_.has(req.session, 'screenData')){
            res.locals.screen = req.session.screenData;
            delete req.session.screenData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/screen', name: 'Screens'},
            ],
            current: 'Edit: ' + screen.name
        };
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.codes = await req.models.code.find({game_id: req.game.id});
        res.locals.variables = await req.models.variable.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.render('screen/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const screen = req.body.screen;
    req.session.screenData = screen;
    if (!_.has(screen, 'special')){
        screen.special = false;
    }
    if (!_.has(screen, 'finish')){
        screen.finish = false;
    }
    if (!_.has(screen, 'template')){
        screen.template = false;
    }
    if (!_.has(screen, 'chat')){
        screen.chat = false;
    }
    if (!_.has(screen, 'show_count')){
        screen.show_count = false;
    }
    if (!_.has(screen, 'show_name')){
        screen.show_name = false;
    }
    if(Number(screen.image_id) === -1){
        screen.image_id = null;
    }
    if (!screen.codes){
        screen.codes = [];
    } else if(!_.isArray(screen.codes)){
        screen.codes = [screen.codes];
    }
    screen.map = await mapParser.parseMap(screen.map, req.game.id);
    screen.game_id = req.game.id;
    try{
        if (screen.start){
            const oldStart = await req.models.screen.getStart();
            if (oldStart){
                oldStart.start = false;
                await req.models.screen.update(oldStart.id, oldStart);
            }
        }
        const id = await req.models.screen.create(screen);
        delete req.session.screenData;
        req.flash('success', 'Created Screen ' + screen.name);
        res.redirect(`/screen/${id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/screen/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const screen = req.body.screen;
    req.session.screenData = screen;
    if (!_.has(screen, 'special')){
        screen.special = false;
    }
    if (!_.has(screen, 'finish')){
        screen.finish = false;
    }
    if (!_.has(screen, 'template')){
        screen.template = false;
    }
    if (!_.has(screen, 'chat')){
        screen.chat = false;
    }
    if (!_.has(screen, 'show_count')){
        screen.show_count = false;
    }
    if (!_.has(screen, 'show_name')){
        screen.show_name = false;
    }

    if(Number(screen.image_id) === -1){
        screen.image_id = null;
    }
    if (!screen.codes){
        screen.codes = [];
    } else if(!_.isArray(screen.codes)){
        screen.codes = [screen.codes];
    }

    screen.map = await mapParser.parseMap(screen.map,  req.game.id);


    try {
        const current = await req.models.screen.get(id);
        if (!current){
            throw new Error('Invalid Screen');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }

        if (screen.start){
            const oldStart = await req.models.screen.getStart();
            if (oldStart && oldStart.id !== screen.id){
                oldStart.start = false;
                await req.models.screen.update(oldStart.id, oldStart);
            }
        }

        await req.models.screen.update(id, screen);
        delete req.session.screenData;
        req.flash('success', 'Updated Screen ' + screen.name);
        res.redirect(`/screen/${id}`);
    } catch(err) {
        console.trace(err);
        req.flash('error', err.toString());
        return (res.redirect(`/screen/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.screen.get(id);
        if (!current){
            throw new Error('Invalid Screen');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }
        await req.models.screen.delete(id);
        req.flash('success', 'Removed Screen');
        res.redirect('/screen');
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
