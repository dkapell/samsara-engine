'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['from_state_id', 'to_state_id', 'group_id', 'link_id', 'manual', 'delay'];

exports.get = async function(id){
    const query = 'select * from transitions where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return result.rows[0];
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
    let query = 'select * from transitions';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by link_id nulls last';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.list = async function(){
    return exports.find({});
};

exports.create = async function(data, cb){
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

    let query = 'insert into transitions (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    return result.rows[0].id;
};

exports.update = async function(id, data, cb){
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

    let query = 'update transitions set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
};

exports.delete = async  function(id, cb){
    const query = 'delete from transitions where id = $1';
    await database.query(query, [id]);
};

function validate(data){
    return true;
}
