'use strict';
const async = require('async');
const _ = require('underscore');
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'url', 'gm', 'active'];

const Link = new Model('links', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Link;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    if (data.url !== 'stub' && !validator.isURL(data.url)){
        return false;
    }

    return true;
}
