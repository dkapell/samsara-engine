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
        current: 'Players'
    };
    try {
        const players = (await req.models.user.list()).filter(user => {
            return user.is_player;
        });
        res.locals.users = await Promise.all(
            players.map( async user => {
                user.player = await req.models.player.getByUserId(user.id);
                user.player.run = await req.models.run.get(user.player.run_id);
                return user;
            })
        );

        res.render('player/list', { pageTitle: 'Players' });
    } catch (err){
        next(err);
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', list);

module.exports = router;
