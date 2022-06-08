'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
    code: require('./code')
};

const tableFields = ['game_id', 'name', 'description', 'image_id', 'start', 'finish', 'special', 'map', 'template', 'chat', 'show_count', 'show_name'];


exports.get = async function(id){
    let screen = await cache.check('screen', id);
    if (screen) { return screen; }
    const query = 'select * from screens where id = $1';
    const result = await database.query(query, [id]);
    if (result.rows.length){
        screen = await fillCodes(result.rows[0]);
        await cache.store('screen', id, screen);
        return screen;
    }
    return;
};

exports.getStart = async function(){
    const query = 'select * from screens where start = true limit 1';
    const result = await database.query(query);
    if (result.rows.length){
        return fillCodes(result.rows[0]);
    }
    return;
};

exports.list = async function(){
    let screens = await cache.check('screen', 'list');

    if (screens) { return screens; }
    const query = 'select * from screens order by name';
    const result = await database.query(query);
    screens = await async.map(result.rows, fillCodes);
    await cache.store('screen', 'list', screens);
    return screens;
};

exports.listSpecial = async function(){
    const query = `select * from screens where start = true or special = true or finish = true
        order by start desc nulls last, finish asc nulls first, name`;
    const result = await database.query(query);
    return async.map(result.rows, fillCodes);
};

exports.listForChat = async function(){
    let screens = await cache.check('screen', 'chatlist');
    if (screens) { return screens; }
    const query = 'select * from screens where template = false and start = false and finish = false and chat = true order by name';
    const result = await database.query(query);
    screens = result.rows;
    await cache.store('screen', 'chatlist', screens);
    return screens;
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

    let query = 'insert into screens (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';

    const result = await database.query(query, queryData);
    const id = result.rows[0].id;
    if (_.has(data, 'codes')){
        await saveCodes(id, data.codes);
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

    let query = 'update screens set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    await database.query(query, queryData);
    await cache.invalidate('screen', id);
    await cache.invalidate('screen', 'list');
    await cache.invalidate('screen', 'chatlist');
    await cache.invalidate('screenrecord', id);
    if (_.has(data, 'codes')){
        await saveCodes(id, data.codes);
    }
};

exports.delete = async function(id){
    const query = 'delete from screens where id = $1';
    await database.query(query, [id]);
    await cache.invalidate('screen', id);
    await cache.invalidate('screen', 'list');
    await cache.invalidate('screen', 'chatlist');
    await cache.invalidate('screenrecord', id);
};

async function fillCodes(screen){
    const query = 'select * from screen_codes where screen_id = $1';
    const result = await database.query(query, [screen.id]);
    screen.codes = await async.map(result.rows, async screenLink => {
        return models.code.get(screenLink.code_id);
    });
    return screen;
}

async function saveCodes(screen_id, codes){
    const currentQuery  = 'select * from screen_codes where screen_id = $1';
    const insertQuery = 'insert into screen_codes (screen_id, code_id) values ($1, $2)';
    const deleteQuery = 'delete from screen_codes where screen_id = $1 and code_id = $2';
    const current = await database.query(currentQuery, [screen_id]);

    const  newCodes = [];
    for (const code of codes){
        if (_.isObject(code)){
            newCodes.push(Number(code.id));
        } else {
            newCodes.push(Number(code));
        }
    }

    for (const codeId of newCodes){
        if(!_.findWhere(current.rows, {code_id: Number(codeId)})){
            await database.query(insertQuery, [screen_id, codeId]);
        }
    }

    for (const code of current.rows){
        if(_.indexOf(newCodes, code.code_id) === -1){
            await database.query(deleteQuery, [screen_id, code.code_id]);
        }
    }
}

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
