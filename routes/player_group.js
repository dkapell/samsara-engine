const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET player_groups listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Player Groups'
    };
    try {
        res.locals.player_groups = await req.models.player_group.list();
        res.render('player_group/list', { pageTitle: 'Player Groups' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.player_group = {
        name: null,
        description: null
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/player_group', name: 'Player Group'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'player_groupData')){
        res.locals.player_group = req.session.player_groupData;
        delete req.session.player_groupData;
    }
    res.render('player_group/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const player_group = await req.models.player_group.get(id);
        res.locals.player_group = player_group;
        if (_.has(req.session, 'player_groupData')){
            res.locals.player_group = req.session.player_groupData;
            delete req.session.player_groupData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/player_group', name: 'Player Groups'},
            ],
            current: 'Edit: ' + player_group.name
        };

        res.render('player_group/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const player_group = req.body.player_group;

    req.session.player_groupData = player_group;

    try{
        await req.models.player_group.create(player_group);
        delete req.session.player_groupData;
        req.flash('success', 'Created Player Group ' + player_group.name);
        res.redirect('/player_group');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/player_group/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const player_group = req.body.player_group;
    req.session.player_groupData = player_group;
    if (!_.has(player_group, 'active')){
        player_group.active = false;
    }

    try {
        const current = await req.models.player_group.get(id);

        await req.models.player_group.update(id, player_group);
        delete req.session.player_groupData;
        req.flash('success', 'Updated Player Group ' + player_group.name);
        res.redirect('/player_group');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/player_group/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.player_group.delete(id);
        req.flash('success', 'Removed Player Group');
        res.redirect('/player_group');
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
