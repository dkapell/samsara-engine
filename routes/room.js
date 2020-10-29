const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET rooms listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Rooms'
    };
    try {
        res.locals.rooms = await req.models.room.list();
        res.render('room/list', { pageTitle: 'Rooms' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.room = {
        name: null,
        code: null,
        description: null,
        url: null,
        active: true,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/room', name: 'Room'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'roomData')){
        res.locals.room = req.session.roomData;
        delete req.session.roomData;
    }
    res.render('room/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const room = await req.models.room.get(id);
        res.locals.room = room;
        if (_.has(req.session, 'roomData')){
            res.locals.furniture = req.session.roomData;
            delete req.session.roomData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/room', name: 'Rooms'},
            ],
            current: 'Edit: ' + room.name
        };

        res.render('room/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const room = req.body.room;

    req.session.roomData = room;

    try{
        await req.models.room.create(room);
        delete req.session.roomData;
        req.flash('success', 'Created Room ' + room.name);
        res.redirect('/room');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/room/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const room = req.body.room;
    req.session.roomData = room;
    if (!_.has(room, 'active')){
        room.active = false;
    }

    try {
        const current = await req.models.room.get(id);

        await req.models.room.update(id, room);
        delete req.session.roomData;
        req.flash('success', 'Updated Room ' + room.name);
        res.redirect('/room');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/room/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.room.delete(id);
        req.flash('success', 'Removed Room');
        res.redirect('/room');
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
