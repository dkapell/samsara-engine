'use strict';
const async = require('async');
const _ = require('underscore');
const cache = require('../lib/cache');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'user_id', 'server_id', 'client_id', 'created'];
const Connection = new Model('connections', tableFields, {
    order: ['created'],
    postSave: postSave,
});

module.exports = Connection;

async function postSave(id, data){
    await cache.invalidate('user', data.user_id);
}
