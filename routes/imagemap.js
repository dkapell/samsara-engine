const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET imagemaps listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Imagemaps'
    };
    try {
        const imagemaps = await req.models.imagemap.list();
        res.locals.imagemaps = await Promise.all(
            imagemaps.map( async imagemap => {
                imagemap.image = await req.models.image.get(imagemap.image_id);
                return imagemap;
            })
        );
        res.render('imagemap/list', { pageTitle: 'Imagemaps' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    try{
        const imagemap = await req.models.imagemap.get(req.params.id);
        if (!_.isArray(imagemap.map)){
            imagemap.map = [];
        }
        imagemap.image = await req.models.image.get(imagemap.image_id);
        res.locals.imagemap = imagemap;
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/imagemap', name: 'Imagemaps'},
            ],
            current: imagemap.name
        };
        res.locals.rooms = _.indexBy(await req.models.room.list(), 'id');
        res.render('imagemap/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    res.locals.imagemap = {
        name: null,
        description: null,
        image_id: null,
        map: [],
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/imagemap', name: 'Imagemaps'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'imagemapData')){
        res.locals.imagemap = req.session.imagemapData;
        delete req.session.imagemapData;
    }
    try {
        res.locals.images = await req.models.image.list();
        res.locals.rooms = await req.models.room.list();
        res.render('imagemap/new');
    } catch (err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const imagemap = await req.models.imagemap.get(id);
        if (!_.isArray(imagemap.map)){
            imagemap.map = [];
        }
        res.locals.imagemap = imagemap;
        if (_.has(req.session, 'imagemapData')){
            res.locals.imagemap = req.session.imagemapData;
            delete req.session.imagemapData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/imagemap', name: 'Imagemaps'},
            ],
            current: 'Edit: ' + imagemap.name
        };
        res.locals.images = await req.models.image.list();
        res.locals.rooms = await req.models.room.list();
        res.render('imagemap/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const imagemap = req.body.imagemap;

    req.session.imagemapData = imagemap;
    imagemap.map = parseMap(imagemap.map);

    try{
        await req.models.imagemap.create(imagemap);
        delete req.session.imagemapData;
        req.flash('success', 'Created Imagemap ' + imagemap.name);
        res.redirect('/imagemap');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/imagemap/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const imagemap = req.body.imagemap;
    imagemap.map = parseMap(imagemap.map);
    req.session.imagemapData = imagemap;

    try {
        const current = await req.models.imagemap.get(id);

        await req.models.imagemap.update(id, imagemap);
        delete req.session.imagemapData;
        req.flash('success', 'Updated Imagemap ' + imagemap.name);
        res.redirect('/imagemap');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/imagemap/'+id));

    }
}

function parseMap(input){
    const map = [];
    for (const id in input){
        if (id === 'new'){
            continue;
        }
        map.push(input[id]);
    }
    return JSON.stringify(map);
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.imagemap.delete(id);
        req.flash('success', 'Removed Imagemap');
        res.redirect('/imagemap');
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
router.get('/:id', csrf(), show);
router.get('/:id/edit', permission('creator'), csrf(), showEdit);
router.post('/', permission('creator'), csrf(), create);
router.put('/:id', permission('creator'), csrf(), update);
router.delete('/:id', permission('creator'), remove);

module.exports = router;
