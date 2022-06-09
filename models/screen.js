'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');
const cache = require('../lib/cache');

const models = {
    code: require('./code')
};

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'description', 'image_id', 'start', 'finish', 'special', 'map', 'template', 'chat', 'show_count', 'show_name'];

const Screen = new Model('screens', tableFields, {
    order: ['name'],
    validator: validator,
    postSelect: fillCodes,
    postSave: saveCodes,
    postDelete: postDelete
});

Screen.getStart = async function getStart(gameId){
    const self = this;
    return self.findOne({game_id: gameId, start:true});
};

Screen.listSpecial = async function listSpecial(gameId){
    const self = this;
    const query = `select * from screens where game_id = $1 and (start = true or special = true or finish = true)
        order by start desc nulls last, finish asc nulls first, name`;
    const result = await database.query(query, [gameId]);
    return async.map(result.rows, fillCodes);
};

Screen.listForChat = async function listForChat(gameId){
    const self = this;
    let screens = await cache.check('screen', `chatlist-${gameId}`);
    if (screens) { return screens; }
    screens = await self.find({game_id: gameId, template:false, start:false, finish:false, chat:true});
    await cache.store('screen', `chatlist-${gameId}`, screens);
    return screens;
};

module.exports = Screen;

async function fillCodes(screen){
    const query = 'select * from screen_codes where screen_id = $1';
    const result = await database.query(query, [screen.id]);
    screen.codes = await async.map(result.rows, async screenLink => {
        return models.code.get(screenLink.code_id);
    });
    return screen;
}

async function saveCodes(screen_id, data){
    await postDelete(data);
    if (!_.has(data, 'codes')){
        return;
    }
    const codes = data.codes;
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

async function postDelete(data){
    await cache.invalidate('screen', data.id);
    await cache.invalidate('screen', `chatlist-${data.game_id}`);
    await cache.invalidate('screenrecord', data.id);
}

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
