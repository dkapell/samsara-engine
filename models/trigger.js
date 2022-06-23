'use strict';
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'icon', 'actions', 'run', 'player', 'group_id', 'condition'];

const Trigger = new Model('triggers', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Trigger;

function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    return true;
}
