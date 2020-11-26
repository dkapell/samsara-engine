const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Users'
    };
    try {
        const users = await req.models.user.list();
        res.locals.users = await Promise.all(
            users.map( async user => {
                if (user.type === 'player'){
                    user.player = await req.models.player.getByUserId(user.id);
                }
                return user;
            })
        );
        res.locals.gamestates = await req.models.gamestate.list();
        res.locals.runs = _.indexBy(await req.models.run.list(), 'id');
        res.locals.groups = _.indexBy(await req.models.group.list(), 'id');
        res.render('user/list', { pageTitle: 'Users' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        const startState = await req.models.gamestate.getStart();
        res.locals.user = {
            name: null,
            email: null,
            type: 'none',
            player: {
                run_id: (await req.models.run.getCurrent()).id,
                gamestate_id: startState.id,
                groups: [],
                character: null
            }
        };
        res.locals.runs = await req.models.run.list();
        res.locals.groups = await req.models.group.list();
        res.locals.gamestates = await req.models.gamestate.list();
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user', name: 'Users'},
            ],
            current: 'New'
        };

        res.locals.csrfToken = req.csrfToken();
        if (_.has(req.session, 'userData')){
            res.locals.user = req.session.userData;
            delete req.session.userData;
        }
        res.render('user/new');
    } catch(err){
        next(err);
    }

}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const user = await req.models.user.get(id);
        const startState = await req.models.gamestate.getStart();
        if (user.type === 'player'){
            user.player = await req.models.player.getByUserId(id);
        }
        if (!user.player){
            user.player = {
                run_id: (await req.models.run.getCurrent()).id,
                gamestate_id: startState.id,
                character: null
            };
        }
        res.locals.runs = await req.models.run.list();
        res.locals.groups = await req.models.group.list();
        res.locals.gamestates = await req.models.gamestate.list();
        res.locals.user = user;
        if (_.has(req.session, 'userData')){
            res.locals.user = req.session.userData;
            delete req.session.userData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user', name: 'Users'},
            ],
            current: 'Edit: ' + user.name
        };

        res.render('user/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const user = req.body.user;

    req.session.userData = user;

    try{
        const id = await req.models.user.create(user);
        if (user.type === 'player'){
            if (!user.player.groups){
                user.player.groups = [];
            } else if(!_.isArray(user.player.groups)){
                user.player.groups = [user.player.groups];
            }
            await req.models.player.create({
                user_id:id,
                run_id:Number(user.player.run_id),
                gamestate_id:Number(user.player.gamestate_id),
                prev_gamestate_id:null,
                character: user.player.character,
                groups: user.player.groups

            });
        }
        delete req.session.userData;
        req.flash('success', 'Created User ' + user.name);
        res.redirect('/user');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/user/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const user = req.body.user;
    req.session.userData = user;
    try {
        const current = await req.models.user.get(id);

        await req.models.user.update(id, user);
        delete req.session.userData;
        if (user.type === 'player'){
            const player = await req.models.player.getByUserId(id);
            if (!user.player.groups){
                user.player.groups = [];
            } else if(!_.isArray(user.player.groups)){
                user.player.groups = [user.player.groups];
            }
            if (player){
                player.run_id = Number(user.player.run_id);
                player.character = user.player.character;
                player.gamestate_id =  Number(user.player.gamestate_id);
                player.groups = user.player.groups;
                await req.models.player.update(player.id, player);
            } else {
                await req.models.player.create({
                    user_id:id,
                    run_id:user.player.run_id,
                    game_state:user.player.game_state,
                    groups: user.player.groups
                });
            }
        }
        req.flash('success', 'Updated User ' + user.name);
        res.redirect('/user');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/user/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.user.delete(id);
        req.flash('success', 'Removed User');
        res.redirect('/user');
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
