const config = require('config');
const express = require('express');
const passport = require('passport');
const _ = require('underscore');
const permission = require('../lib/permission');

const router = express.Router();


router.get('/login', function(req, res, next){
    if (req.user){
        return res.redirect('/');
    }
    if (!req.game.intercode_login){
        return res.redirect('/auth/google');
    }
    res.render('auth/login');
});


// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve
//   redirecting the user to google.com.  After authorization, Google
//   will redirect the user back to this application at /auth/google/callback
router.get('/google',
    (req, res, next) => {
        passport.authenticate('google', {
            callbackURL: `http${req.secure?'s':''}://${req.headers.host}/auth/google/callback`,
            scope: [ 'email', 'profile' ]
        })(req, res, next);
    });

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', {
            failureRedirect: '/',
            callbackURL: `http${req.secure?'s':''}://${req.headers.host}/auth/google/callback`,
        })(req, res, next);
    },
    (req, res) => {
        console.log(req.query);
        if (_.has(req.session, 'backto')){
            const backto = req.session.backto;
            delete req.session.backto;
            if (backto.match(/^\/game/)){
                res.redirect('/');
            } else {
                res.redirect(backto);
            }
        } else {
            res.redirect('/');
        }
    });

if (config.get('auth.intercode.clientID')){
    router.get('/intercode',
        function(req, res, next){
            req.session.site = req.game.site;
            next();
        },
        (req, res, next) => {
            passport.authenticate('intercode', {
                callbackURL: `http${req.secure?'s':''}://${req.headers.host}/auth/intercode/callback`,
            })(req, res, next);
        });

    router.get('/intercode/callback',
        (req, res, next) => {
            passport.authenticate('intercode', {
                failureRedirect: '/login',
                callbackURL: `http${req.secure?'s':''}://${req.headers.host}/auth/intercode/callback`,
            })(req, res, next);
        },
        (req, res) => {
            // Successful authentication, redirect home.
            if (_.has(req.session, 'backto')){
                const backto = req.session.backto;
                delete req.session.backto;
                res.redirect(backto);
            } else {
                res.redirect('/');
            }
        });
}

if (config.get('auth.local.key') && config.util.getEnv('NODE_ENV') === 'development'){
    // GET /auth/token
    router.post('/token',
        passport.authenticate('localapi', { failureRedirect: '/', failureFlash: true }),
        function(req, res) {
            res.json({ message: 'Authenticated' });
        });
}

router.get('/logout',
    function logout(req, res, next){
        req.logout();
        delete req.session.accessToken;
        delete req.session.gm_mode;
        delete req.session.assumed_user;
        res.redirect('/');
    });

router.get('/gm', permission('gm'),
    function toggleGmMode(req, res, next){
        if (req.session.gm_mode){
            delete req.session.gm_mode;
        } else {
            req.session.gm_mode = true;
        }
        res.redirect('/');
    });

module.exports = router;
