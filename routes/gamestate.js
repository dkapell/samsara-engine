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
                gamestate.imagemap = await req.models.imagemap.get(gamestate.imagemap_id);
                return gamestate;
            })
        );
        res.render('gamestate/list', { pageTitle: 'Gamestates' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.gamestate = {
        name: null,
        description: null,
        imagemap_id: null,
        allow_codes: true,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/gamestate', name: 'Gamestate'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'gamestateData')){
        res.locals.gamestate = req.session.gamestateData;
        delete req.session.gamestateData;
    }
    try{
        res.locals.imagemaps = await req.models.imagemap.list();
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
        res.locals.imagemaps = await req.models.imagemap.list();
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
    if(Number(gamestate.imagemap_id) === -1){
        gamestate.imagemap_id = null;
    }

    try{
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
    if(Number(gamestate.imagemap_id) === -1){
        gamestate.imagemap_id = null;
    }


    try {
        const current = await req.models.gamestate.get(id);

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
    res.locals.siteSection='gm';
    next();
});

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
