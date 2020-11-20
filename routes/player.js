const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');
const gameEngine = require('../lib/gameEngine');

/* GET users listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Players'
    };
    try {
        const players = (await req.models.user.list()).filter(user => {
            return user.type === 'player';
        });
        res.locals.users = await Promise.all(
            players.map( async user => {
                user.gamestate = await gameEngine.getGameState(user.id);
                if (user.gamestate.player.group_id){
                    user.gamestate.player.group = await req.models.player_group.get(user.gamestate.player.group_id);
                }
                user.player = user.gamestate.player;
                return user;
            })
        );
        res.locals.runs = _.indexBy(await req.models.run.list(), 'id');
        res.locals.player_groups = _.indexBy(await req.models.player_group.list(), 'id');

        res.render('player/list', { pageTitle: 'Players' });
    } catch (err){
        next(err);
    }
}

async function assumePlayer(req, res, next){
    try{
        const user = await req.models.user.get(req.params.id);
        if (!user){
            req.flash('error', 'No User Found');
            return res.redirect('/player');
        }
        if (user.type !== 'player'){
            req.flash('error', 'User is not a player');
            return res.redirect('/player');
        }
        user.player = await req.models.player.getByUserId(user.id);
        req.session.assumed_user = user;
        res.redirect('/');
    } catch (err) {
        next(err);
    }
}

function revertPlayer(req, res, next){
    delete req.session.assumed_user;
    res.redirect('/');
}

const router = express.Router();

router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', permission('gm'), list);
router.get('/revert', revertPlayer);
router.get('/:id/assume', permission('gm'), assumePlayer);


module.exports = router;
