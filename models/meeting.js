'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'meeting_id', 'name', 'description', 'gm', 'active', 'screen_id', 'public', 'show_users'];

const Meeting = new Model('meetings', tableFields, {
    order: ['name'],
    validator: validate
});

module.exports = Meeting;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    if (!_.has(data, 'meeting_id')){
        return false;
    }

    return true;
}
