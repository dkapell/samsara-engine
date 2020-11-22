'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');
const gameEngine = require('./gameEngine');

// Validate a game config starting from an initial gamestate
exports.validate = async function validate(){

    const gamestates = _.indexBy((await Promise.all(
        (await models.gamestate.list())
            .filter(state => {return !state.template;})
            .map( async gamestate => {
                return gameEngine.getGameStateRecord(gamestate.id);
            })
    )), 'id');
    const rooms = models.room.list();
    const groups = models.player_group.list();

    const unusedGamestates = _.indexBy(gamestates, 'id');
    const unusedRooms = _.indexBy(rooms, 'id');

    const issues = [];

    const startState = await models.gamestate.getStart();

    if (!startState){
        issues.push('No Start State found');
    } else {
        check(startState.id);
    }

    return {
        issues: _.uniq(issues),
        unused: {
            gamestates: unusedGamestates,
            rooms: unusedRooms,
        }
    };

    function check(stateId){
        // Check a gamestate for
        //  Imagemaps with areas with no coords
        //  Transitions missing for player groups
        //  Transitions for rooms that don't exist as codes or maps.
        const state = gamestates[stateId];
        const stateRooms = {};
        let unusedStateGroups = _.keys(groups);
        delete unusedGamestates[stateId];
        if (state.image_id){
            for (const area of state.map){
                if (!area.coords){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no coords`);
                }
                const roomActions = {};
                if (!area.actions.length){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no actions`);
                }

                for (const action of area.actions){
                    if (action.type === 'room'){
                        delete unusedRooms[action.room_id];
                        stateRooms[action.room_id] = 1;
                    }
                    if (_.has(roomActions, action.type)){
                        issues.push(`Gamestate ${state.name} [${state.id}] has an area with more than one ${action.type} action`);
                    }
                    roomActions[action.type] = 1;
                }
            }
        }
        // add state_rooms

        for (const transition of state.transitions){
            if (transition.room_id){
                delete unusedRooms[transition.room_id];
                if(!_.has(stateRooms, transition.room_id)){
                    issues.push(`state ${state.name} [${state.id}] has a transition that leads to ${transition.room_id} but there is no way to get there`);
                }
            }
            if (transition.group_id){
                delete unusedStateGroups[transition.group_id];
            } else {
                unusedStateGroups = {};
            }
            check(transition.to_state_id);
        }
        if (_.keys(unusedStateGroups).length){
            issues.push(`state ${state.name} [${state.id}] has no path for groups ${unusedStateGroups.join(', ')}`);

        }
    }
};
