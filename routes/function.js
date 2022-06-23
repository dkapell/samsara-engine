const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');
const liquid = require('../lib/liquid');

/* GET functions listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Functions'
    };
    try {
        res.locals.functions = await req.models.function.find({game_id: req.game.id});
        res.render('function/list', { pageTitle: 'Functions' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const func = await req.models.function.get(id);
        if (!func || func.game_id !== req.game.id){
            throw new Error('Invalid Function');
        }

        res.locals.func = func;

        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/function', name: 'Functions'},
            ],
            current: func.name
        };
        res.render('function/show');
    } catch(err){
        next(err);
    }
}


async function showNew(req, res, next){
    res.locals.func = {
        name: null,
        usage: null,
        description: null,
        type: null,
        content: null
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/function', name: 'Functions'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'functionData')){
        res.locals.func = req.session.functionData;
        delete req.session.functionData;
    }
    try{
        res.locals.variables = await req.models.variable.find({game_id: req.game.id});
        res.render('function/new');
    } catch(err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const func = await req.models.function.get(id);
        if (!func || func.game_id !== req.game.id){
            throw new Error('Invalid Function');
        }
        res.locals.func = func;
        if (_.has(req.session, 'functionData')){
            res.locals.func = req.session.functionData;
            delete req.session.functionData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/function', name: 'Functions'},
            ],
            current: 'Edit: ' + func.name
        };
        res.locals.variables = await req.models.variable.find({game_id: req.game.id});

        res.render('function/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const func = req.body.function;

    req.session.functionData = func;
    func.game_id = req.game.id;

    try{
        const id = await req.models.function.create(func);
        delete req.session.functionData;
        req.flash('success', 'Created Function ' + func.name);
        res.redirect(`/function/${id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/function/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const func = req.body.function;
    req.session.functionData = func;

    try {
        const current = await req.models.function.get(id);
        if (!current){
            throw new Error('Invalid Function');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }

        await req.models.function.update(id, func);
        delete req.session.functionData;
        req.flash('success', 'Updated Function ' + func.name);
        res.redirect(`/function/${id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/function/${id}/edit`));
    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.function.get(id);
        if (!current){
            throw new Error('Invalid Function');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not delete record from different game');
        }
        await req.models.function.delete(id);
        req.flash('success', 'Removed Function');
        res.redirect('/function');
    } catch(err) {
        return next(err);
    }
}

const router = express.Router();
router.use(permission('creator'));
router.use(function(req, res, next){
    res.locals.siteSection='config';
    next();
});

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), show);
router.get('/:id/edit', csrf(),  showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
