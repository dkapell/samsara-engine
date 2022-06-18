'use strict';
const async = require('async');
const _ = require('underscore');
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'content'];

const Document = new Model('documents', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Document;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
