'use strict';

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'user_id', 'blocked_user_id', 'created'];

const ChatBlock = new Model('chat_blocks', tableFields, {
    order: ['user_id', 'blocked_user_id']
});

module.exports = ChatBlock;
