const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const mapParser = require('../lib/mapParser');
const validator = require('validator');

/* GET triggers listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Triggers'
    };
    try {
        res.locals.triggers = await req.models.trigger.list();
        res.render('trigger/list', { pageTitle: 'Triggers' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const trigger =  await req.models.trigger.get(id);
        res.locals.trigger = trigger;
        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.images = await req.models.image.list();
        res.locals.documents = await req.models.document.list();
        res.locals.links = await req.models.link.list();

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
            if (old){
                res.locals.trigger = {
                    name: `Copy of ${old.name}`,
                    description: old.description?old.description:null,
                    icon: old.icon?old.icon:null,
                    map: old.actions?old.actions:[],
                    run: old.run,
                    player: old.player
                };
            }
        }

        if (_.has(req.session, 'triggerData')){
            res.locals.trigger = req.session.triggerData;
            delete req.session.triggerData;
        }

        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.images = await req.models.image.list();
        res.locals.documents = await req.models.document.list();
        res.locals.links = await req.models.link.list();
        res.locals.groups = await req.models.group.list();
        res.locals.variables = await req.models.variable.list();
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
            current: 'Edit: ' + trigger.trigger
        };
        res.locals.gamestates = (await req.models.gamestate.list()).filter(state => {return !state.template;});
        res.locals.images = await req.models.image.list();
        res.locals.documents = await req.models.document.list();
        res.locals.links = await req.models.link.list();
        res.locals.groups = await req.models.group.list();
        res.locals.variables = await req.models.variable.list();

        res.render('trigger/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const trigger = req.body.trigger;

    req.session.triggerData = trigger;

    trigger.actions = JSON.stringify(await mapParser.parseActions(trigger.actions));

    if (!_.has(trigger, 'run')){
        trigger.run = false;
    }
    if (!_.has(trigger, 'player')){
        trigger.player = false;
    }

    try{
        const id = await req.models.trigger.create(trigger);
        delete req.session.triggerData;
        req.flash('success', 'Created Trigger ' + trigger.trigger);
        res.redirect(`/trigger/${id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/trigger/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const trigger = req.body.trigger;
    req.session.triggerData = trigger;

    trigger.actions = JSON.stringify(await mapParser.parseActions(trigger.actions));

    if (!_.has(trigger, 'run')){
        trigger.run = false;
    }
    if (!_.has(trigger, 'player')){
        trigger.player = false;
    }

    try {
        const current = await req.models.trigger.get(id);

        await req.models.trigger.update(id, trigger);
        delete req.session.triggerData;
        req.flash('success', 'Updated Trigger ' + trigger.trigger);
        res.redirect(`/trigger/${id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/trigger/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
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
