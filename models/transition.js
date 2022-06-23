'use strict';

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'from_screen_id', 'to_screen_id', 'group_id', 'manual', 'delay'];

const Transition = new Model('transitions', tableFields, {
    order: ['from_screen_id nulls last'],
});

module.exports = Transition;

