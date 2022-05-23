const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const inkjs = require('inkjs');


const gameData = require('../lib/gameData');

/* GET inks listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Ink Stories'
    };
    try {
        res.locals.inks = await req.models.ink.list();
        res.render('ink/list', { pageTitle: 'Ink Stories' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.ink = {
        name: null,
        description: null,
        content:''
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/ink', name: 'Ink Stories'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();

    try{
        const variables = await req.models.variable.listInk();
        for (const variable of variables){
            if (variable.type === 'integer'){
                res.locals.ink.content += `VAR ${variable.ink_name} = ${variable.base_value}\n`;
            } else {
                res.locals.ink.content += `VAR ${variable.ink_name} = "${variable.base_value}"\n`;
            }
        }

        if (_.has(req.session, 'inkData')){
            res.locals.ink = req.session.inkData;
            delete req.session.inkData;
        }

        res.render('ink/new');
    } catch(err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const ink = await req.models.ink.get(id);
        res.locals.ink = ink;
        if (_.has(req.session, 'inkData')){
            res.locals.ink = req.session.inkData;
            delete req.session.inkData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/ink', name: 'Ink Stories'},
            ],
            current: 'Edit: ' + ink.name
        };

        res.render('ink/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const ink = req.body.ink;

    req.session.inkData = ink;

    const compiled = compile(ink.content);
    if (!compiled.story){
        req.flash('error', 'Errors in Ink Story: ' + compiled.errors.join(','));
        return res.redirect('/ink/new');
    }

    ink.compiled = compiled.story.ToJson();

    try{
        const inkId = await req.models.ink.create(ink);
        delete req.session.inkData;
        await gameData.addNewVariable(ink);
        req.flash('success', 'Created Ink Story ' + ink.name);
        res.redirect('/ink');
    } catch (err) {
        req.flash('error', err.toString());
        console.trace(err);
        return res.redirect('/ink/new');
    }

}

async function update(req, res, next){
    const id = req.params.id;
    const ink = req.body.ink;
    req.session.inkData = ink;

    const compiled = compile(ink.content);
    if (!compiled.story){
        req.flash('error', 'Errors in Ink Story: ' + compiled.errors.join(','));
        return res.redirect('/ink/' + id);
    }

    ink.compiled = compiled.story.ToJson();

    try {
        const current = await req.models.ink.get(id);

        await req.models.ink.update(id, ink);
        delete req.session.inkData;
        await gameData.addNewVariable(ink, current);
        req.flash('success', 'Updated Ink Story ' + ink.name);
        res.redirect('/ink');
    } catch(err) {
        console.trace(err);
        req.flash('error', err.toString());
        return (res.redirect('/ink/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.ink.delete(id);
        req.flash('success', 'Removed Ink Story');
        res.redirect('/ink');
    } catch(err) {
        return next(err);
    }
}

function compile(inkFile){
    let myStory = null;
    const errors = [];

    function errorHandler(message, errorType){
        errors.push(message);
    }

    const options = new inkjs.CompilerOptions(
        null, [], false, errorHandler, null
    );
    try{
        myStory  = (new inkjs.Compiler(inkFile, options)).Compile();
    } catch (e){}

    return {story: myStory, errors: errors};
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
