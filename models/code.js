'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['game_id', 'code', 'description', 'actions'];

exports.get = async function(id){
    let code = await cache.check('code', id);
    if (code) { return code; }
    const query = 'select * from codes where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        code = result.rows[0];
        await cache.store('code', id, code);
        return code;
    }
    return;
};

exports.getByCode = async function(uuid){
    const query = 'select * from codes where UPPER(code) = UPPER($1)';
    const result = await database.query(query, [uuid]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};


exports.list = async function(){
    const query = 'select * from codes order by code';
    const result = await database.query(query);
    return result.rows;
};

exports.create = async function(data){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryFields = [];
    const queryData = [];
    const queryValues = [];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryFields.push(field);
            queryValues.push('$' + queryFields.length);
            queryData.push(data[field]);
        }
    }

    let query = 'insert into codes (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    return result.rows[0].id;
};

exports.update = async function(id, data){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryUpdates = [];
    const queryData = [id];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+2));
            queryData.push(data[field]);
        }
    }

    let query = 'update codes set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
};

exports.delete = async  function(id){
    const query = 'delete from codes where id = $1';
    await database.query(query, [id]);
};

function validate(data){
    if (! validator.isLength(data.code, 2, 80)){
        return false;
    }

    return true;
}
