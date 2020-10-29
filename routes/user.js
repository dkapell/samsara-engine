const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Users'
    };
    try {
        res.locals.users = await req.models.user.list();
        res.render('user/list', { pageTitle: 'Users' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.user = {
        name: null,
        email: null,
        is_admin: false,
        is_gm: false,
        is_player: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/user', name: 'User'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'userData')){
        res.locals.user = req.session.userData;
        delete req.session.userData;
    }
    res.render('user/new');
}

function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const user = await req.models.user.get(id);
        res.locals.user = user;
        if (_.has(req.session, 'userData')){
            res.locals.furniture = req.session.userData;
            delete req.session.userData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user', name: 'Users'},
            ],
            current: 'Edit: ' + user.name
        };

        res.render('user/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const user = req.body.user;

    req.session.userData = user;

    try{
        await req.models.user.create(user);
        delete req.session.userData;
        req.flash('success', 'Created User ' + user.name);
        res.redirect('/user');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/user/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const user = req.body.user;
    req.session.userData = user;
    if (!_.has(user, 'is_admin')){
        user.is_admin = false;
    }
    if (!_.has(user, 'is_gm')){
        user.is_gm = false;
    }
    if (!_.has(user, 'is_player')){
        user.is_player = false;
    }

    try {
        const current = await req.models.user.get(id);

        await req.models.user.update(id, user);
        delete req.session.userData;
        req.flash('success', 'Updated User ' + user.name);
        res.redirect('/user');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/user/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.user.delete(id);
        req.flash('success', 'Removed User');
        res.redirect('/user');
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
