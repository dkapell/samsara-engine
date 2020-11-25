'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    link: require('./link')
};

const tableFields = ['name', 'description', 'image_id', 'start', 'finish', 'special', 'map', 'template'];


exports.get = async function(id){
    const query = 'select * from gamestates where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return fillLinks(result.rows[0]);
    }
    return;
};

exports.getStart = async function(){
    const query = 'select * from gamestates where start = true limit 1';
    const result = await database.query(query);
    if (result.rows.length){
        return fillLinks(result.rows[0]);
    }
    return;
};

exports.list = async function(){
    const query = 'select * from gamestates order by name';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillLinks));
};

exports.listSpecial = async function(){
    const query = 'select * from gamestates where start = true or special = true order by start desc nulls last, name';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillLinks));
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

    let query = 'insert into gamestates (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
    if (_.has(data, 'links')){
        await saveLinks(id, data.links);
    }
    return id;
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

    let query = 'update gamestates set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    if (_.has(data, 'links')){
        await saveLinks(id, data.links);
    }
};

exports.delete = async  function(id, cb){
    const query = 'delete from gamestates where id = $1';
    await database.query(query, [id]);
};

async function fillLinks(gamestate){
    const query = 'select * from gamestate_links where gamestate_id = $1';
    const result = await database.query(query, [gamestate.id]);
    gamestate.links = await Promise.all(
        result.rows.map( async gamestateLink => {
            return models.link.get(gamestateLink.link_id);
        })
    );
    return gamestate;
}

async function saveLinks(gamestate_id, links){
    const deleteQuery = 'delete from gamestate_links where gamestate_id = $1';
    const insertQuery = 'insert into gamestate_links (gamestate_id, link_id) values ($1, $2)';
    await database.query(deleteQuery, [gamestate_id]);
    return Promise.all(
        links.map(link => {
            if (_.isObject(link)){
                return database.query(insertQuery, [gamestate_id, link.id]);
            } else {
                return database.query(insertQuery, [gamestate_id, link]);
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
