'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    code: require('./code')
};

const tableFields = ['name', 'description', 'image_id', 'start', 'finish', 'special', 'map', 'template', 'chat'];


exports.get = async function(id){
    const query = 'select * from gamestates where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return fillCodes(result.rows[0]);
    }
    return;
};

exports.getStart = async function(){
    const query = 'select * from gamestates where start = true limit 1';
    const result = await database.query(query);
    if (result.rows.length){
        return fillCodes(result.rows[0]);
    }
    return;
};

exports.list = async function(){
    const query = 'select * from gamestates order by name';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillCodes));
};

exports.listSpecial = async function(){
    const query = `select * from gamestates where start = true or special = true or finish = true
        order by start desc nulls last, finish asc nulls first, name`;
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillCodes));
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

    let query = 'insert into gamestates (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
    if (_.has(data, 'codes')){
        await saveLinks(id, data.codes);
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

    let query = 'update gamestates set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    if (_.has(data, 'codes')){
        await saveLinks(id, data.codes);
    }
};

exports.delete = async function(id){
    const query = 'delete from gamestates where id = $1';
    await database.query(query, [id]);
};

async function fillCodes(gamestate){
    const query = 'select * from gamestate_codes where gamestate_id = $1';
    const result = await database.query(query, [gamestate.id]);
    gamestate.codes = await Promise.all(
        result.rows.map( async gamestateLink => {
            return models.code.get(gamestateLink.code_id);
        })
    );
    return gamestate;
}

async function saveLinks(gamestate_id, codes){
    const deleteQuery = 'delete from gamestate_codes where gamestate_id = $1';
    const insertQuery = 'insert into gamestate_codes (gamestate_id, code_id) values ($1, $2)';
    await database.query(deleteQuery, [gamestate_id]);
    return Promise.all(
        codes.map(code => {
            if (_.isObject(code)){
                return database.query(insertQuery, [gamestate_id, code.id]);
            } else {
                return database.query(insertQuery, [gamestate_id, code]);
            }
        })
    );
}

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
