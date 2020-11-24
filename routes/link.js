const express = require('express');
const csrf = require('csurf');
const pluralize = require('pluralize');
const config = require('config');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET links listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: pluralize(config.get('game.linkName'))
    };
    try {
        res.locals.links = await req.models.link.list();
        res.render('link/list', { pageTitle: pluralize(config.get('game.linkName')) });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.link = {
        name: null,
        code: null,
        description: null,
        url: null,
        active: true,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/link', name: pluralize(config.get('game.linkName'))},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'linkData')){
        res.locals.link = req.session.linkData;
        delete req.session.linkData;
    }
    res.render('link/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const link = await req.models.link.get(id);
        res.locals.link = link;
        if (_.has(req.session, 'linkData')){
            res.locals.link = req.session.linkData;
            delete req.session.linkData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/link', name: pluralize(config.get('game.linkName'))},
            ],
            current: 'Edit: ' + link.name
        };

        res.render('link/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const link = req.body.link;

    req.session.linkData = link;
    if (link.code === ''){
        link.code = null;
    }

    try{
        await req.models.link.create(link);
        delete req.session.linkData;
        req.flash('success', `Created ${config.get('game.linkName')} ${link.name}`);
        res.redirect('/link');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/link/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const link = req.body.link;
    req.session.linkData = link;
    if (!_.has(link, 'active')){
        link.active = false;
    }
    if (link.code === ''){
        link.code = null;
    }

    try {
        const current = await req.models.link.get(id);

        await req.models.link.update(id, link);
        delete req.session.linkData;
        req.flash('success', `Updated ${config.get('game.linkName')} ${link.name}`);
        res.redirect('/link');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/link/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.link.delete(id);
        req.flash('success', `Removed ${config.get('game.linkName')}`);
        res.redirect('/link');
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
