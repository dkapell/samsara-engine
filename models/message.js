'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
    user: './user'
};

const tableFields = ['message_id', 'run_id', 'user_id', 'location', 'location_id', 'content', 'created', 'removed'];


exports.get = async function(id){
    const query = `select m.*, u.name, u.type as user_type, p.character
         from "messages" m left join users u on m.user_id = u.id
         left join players p on u.id = p.user_id
         where m.id = $1`;
    const result = await database.query(query, [id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.getByMessageId = async function(message_id){
    const query = `select m.*, u.name, u.type as user_type, p.character
        from "messages" m left join users u on m.user_id = u.id
        left join players p on u.id = p.user_id
        where message_id = $1`;
    const result = await database.query(query, [message_id]);
    if (result.rows.length){
        return result.rows[0];
    }
    return;
};

exports.find = async function(conditions, options){
    const queryParts = [];
    const queryData = [];
    if (!options){
        options = {};
    }
    for (const field of tableFields){
        if (_.has(conditions, field)){
            queryParts.push(`m.${field} = $${queryParts.length+1}`);
            queryData.push(conditions[field]);
        }
    }
    let query = `select m.*, u.name, u.type as user_type, p.character
         from "messages" m left join users u on m.user_id = u.id
         left join players p on u.id = p.user_id`;
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by created desc';
    if (options.offset){
        query += ` offset ${options.offset}`;
    }
    if (options.limit){
        query += ` limit ${options.limit}`;
    }
    const result = await database.query(query, queryData);
    return result.rows;
};

exports.findOne = async function(conditions){
    const results = await exports.find(conditions, {limit:1});
    if (results.length){
        return results[0];
    }
    return;
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

    let query = 'insert into "messages" (';
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

    let query = 'update "messages" set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';
    await database.query(query, queryData);
};

exports.delete = async  function(id){
    const query = 'delete from "messages" where id = $1';
    await database.query(query, [id]);
};



function validate(data){
    if (! validator.isLength(data.content, 1, 80)){
        return false;
    }
    return true;
}
