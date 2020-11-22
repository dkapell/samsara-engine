'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    room: require('./room')
};

const tableFields = ['name', 'description', 'image_id', 'start', 'special', 'map'];


exports.get = async function(id){
    const query = 'select * from gamestates where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return fillRooms(result.rows[0]);
    }
    return;
};

exports.getStart = async function(){
    const query = 'select * from gamestates where start = true limit 1';
    const result = await database.query(query);
    if (result.rows.length){
        return fillRooms(result.rows[0]);
    }
    return;
};

exports.list = async function(){
    const query = 'select * from gamestates order by name';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillRooms));
};

exports.listSpecial = async function(){
    const query = 'select * from gamestates where start = true or special = true order by start desc nulls last, name';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillRooms));
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
    if (_.has(data, 'rooms')){
        await saveRooms(id, data.rooms);
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
    if (_.has(data, 'rooms')){
        await saveRooms(id, data.rooms);
    }
};

exports.delete = async  function(id, cb){
    const query = 'delete from gamestates where id = $1';
    await database.query(query, [id]);
};

async function fillRooms(gamestate){
    const query = 'select * from gamestate_rooms where gamestate_id = $1';
    const result = await database.query(query, [gamestate.id]);
    gamestate.rooms = await Promise.all(
        result.rows.map( async gamestateRoom => {
            return models.room.get(gamestateRoom.room_id);
        })
    );
    return gamestate;
}

async function saveRooms(gamestate_id, rooms){
    const deleteQuery = 'delete from gamestate_rooms where gamestate_id = $1';
    const insertQuery = 'insert into gamestate_rooms (gamestate_id, room_id) values ($1, $2)';
    await database.query(deleteQuery, [gamestate_id]);
    return Promise.all(
        rooms.map(room => {
            if (_.isObject(room)){
                return database.query(insertQuery, [gamestate_id, room.id]);
            } else {
                return database.query(insertQuery, [gamestate_id, room]);
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
