'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    group: require('./group')
};

const tableFields = ['user_id', 'run_id', 'gamestate_id', 'prev_gamestate_id', 'statetime', 'character', 'data'];


exports.get = async function(id){
    const query = 'select * from players where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return fillGroups(result.rows[0]);
    }
    return;
};

exports.getByUserId = async function(user_id){
    const query = 'select * from players where user_id = $1';
    const result = await database.query(query, [user_id]);
    if (result.rows.length){
        return fillGroups(result.rows[0]);
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
    return Promise.all(result.rows.map(fillGroups));
};

exports.list = async function(){
    const query = 'select * from players';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillGroups));
};

exports.listByRunId = async function(run_id){
    const query = 'select * from players where run_id = $1';
    const result = await database.query(query, [run_id]);
    return Promise.all(result.rows.map(fillGroups));
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
    const id = result.rows[0].id;
    if (_.has(data, 'groups')){
        await saveGroups(id, data.groups);
    }
    return id;
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

    if (_.has(data, 'groups')){
        await saveGroups(id, data.groups);
    }
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

async function fillGroups(player){
    const query = 'select * from player_groups where player_id = $1';
    const result = await database.query(query, [player.id]);
    player.groups = await Promise.all(
        result.rows.map( async playerGroup => {
            return models.group.get(playerGroup.group_id);
        })
    );
    return player;
}

async function saveGroups(player_id, groups){
    const deleteQuery = 'delete from player_groups where player_id = $1';
    const insertQuery = 'insert into player_groups (player_id, group_id) values ($1, $2)';
    await database.query(deleteQuery, [player_id]);
    return Promise.all(
        groups.map(group => {
            if (_.isObject(group)){
                return database.query(insertQuery, [player_id, group.id]);
            } else {
                return database.query(insertQuery, [player_id, group]);
            }
        })
    );
}

function validate(data){

    return true;
}
