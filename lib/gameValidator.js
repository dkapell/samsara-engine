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
    const codes = await models.code.list();
    const links = await models.link.list();
    const groups = await models.group.list();

    const unusedGamestates = _.indexBy(gamestates, 'id');
    const unusedLinks = _.indexBy(links, 'id');
    const unusedCodes = _.indexBy(codes, 'id');


    const issues = [];

    const startState = await models.gamestate.getStart();

    if (!startState){
        issues.push('No Start State found');
    } else {
        checkState(startState.id);
    }

    for (const code of codes){
        checkActions(`Code ${code.code} [${code.id}]`, code.actions);
    }

    return {
        issues: _.uniq(issues),
        unused: {
            gamestates: unusedGamestates,
            links: unusedLinks,
            codes: unusedCodes,
        }
    };

    function checkState(stateId){
        // Check a gamestate for
        //  Imagemaps with areas with no coords
        //  Transitions missing for player groups
        //  Transitions for links that don't exist as codes or maps.
        const state = gamestates[stateId];
        const stateLinks = {};
        let unusedStateGroups = _.indexBy(groups, 'id');
        if (!_.has(unusedGamestates, stateId)){
            return;
        }
        delete unusedGamestates[stateId];
        if (state.image_id){
            for (const area of state.map){
                if (!area.coords){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no coords`);
                }
                const areaActions = {};
                const areaGroups = {};
                if (!area.actions.length){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no actions`);
                }
                checkActions(`Gamestate ${state.name} [${state.id}]`, area.actions, stateLinks);
            }
        }
        for(const code of state.codes){
            delete unusedCodes[code.id];
        }
        for (const transition of state.transitions){
            if (transition.link_id){
                delete unusedLinks[transition.link_id];
                if(!_.has(stateLinks, transition.link_id)){
                    issues.push(`state ${state.name} [${state.id}] has a transition that leads to ${transition.link_id} but there is no way to get there`);
                }
            }
            if (transition.group_id){
                delete unusedStateGroups[transition.group_id.toString()];
            } else {
                unusedStateGroups = {};
            }
            checkState(transition.to_state_id);
        }
        if (_.keys(unusedStateGroups).length && _.keys(unusedStateGroups).length !== groups.length){
            const names = [];
            for (const groupId in unusedStateGroups){
                names.push(unusedStateGroups[groupId].name);
            }
            issues.push(`state ${state.name} [${state.id}] has no path for groups ${names.join(', ')}`);

        }
    }

    function checkActions(identifier, actions, stateLinks){
        const objectActions = {};
        const objectGroups = {};
        for (const action of actions){
            if (action.type === 'link'){
                delete unusedLinks[action.link_id];
            }
            if (action.type === 'transition'){
                if (_.has(action, 'group_id') && _.has(objectGroups, action.group_id)){
                    issues.push(`${identifier} has an area with more than one transition for players in group ${_.findWhere(groups, {id: action.group_id}).name}`);
                }
                if (!_.has(action, 'group_id') && _.has(objectGroups, 'all')){
                    issues.push(`${identifier} has an area with more than one transition for all players`);
                }
                objectGroups[_.has(action, 'group_id')?action.group_id:'all'] = 1;

            } else {
                if (_.has(objectActions, action.type)){
                    issues.push(`${identifier} has an area with more than one ${action.type} action`);
                }
            }
            objectActions[action.type] = 1;
        }
    }
};
