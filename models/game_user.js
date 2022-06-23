'use strict';

const Model = require('../lib/Model');

const tableFields = ['game_id', 'user_id', 'type', 'created'];

const GameUser = new Model('game_users', tableFields, {
    keyFields: ['game_id', 'user_id'],
    order: ['user_id', 'game_id']
});

module.exports = GameUser;
