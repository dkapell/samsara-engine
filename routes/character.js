const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameData = require('../lib/gameData');
const gameEngine = require('../lib/gameEngine');

/* GET characters listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Characters'
    };
    try {
        res.locals.characters = await req.models.character.list();
        res.locals.groups = _.indexBy(await req.models.group.list(), 'id');
        res.render('character/list', { pageTitle: 'Characters' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.character = {
            groups: [],
            name: null,
            data: await gameData.getStartData('player'),
            character_sheet: null

        };
        res.locals.groups = await req.models.group.list();
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/character', name: 'Characters'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();
        if (_.has(req.session, 'characterData')){
            res.locals.character = req.session.characterData;
            delete req.session.characterData;
        }
        res.render('character/new');
    } catch(err){
        next(err);
    }

}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const character = await req.models.character.get(id);
        res.locals.groups = await req.models.group.list();
        res.locals.character = character;
        if (_.has(req.session, 'characterData')){
            res.locals.character = req.session.characterData;
            delete req.session.characterData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/character', name: 'Characters'},
            ],
            current: 'Edit: ' + character.name
        };

        res.render('character/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const character = req.body.character;

    if (!character.groups){
        character.groups = [];
    } else if(!_.isArray(character.groups)){
        character.groups = [character.groups];
    }
    character.data = JSON.parse(character.data);

    req.session.characterData = character;

    try{
        const id = await req.models.character.create(character);
        delete req.session.characterData;
        req.flash('success', 'Created Character ' + character.name);
        res.redirect('/character');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/character/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const character = req.body.character;

    if (!character.groups){
        character.groups = [];
    } else if(!_.isArray(character.groups)){
        character.groups = [character.groups];
    }
    character.data = JSON.parse(character.data);
    req.session.characterData = character;

    try {
        const current = await req.models.character.get(id);

        await req.models.character.update(id, character);
        delete req.session.characterData;
        req.flash('success', 'Updated Character ' + character.name);
        res.redirect('/character');
    } catch(err) {
        console.trace(err);
        req.flash('error', err.toString());
        return (res.redirect('/character/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.character.delete(id);
        req.flash('success', 'Removed Character');
        res.redirect('/character');
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
router.get('/:id', csrf(), showEdit);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
