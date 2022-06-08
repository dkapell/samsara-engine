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

const tableFields = ['name', 'description', 'intercode_login', 'site', 'theme', 'css', 'created_by', 'created', 'updated'];

exports.get = async function(id){
    let record = await cache.check('game', id);
    if (record) {
        return record;
    }
    const query = 'select * from games where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        record = result.rows[0];
        await cache.store('game', id, record);
        await cache.store('game-site', record.site, record);
        return record;
    }
    return;
};

exports.getBySite = async function(site){
    let record = await cache.check('game-site', site);
    if (record) {
        return record;
    }
    const query = 'select * from games where site = $1';
    const result = await database.query(query, [site]);
    if (result.rows.length){
        record = result.rows[0];
        await cache.store('game', record.id, record);
        await cache.store('game-site', record.site, record);
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
    let query = 'select * from games';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by name';
    const result = await database.query(query, queryData);
    return result.rows
};

exports.findOne = async function(conditions){
    const results = await exports.find(conditions, {limit:1});
    if (results.length){
        return results[0];
    }
    return;
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

    let query = 'insert into games (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
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

    let query = 'update games set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    const current = await exports.get(id);

    await database.query(query, queryData);

    await cache.invalidate('game', id);
    await cache.invalidate('game-site', current.site);
};

exports.delete = async  function(id, cb){
    const current = await exports.get(id);
    const query = 'delete from games where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('game', id);
    await cache.invalidate('game-site', current.site);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    return true;
}
