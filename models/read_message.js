'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['user_id', 'location', 'message_id', 'seen', 'emailed'];

exports.find = async function(conditions){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from "read_messages"';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by user_id, location';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function(conditions){
    const results = await exports.find(conditions);
    if (results.length){
        return results[0];
    }
    return;
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

    let query = 'insert into "read_messages" (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ')';

    await database.query(query, queryData);
};

exports.update = async function(data){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    const queryUpdates = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+1));
            queryData.push(data[field]);
        }
    }

    let query = 'update "read_messages" set ';
    query += queryUpdates.join(', ');
    query += ' where user_id = $1 and location = $2';

    await database.query(query, queryData);
};

exports.upsert = async function(data){
    const read_message = await exports.findOne({user_id: data.user_id, location: data.location});
    if (read_message) {
        for (const field in data){
            if (_.has(read_message, field)){
                read_message[field] = data[field];
            }
        }
        await exports.update(read_message);
    } else {
        await exports.create(data);
    }
};


function validate(data){
    return true;
}
