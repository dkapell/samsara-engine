'use strict';

exports.parseMap = function(input){
    const map = [];
    for (const id in input){
        if (id === 'new'){
            continue;
        }
        const actions = [];
        for (const actionId in input[id].actions){
            const row = input[id].actions[actionId];
            const action = {
                type: row.type
            };
            switch (row.type){
                case 'room':
                    action.room_id = row.room_id;
                    break;
                case 'text':
                    action.content = row.content;
                    break;
            }
            actions.push(action);
        }
        input[id].actions = actions;
        map.push(input[id]);
    }
    return JSON.stringify(map);
};
