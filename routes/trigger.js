const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const mapParser = require('../lib/mapParser');
const validator = require('validator');
const gameEngine = require('../lib/gameEngine');

/* GET triggers listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Triggers'
    };
    try {
        res.locals.triggers = await req.models.trigger.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.render('trigger/list', { pageTitle: 'Triggers' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const trigger =  await req.models.trigger.get(id);
        if (!trigger || trigger.game_id !== req.game.id){
            throw new Error('Invalid Trigger');
        }

        res.locals.trigger = trigger;
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.locals.functions = await req.models.function.find({game_id: req.game.id});
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/trigger', name: 'Triggers'},
            ],
            current: trigger.name
        };

        res.render('trigger/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.trigger = {
        name: null,
        description: null,
        icon:null,
        actions: [],
        run: false,
        player: false,
        group_id: -1,
        condition:''
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/trigger', name: 'Triggers'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    try{

        if (req.query.clone){
            const old = await req.models.trigger.get(Number(req.query.clone));
            if (old && old.game_id === req.game.id){
                res.locals.trigger = {
                    name: `Copy of ${old.name}`,
                    description: old.description?old.description:null,
                    icon: old.icon?old.icon:null,
                    map: old.actions?old.actions:[],
                    run: old.run,
                    player: old.player,
                    group_id: old.group_id,
                    condition: old.condition
                };
            }
        }

        if (_.has(req.session, 'triggerData')){
            res.locals.trigger = req.session.triggerData;
            delete req.session.triggerData;
        }

        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.variables = await req.models.variable.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.locals.functions = await req.models.function.find({game_id: req.game.id});
        res.render('trigger/new');
    } catch (err){
        next(err);
    }

}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const trigger = await req.models.trigger.get(id);
        if (!trigger || trigger.game_id !== req.game.id){
            throw new Error('Invalid Trigger');
        }
        res.locals.trigger = trigger;
        if (_.has(req.session, 'triggerData')){
            res.locals.trigger = req.session.triggerData;
            delete req.session.triggerData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/trigger', name: 'Triggers'},
            ],
            current: 'Edit: ' + trigger.name
        };
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.variables = await req.models.variable.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.locals.functions = await req.models.function.find({game_id: req.game.id});

        res.render('trigger/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const trigger = req.body.trigger;

    req.session.triggerData = trigger;

    trigger.actions = JSON.stringify(await mapParser.parseActions(trigger.actions, req.game.id));

    if (!_.has(trigger, 'run')){
        trigger.run = false;
    }
    if (!_.has(trigger, 'player')){
        trigger.player = false;
    }
    if (Number(trigger.group_id) === -1){
        trigger.group_id = null;
    }

    trigger.game_id = req.game.id;

    try{
        const id = await req.models.trigger.create(trigger);
        delete req.session.triggerData;
        req.flash('success', 'Created Trigger ' + trigger.name);
        res.redirect(`/trigger/${id}`);
        gameEngine.updateAllTriggers(req.game.id);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/trigger/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const trigger = req.body.trigger;
    req.session.triggerData = trigger;

    trigger.actions = JSON.stringify(await mapParser.parseActions(trigger.actions, req.game.id));

    if (!_.has(trigger, 'run')){
        trigger.run = false;
    }
    if (!_.has(trigger, 'player')){
        trigger.player = false;
    }
    if (Number(trigger.group_id) === -1){
        trigger.group_id = null;
    }

    try {
        const current = await req.models.trigger.get(id);
        if (!current){
            throw new Error('Invalid Document');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }


        await req.models.trigger.update(id, trigger);
        delete req.session.triggerData;
        req.flash('success', 'Updated Trigger ' + trigger.name);
        res.redirect(`/trigger/${id}`);
        gameEngine.updateAllTriggers(req.game.id);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/trigger/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.trigger.get(id);
        if (!current){
            throw new Error('Invalid Document');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not delete record from different game');
        }
        await req.models.trigger.delete(id);
        req.flash('success', 'Removed Trigger');
        res.redirect('/trigger');
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
router.get('/new', csrf(), permission('creator'), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(),  permission('creator'), showEdit);
router.post('/', csrf(), permission('creator'), create);
router.put('/:id', csrf(), permission('creator'), update);
router.delete('/:id', permission('creator'), remove);

module.exports = router;
