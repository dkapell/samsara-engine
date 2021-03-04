'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
    player: require('./player'),
    run: require('./run'),
    gamestate: require('./gamestate'),
    connection: require('./connection')
};

const tableFields = ['name', 'email', 'google_id', 'intercode_id', 'type'];


exports.get = async function(id){
    let user = await cache.check('user', id);
    if (user) { return user; }
    const query = 'select * from users where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        user = result.rows[0];
        if (user.type === 'player'){
            user.player = await models.player.getByUserId(user.id);
        }
        user.connections = await (models.connection.find({user_id: id}));
        cache.store('user', id, user);
        return user;
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
    let query = 'select * from users';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
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

exports.list = async function(){
    const query = 'select * from users order by name';
    const result = await database.query(query);
    return Promise.all(
        result.rows.map( async user => {
            if (user.type === 'player'){
                user.player = await models.player.getByUserId(user.id);
            }
            user.connections = await (models.connection.find({user_id: user.id}));
            cache.store('user', user.id, user);
            return user;
        })
    );
};

exports.listGms = async function(){
    const query = 'select * from users where type not in (\'none\', \'player\') order by name';
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

    let query = 'insert into users (';
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

    let query = 'update users set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    cache.invalidate('user', id);
};

exports.delete = async  function(id){
    const query = 'delete from users where id = $1';
    await database.query(query, [id]);
};

exports.findOrCreate = async function(data){
    let user = null;
    if (data.google_id){
        user = await exports.findOne({google_id: data.google_id});
    } else if (data.intercode_id){
        user = await exports.findOne({intercode_id: data.intercode_id});
    }
    if (user) {
        delete data.type;
        for (const field in data){
            if (_.has(user, field)){
                user[field] = data[field];
            }
        }
        await exports.update(user.id, user);
        return await exports.get(user.id);

    } else {
        user = await exports.findOne({email: data.email});

        if (user) {
            delete data.type;
            for (const field in data){
                if (_.has(user, field)){
                    user[field] = data[field];
                }
            }
            await exports.update(user.id, user);
            return await exports.get(user.id);

        } else {
            const id = await exports.create(data);
            if (data.type === 'player'){
                const run = await models.run.getCurrent();
                const gamestate = await models.gamestate.getStart();
                await models.player.create({
                    user_id:id,
                    run_id: run.id,
                    gamestate_id: gamestate.id,
                    prev_gamestate_id: null,
                    character: null,
                    groups: []

                });
            }

            return await exports.get(id);
        }
    }
};


function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    if (! validator.isLength(data.email, 3, 100)){
        return false;
    }
    return true;
}
