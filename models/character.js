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

const tableFields = ['name', 'data', 'character_sheet', 'description'];


exports.get = async function(id){
    let record = await cache.check('character', id);
    if (record) {
        return record;
    }
    const query = 'select * from characters where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        record = await fillGroups(result.rows[0]);
        await cache.store('character', id, record);
        return record;
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
    let query = 'select * from characters';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return Promise.all(result.rows.map(fillGroups));
};

exports.list = async function(){
    const query = 'select * from characters order by name';
    const result = await database.query(query);
    return Promise.all(result.rows.map(fillGroups));
};

exports.create = async function(data){
    console.log(JSON.stringify(data, null, 2));
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

    let query = 'insert into characters (';
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

    let query = 'update characters set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);

    if (_.has(data, 'groups')){
        await saveGroups(id, data.groups);
    }
    await cache.invalidate('character', id);
    await cache.invalidate('user', data.user_id);
};

exports.delete = async  function(id, cb){
    const query = 'delete from characters where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('character', id);
};

async function fillGroups(character){
    const query = 'select * from character_groups where character_id = $1';
    const result = await database.query(query, [character.id]);
    character.groups = await Promise.all(
        result.rows.map( async characterGroup => {
            return models.group.get(characterGroup.group_id);
        })
    );
    character.groups = _.sortBy(character.groups, 'name');
    return character;
}

async function saveGroups(character_id, groups){
    const currentQuery  = 'select * from character_groups where character_id = $1';
    const insertQuery = 'insert into character_groups (character_id, group_id) values ($1, $2)';
    const deleteQuery = 'delete from character_groups where character_id = $1 and group_id = $2';
    const current = await database.query(currentQuery, [character_id]);

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
