'use strict';
const database = require('../lib/database');
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'code', 'description', 'actions'];

const Code = new Model('codes', tableFields, {
    order: ['code'],
    validator: validate,
});

Code.getByCode = async function(gameId, code){
    const self = this;
    const query = 'select * from codes where UPPER(code) = UPPER($1)';
    const result = await database.query(query, [code]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

module.exports = Code;

function validate(data){
    if (! validator.isLength(data.code, 2, 80)){
        return false;
    }

    return true;
}
