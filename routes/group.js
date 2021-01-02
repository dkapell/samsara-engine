const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET groups listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Player Groups'
    };
    try {
        res.locals.groups = await req.models.group.list();
        res.render('group/list', { pageTitle: 'Player Groups' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.group = {
        name: null,
        description: null,
        chat: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/group', name: 'Player Groups'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'groupData')){
        res.locals.group = req.session.groupData;
        delete req.session.groupData;
    }
    res.render('group/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const group = await req.models.group.get(id);
        res.locals.group = group;
        if (_.has(req.session, 'groupData')){
            res.locals.group = req.session.groupData;
            delete req.session.groupData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/group', name: 'Player Groups'},
            ],
            current: 'Edit: ' + group.name
        };

        res.render('group/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const group = req.body.group;

    req.session.groupData = group;

    if (!_.has(group, 'chat')){
        group.chat = false;
    }

    try{
        await req.models.group.create(group);
        delete req.session.groupData;
        req.flash('success', 'Created Player Group ' + group.name);
        res.redirect('/group');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/group/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const group = req.body.group;
    req.session.groupData = group;
    if (!_.has(group, 'chat')){
        group.chat = false;
    }


    try {
        const current = await req.models.group.get(id);

        await req.models.group.update(id, group);
        delete req.session.groupData;
        req.flash('success', 'Updated Player Group ' + group.name);
        res.redirect('/group');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/group/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.group.delete(id);
        req.flash('success', 'Removed Player Group');
        res.redirect('/group');
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
