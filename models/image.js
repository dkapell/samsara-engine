'use strict';
const async = require('async');
const config = require('config');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
};

const tableFields = ['name', 'display_name', 'description', 'status', 'is_gamestate', 'is_popup', 'is_inventory'];

exports.get = async function(id){
    let image = await cache.check('image', id);
    if (image) { return image; }
    const query = 'select * from images where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        image = postProcess(result.rows[0]);
        await cache.store('image', id, image);
        return image;
    }
    return;
};

exports.list = async function(){
    const query = 'select * from images order by display_name';
    const result = await database.query(query);
    return result.rows.map(postProcess);
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
    let query = 'select * from images';
    if (queryParts.length){
        query += ' where ' + queryParts.join(' and ');
    }
    query += ' order by display_name';
    const result = await database.query(query, queryData);
    return result.rows.map(postProcess);
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

    let query = 'insert into images (';
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

    let query = 'update images set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('image', id);
};

exports.delete = async  function(id){
    const query = 'delete from images where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('image', id);
};



function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, 2, 80)){
        return false;
    }
    return true;
}

function postProcess(image){
    const key = ['images', image.id, image.name].join('/');
    image.url = `https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
    return image;
}
