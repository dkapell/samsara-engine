'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const Model = require('../lib/Model');

const tableFields = ['id', 'name', 'description', 'intercode_login', 'site', 'theme', 'css', 'created_by', 'created', 'updated', 'default_to_player', 'google_client_id', 'google_client_secret'];

const Game = new Model('games', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postSelect,
    postSave: postSave,
    postDelete: postSave
});

Game.getBySite = async function getBySite(site){
    const self = this;
    let record = await cache.check('game-site', site);
    if (record) {
        return record;
    }
    return self.findOne({site:site});
};

module.exports = Game;

async function postSelect(data){
    await cache.store('game-site', data.site, data);
    return data;
}

async function postSave(id, data){
    if (data.site){
        return cache.invalidate('game-site', data.site);
    }
}

function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    return true;
}
