'use strict';

const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'content', 'compiled'];

const Ink = new Model('inks', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Ink;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
