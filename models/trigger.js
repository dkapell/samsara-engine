'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['name', 'description', 'icon', 'actions', 'run', 'player', 'group_id', 'condition'];

exports.get = async function(id){
    let trigger = await cache.check('trigger', id);
    if (trigger) { return trigger; }
    const query = 'select * from triggers where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        trigger = result.rows[0];
        await cache.invalidate('trigger', id, trigger);
        return trigger;
    }
    return;
};

exports.find = async function(conditions, options){
    const queryParts = [];
    const queryData = [];
    if (!options){
        options = {};
    }
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from triggers';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    if (options.offset){
        query += ` offset ${options.offset}`;
    }
    if (options.limit){
        query += ` limit ${options.limit}`;
    }
    const result = await database.query(query, queryData);
    return result.rows;

};

exports.findOne = async function(conditions){
    const results = await exports.find(conditions, {limit:1});
    if (results.length){
        return results[0];
    }
    return;
};

exports.list = async function(){
    const query = 'select * from triggers order by name';
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

    let query = 'insert into triggers (';
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

    let query = 'update triggers set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('trigger', id);
};

exports.delete = async  function(id){
    const query = 'delete from triggers where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('trigger', id);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    return true;
}
