'use strict';

const Model = require('../lib/Model');

const tableFields = ['id', 'player_id', 'ink_id', 'state', 'updated', 'complete'];

const InkState = new Model('ink_states', tableFields, {
    order: ['ink_id']
});

module.exports = InkState;
