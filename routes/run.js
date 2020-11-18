const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET runs listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Runs'
    };
    try {
        res.locals.runs = await req.models.run.list();
        res.render('run/list', { pageTitle: 'Runs' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.run = {
        name: null,
        current: false,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/run', name: 'Runs'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'runData')){
        res.locals.run = req.session.runData;
        delete req.session.runData;
    }
    res.render('run/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const run = await req.models.run.get(id);
        res.locals.run = run;
        if (_.has(req.session, 'runData')){
            res.locals.run = req.session.runData;
            delete req.session.runData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/run', name: 'Runs'},
            ],
            current: 'Edit: ' + run.name
        };

        res.render('run/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const run = req.body.run;

    req.session.runData = run;

    try{
        if (run.current){
            const current = await req.models.run.getCurrent();
            current.current = false;
            await req.models.run.update(current.id, current);
        }

        await req.models.run.create(run);

        delete req.session.runData;
        req.flash('success', 'Created Run ' + run.name);
        res.redirect('/run');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/run/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const run = req.body.run;
    req.session.runData = run;

    try {
        if (run.current){
            const current = await req.models.run.getCurrent();
            if (current.id !== id){
                current.current = false;
                await req.models.run.update(current.id, current);
            }
        }

        await req.models.run.update(id, run);
        delete req.session.runData;
        req.flash('success', 'Updated run ' + run.name);
        res.redirect('/run');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/run/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.run.delete(id);
        req.flash('success', 'Removed Run');
        res.redirect('/run');
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
