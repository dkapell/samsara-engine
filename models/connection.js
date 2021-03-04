'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['user_id', 'server_id', 'client_id', 'created'];

exports.get = async function(id){
    let connection = await cache.check('connection', id);

    if (connection) {
        console.log('here ' + id);
        return connection;}

    const query = 'select * from connections where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        connection = result.rows[0];
        cache.store('connection', id, connection);
        return connection;
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
    let query = 'select * from connections';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.list = async function(){
    return exports.find({});
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

    let query = 'insert into connections (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    cache.invalidate('user', data.user_id);
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

    let query = 'update connections set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    cache.invalidate('connections', id);
    cache.invalidate('user', data.user_id);
};

exports.delete = async  function(id){
    const connection = await exports.get(id);
    const query = 'delete from connections where id = $1';
    await database.query(query, [id]);
    cache.invalidate('connections', id);
    cache.invalidate('user', connection.user_id);
};

function validate(data){
    return true;
}
