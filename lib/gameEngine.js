'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');

exports.getGameState = async function getGameState(userId){
    const state = {
        player: {},
        next: {},
        prev: {},
        current: {}
    };
    state.user = await models.user.get(userId);
    if (!state.user.is_player){
        return false;
    }
    state.player = await models.player.getByUserId(userId);
    state.next = await getGameStateRecord(state.player.gamestate_id);
    if (state.player.prev_gamestate_id){
        state.prev = await getGameStateRecord(state.player.prev_gamestate_id);
    }
    if(new Date() < new Date(state.player.statetime)){
        state.current = state.prev;
    } else {
        state.current = state.next;
    }
    return state;
};

async function getGameStateRecord(id){
    const gamestate = await models.gamestate.get(id);
    const transitions = await models.transition.find({from_state_id:id});
    gamestate.transitions =  await Promise.all(
        transitions.map( async transition => {
            transition.to_state = await models.gamestate.get(transition.to_state_id);
            return transition;
        })
    );
    if(gamestate.imagemap_id){
        gamestate.imagemap = await models.imagemap.get(gamestate.imagemap_id);
        gamestate.imagemap.image = await models.image.get(gamestate.imagemap.image_id);
    }

    return gamestate;
}

async function checkCode(code, userId){
    const room = await models.room.getByCode(code);
    if (!room) { throw new Error('Invalid Code'); }
    return checkRoom(room.id, userId);
}

async function checkRoom(roomId, userId){
    const room = await models.room.get(roomId);
    if (!room) { throw new Error('Invalid Room'); }
    if (!room.active) { throw new Error('Room is not active');}

    const gamestate = await exports.getGameState(userId);

    let roomAllowed = false;
    if (gamestate.current.imagemap){
        for (const area of gamestate.current.imagemap.map){
            if (Number(area.room_id) === roomId){
                roomAllowed = true;
                break;
            }
        }
    }

    for (const stateRoom of gamestate.current.rooms){
        if (roomId === stateRoom.room_id){
            roomAllowed = true;
            break;
        }
    }
    if (!roomAllowed) { return false; }

    for (const transition of gamestate.current.transitions){
        if (transition.room_id === roomId && (!transition.group_id || transition.group_id === gamestate.player.group_id)){
            return {
                to_state_id: transition.to_state_id,
                delay: transition.delay,
                room: room
            };
        }
    }
    return { room: room };
}

exports.openRoom = async function openRoom(roomId, userId){
    checkRoom(roomId, userId);
    const room = await checkRoom(roomId, userId);
    if (!room) { return null; }
    if (room.to_state_id){
        await exports.changeState(userId, room.to_state_id, room.delay);
    }
    return room;
};


exports.openCode = async function openCode(code, userId){
    const room = await checkCode(code, userId);
    console.log(room);
    if (!room) { return null; }
    if (room.to_state_id){
        await exports.changeState(userId, room.to_state_id, room.delay);
    }
    return room;
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


// Validate a game config starting from an initial gamestate
exports.validate = async function validate(startStateId){
    const gamestates = _.indexBy((await Promise.all(
        (await models.gamestate.list()).map( async gamestate => {
            return getGameStateRecord(gamestate.id);
        })
    )), 'id');
    const imagemaps = models.imagemap.list();
    const rooms = models.room.list();
    const groups = models.player_group.list();

    const unusedGamestates = _.indexBy(gamestates, 'id');
    const unusedRooms = _.indexBy(rooms, 'id');
    const unusedImagemaps = _.indexBy(imagemaps, 'id');

    const issues = [];

    check(startStateId);
    return {
        issues: _.uniq(issues),
        unused: {
            gamestates: unusedGamestates,
            rooms: unusedRooms,
            imagemaps: unusedImagemaps
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
        if (state.imagemap_id){
            delete unusedImagemaps[state.imagemap_id];
            for (const area of state.imagemap.map){
                if (!area.coords){
                    issues.push(`imagemap ${state.imagemap.name} [${state.imagemap.id}] has an area with no coords`);
                }
                delete unusedRooms[area.room_id];
                stateRooms[area.room_id] = 1;
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
