'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');
const Model = require('../lib/Model');

const models = {
    group: require('./group'),
    trigger: require('./trigger')
};

const tableFields = ['id', 'game_id', 'name', 'data', 'character_sheet', 'description'];

const Character = new Model('characters', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: fillGroups,
    postSave: saveGroups,
});

module.exports = Character;

async function fillGroups(character){
    const query = 'select * from character_groups where character_id = $1';
    const result = await database.query(query, [character.id]);
    character.groups = await Promise.all(
        result.rows.map( async characterGroup => {
            return models.group.get(character.game_id, characterGroup.group_id);
        })
    );
    character.groups = _.sortBy(character.groups, 'name');
    return character;
}

async function saveGroups(character_id, data){
    if (!_.has(data, 'groups')){
        return;
    }
    const currentQuery  = 'select * from character_groups where character_id = $1';
    const insertQuery = 'insert into character_groups (character_id, group_id) values ($1, $2)';
    const deleteQuery = 'delete from character_groups where character_id = $1 and group_id = $2';
    const current = await database.query(currentQuery, [character_id]);

    const newGroups = [];
    for (const group of data.groups){
        if (_.isObject(group)){
            newGroups.push(Number(group.id));
        } else {
            newGroups.push(Number(group));
        }
    }

    for (const groupId of newGroups){
        if(!_.findWhere(current.rows, {group_id: groupId})){
            await database.query(insertQuery, [character_id, groupId]);
        }
    }

    for (const row of current.rows){
        if(_.indexOf(newGroups, row.group_id) === -1){
            await database.query(deleteQuery, [character_id, row.group_id]);
        }
    }

}

function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    if (!_.isNull(data.character_sheet) && data.character_sheet !== '' && ! validator.isURL(data.character_sheet)){
        return false;
    }
    return true;
}
