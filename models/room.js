'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['name', 'code', 'description', 'url', 'gm', 'active'];


exports.get = async function(id){
    const query = 'select * from rooms where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.getByCode = async function(code){
    const query = 'select * from rooms where UPPER(code) = UPPER($1)';
    const result = await database.query(query, [code]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.list = async function(){
    const query = 'select * from rooms order by name';
    const result = await database.query(query);
    return result.rows;
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

    let query = 'insert into rooms (';
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

    let query = 'update rooms set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
};

exports.delete = async  function(id, cb){
    const query = 'delete from rooms where id = $1';
    await database.query(query, [id]);
};



function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    if (! validator.isLength(data.code, 2, 20)){
        return false;
    }
    if (! validator.isURL(data.url)){
        return false;
    }

    return true;
}
