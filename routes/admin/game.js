const express = require('express');
const csrf = require('csurf');
const async = require('async');
const pluralize = require('pluralize');
const config = require('config');
const _ = require('underscore');
const permission = require('../../lib/permission');
const gameCloner = require('../../lib/gameCloner');

/* GET games listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Games'
    };
    try {
        const games = await req.models.game.find();
        res.locals.games = await async.map(games, async (game) => {
            game.user = await req.models.user.get(null, game.created_by);
            return game;
        });
        res.render('admin/game/list', { pageTitle: 'Games' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.game = {
        name: null,
        description: null,
        site: null,
        theme: null,
        css: null,
        intercode_login: false,
        default_to_player: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/admin/game', name: 'Games'},
        ],
        current: 'New'
    };
    res.locals.themes = _.keys(config.get('themes'));
    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'gameData')){
        res.locals.game = req.session.gameData;
        delete req.session.gameData;
    }
    res.render('admin/game/new');
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
                { url: '/admin/game', name: 'Games'},
            ],
            current: 'Edit: ' + game.name
        };
        res.locals.themes = _.keys(config.get('themes'));
        res.render('admin/game/edit');
    } catch(err){
        next(err);
    }
}

async function showClone(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const game = await req.models.game.get(id);
        res.locals.source = game;

        res.locals.game = {
            oldGameId: id,
            name: game.name,
            description: game.description,
            site: game.site,
            theme: game.theme,
            css: game.css,
            intercode_login: game.intercode_login,
            default_to_player: game.default_to_player,
        };

        res.locals.clone = {
            fakeUsers: false,
            tables:{
                run: false,
                player: false,
                message: false,
                chat_report: false,
            }
        };
        res.locals.tables = _.indexBy(gameCloner.tables, 'name')

        if (_.has(req.session, 'gameData')){
            res.locals.game = req.session.gameData.game;
            if (_.has(req.session.gameData.clone, 'tables')){
                for (const table in req.session.gameData.clone.tables ){
                    res.locals.clone.tables[table] = req.session.gameData.clone.tables[table];
                }
            }
            if (req.session.gameData.clone && req.session.gameData.clone.fakeUsers){
                res.locals.clone.fakeUsers = req.session.gameData.clone.fakeUsers;
            }
            delete req.session.gameData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/admin/game', name: 'Games'},
            ],
            current: 'Clone: ' + game.name
        };
        res.locals.themes = _.keys(config.get('themes'));
        res.render('admin/game/clone');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const game = req.body.game;

    req.session.gameData = game;

    if (!_.has(game, 'intercode_login')){
        game.intercode_login = false;
    }
    if (!_.has(game, 'default_to_player')){
        game.default_to_player = false;
    }

    try{
        await req.models.game.create(game);
        delete req.session.gameData;
        req.flash('success', `Created Game ${game.name}`);
        res.redirect('/admin/game');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/admin/game/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const game = req.body.game;
    req.session.gameData = game;

    if (!_.has(game, 'intercode_login')){
        game.intercode_login = false;
    }
    if (!_.has(game, 'default_to_player')){
        game.default_to_player = false;
    }

    try {
        const current = await req.models.game.get(id);

        await req.models.game.update(id, game);
        delete req.session.gameData;
        req.flash('success', `Updated Game ${game.name}`);
        if (req.game.id){
            res.redirect('/');
        } else {
            res.redirect('/admin/game');
        }
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/admin/game/'+id));

    }
}

async function clone(req, res, next){
    const game = req.body.game;
    const id = req.params.id;
    const cloneOptions = req.body.clone;

    req.session.gameData = {
        game: game,
        clone: cloneOptions
    };

    if (!_.has(game, 'intercode_login')){
        game.intercode_login = false;
    }
    if (!_.has(game, 'default_to_player')){
        game.default_to_player = false;
    }

    try{

        const cloneConfig = {
            game: game,
            tables: {}
        };
        if (cloneOptions){
            if ( cloneOptions.fakeUsers){
                cloneConfig.fakeUsers = true;
            }
            for (const table in cloneOptions.tables){
                if (cloneOptions.tables[table]){
                    cloneConfig.tables[table] = true;
                }
            }
        }

        await gameCloner.clone(id, cloneConfig);
        delete req.session.gameData;
        req.flash('success', `Cloned Game ${game.name}`);
        res.redirect('/admin/game');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect(`/admin/game/${id}/clone`);
    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.game.delete(id);
        req.flash('success', 'Removed Game');
        if (req.game.id){
            res.redirect('/');
        } else {
            res.redirect('/admin/game');
        }
    } catch(err) {
        return next(err);
    }
}

async function checkPermission(req, res, next){
    const id = req.params.id;
    const user = req.session.assumed_user ? req.session.assumed_user: req.user;
    if (!req.session.assumed_user && user.site_admin){
        return next();
    }
    const siteUser = await req.models.user.get(id, user.id);
    if (siteUser.type === 'admin'){
        return next();
    }
    req.flash('error', 'You are not allowed to access that resource');
    res.redirect('/');
}

const router = express.Router();

router.use(permission('admin'));
router.use(function(req, res, next){
    res.locals.siteSection='admin';
    next();
});

router.get('/', list);
router.get('/new', csrf(), permission('site_admin'), showNew);
router.get('/:id', csrf(), checkPermission, showEdit);
router.get('/:id/clone', csrf(), checkPermission, showClone);
router.post('/', csrf(), permission('site_admin'), create);
router.post('/:id/clone', csrf(), permission('site_admin'), clone);
router.put('/:id', csrf(), checkPermission, update);
router.delete('/:id', checkPermission, remove);

module.exports = router;
