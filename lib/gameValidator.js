'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');
const gameEngine = require('./gameEngine');

// Validate a game config starting from an initial screen
exports.validate = async function validate(){

    const screens = _.indexBy((await Promise.all(
        (await models.screen.list())
            .filter(screen => {return !screen.template;})
            .map( async screen => {
                return gameEngine.getScreenRecord(screen.id);
            })
    )), 'id');
    const codes = await models.code.list();
    const links = await models.link.list();
    const meetings = await models.meeting.list();
    const groups = await models.group.list();
    const triggers = await models.trigger.list();
    const inks = await models.ink.list();

    const unusedScreens = _.indexBy(screens, 'id');
    const unusedLinks = _.indexBy(links, 'id');
    const unusedMeetings = _.indexBy(meetings, 'id');
    const unusedCodes = _.indexBy(codes, 'id');
    const unusedInks = _.indexBy(inks, 'id');

    const issues = [];

    const startScreen = await models.screen.getStart();

    if (!startScreen){
        issues.push('No Start Screen found');
    } else {
        checkScreen(startScreen.id);
    }

    for (const code of codes){
        checkActions(`Code ${code.code} [${code.id}]`, code.actions);
    }

    for (const trigger of triggers){
        checkActions(`Trigger ${trigger.name} [${trigger.id}]`, trigger.actions);
    }

    return {
        issues: _.uniq(issues),
        unused: {
            screens: unusedScreens,
            links: unusedLinks,
            codes: unusedCodes,
            meetings: unusedMeetings,
            inks: unusedInks
        }
    };

    function checkScreen(screenId){
        // Check a screen for
        //  Imagemaps with areas with no coords
        //  Transitions missing for player groups
        //  Transitions for links that don't exist as codes or maps.
        const screen = screens[screenId];
        const screenLinks = {};
        const screenMeetings = {};
        let unusedScreenGroups = _.indexBy(groups, 'id');
        if (!_.has(unusedScreens, screenId)){
            return;
        }
        delete unusedScreens[screenId];
        if (screen.image_id){
            for (const area of screen.map){
                if (!area.coords){
                    issues.push(`Screen ${screen.name} [${screen.id}] has an area with no coords`);
                }
                const areaActions = {};
                const areaGroups = {};
                if (!area.actions.length){
                    issues.push(`Screen ${screen.name} [${screen.id}] has an area with no actions`);
                }
                checkActions(`Screen ${screen.name} [${screen.id}]`, area.actions, screenLinks);
            }
        }
        for(const code of screen.codes){
            delete unusedCodes[code.id];
        }
        for (const transition of screen.transitions){
            if (transition.link_id){
                delete unusedLinks[transition.link_id];
                if(!_.has(screenLinks, transition.link_id)){
                    issues.push(`screen ${screen.name} [${screen.id}] has a transition that leads to link ${transition.link_id} but there is no way to get there`);
                }
            }
            if (transition.meeting_id){
                delete unusedMeetings[transition.meeting_id];
                if(!_.has(screenMeetings, transition.meeting_id)){
                    issues.push(`screen ${screen.name} [${screen.id}] has a transition that leads to meeting ${transition.meeting_id} but there is no way to get there`);
                }
            }
            if (transition.group_id){
                delete unusedScreenGroups[transition.group_id.toString()];
            } else {
                unusedScreenGroups = {};
            }
            checkScreen(transition.to_screen_id);
        }
        if (_.keys(unusedScreenGroups).length && _.keys(unusedScreenGroups).length !== groups.length){
            const names = [];
            for (const groupId in unusedScreenGroups){
                names.push(unusedScreenGroups[groupId].name);
            }
            issues.push(`screen ${screen.name} [${screen.id}] has no path for groups ${names.join(', ')}`);

        }
    }

    function checkActions(identifier, actions, screenLinks){
        const objectActions = {};
        const objectGroups = {};
        for (const action of actions){
            if (action.type === 'link'){
                delete unusedLinks[action.link_id];
            } else if (action.type === 'meeting'){
                delete unusedMeetings[action.meeting_id];
            } else if (action.type === 'ink'){
                delete unusedInks[action.ink_id];
            } else if (action.type === 'transition'){
                if (_.has(action, 'group_id') && _.has(objectGroups, action.group_id)){
                    issues.push(`${identifier} has an area with more than one transition for players in group ${_.findWhere(groups, {id: action.group_id}).name}`);
                }
                if (!_.has(action, 'group_id') && _.has(objectGroups, 'all')){
                    issues.push(`${identifier} has an area with more than one transition for all players`);
                }
                objectGroups[_.has(action, 'group_id')?action.group_id:'all'] = 1;
                checkScreen(action.to_screen_id);

            } else {
                if (_.has(objectActions, action.type)){
                    issues.push(`${identifier} has an area with more than one ${action.type} action`);
                }
            }
            objectActions[action.type] = 1;
        }
    }
};
