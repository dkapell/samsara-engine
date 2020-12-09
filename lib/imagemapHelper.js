'use strict';
const models = require('./models');

exports.parseMap = async function(input){
    const map = [];
    for (const id in input){
        if (id === 'new'){
            continue;
        }
        const area = input[id];
        const actions = [];
        for (const actionId in area.actions){
            const row = area.actions[actionId];
            const action = {
                type: row.type
            };
            switch (row.type){
                case 'link':
                    action.link_id = Number(row.link_id);
                    break;
                case 'text':
                    action.content = row.content;
                    action.duration = row.duration;
                    break;
                case 'transition':
                    action.to_state_id = Number(row.to_state_id);
                    action.delay = Number(row.delay);
                    action.group_id = row.group_id && row.group_id !== '-1'?Number(row.group_id):null;
                    break;
                case 'image':
                    action.image_id = row.image_id;
                    break;
            }
            actions.push(action);
        }
        area.actions = actions;
        map.push(await nameArea(area));
    }
    return JSON.stringify(map);
};

async function nameArea(area){
    if (area.name){
        return area;
    }
    area.name = 'Area';
    for (const action of area.actions){
        switch(action.type){
            case 'link':
                area.name = (await models.link.get(action.link_id)).name;
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
        }
    }
    return area;
}
