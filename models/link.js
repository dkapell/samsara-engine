'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['name', 'description', 'url', 'gm', 'active'];


exports.get = async function(id){
    let link = await cache.check('link', id);
    if (link) { return link; }
    const query = 'select * from links where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        link = result.rows[0];
        await cache.store('link',id, link);
        return link;
    }
    return;
};

exports.list = async function(){
    const query = 'select * from links order by name';
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

    let query = 'insert into links (';
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

    let query = 'update links set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('link', id);
};

exports.delete = async  function(id){
    const query = 'delete from links where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('link', id);
};



function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }
    if (data.url !== 'stub' && !validator.isURL(data.url)){
        return false;
    }

    return true;
}
