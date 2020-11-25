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
    const links = await models.link.list();
    const groups = await models.player_group.list();

    const unusedGamestates = _.indexBy(gamestates, 'id');
    const unusedLinks = _.indexBy(links, 'id');


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
            links: unusedLinks,
        }
    };

    function check(stateId){
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
                const linkActions = {};
                const linkGroups = {};
                if (!area.actions.length){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no actions`);
                }

                for (const action of area.actions){
                    if (action.type === 'link'){
                        delete unusedLinks[action.link_id];
                        stateLinks[action.link_id] = 1;
                    }
                    if (action.type === 'transition'){
                        if (_.has(action, 'group_id') && _.has(linkGroups, action.group_id)){
                            issues.push(`Gamestate ${state.name} [${state.id}] has an area with more than one transition for players in group ${_.findWhere(groups, {id: action.group_id}).name}`);
                        }
                        if (!_.has(action, 'group_id') && _.has(linkGroups, 'all')){
                            issues.push(`Gamestate ${state.name} [${state.id}] has an area with more than one transition for all players`);
                        }
                        linkGroups[_.has(action, 'group_id')?action.group_id:'all'] = 1;

                    } else {
                        if (_.has(linkActions, action.type)){
                            issues.push(`Gamestate ${state.name} [${state.id}] has an area with more than one ${action.type} action`);
                        }
                    }
                    linkActions[action.type] = 1;
                }
            }
        }
        for(const link of state.links){
            delete unusedLinks[link.id];
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
            check(transition.to_state_id);
        }
        if (_.keys(unusedStateGroups).length && _.keys(unusedStateGroups).length !== groups.length){
            const names = [];
            for (const groupId in unusedStateGroups){
                names.push(unusedStateGroups[groupId].name);
            }
            issues.push(`state ${state.name} [${state.id}] has no path for groups ${names.join(', ')}`);

        }
    }
};
