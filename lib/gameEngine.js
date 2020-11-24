'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');

exports.getGameState = async function getGameState(userId){
    const state = {
        player: {},
        next: {},
        prev: {},
        current: {},
        transitioning: false
    };
    const user = await models.user.get(userId);
    if (user.type !== 'player'){
        return false;
    }
    state.player = await models.player.getByUserId(userId);
    state.next = await getGameStateRecord(state.player.gamestate_id);
    if (state.player.prev_gamestate_id){
        state.prev = await getGameStateRecord(state.player.prev_gamestate_id);
    }
    if(new Date() < new Date(state.player.statetime)){
        state.current = state.prev;
        state.transitioning = true;
    } else {
        state.current = state.next;
    }
    return state;
};

exports.getTransitionsFrom = async function getTransitionsFrom(gamestate){
    const transitions = [];
    if (gamestate.image_id){
        gamestate.map.forEach((area, idx) => {
            for (const action of area.actions){
                if (action.type === 'transition'){
                    transitions.push({
                        name: area.name,
                        areaId: idx,
                        to_state_id: Number(action.to_state_id),
                        from_state_id: gamestate.id,
                        delay: Number(action.delay),
                        group_id: Number(action.group_id),
                        type: 'map'
                    });
                }
            }
        });
    }
    const records = await models.transition.find({from_state_id:gamestate.id});

    for (const transition of records){
        transition.type = 'gamestate';
        transitions.push(transition);
    }
    return transitions;
};

exports.getTransitionsTo = async function getTransitionsTo(gamestateId){
    const gamestates = (await models.gamestate.list()).filter(state => {return !state.template;});
    let transitions = [];
    for (const gamestate of gamestates){
        const stateTransitions = await exports.getTransitionsFrom(gamestate);
        transitions = transitions.concat(stateTransitions.filter(transition => {
            return transition.to_state_id === gamestateId;
        }));
    }
    return transitions;
};

async function getGameStateRecord(id){
    const gamestate = await models.gamestate.get(id);
    const transitions = await exports.getTransitionsFrom(gamestate);
    gamestate.transitions =  await Promise.all(
        transitions.map( async transition => {
            transition.to_state = await models.gamestate.get(transition.to_state_id);
            return transition;
        })
    );
    if(gamestate.image_id){
        gamestate.image = await models.image.get(gamestate.image_id);
    }

    return gamestate;
}
exports.getGameStateRecord = getGameStateRecord;

async function checkCode(code, userId){
    const link = await models.link.getByCode(code);
    if (!link) { throw new Error('Invalid Code'); }
    return checkLink(link.id, userId);
}

async function checkLink(linkId, userId){
    const link = await models.link.get(linkId);
    if (!link) { throw new Error('Invalid Link'); }
    if (!link.active) { throw new Error('Link is not active');}

    const gamestate = await exports.getGameState(userId);

    let linkAllowed = false;
    if (gamestate.current.image_id){
        for (const area of gamestate.current.map){
            for (const action of area.actions){
                if (Number(action.link_id) === linkId){
                    linkAllowed = true;
                    break;
                }
            }
        }
    }

    if (_.findWhere(gamestate.current.links, {id: linkId})){
        linkAllowed = true;
    }

    if (!linkAllowed) { return false; }

    for (const transition of gamestate.current.transitions){
        if (transition.link_id === linkId && (!transition.group_id || transition.group_id === gamestate.player.group_id)){
            return {
                to_state_id: transition.to_state_id,
                delay: transition.delay,
                link: link
            };
        }
    }
    return { link: link };
}

exports.openLink = async function openLink(linkId, userId){
    checkLink(linkId, userId);
    const link = await checkLink(linkId, userId);
    if (!link) { return null; }
    if (link.to_state_id){
        await exports.changeState(userId, link.to_state_id, link.delay);
    }
    return link;
};


exports.openCode = async function openCode(code, userId){
    const link = await checkCode(code, userId);
    if (!link) { return null; }
    if (link.to_state_id){
        await exports.changeState(userId, link.to_state_id, link.delay);
    }
    return link;
};

exports.checkArea = async function checkArea(areaId, userId){
    const gamestate = await exports.getGameState(userId);
    const state = gamestate.current;
    const actions = [];
    if (state.image_id){
        const area = state.map[areaId];
        for (const action of area.actions){
            switch(action.type){
                case 'link': {
                    let link = await checkLink(Number(action.link_id), userId);
                    if (!link) {
                        continue;
                    }
                    if (link.to_state_id){
                        await exports.changeState(userId, link.to_state_id, link.delay);
                    }

                    if (link.link.url === 'stub'){
                        actions.push({action:'load', url:'/stub/' + link.link.id});
                    } else {
                        actions.push({action: 'load', url: link.link.url});
                    }

                    break;
                }
                case 'text':
                    actions.push({action:'display', content: action.content, duration:action.duration?action.duration:0});
                    break;

                case 'transition':
                    await exports.changeState(userId, action.to_state_id, action.delay);
                    break;
            }
        }
    }
    return actions;
};

// Update a player's state
exports.changeState = async function changeState(userId, newStateId, delay){
    const player = await models.player.getByUserId(userId);
    const now = new Date();
    now.setSeconds(now.getSeconds() + delay);
    player.prev_gamestate_id = player.gamestate_id;
    player.gamestate_id = newStateId;
    player.statetime = now;
    await models.player.update(player.id, player);
};

exports.nextState = async function nextState(userId){
    const gamestate = await exports.getGameState(userId);
    for (const transition of gamestate.current.transitions){
        // Skip Area/Map-based transitions
        if (transition.type === 'map'){
            continue;
        }
        // Skip Code-based transitions
        if (transition.link_id){
            continue;
        }
        // Skip transitions for other groups
        if (transition.group_id && transition.group_id !== gamestate.player.group_id){
            continue;
        }
        await exports.changeState(userId, transition.to_state_id, transition.delay);
        return true;
    }
    return false;
};
