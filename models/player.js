'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['user_id', 'run_id', 'game_state'];


exports.get = async function(id){
    const query = 'select * from players where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.getByUserId = async function(user_id){
    const query = 'select * from players where user_id = $1';
    const result = await database.query(query, [user_id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};
exports.getByRunId = async function(run_id){
    const query = 'select * from players where run_id = $1';
    const result = await database.query(query, [run_id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.list = async function(){
    const query = 'select * from players order by name';
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

    let query = 'insert into players (';
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

    let query = 'update players set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
};

exports.delete = async  function(id, cb){
    const query = 'delete from players where id = $1';
    await database.query(query, [id]);
};



function validate(data){


    return true;
}
