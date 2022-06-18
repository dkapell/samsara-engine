const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const async = require('async');
const permission = require('../lib/permission');

/* GET transitions listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Transitions'
    };
    try {
        const transitions = await req.models.transition.find({game_id: req.game.id});
        res.locals.transitions = await async.map( transitions, async transition => {
            transition.from_screen = (await req.models.screen.get(transition.from_screen_id)).name;
            if (transition.from_screen.game_id !== req.game.id){
                throw new Error('Invalid Transition');
            }
            transition.to_screen = (await req.models.screen.get(transition.to_screen_id)).name;
            if (transition.to_screen.game_id !== req.game.id){
                throw new Error('Invalid Transition');
            }
            if(transition.group_id){
                transition.group = await req.models.group.get(transition.game_id, transition.group_id);
            }
            return transition;
        });
        res.render('transition/list', { pageTitle: 'Transitions' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.transition = {
        from_screen_id: null,
        to_screen_id: null,
        group_id: null,
        delay: 0
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/transition', name: 'Transitions'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (req.query.from_screen_id){
        res.locals.transition.from_screen_id = Number(req.query.from_screen_id);
    }
    if (req.query.to_screen_id){
        res.locals.transition.to_screen_id = Number(req.query.to_screen_id);
    }
    if (_.has(req.session, 'transitionData')){
        res.locals.transition = req.session.transitionData;
        delete req.session.transitionData;
    }
    try{
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.render('transition/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const transition = await req.models.transition.get(id);
        if (!transition || transition.game_id !== req.game.id){
            throw new Error('Invalid Transition');
        }
        res.locals.transition = transition;
        if (_.has(req.session, 'transitionData')){
            res.locals.transition = req.session.transitionData;
            delete req.session.transitionData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/transition', name: 'Transitions'},
            ],
            current: 'Edit Transition'
        };
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.render('transition/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const transition = req.body.transition;
    req.session.transitionData = transition;

    if(Number(transition.group_id) === -1){
        transition.group_id = null;
    }
    transition.game_id = req.game.id;
    try{
        await req.models.transition.create(transition);
        delete req.session.transitionData;
        req.flash('success', 'Created Screen ' + transition.name);
        res.redirect('/transition');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/transition/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const transition = req.body.transition;
    req.session.transitionData = transition;

    if(Number(transition.group_id) === -1){
        transition.group_id = null;
    }

    try {
        const current = await req.models.transition.get(id);
        if (!current){
            throw new Error('Invalid Document');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }

        await req.models.transition.update(id, transition);
        delete req.session.transitionData;
        req.flash('success', 'Updated Screen ' + transition.name);
        res.redirect('/transition');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/transition/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.transition.get(id);
        if (!current){
            throw new Error('Invalid Document');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }
        await req.models.transition.delete(id);
        req.flash('success', 'Removed Screen');
        res.redirect('/transition');
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
router.get('/:id', csrf(), showEdit);
router.get('/:id/edit', permission('creator'), csrf(), showEdit);
router.post('/', permission('creator'), csrf(), create);
router.put('/:id', permission('creator'), csrf(), update);
router.delete('/:id', permission('creator'), remove);

module.exports = router;
