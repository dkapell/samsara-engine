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
                if (user.is_player){
                    user.player = await req.models.player.getByUserId(user.id);
                }
                return user;
            })
        );
        res.locals.runs = _.indexBy(await req.models.run.list(), 'id');
        res.locals.player_groups = _.indexBy(await req.models.player_group.list(), 'id');
        res.render('user/list', { pageTitle: 'Users' });
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.user = {
            name: null,
            email: null,
            is_admin: false,
            is_gm: false,
            is_player: false,
            player: {
                run_id: (await req.models.run.getCurrent()).id,
                game_state: 'initial',
                group_id: null,
            }
        };
        res.locals.runs = await req.models.run.list();
        res.locals.player_groups = await req.models.player_group.list();
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/user', name: 'User'},
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
        if (user.is_player){
            user.player = await req.models.player.getByUserId(id);
        }
        if (!user.player){
            user.player = {
                run_id: (await req.models.run.getCurrent()).id,
                game_state: 'initial'
            };
        }
        res.locals.runs = await req.models.run.list();
        res.locals.player_groups = await req.models.player_group.list();
        res.locals.user = user;
        if (_.has(req.session, 'userData')){
            res.locals.furniture = req.session.userData;
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
        if (user.is_player){
            await req.models.player.create({
                user_id:id,
                run_id:user.player.run_id,
                game_state:user.player.game_state,
                group_id: null
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
    if (!_.has(user, 'is_admin')){
        user.is_admin = false;
    }
    if (!_.has(user, 'is_gm')){
        user.is_gm = false;
    }
    if (!_.has(user, 'is_player')){
        user.is_player = false;
    }

    try {
        const current = await req.models.user.get(id);

        await req.models.user.update(id, user);
        delete req.session.userData;
        if (user.is_player){
            const player = await req.models.player.getByUserId(id);
            if (player){
                player.run_id = user.player.run_id;
                player.game_state =  user.player.game_state;
                player.group_id = user.player.group_id;
                await req.models.player.update(player.id, player);
            } else {
                await req.models.player.create({
                    user_id:id,
                    run_id:user.player.run_id,
                    game_state:user.player.game_state,
                    group_id: null
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
