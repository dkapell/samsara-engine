const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET users listing. */
function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Users'
    };

    req.models.user.list(function(err, users){
        if (err) { return next(err); }
        res.locals.users = users;
        res.render('user/list', { pageTitle: 'Users' });
    });
}

function showNew(req, res, next){
    res.locals.user = {
        name: null,
        email: null,
        is_admin: false,
        is_gm: false
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


    req.models.user.get(id, function(err, user){
        if (err) { return next(err); }
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
    });
}

function create(req, res, next){
    const user = req.body.user;

    req.session.userData = user;

    req.models.user.create(user, function(err, newUserId){
        if (err) {
            req.flash('error', err.toString());
            return res.redirect('/user/new');
        }
        delete req.session.userData;
        req.flash('success', 'Created User ' + user.name);
        res.redirect('/user');
    });
}

function update(req, res, next){
    const id = req.params.id;
    const user = req.body.user;
    req.session.userData = user;
    if (!_.has(user, 'is_admin')){
        user.is_admin = false;
    }
    if (!_.has(user, 'is_gm')){
        user.is_gm = false;
    }

    req.models.user.get(id, function(err, current){
        if (err) { return next(err); }

        req.models.user.update(id, user, function(err){
            if (err){
                req.flash('error', err.toString());
                return (res.redirect('/user/'+id));
            }
            delete req.session.userData;
            req.flash('success', 'Updated User ' + user.name);
            res.redirect('/user');
        });
    });
}

function remove(req, res, next){
    const id = req.params.id;
    req.models.user.delete(id, function(err){
        if (err) { return next(err); }
        req.flash('success', 'Removed User');
        res.redirect('/user');
    });
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
