const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const validator = require('validator');
const liquid = require('../lib/liquid');

/* GET documents listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Documents'
    };
    try {
        res.locals.documents = await req.models.document.list();
        res.render('document/list', { pageTitle: 'Documents' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    const id = req.params.id;
    try{
        res.locals.document = await req.models.document.get(id);
        res.render('document/show');
    } catch(err){
        next(err);
    }
}

async function showByCode(req, res, next){
    const code = req.params.code;
    res.locals.siteSection='home';

    if (!validator.isUUID(code)){
        return res.render('document/invalid');
    }
    try{
        const user = req.session.assumed_user ? req.session.assumed_user: req.user;
        const doc = await req.models.document.getByCode(code);
        if(!doc){
            return res.render('document/invalid');
        }
        doc.content = await liquid.render(user.id, doc.content);
        res.locals.document = doc;

        res.render('document/page');
    } catch(err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.document = {
        name: null,
        description: null
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/document', name: 'Documents'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'documentData')){
        res.locals.document = req.session.documentData;
        delete req.session.documentData;
    }
    res.render('document/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const document = await req.models.document.get(id);
        res.locals.document = document;
        if (_.has(req.session, 'documentData')){
            res.locals.document = req.session.documentData;
            delete req.session.documentData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/document', name: 'Documents'},
            ],
            current: 'Edit: ' + document.name
        };

        res.render('document/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const document = req.body.document;

    req.session.documentData = document;

    try{
        const id = await req.models.document.create(document);
        delete req.session.documentData;
        req.flash('success', 'Created Document ' + document.name);
        res.redirect(`/document/${id}`);
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/document/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const document = req.body.document;
    req.session.documentData = document;
    if (!_.has(document, 'active')){
        document.active = false;
    }

    try {
        const current = await req.models.document.get(id);

        await req.models.document.update(id, document);
        delete req.session.documentData;
        req.flash('success', 'Updated Document ' + document.name);
        res.redirect(`/document/${id}`);
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect(`/document/${id}/edit`));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.document.delete(id);
        req.flash('success', 'Removed Document');
        res.redirect('/document');
    } catch(err) {
        return next(err);
    }
}


const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='config';
    next();
});

router.get('/', permission('gm'), list);
router.get('/new', csrf(), permission('creator'), showNew);
router.get('/code/:code', csrf(), permission('player'), showByCode);
router.get('/:id', csrf(),permission('gm'), show);
router.get('/:id/edit', csrf(),  permission('creator'), showEdit);
router.post('/', csrf(), permission('creator'), create);
router.put('/:id', csrf(), permission('creator'), update);
router.delete('/:id', permission('creator'), remove);

module.exports = router;
