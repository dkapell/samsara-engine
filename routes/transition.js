const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
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
        const transitions = await req.models.transition.list();
        res.locals.transitions = await Promise.all(
            transitions.map( async transition => {
                transition.from_state = await req.models.gamestate.get(transition.from_state_id);
                transition.to_state = await req.models.gamestate.get(transition.to_state_id);
                if(transition.room_id){
                    transition.room = await req.models.room.get(transition.room_id);
                }
                if(transition.group_id){
                    transition.player_group = await req.models.player_group.get(transition.group_id);
                }
                return transition;
            })
        );
        res.render('transition/list', { pageTitle: 'Transitions' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.transition = {
        from_state_id: null,
        to_state_id: null,
        group_id: null,
        room_id: null,
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
    if (req.query.from_state_id){
        res.locals.transition.from_state_id = Number(req.query.from_state_id);
    }
    if (_.has(req.session, 'transitionData')){
        res.locals.transition = req.session.transitionData;
        delete req.session.transitionData;
    }
    try{
        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.rooms = await req.models.room.list();
        res.locals.player_groups = await req.models.player_group.list();
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
        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.rooms = await req.models.room.list();
        res.locals.player_groups = await req.models.player_group.list();
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
    if(Number(transition.room_id) === -1){
        transition.room_id = null;
    }

    try{
        await req.models.transition.create(transition);
        delete req.session.transitionData;
        req.flash('success', 'Created Gamestate ' + transition.name);
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
    if(Number(transition.room_id) === -1){
        transition.room_id = null;
    }

    try {
        const current = await req.models.transition.get(id);

        await req.models.transition.update(id, transition);
        delete req.session.transitionData;
        req.flash('success', 'Updated Gamestate ' + transition.name);
        res.redirect('/transition');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/transition/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.transition.delete(id);
        req.flash('success', 'Removed Gamestate');
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
