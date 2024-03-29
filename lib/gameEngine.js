'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const models = require('./models');
const scriptRunner = require('./scriptRunner');
const cache = require('./cache');
const jitsi = require('./jitsi');

const actionLib = require('./actionLib');

exports.getScreen = async function getScreen(userId, gameId){
    if (!userId) { console.trace('no');}
    const screen = {
        player: {},
        next: {},
        prev: {},
        current: {},
        transitioning: false
    };
    const user = await models.user.get(gameId, userId);
    if (!user) {
        throw new Error(`Invalid userId ${userId}`);
    }
    if (user.type !== 'player'){
        return {
            chatSidebar:user.type !== 'none',
            chat:true,
            chatExpanded:false
        };
    }

    screen.player = await models.player.getByUser(userId, gameId);

    screen.run = await models.run.get(screen.player.run_id);
    screen.next = await getScreenRecord(screen.player.screen_id);

    if (screen.player.prev_screen_id){
        screen.prev = await getScreenRecord(screen.player.prev_screen_id);
    }
    if(new Date().getTime() < new Date(screen.player.statetime).getTime()){
        screen.current = screen.prev;
        screen.transitioning = true;
    } else {
        screen.current = screen.next;
    }
    return screen;
};

exports.getTransitionsFrom = async function getTransitionsFrom(fromScreen){
    const transitions = [];
    if (fromScreen.image_id){
        for (const area of fromScreen.map){
            for (const action of area.actions){
                if (action.type === 'transition'){
                    const doc = {
                        name: area.name,
                        areaId: area.uuid,
                        to_screen_id: Number(action.to_screen_id),
                        from_screen_id: fromScreen.id,
                        delay: Number(action.delay),
                        group_id: Number(action.group_id),
                        type: 'map'
                    };
                    if (action.group_id){
                        const group = await models.group.find({game_id: fromScreen.game_id, id:action.group_id});
                        doc.group_name = group.name;
                    }
                    transitions.push(doc);
                }
            }
        }
    }

    const records = await models.transition.find({from_screen_id:fromScreen.id});

    for (const transition of records){
        transition.type = 'screen';
        transitions.push(transition);
    }
    return transitions;
};

exports.getTransitionsTo = async function getTransitionsTo(toScreen){
    const screens = (await models.screen.find({game_id: toScreen.game_id})).filter(screen => {return !screen.template;});
    let transitions = [];
    for (const screen of screens){
        const screenTransitions = await exports.getTransitionsFrom(screen);
        transitions = transitions.concat(screenTransitions.filter(transition => {
            return transition.to_screen_id === toScreen.id;
        }));
    }
    return transitions;
};

async function getScreenRecord(id){
    const screen = await models.screen.get(id);
    if (!screen){ return; }

    screen.transitions  = await exports.getTransitionsFrom(screen);

    if(screen.image_id){
        const image = await models.image.get(screen.image_id);
        if (image.game_id === screen.game_id){
            screen.image = image;
        }
    }
    return screen;
}
exports.getScreenRecord = getScreenRecord;

exports.openCode = async function openCode(code, userId, gameId){
    const codeRecord = await models.code.getByCode(gameId, code);
    const screen = await exports.getScreen(userId, gameId);
    if (!codeRecord) { throw new Error('Invalid Code'); }
    if (!_.findWhere(screen.current.codes, {id: codeRecord.id})){
        return [];
    }

    const actions = await getActions(code.game_id, codeRecord.actions, userId);
    await exports.updateTriggers(userId, gameId);
    return actions;
};

exports.openArea = async function openArea(areaUuid, userId, gameId){
    const screen = await exports.getScreen(userId, gameId);
    const current = screen.current;
    let actions = [];
    if (current.game_id !== gameId){
        return actions;
    }
    if (current.image_id){
        const area = _.findWhere(current.map, {uuid: areaUuid});
        if(area){
            const user = await models.user.get(gameId, userId);
            if (area.condition || area.condition_id){
                let script = area.condition;
                if (area.condition_id && Number(area.condition_id) !== -2){
                    console.log(area.condition_id);
                    const func = await models.function.get(area.condition_id);
                    script = func.content;
                }

                if (! await scriptRunner.runCheck(script, user.player)){
                    return actions;
                }
            }

            if (area.group_id && !_.findWhere(user.player.groups, {id: area.group_id})){
                return actions;
            }
            actions = await getActions(current.game_id, area.actions, userId);
        }
    }
    await exports.updateTriggers(userId, gameId);
    return actions;
};

exports.runTrigger = async function runTrigger(triggerId, userId, gameId){
    if (! await checkTrigger(triggerId, userId)){
        return [];
    }
    const trigger = await models.trigger.findOne({game_id: gameId, id: triggerId});
    const actions = await getActions(gameId, trigger.actions, userId);
    await exports.updateTriggers(userId, gameId);
    return actions;
};


exports.updateTriggers = async function updateTriggers(userId, gameId) {
    const user = await models.user.get(gameId, userId);
    if (user.type !== 'player'){
        return false;
    }
    let triggers = await cache.check('trigger', 'list');
    if (!triggers) {
        triggers = (await models.trigger.find()).filter( trigger => { return trigger.player; } );
        await cache.store('trigger', 'list', triggers);
    }
    const filteredTriggers = await async.filterLimit(triggers, 5, async trigger => {
        return await checkTrigger(trigger.id, userId);
    });

    return await models.player.saveTriggers(user.player.id, filteredTriggers);
};

exports.updateAllTriggers = async function updateAllTriggers(gameId){
    const users = await models.user.find(gameId);
    await async.eachLimit(users, 5, async user => {
        return exports.updateTriggers(user.id, gameId);
    });
};

async function checkTrigger(triggerId, userId){
    const trigger = await models.trigger.get(triggerId);
    const user = await models.user.get(trigger.game_id, userId);
    if (user.type !== 'player'){
        return false;
    }
    if (trigger.condition || trigger.condition_id){
        let script = trigger.condition;
        if (trigger.condition_id && Number(trigger.condition_id) !== -2){
            const func = await models.function.get(trigger.condition_id);
            script = func.content;
        }

        if (! await scriptRunner.runCheck(script, user.player)){
            return false;
        }
    }
    if (trigger.group_id && !_.findWhere(user.player.groups, {id: trigger.group_id})){
        return false;
    }
    return true;
}

async function getActions(gameId, actions, userId){
    const filteredActions = [];
    let screenChanged = false;
    if (!actions) {
        return filteredActions;
    }
    for (const action of actions){
        const screen =  await exports.getScreen(userId, gameId);
        if (action.condition || action.condition_id){
            let script = action.condition;
            if (action.condition_id && action.condition_id !== -2){
                const func = await models.function.get(action.condition_id);
                script = func.content;
            }

            if (! await scriptRunner.runCheck(script, screen.player)){
                continue;
            }
        }
        if (action.group_id && !_.findWhere(screen.player.groups, {id: action.group_id})){
            continue;
        }
        switch(action.type){
            case 'link': {
                let link = await models.link.get(action.link_id);
                if (!link) {
                    continue;
                }
                if (link.game_id !== gameId){
                    continue;
                }

                if (!link.active){
                    continue;
                }

                if (link.url === 'stub'){
                    if(screen.run.show_stubs){
                        filteredActions.push(actionLib.link, `/stub/${link.id}`, true);
                    }
                } else {
                    filteredActions.push(actionLib.link, link.url);
                }

                break;
            }
            case 'meeting': {
                let meeting = await models.meeting.get(action.meeting_id);
                if (!meeting) {
                    continue;
                }

                if (!meeting.active){
                    continue;
                }

                if (!await jitsi.active()){
                    continue;
                }
                filteredActions.push(actionLib.meeting(meeting));

                break;
            }

            case 'closemeeting':
                filteredActions.push(actionLib.closeMeeting());
                break;
            case 'closeink':
                filteredActions.push(actionLib.closeInk());
                break;

            case 'text':
                filteredActions.push(await actionLib.text(gameId, action));
                break;

            case 'image': {
                const image = await models.image.get(action.image_id);
                if (image.game_id === gameId){
                    filteredActions.push(actionLib.image(image.url, image.display_name, image.description));
                }
                break;
            }

            case 'transition':
                if (!screenChanged){
                    if (await exports.changeScreen(userId, gameId, action.to_screen_id, action.delay)){
                        screenChanged = true;
                    }
                }
                break;

            case 'script': {
                let result = null;
                try{
                    let script = action.script;
                    if (action.function_id && Number(action.function_id) !== -2){
                        const func = await models.function.get(action.function_id);
                        script = func.content;
                    }

                    result = await scriptRunner.runAction(gameId, script, screen.player);
                    if (!screenChanged && result && result.screen_id){
                        await exports.changeScreen(userId, gameId, result.to_screen_id, result.delay);
                        screenChanged = true;
                    }
                    if (result.runUpdated){
                        filteredActions.push({action:'runupdate', run_id:screen.run.id});
                        await exports.updateAllTriggers();
                    }
                    if (result.playerUpdated){
                        filteredActions.push({action:'playerupdate', run_id:screen.run.id});
                    }
                    if (result.actions){
                        for (const item of result.actions){
                            filteredActions.push(item);
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
                break;
            }

            case 'ink':
                filteredActions.push(actionLib.ink(action.ink_id, action.ink_fullscreen, action.ink_startPoint, action.ink_restart));
                break;

        }
    }
    return filteredActions;
}

// Update a player's screen
exports.changeScreen = async function changeScreen(userId, gameId, newScreenId, delay, force){
    const player = await models.player.getByUser(userId, gameId);
    const changeTime = new Date();
    changeTime.setSeconds(changeTime.getSeconds() + delay);
    let screenChanged = false;
    if (force || player.screen_id !== newScreenId){
        player.prev_screen_id = player.screen_id;
        player.screen_id = newScreenId;
        player.statetime = changeTime;
        screenChanged = true;
    } else {
        if (player.statetime > changeTime){
            player.statetime = changeTime;
        }
    }
    await models.player.update(player.id, player);
    return screenChanged;
};

exports.nextScreen = async function nextScreen(userId, gameId){
    const screen = await exports.getScreen(userId, gameId);
    for (const transition of screen.current.transitions){
        // Skip Area/Map-based transitions
        if (transition.type === 'map'){
            continue;
        }
        // Skip Code-based transitions
        if (transition.link_id){
            continue;
        }
        // Skip transitions for other groups
        if (transition.group_id && !_.findWhere(screen.player.groups, {id: transition.group_id})){
            continue;
        }
        await exports.changeScreen(userId, gameId, transition.to_screen_id, transition.delay, true);
        return true;
    }
    return false;
};

exports.getScreenCounts = async function getScreenCounts(runId, gameId){
    if (!runId){
        runId = (await models.run.getCurrent(gameId)).id;
    }
    const screens = (await models.screen.find({game_id: gameId})).filter(screen => {
        return screen.show_count;
    });
    const players = await models.player.find({run_id: runId, game_id: gameId});
    const screenList = {};
    for (const player of players){
        const screen = _.findWhere(screens, {id: player.screen_id});
        if (screen){
            if (!_.has(screenList, player.screen_id)){
                screenList[player.screen_id.toString()] = 0;
            }
            screenList[player.screen_id.toString()]++;
        }
    }
    return screenList;
};

exports.getMeetingCounts = async function getMeetingCounts(userId, screen){
    const player = await models.player.getByUser(userId, screen.game_id);
    const run = await models.run.get(player.run_id);
    const meetings = await models.meeting.find({screen_id: screen.id, show_users: true, game_id: screen.game_id});
    let rooms = {};
    if (await jitsi.active()){
        rooms = await jitsi.rooms();
    }

    return async.map(meetings, async meeting => {
        const id = meeting.meeting_id.toLowerCase();
        const participants = await models.participant.find({meeting_id:meeting.id, game_id:meeting.game_id});
        const users = [];
        for (const participant of participants){

            const user = participant.user;
            if (user.type === 'player'){
                users.push({
                    name: user.player && user.player.character?user.player.character:user.name,
                    self: user.id === userId
                });
            }
        }

        return {
            id: meeting.id,
            name: meeting.name,
            count: _.has(rooms, id)?rooms[id]:0,
            users: users
        };
    });
};

exports.getAreaMeeting = async function getAreaMeeting(area, userId, gameId){
    const actions = area.actions.filter( action => {
        if (action.type === 'meeting' || action.type === 'script') {
            return true;
        }
        return false;
    });
    let meetingData = null;

    await async.each(actions, async (action) => {
        switch (action.type){
            case 'meeting': {
                const meeting = await models.meeting.get(action.meeting_id);
                if (!meeting || meeting.game_id !== gameId){
                    break;
                }
                if (meeting.show_users){
                    meetingData = meeting.id;
                }
                break;
            }
            case 'script':{
                const player = await models.player.getByUser(userId, gameId);
                let script = action.script;
                if (action.function_id && Number(action.function_id) !== -2){
                    const func = await models.function.get(action.function_id);
                    script = func.content;
                }

                const result = await scriptRunner.runAction(player.game_id, script, player);

                async.each(result.actions, async (scriptAction) => {
                    if (scriptAction.type !== 'meeting') { return; }
                    const meeting = await models.meeting.get(action.meeting_id);
                    if (!meeting || meeting.game_id !== gameId){
                        return;
                    }
                    if (meeting.show_users){
                        meetingData = meeting.id;
                    }
                });
                break;
            }
        }
    });

    return meetingData;
};

exports.getScreensFromMeeting = async function getScreensFromMeeting(meeting){
    const screens = await models.screen.find({game_id: meeting.game_id});
    return screens.filter(async (screen) => {
        if (screen.template) { return false; }
        for (const area of screen.map){
            for (const action of area.actions){
                if (action.type === 'meeting' && action.meeting_id === meeting.id){
                    return true;
                }
                if (action.type === 'script'){
                    let script = action.script;
                    if (action.function_id && Number(action.function_id) !== -2){
                        const func = await models.function.get(action.function_id);
                        script = func.content;
                    }
                    //eslint-disable-next-line
                    const re = new RegExp(`meeting(\s*${meeting.id}\s*)`);
                    return action.script.match(re);
                }
            }
        }
        return false;
    });
};

