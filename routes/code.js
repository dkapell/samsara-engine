const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const mapParser = require('../lib/mapParser');
const validator = require('validator');

/* GET codes listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Codes'
    };
    try {
        res.locals.codes = await req.models.code.find({game_id: req.game.id});
        res.render('code/list', { pageTitle: 'Codes' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        const code = await req.models.code.get(id);
        if (!code || code.game_id !== req.game.id){
            throw new Error('Invalid Code');
        }
        res.locals.code = code;
        res.locals.screens = (await req.models.screen.find({game_id: req.game.id})).filter(screen => {return !screen.template;});
        res.locals.images = await req.models.image.find({game_id: req.game.id});
        res.locals.documents = await req.models.document.find({game_id: req.game.id});
        res.locals.links = await req.models.link.find({game_id: req.game.id});
        res.locals.meetings = await req.models.meeting.find({game_id: req.game.id});
        res.locals.inks = await req.models.ink.find({game_id: req.game.id});
        res.locals.functions = await req.models.function.find({game_id: req.game.id});
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/code', name: 'Codes'},
            ],
            current: code.code
        };
        res.render('code/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.code = {
        code: null,
        description: null,
        actions: []
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/code', name: 'Codes'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    try{

        if (req.query.clone){
            const old = await req.models.code.get(Number(req.query.clone));

            if (old && old.game_id === req.game.id){
                res.locals.code = {
                    code: null,
                    description: old.description?old.description:null,
                    map: old.actions?old.actions:[]
                };
            }
        }

        if (_.has(req.session, 'codeData')){
            res.locals.code = req.session.codeData;
            delete req.session.codeData;
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
        res.render('code/new');
    } catch (err){
        next(err);
    }

}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const code = await req.models.code.get(id);
        if (!code || code.game_id !== req.game.id){
            throw new Error('Invalid Code');
        }

        res.locals.code = code;
        if (_.has(req.session, 'codeData')){
            res.locals.code = req.session.codeData;
            delete req.session.codeData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/code', name: 'Codes'},
            ],
            current: 'Edit: ' + code.code
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

        res.render('code/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const code = req.body.code;

    req.session.codeData = code;

    code.actions = JSON.stringify(await mapParser.parseActions(code.actions, req.game.id));

    try{
        code.game_id = req.game.id;
        const id = await req.models.code.create(code);
        delete req.session.codeData;
        req.flash('success', 'Created Code ' + code.code);
        res.redirect(`/code/${id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/code/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const code = req.body.code;
    req.session.codeData = code;

    code.actions = JSON.stringify(await mapParser.parseActions(code.actions, req.game.id));

    try {
        const current = await req.models.code.get(id);
        if (!current){
            throw new Error('Invalid Code');
        }
        if (current.game_id !== req.game.id){
            throw new Error('Can not edit record from different game');
        }

        await req.models.code.update(id, code);
        delete req.session.codeData;
        req.flash('success', 'Updated Code ' + code.code);
        res.redirect(`/code/${id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/code/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        const current = await req.models.code.get(id);
        if (!current){
            throw new Error('Invalid Code');
        }

        if (current.game_id !== req.game.id){
            throw new Error('Can not delete record from different game');
        }
        await req.models.code.delete(id);
        req.flash('success', 'Removed Code');
        res.redirect('/code');
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
