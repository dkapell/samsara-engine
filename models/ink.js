'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['name', 'description', 'content', 'compiled'];

exports.get = async function(id){
    let doc = await cache.check('ink', id);
    if (doc) { return doc; }
    const query = 'select * from inks where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        doc = result.rows[0];
        await cache.store('ink', doc.id, doc);
        await cache.store('ink-name', doc.name, doc);
        return doc;
    }
    return;
};

exports.getByName = async function(name){
    const query = 'select * from inks where name = $1';
    const result = await database.query(query, [name]);
    if (result.rows.length){
        const doc = result.rows[0];
        await cache.store('ink', doc.id, doc);
        await cache.store('ink-name', doc.name, doc);
        return doc;
    }
    return;
};

exports.list = async function(){
    const query = 'select * from inks order by name';
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

    let query = 'insert into inks (';
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

    let query = 'update inks set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('ink', id);
    await cache.invalidate('ink-name', data.name);
};

exports.delete = async  function(id){
    const ink = await exports.get(id);
    const query = 'delete from inks where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('ink', id);
    await cache.invalidate('ink-name', ink.name);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
