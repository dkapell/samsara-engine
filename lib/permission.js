'use strict';
var config = require('config');
var _ = require('underscore');
var async = require('async');
var models = require('./models');

module.exports = function(permission, redirect){
    return function(req, res, next){

        const user = req.user;

        res.locals.checkPermission = function(permission){
            return check(req.user, permission);
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

        if (check(user, permission)){
            return next();
        }
        return fail(req, res, 'permission fail', redirect);

    };
};

function fail(req, res, reason, redirect){
    if (reason === 'not logged in'){
        if (req.originalUrl.match(/\/api\//)){
            res.header('WWW-Authenticate', 'Basic realm="ritual"');
            res.status(401).send('Authentication required');
        } else {
            if (!req.session.backto &&
                ! req.originalUrl.match(/\/auth\/google/) &&
                ! req.originalUrl.match(/^\/$/) ){
                req.session.backto = req.originalUrl;
            }
            res.redirect('/auth/google');
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

function check(user, permission){
    var eventId = null;

    if (!user){
        return false;
    }

    if (user.is_admin){
        return true;
    }

    if (permission === 'gm' && user.is_gm){
        return true;
    }
    if (permission === 'player' && (user.is_gm || user.is_player)){
        return true;
    }
    return false;
}
