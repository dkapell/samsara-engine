'use strict';
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'chat'];

const Group = new Model('groups', tableFields, {
    order: ['name'],
    validator: validate,
});

module.exports = Group;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
