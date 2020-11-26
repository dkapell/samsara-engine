'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['user_id', 'run_id', 'gamestate_id', 'prev_gamestate_id', 'group_id', 'statetime', 'character'];


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

exports.find = async function(conditions){
    const queryParts = [];
    const queryData = [];
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(field + ' = $' + (queryParts.length+1));
            queryData.push(conditions[field]);
        }
    }
    let query = 'select * from players';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.list = async function(){
    const query = 'select * from players order by name';
    const result = await database.query(query);
    return result.rows;
};

exports.listByRunId = async function(run_id){
    const query = 'select * from players where run_id = $1';
    const result = await database.query(query, [run_id]);
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

    let query = 'insert into players (';
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

    let query = 'update players set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
};

exports.delete = async  function(id, cb){
    const query = 'delete from players where id = $1';
    await database.query(query, [id]);
};

exports.updateState = async function(id, gamestate_id, cb){
    const player = await exports.get(id);
    player.prev_gamestate_id = player.gamestate_id;
    player.statetime = new Date();
    player.gamestate_id = gamestate_id;
    await exports.update(id, player);
};

function validate(data){


    return true;
}
