const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

const gameData = require('../lib/gameData');

/* GET variables listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Player Groups'
    };
    try {
        res.locals.variables = await req.models.variable.list();
        res.render('variable/list', { pageTitle: 'Variables' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.variable = {
        name: null,
        type: null,
        public: false,
        base_value: null,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/variable', name: 'Variables'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'variableData')){
        res.locals.variable = req.session.variableData;
        delete req.session.variableData;
    }
    res.render('variable/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const variable = await req.models.variable.get(id);
        res.locals.variable = variable;
        if (_.has(req.session, 'variableData')){
            res.locals.variable = req.session.variableData;
            delete req.session.variableData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/variable', name: 'Variables'},
            ],
            current: 'Edit: ' + variable.name
        };

        res.render('variable/edit');
    } catch(err){
        next(err);
    }
}

/// AFTER CREATE UPDATE ALL PLAYERS
async function create(req, res, next){
    const variable = req.body.variable;

    req.session.variableData = variable;
    if (_.has(variable, 'public')){
        variable.public = true;
    } else {
        variable.public = false;
    }

    if (_.has(variable, 'player')){
        variable.player = true;
    } else {
        variable.player = false;
    }
    if (variable.base_value === ''){
        variable.base_value = null;
    }

    try{
        const variableId = await req.models.variable.create(variable);
        delete req.session.variableData;
        await gameData.addNewVariable(variable);
        req.flash('success', 'Created Variable ' + variable.name);
        res.redirect('/variable');
    } catch (err) {
        req.flash('error', err.toString());
        console.trace(err);
        return res.redirect('/variable/new');
    }

}

async function update(req, res, next){
    const id = req.params.id;
    const variable = req.body.variable;
    req.session.variableData = variable;
    if (_.has(variable, 'public')){
        variable.public = true;
    } else {
        variable.public = false;
    }

    if (_.has(variable, 'player')){
        variable.player = true;
    } else {
        variable.player = false;
    }
    if (variable.base_value === ''){
        variable.base_value = null;
    }


    try {
        const current = await req.models.variable.get(id);

        await req.models.variable.update(id, variable);
        delete req.session.variableData;
        await gameData.addNewVariable(variable, current);
        req.flash('success', 'Updated Variable ' + variable.name);
        res.redirect('/variable');
    } catch(err) {
        console.trace(err);
        req.flash('error', err.toString());
        return (res.redirect('/variable/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.variable.delete(id);
        req.flash('success', 'Removed Variable');
        res.redirect('/variable');
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
router.get('/:id', csrf(), permission('creator'), showEdit);
router.post('/', csrf(), permission('creator'), create);
router.put('/:id', csrf(), permission('creator'), update);
router.delete('/:id', permission('creator'), remove);

module.exports = router;
