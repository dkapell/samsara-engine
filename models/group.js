'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['name', 'description', 'chat'];


exports.get = async function(id){
    let group = await cache.check('group', id);
    if (group){ return group; }
    const query = 'select * from groups where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        group = result.rows[0];
        await cache.store('group', id, group);
        return group;
    }
    return;
};

exports.getByName = async function(name){
    const query = 'select * from groups where name = $1';
    const result = await database.query(query, [name]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.list = async function(){
    let groups = await cache.check('group', 'list');
    if (groups) { return groups; }
    const query = 'select * from groups order by name';
    const result = await database.query(query);
    groups = result.rows;
    await cache.store('group', 'list', groups);
    return groups;
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

    let query = 'insert into groups (';
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

    let query = 'update groups set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('group', id);
    await cache.invalidate('group', 'list');
};

exports.delete = async  function(id){
    const query = 'delete from groups where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('group', id);
    await cache.invalidate('group', 'list');
};

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
