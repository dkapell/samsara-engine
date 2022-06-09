const express = require('express');
const csrf = require('csurf');
const pluralize = require('pluralize');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET games listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Games'
    };
    try {
        res.locals.games = await req.models.game.find();
        res.render('game/list', { pageTitle: 'Games' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.game = {
        name: null,
        description: null,
        url: null,
        active: true,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/game', name: 'Games'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'gameData')){
        res.locals.game = req.session.gameData;
        delete req.session.gameData;
    }
    res.render('game/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const game = await req.models.game.get(id);
        res.locals.game = game;
        if (_.has(req.session, 'gameData')){
            res.locals.game = req.session.gameData;
            delete req.session.gameData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/game', name: 'Games'},
            ],
            current: 'Edit: ' + game.name
        };

        res.render('game/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const game = req.body.game;

    req.session.gameData = game;
    if (game.code === ''){
        game.code = null;
    }

    try{
        await req.models.game.create(game);
        delete req.session.gameData;
        req.flash('success', `Created Game ${game.name}`);
        res.redirect('/game');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/game/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const game = req.body.game;
    req.session.gameData = game;
    if (!_.has(game, 'active')){
        game.active = false;
    }
    if (game.code === ''){
        game.code = null;
    }

    try {
        const current = await req.models.game.get(id);

        await req.models.game.update(id, game);
        delete req.session.gameData;
        req.flash('success', `Updated Game ${game.name}`);
        res.redirect('/game');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/game/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.game.delete(id);
        req.flash('success', 'Removed Game');
        res.redirect('/game');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
