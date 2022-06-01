'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['player_id', 'ink_id', 'state', 'updated', 'complete'];

exports.get = async function(id){
    let doc = await cache.check('ink_state', id);
    if (doc) { return doc; }
    const query = 'select * from ink_states where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        doc = result.rows[0];
        await cache.store('ink_state', doc.id, doc);
        return doc;
    }
    return;
};

exports.find = async function(conditions){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from "ink_states"';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by ink_id';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function(conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return result[0];
};

exports.list = async function(){
    const query = 'select * from ink_states order by name';
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

    let query = 'insert into ink_states (';
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

    let query = 'update ink_states set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('ink_state', id);
};

exports.delete = async  function(id){
    const ink_state = await exports.get(id);
    const query = 'delete from ink_states where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('ink_state', id);
};

function validate(data){

    return true;
}
