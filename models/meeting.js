'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['meeting_id', 'name', 'description', 'gm', 'active', 'gamestate_id'];

exports.get = async function(id){
    let meeting = await cache.check('meeting', id);
    if (meeting) { return meeting; }
    const query = 'select * from meetings where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        meeting = result.rows[0];
        await cache.store('meeting',id, meeting);
        return meeting;
    }
    return;
};

exports.list = async function(){
    const query = 'select * from meetings order by name';
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

    let query = 'insert into meetings (';
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

    let query = 'update meetings set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('meeting', id);
};

exports.delete = async  function(id){
    const query = 'delete from meetings where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('meeting', id);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    if (!_.has(data, 'meeting_id')){
        return false;
    }

    return true;
}
