'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
    group: require('./group'),
    trigger: require('./trigger')
};

const tableFields = ['user_id', 'run_id', 'gamestate_id', 'prev_gamestate_id', 'statetime', 'character', 'data', 'character_sheet'];


exports.get = async function(id){
    let record = await cache.check('player', id);
    if (record) {
        return record;
    }
    const query = 'select * from players where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        record = await fillGroups(result.rows[0]);
        await cache.store('player', id, record);
        return record;
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
    return async.map(result.rows, fillGroups);
};

exports.list = async function(){
    const query = 'select * from players';
    const result = await database.query(query);
    return async.map(result.rows, fillGroups);
};

exports.listByGroupAndRun = async function(group_id, run_id){
    const query = `select players.* from players left join player_groups on player_groups.player_id = players.id
        where player_groups.group_id = $1 and players.run_id = $2`;
    const result = await database.query(query, [group_id, run_id]);
    return async.map(result.rows, fillGroups);
};

exports.listByRunId = async function(run_id){
    const query = 'select * from players where run_id = $1';
    const result = await database.query(query, [run_id]);
    return async.map(result.rows, fillGroups);
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
    await cache.invalidate('player', id);
    await cache.invalidate('user', data.user_id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from players where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('player', id);
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
    player.groups = await async.map(result.rows, async playerGroup => {
        return models.group.get(playerGroup.group_id);
    });

    player.groups = _.sortBy(player.groups, 'name');
    return player;
}

async function saveGroups(player_id, groups){
    const currentQuery  = 'select * from player_groups where player_id = $1';
    const insertQuery = 'insert into player_groups (player_id, group_id) values ($1, $2)';
    const deleteQuery = 'delete from player_groups where player_id = $1 and group_id = $2';
    const current = await database.query(currentQuery, [player_id]);

    const newGroups = [];
    for (const group of groups){
        if (_.isObject(group)){
            newGroups.push(Number(group.id));
        } else {
            newGroups.push(Number(group));
        }
    }

    for (const groupId of newGroups){
        if(!_.findWhere(current.rows, {group_id: groupId})){
            await database.query(insertQuery, [player_id, groupId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newGroups, row.group_id) === -1){
            await database.query(deleteQuery, [player_id, row.group_id]);
        }
    }
}

exports.getTriggers = async function getTriggers(id){
    const query = 'select * from player_triggers where player_id = $1';
    const result = await database.query(query, [id]);
    const triggers = await Promise.all(
        result.rows.map( async playerTrigger => {
            return models.trigger.get(playerTrigger.trigger_id);
        })
    );
    return _.sortBy(triggers, 'name');
};

exports.saveTriggers = async function saveTriggers(player_id, triggers){
    const currentQuery  = 'select * from player_triggers where player_id = $1';
    const insertQuery = 'insert into player_triggers (player_id, trigger_id) values ($1, $2)';
    const deleteQuery = 'delete from player_triggers where player_id = $1 and trigger_id = $2';
    const current = await database.query(currentQuery, [player_id]);

    const newTriggers = [];
    for (const trigger of triggers){
        if (_.isObject(trigger)){
            newTriggers.push(Number(trigger.id));
        } else {
            newTriggers.push(Number(trigger));
        }
    }

    for (const triggerId of newTriggers){
        if(!_.findWhere(current.rows, {trigger_id: triggerId})){
            await database.query(insertQuery, [player_id, triggerId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTriggers, row.trigger_id) === -1){
            await database.query(deleteQuery, [player_id, row.trigger_id]);
        }
    }
};



function validate(data){
    if (!_.isNull(data.character_sheet) && data.character_sheet !== '' && ! validator.isURL(data.character_sheet)){
        return false;
    }
    return true;
}
