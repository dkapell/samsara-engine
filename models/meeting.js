'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['meeting_id', 'name', 'description', 'gm', 'active', 'screen_id', 'public', 'show_users'];

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

exports.getByMeetingId = async function(meetingId){
    let meeting = await cache.check('meeting-id', meetingId);
    if (meeting) { return meeting; }
    const query = 'select * from meetings where meeting_id = $1';
    const result = await database.query(query, [meetingId]);
    if (result.rows.length){
        meeting = result.rows[0];
        await cache.store('meeting-id',meetingId, meeting);
        return meeting;
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
    let query = 'select * from meetings';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.list = async function(){
    return exports.find();
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
