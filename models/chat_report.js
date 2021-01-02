'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['user_id', 'report_id', 'message_id', 'reason', 'created', 'resolved', 'resolved_by', 'resolution'];

exports.get = async function(id){
    const query = 'select * from chat_reports where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return result.rows[0];
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
    let query = 'select * from chat_reports';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by created desc';
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
    const query = 'select * from chat_reports order by name';
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

    let query = 'insert into chat_reports (';
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

    let query = 'update chat_reports set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
};

exports.delete = async  function(id){
    const query = 'delete from chat_reports where id = $1';
    await database.query(query, [id]);
};

function validate(data){
    return true;
}
