'use strict';
const async = require('async');
const config = require('config');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
    user: require('./user'),
    meeting: require('./meeting')
};

const tableFields = ['meeting_id', 'user_id', 'joined'];

exports.get = async function(id){
    if(!id) { console.trace('no'); return; }
    let participant = await cache.check('participant', id);
    if (participant) { return participant; }
    const query = 'select * from participants where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        participant = postProcess(result.rows[0]);
        await cache.store('participant', id, participant);
        return participant;
    }
    return;
};

exports.list = async function(){
    const query = 'select * from participants order by meeting_id';
    const result = await database.query(query);
    return async.map(result.rows, postProcess);
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
    let query = 'select * from participants';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by meeting_id, user_id';
    const result = await database.query(query, queryData);
    return async.map(result.rows, postProcess);
};

exports.findOne = async function( conditions){
    const result = await exports.find(conditions);

    if (!result.length){
        return null;
    }
    return result[0];
};

exports.create = async function(data){
    if (! validate(data)){
        throw new Error('Invalid Data');
    }
    if (_.has(data, 'type')){
        if(!_.isArray(data.type)){
            data.type = [data.type];
        }
        data.type = data.type.sort((a,b)=>{return a.localecompare(b);});
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

    let query = 'insert into participants (';
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

    if (_.has(data, 'type')){
        if(!_.isArray(data.type)){
            data.type = [data.type];
        }
        data.type = data.type.sort((a,b)=>{return b.localeCompare(a);});
    }


    const queryUpdates = [];
    const queryData = [id];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+2));
            queryData.push(data[field]);
        }
    }

    let query = 'update participants set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('participant', id);
};

exports.upsert = async function(data){
    const participant = await exports.find(data);
    if (participant) { return participant.id; }
    return exports.create(data);
};

exports.delete = async  function(id){
    const query = 'delete from participants where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('participant', id);
};



function validate(data){
    return true;
}

async function postProcess(participant){
    participant.user = await models.user.get(participant.user_id);
    participant.meeting = await models.meeting.get(participant.meeting_id);
    return participant;
}
