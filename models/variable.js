'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'type', 'public', 'player', 'base_value', 'ink_name'];

const Variable = new Model('variables', tableFields, {
    order: ['name'],
    validator: validate
});

Variable.listInk = async function listInk(gameId){
    const query = 'select * from "variables" where ink_name is not null and game_id = $1 order by ink_name';
    const result = await database.query(query, [gameId]);
    return result.rows;
};

module.exports = Variable;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    return true;
}
