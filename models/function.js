'use strict';
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'usage', 'type', 'content'];

const Function = new Model('functions', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Function;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    if (! data.type.match(/^(conditional|action|ink)$/)){
        return false;
    }

    return true;
}
