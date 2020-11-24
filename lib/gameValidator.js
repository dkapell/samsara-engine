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
    const links = models.link.list();
    const groups = models.player_group.list();

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
        let unusedStateGroups = _.keys(groups);
        delete unusedGamestates[stateId];
        if (state.image_id){
            for (const area of state.map){
                if (!area.coords){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no coords`);
                }
                const linkActions = {};
                if (!area.actions.length){
                    issues.push(`Gamestate ${state.name} [${state.id}] has an area with no actions`);
                }

                for (const action of area.actions){
                    if (action.type === 'link'){
                        delete unusedLinks[action.link_id];
                        stateLinks[action.link_id] = 1;
                    }
                    if (_.has(linkActions, action.type)){
                        issues.push(`Gamestate ${state.name} [${state.id}] has an area with more than one ${action.type} action`);
                    }
                    linkActions[action.type] = 1;
                }
            }
        }
        // add state_links

        for (const transition of state.transitions){
            if (transition.link_id){
                delete unusedLinks[transition.link_id];
                if(!_.has(stateLinks, transition.link_id)){
                    issues.push(`state ${state.name} [${state.id}] has a transition that leads to ${transition.link_id} but there is no way to get there`);
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
