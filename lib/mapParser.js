'use strict';
const _ = require('underscore');
const models = require('./models');
const scriptRunner = require('./scriptRunner');
const uuid = require('uuid');

exports.parseMap = async function(input, gameId){
    const map = [];
    for (const id in input){
        if (id === 'new'){
            continue;
        }
        const area = input[id];
        area.actions = await exports.parseActions(area.actions, gameId);
        if (!_.has(area, 'uuid') || area.uuid === ''){
            area.uuid = uuid.v4();
        }
        area.group_id =  area.group_id && area.group_id !== '-1'?Number(area.group_id):null;

        if (_.has(area, 'condition_id')){
            area.condition_id = Number(area.condition_id);
            if (Number(area.condition_id) === -2){
                if (_.has(area, 'condition')  && area.condition !== ''){
                    const verified = await scriptRunner.verify(area.condition, 'condition');
                    if (!verified.verified){
                        throw new Error('Script Error: ' + verified.errors);
                    }
                    area.condition = verified.script;
                } else {
                    area.condition_id = null;
                }
            }
        }

        map.push(await nameArea(area, gameId));
    }
    return JSON.stringify(map);
};

async function nameArea(area, gameId){
    if (area.name){
        return area;
    }
    area.name = 'Area';
    for (const action of area.actions){
        switch(action.type){
            case 'link':
                area.name = (await models.link.find({id: action.link_id, game_id: gameId})).name;
                return area;
            case 'meeting':
                area.name = (await models.meeting.find({id: action.meeting_id, game_id: gameId})).name;
                return area;
            case 'text':
                if(area.name === 'Area'){
                    area.name = 'Text Area';
                }
                break;
            case 'transition':
                if(area.name === 'Area'){
                    area.name = 'Transition Area';
                }
                break;
            case 'image':
                if(area.name === 'Area'){
                    area.name = 'Image Area';
                }
                break;
            case 'script':
                if(area.name === 'Area'){
                    area.name = 'Script Area';
                }
                break;
        }
    }
    return area;
}

exports.parseActions = async function(input, gameId){
    const actions = [];
    for (const actionId in input){
        if (actionId === 'new'){
            continue;
        }

        const row = input[actionId];
        const action = {
            type: row.type,
            group_id: row.group_id && row.group_id !== '-1'?Number(row.group_id):null
        };
        if (_.has(row, 'condition_id')){
            action.condition_id = Number(row.condition_id);
            if (Number(action.condition_id) === -2){
                if (_.has(row, 'condition')  && row.condition !== ''){
                    const verified = await scriptRunner.verify(row.condition, 'condition');
                    if (!verified.verified){
                        throw new Error('Script Error: ' + verified.errors);
                    }
                    action.condition = verified.script;
                } else {
                    action.condition_id = null;
                }
            }
        }
        switch (row.type){
            case 'link':
                action.link_id = Number(row.link_id);
                break;
            case 'meeting':
                action.meeting_id = Number(row.meeting_id);
                break;
            case 'closemeeting':
                break;
            case 'closeink':
                break;
            case 'text':
                if (row.document_id !== '-1'){
                    action.document_id = Number(row.document_id);
                } else {
                    action.content = row.content;
                }
                action.duration = row.duration;
                action.location = row.location;
                break;
            case 'transition':
                action.to_screen_id = Number(row.to_screen_id);
                action.delay = Number(row.delay);
                break;
            case 'image':
                action.image_id = row.image_id;
                break;
            case 'script':{
                action.function_id = Number(row.function_id);
                if (action.function_id === -2 && _.has(row.script)){
                    const verified = await scriptRunner.verify(row.script, 'action');
                    if (!verified.verified){
                        console.log(verified.errors);
                        continue;
                    }
                    action.script = verified.script;
                }
                break;
            }
            case 'ink':
                action.ink_id = Number(row.ink_id);
                action.ink_fullscreen = (row.ink_fullscreen === 'on');
                action.ink_startPoint = row.ink_startPoint;
                action.ink_restart = row.ink_restart;
                break;

        }
        actions.push(action);
    }
    return actions;
};
