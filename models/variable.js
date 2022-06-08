'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['game_id', 'name', 'type', 'public', 'player', 'base_value', 'ink_name'];


exports.get = async function(id){
    const query = 'select * from "variables" where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.getByName = async function(name){
    const query = 'select * from "variables" where name = $1';
    const result = await database.query(query, [name]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.list = async function(){
    const query = 'select * from "variables" order by name';
    const result = await database.query(query);
    return result.rows;
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
    let query = 'select * from "variables"';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function(conditions){
    const result = await exports.find(conditions);
    if (!result.length){ return null; }
    return result[0];
};

exports.listInk = async function(){
    const query = 'select * from "variables" where ink_name is not null order by ink_name';
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

    let query = 'insert into "variables" (';
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

    let query = 'update "variables" set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';
    await database.query(query, queryData);
};

exports.delete = async  function(id){
    const query = 'delete from "variables" where id = $1';
    await database.query(query, [id]);
};



function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    return true;
}
