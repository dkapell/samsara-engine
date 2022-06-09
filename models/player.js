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

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'user_id', 'run_id', 'screen_id', 'prev_screen_id', 'statetime', 'character', 'data', 'character_sheet'];

const Player = new Model('players', tableFields, {
    order: ['run_id', 'character'],
    validator: validate,
    postSelect: fillGroups,
    postSave: postSave,
    postDelete: postSave
});

Player.getByUser = async function(userId, gameId){
    const self = this;
    let record = await cache.check('players', `game-${gameId}-user-${userId}`);
    if (record){
        return record;
    }
    return self.findOne({user_id:userId, game_id:gameId});
};
Player.updateScreen = async function updateScreen(id, screen_id){
    const self = this;
    const player = await self.get(id);
    player.prev_screen_id = player.screen_id;
    player.statetime = new Date();
    player.screen_id = screen_id;
    await self.update(id, player);
};

Player.listByGroupAndRun = async function listByGroupAndRun(group_id, run_id){
    const self = this;
    const query = `select players.* from players left join player_groups on player_groups.player_id = players.id
        where player_groups.group_id = $1 and players.run_id = $2`;
    const result = await database.query(query, [group_id, run_id]);
    return async.map(result.rows, fillGroups);
};

Player.getTriggers = async function getTriggers(id){
    const self = this;
    const query = 'select * from player_triggers where player_id = $1';
    const result = await database.query(query, [id]);
    const triggers = await async.map(result.rows, async (playerTrigger) => {
        return models.trigger.get(playerTrigger.trigger_id);
    });
    return _.sortBy(triggers, 'name');
};

Player.saveTriggers = async function saveTriggers(id, triggers){
    const currentQuery  = 'select * from player_triggers where player_id = $1';
    const insertQuery = 'insert into player_triggers (player_id, trigger_id) values ($1, $2)';
    const deleteQuery = 'delete from player_triggers where player_id = $1 and trigger_id = $2';
    const current = await database.query(currentQuery, [id]);

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
            await database.query(insertQuery, [id, triggerId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newTriggers, row.trigger_id) === -1){
            await database.query(deleteQuery, [id, row.trigger_id]);
        }
    }
};

module.exports = Player;

async function fillGroups(player){
    await cache.store('player', `game-${player.game_id}-user-${player.user_id}`, player);
    const query = 'select * from player_groups where player_id = $1';
    const result = await database.query(query, [player.id]);
    player.groups = await async.map(result.rows, async (playerGroup) => {
        return models.group.get(playerGroup.group_id);
    });

    player.groups = _.sortBy(player.groups, 'name');
    return player;
}

async function postSave(player_id, data){
    await cache.invalidate('user', data.user_id);
    await cache.invalidate('player', `game-${data.game_id}-user-${data.user_id}`);

    if (!_.has(data, 'groups')){
        return;
    }
    const groups = data.groups;

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

function validate(data){
    if (!_.isNull(data.character_sheet) && data.character_sheet !== '' && ! validator.isURL(data.character_sheet)){
        return false;
    }
    return true;
}
