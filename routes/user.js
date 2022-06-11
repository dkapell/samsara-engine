const express = require('express');
const csrf = require('csurf');
const async = require('async');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameData = require('../lib/gameData');
const gameEngine = require('../lib/gameEngine');

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Users'
    };
    try {
        if (req.game.id){
            res.locals.users = await req.models.user.find({game_id: req.game_id});
            res.locals.screens = await req.models.screen.find({game_id: req.game.id});
            res.locals.runs = _.indexBy(await req.models.run.find({game_id: req.game.id}), 'id');
            res.locals.groups = _.indexBy(await req.models.group.find({game_id: req.game.id}), 'id');
            res.render('user/list', { pageTitle: 'Users' });
        } else {
            const games = await req.models.game.find();
            const users = await req.models.user.find();
            res.locals.users = await async.map(users, async(user) => {
                user.games = (await req.models.game_user.find({user_id: user.id})).map(user_game => {
                    const game = _.findWhere(games, {id: user_game.game_id});
                    return {
                        name: game.name,
                        type: user_game.type,
                        game_id: game.id
                    };
                });
                return user;
            });
            res.locals.games = await req.models.game.find();
            res.render('admin/user/list', { pageTitle: 'All Users' });
        }
    } catch (err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        const startScreen = await req.models.screen.getStart(req.game.id);
        res.locals.user = {
            name: null,
            email: null,
            type: 'none',
            player: {
                run_id: (await req.models.run.getCurrent(req.game.id)).id,
                screen_id: startScreen.id,
                groups: [],
                character: null,
                data: await gameData.getStartData('player', req.game.id),
                character_sheet: null,
                character_id: -1
            }
        };
        res.locals.runs = await req.models.run.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.screens = await req.models.screen.find({game_id: req.game.id});
        res.locals.characters = await req.models.character.find({game_id: req.game.id});
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
        const user = await req.models.user.get(req.game.id, id);
        const startScreen = await req.models.screen.getStart(req.game.id);
        if (user.type === 'player'){
            user.player = await req.models.player.find({game_id: req.game.id, user_id: id});
        }
        if (!user.player){
            user.player = {
                run_id: (await req.models.run.getCurrent(req.game.id)).id,
                screen_id: startScreen.id,
                character: null,
                data: await gameData.getStartData('player', req.game.id),
                character_sheet: null,
                character_id: -1,
            };
        }
        res.locals.runs = await req.models.run.find({game_id: req.game.id});
        res.locals.groups = await req.models.group.find({game_id: req.game.id});
        res.locals.screens = await req.models.screen.find({game_id: req.game.id});
        res.locals.characters = await req.models.character.find({game_id: req.game.id});
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
        const id = await req.models.user.create(req.game.id, user);
        if (user.type === 'player'){
            if (!user.player.groups){
                user.player.groups = [];
            } else if(!_.isArray(user.player.groups)){
                user.player.groups = [user.player.groups];
            }
            await req.models.player.create({
                user_id:id,
                game_id: req.game_id,
                run_id:Number(user.player.run_id),
                screen_id:Number(user.player.screen_id),
                prev_screen_id:null,
                character: user.player.character,
                groups: user.player.groups,
                data: JSON.parse(user.player.data),
                character_sheet: user.player.character_sheet
            });
            await gameEngine.updateTriggers(id, req.game.id);
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
        const current = await req.models.user.get(req.game.id, id);

        await req.models.user.update(req.game_id, user);
        delete req.session.userData;
        if (user.type === 'player'){
            const player = await req.models.player.find({game_id: req.game.id, user_id: id});
            if (!user.player.groups){
                user.player.groups = [];
            } else if(!_.isArray(user.player.groups)){
                user.player.groups = [user.player.groups];
            }
            if (player){
                player.run_id = Number(user.player.run_id);
                player.character = user.player.character;
                player.screen_id =  Number(user.player.screen_id);
                player.groups = user.player.groups;
                player.data = JSON.parse(user.player.data);
                player.character_sheet = user.player.character_sheet;
                await req.models.player.update(player.id, player);
            } else {
                await req.models.player.create({
                    user_id:id,
                    game_id: req.game.id,
                    run_id:Number(user.player.run_id),
                    screen_id:  Number(user.player.screen_id),
                    prev_screen_id:null,
                    groups: user.player.groups,
                    data: JSON.parse(user.player.data),
                    character: user.player.character,
                    character_sheet: user.player.character_sheet
                });
            }
            await gameEngine.updateTriggers(id, req.game.id);
            await req.app.locals.gameServer.sendScreen(id, req.game.id);
            await req.app.locals.gameServer.sendLocationUpdate(user.player.run_id, null, null);
        } else {
            const player = await req.models.player.find({game_id: req.game.id, user_id: id});
            if (player){
                await req.models.player.delete(player.id);
            }
        }
        req.flash('success', 'Updated User ' + user.name);
        res.redirect('/user');
    } catch(err) {
        console.trace(err);
        req.flash('error', err.toString());
        return (res.redirect('/user/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.user.delete(req.game.id, id);
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
