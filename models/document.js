'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['game_id', 'name', 'description', 'content'];

exports.get = async function(id){
    let doc = await cache.check('document', id);
    if (doc) { return doc; }
    const query = 'select * from documents where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        doc = result.rows[0];
        await cache.store('document', doc.id, doc);
        await cache.store('document-name', doc.name, doc);
        await cache.store('document-code', doc.code, doc);
        return doc;
    }
    return;
};

exports.getByName = async function(name){
    const query = 'select * from documents where name = $1';
    const result = await database.query(query, [name]);
    if (result.rows.length){
        const doc = result.rows[0];
        await cache.store('document', doc.id, doc);
        await cache.store('document-name', doc.name, doc);
        await cache.store('document-code', doc.code, doc);
        return doc;
    }
    return;
};

exports.getByCode = async function(uuid){
    const query = 'select * from documents where code = $1';
    const result = await database.query(query, [uuid]);
    if (result.rows.length){
        const doc = result.rows[0];
        await cache.store('document', doc.id, doc);
        await cache.store('document-name', doc.name, doc);
        await cache.store('document-code', doc.code, doc);
        return doc;
    }
    return;
};


exports.list = async function(){
    const query = 'select * from documents order by name';
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

    let query = 'insert into documents (';
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

    let query = 'update documents set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('document', id);
    await cache.invalidate('document-name', data.name);
    await cache.invalidate('document-code', data.code);
};

exports.delete = async  function(id){
    const document = await exports.get(id);
    const query = 'delete from documents where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('document', id);
    await cache.invalidate('document-name', document.name);
    await cache.invalidate('document-code', document.code);
};

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
