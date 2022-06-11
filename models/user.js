'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
    player: require('./player'),
    run: require('./run'),
    screen: require('./screen'),
    connection: require('./connection'),
    game_user: require('./game_user')
};

const tableFields = ['name', 'email', 'google_id', 'intercode_id', 'site_admin'];

exports.get = async function(gameId, id){
    if (!id){ throw new Error('no id specified'); }
    let user = await cache.check('user', id);

    if (user) {
        return postSelect(user, gameId);
    }

    const query = 'select * from users where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        user = result.rows[0];
        await cache.store('user', id, user);

        return postSelect(user, gameId);
    }
    return;
};

exports.find = async function(gameId, conditions = {}, options = {}){
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

    if (_.has(options, 'offset')){
        query += ` offset ${Number(options.offset)}`;
    }

    if (_.has(options, 'limit')){
        query += ` limit ${Number(options.limit)}`;
    }
    const result = await database.query(query, queryData);
    return async.map(result.rows, async(row) => {
        return postSelect(row, gameId);
    });
};

exports.findOne = async function(gameId, conditions, options = {}){
    options.limit = 1;
    const results = await exports.find(gameId, conditions, options);
    if (results.length){
        return results[0];
    }
    return;
};

exports.listGms = async function(gameId){
    let query = 'select users.* from users left join games_users on games_users.user_id = user.id ';
    query += 'where games_users.type not in (\'none\', \'player\') ';
    query += 'and games_users.game_id = $1 order by name';
    const result = await database.query(query, [gameId]);
    return result.rows;
};

exports.create = async function(gameId, data){
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
    await postSave(result.rows[0].id, data, gameId);
    return result.rows[0].id;
};

exports.update = async function(gameId, id, data){
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
    await cache.invalidate('user', id);
    await postSave(id, data, gameId);
};

exports.findOrCreate = async function(gameId, data){
    let user = null;
    if (data.google_id){
        user = await exports.findOne(gameId, {google_id: data.google_id});
    } else if (data.intercode_id){
        user = await exports.findOne(gameId, {intercode_id: data.intercode_id});
    }
    if (user) {
        for (const field in tableFields){
            if (_.has(user, field)){
                user[field] = data[field];
            }
        }
        await exports.update(gameId, user.id, user);
        return exports.get(gameId, user.id);

    } else {
        user = await exports.findOne(gameId, {email: data.email});

        if (user) {
            for (const field in tableFields){
                if (_.has(user, field)){
                    user[field] = data[field];
                }
            }
            await exports.update(gameId,user.id, user);
            return exports.get(gameId, user.id);

        } else {
            const id = await exports.create(gameId, data);
            if (data.type === 'player'){
                const run = await models.run.getCurrent(gameId);
                const screen = await models.screen.getStart(gameId);
                await models.player.create({
                    user_id:id,
                    game_id: gameId,
                    run_id: run.id,
                    screen_id: screen.id,
                    prev_screen_id: null,
                    character: null,
                    groups: []
                });
            }

            return exports.get(gameId, id);
        }
    }
};

exports.delete = async  function(gameId, id){
    if (gameId){
        let game_user = await models.game_user.find({user_id: id, game_id: gameId});
        if (game_user){
            await models.game_user.delete(game_user.id);
        }
    } else {
        const query = 'delete from users where id = $1';
        await database.query(query, [id]);
        await cache.invalidate('user', id);
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

async function postSelect(user, gameId){
    // Get the game_user record for the specific site/game.
    if (!gameId){
        user.type = 'none';
        return user;
    }

    const game_user = await models.game_user.findOne({user_id: user.id, game_id: gameId});
    if (game_user){
        user.type = game_user.type;
    } else {
        user.type = 'none';
    }

    if (user.type === 'player'){
        user.player = await models.player.getByUser(user.id, gameId);
    }
    user.connections = await (models.connection.find({user_id: user.id, game_id:gameId}));

    return user;
}

async function postSave(id, data, gameId){
    if (!gameId){
        return;
    }
    let game_user = await models.game_user.findOne({user_id: data.id, game_id: gameId});
    if (game_user){
        if (_.has(data, 'type') && game_user.type !== data.type){
            game_user.type = data.type;
            await models.game_user.update(game_user.id, game_user);
        }
    } else {
        game_user = {
            user_id: data.id,
            game_id: gameId,
            type: 'none'
        };
        if (_.has(data, 'type')){
            game_user.type = data.type;
        }
        await models.game_user.create(game_user);
    }
}
