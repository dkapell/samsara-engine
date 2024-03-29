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
        const authConfig = {
            callbackURL: getCallbackUrl(req, 'google'),
            scope: [ 'email', 'profile' ]
        };

        if (req.game.google_client_id && req.game.google_client_secret){
            passport.authenticate(`google-game-${req.game.id}`, authConfig)(req, res, next);
        } else {
            passport.authenticate('google', authConfig)(req, res, next);
        }
    });

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/google/callback',
    (req, res, next) => {
        const authConfig = {
            failureRedirect: '/',
            callbackURL: getCallbackUrl(req, 'google'),
        };
        if (req.game.google_client_id && req.game.google_client_secret){
            passport.authenticate(`google-game-${req.game.id}`, authConfig)(req, res, next);
        } else {
            passport.authenticate('google', authConfig)(req, res, next);
        }
    },
    (req, res) => {
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
        (req, res, next) => {
            passport.authenticate('intercode', {
                callbackURL: getCallbackUrl(req, 'intercode')
            })(req, res, next);
        });

    router.get('/intercode/callback',
        (req, res, next) => {
            passport.authenticate('intercode', {
                failureRedirect: '/login',
                callbackURL: getCallbackUrl(req, 'intercode')
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

function getCallbackUrl(req, type){
    let proto = 'http';
    if (req.headers['x-forwarded-proto'] === 'https'){
        proto = 'https';
    }
    if (config.get('auth.httpsAlways')){
        proto = 'https';
    }

    return `${proto}://${req.headers.host}/auth/${type}/callback`;
}

module.exports = router;
