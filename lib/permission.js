'use strict';
var config = require('config');
var _ = require('underscore');
var async = require('async');
var models = require('./models');

module.exports = function(permission, redirect, bypass){
    return function(req, res, next){

        res.locals.checkPermission = function(permission, bypass, user){
            return check(req, permission, bypass, user);
        };

        if (!permission){
            return next();
        }

        if (permission === 'login') {
            if (!req.user) {
                return fail(req, res, 'not logged in', redirect);
            } else {
                return next();
            }
        }

        if (!req.user){
            return fail(req, res, 'not logged in', redirect);
        }

        if (check(req, permission, bypass)){
            return next();
        }
        return fail(req, res, 'permission fail', redirect);

    };
};

function fail(req, res, reason, redirect){
    if (reason === 'not logged in'){
        if (req.originalUrl.match(/\/api\//)){
            res.header(`WWW-Authenticate', 'Basic realm="${req.game.name}"`);
            res.status(401).send('Authentication required');
        } else {
            if (!req.session.backto &&
                ! req.originalUrl.match(/^\/auth\//) &&
                ! req.originalUrl.match(/^\/$/) ){
                req.session.backto = req.originalUrl;
            }
            res.redirect('/auth/login');
        }
    } else {
        if (redirect){
            req.flash('error', 'You are not allowed to access that resource');
            res.redirect(redirect);
        } else {
            res.status('403').send('Forbidden');
        }
    }
}

function check(req, permission, bypass, user=null){
    var eventId = null;

    if (!user){
        user = req.session.assumed_user ? req.session.assumed_user: req.user;
    }

    if (!user){
        return false;
    }

    if (permission === 'login'){
        return true;
    }

    if (user.site_admin && (bypass || !req.session.gm_mode)){
        return true;
    }

    if (permission === 'site_admin' && (req.session.assumed_user || !user.site_admin )) {
        return false;
    }

    if (user.type === 'admin' && (bypass || !req.session.gm_mode)){
        return true;
    }

    if (permission === 'creator' && user.type.match(/^(admin|creator)$/) && (bypass || !req.session.gm_mode)){
        return true;
    }

    if (permission === 'gm' && user.type.match(/^(admin|creator|gm)$/)){
        return true;
    }
    if (permission === 'player' && user.type.match(/^(admin|creator|gm|player)$/)){
        return true;
    }
    return false;
}
