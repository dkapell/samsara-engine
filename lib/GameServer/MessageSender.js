'use strict';
const _ = require('underscore');
const async = require('async');
const util = require('util');
const uuid = require('uuid');
const config = require('config');

const models = require('../models');
const gameEngine = require('../gameEngine');
const GameBroker = require('../GameBroker');
const chat = require('../chat');
const script = require('../script');

class MessageSender{
    constructor(clients){
        this.clients = clients;
        this.messageTimers = {
            locations: {},
            meetings: {}
        };
    }

    chat(userId, message, ws){
        const self = this;
        const messageCopy = _.clone(message);

        if (userId === message.user_id){
            messageCopy.self = true;
        }

        const doc = JSON.stringify({
            action: 'chat',
            messages: [messageCopy],
            userId: userId
        });

        if (ws){
            ws.send(doc);
        } else {
            self.message(doc, userId);
        }
    }

    async gameState(userId, ws, force){
        const self = this;
        const playerGameState = JSON.stringify(await self.getPlayerGameState(userId, force));
        if (ws){
            ws.send(playerGameState);
        } else {
            GameBroker.send('action', {
                userId:userId,
                action: playerGameState
            });
        }
    }

    async chatLocations(userId, ws){
        const self = this;
        if (self.messageTimers.locations && self.messageTimers.locations[userId]){
            return;
        }
        self.messageTimers.locations[userId] = setTimeout(async () => {
            const doc = JSON.stringify({
                action: 'chat',
                locations: await chat.getLocations(userId),
                userId: userId
            });
            if (ws){
                ws.send(doc);
            } else {
                self.message(doc, userId);
            }
            delete self.messageTimers.locations[userId];
        }, 50);
    }

    async gameData(runId, userId){
        const self = this;
        // Send updated gamestate counts
        let players = [];
        if (userId){
            const player = await models.player.get(userId);
            if(player){
                players.push(player);
            }
        } else {
            players = await models.player.find({run_id:runId});
        }

        let delay = 0;
        if (players.length > 1){
            delay = 50;
        }

        if (self.messageTimers.gamedata){
            return;
        }

        self.messageTimers.gamedata = setTimeout(async () => {
            const gamestateCounts = await gameEngine.getGamestateCounts(runId);
            await async.each(players, async player =>{
                const gamestate = await gameEngine.getGameState(player.user_id);
                const doc = JSON.stringify({
                    action: 'gamedata',
                    gamedata:{
                        gamestate: gamestateCounts,
                        player: _.has(gamestate.player.data, 'public')?gamestate.player.data.public:{},
                        run: _.has(gamestate.run.data, 'public')?gamestate.run.data.public:{},
                        character: gamestate.player.character,
                        user: {
                            name: (await models.user.get(player.user_id)).name
                        },
                        groups: _.pluck(gamestate.player.groups.filter(group=>{return group.chat;}), 'name')

                    }
                });
                self.message(doc, player.user_id);
            });
            delete self.messageTimers.gamedata;
        }, delay);
    }

    message(message, userId){
        const self = this;
        if (userId){
            userId = userId.toString();
            for (const clientId in self.clients[userId]){
                self.clients[userId][clientId].send(message);
            }
        } else {
            for (const userId in self.clients){
                for (const clientId in self.clients[userId]){
                    self.clients[userId][clientId].send(message);
                }
            }
        }
    }

    removeMessage(message_id, options){
        const self = this;
        if (!options){
            options = {};
        }
        const doc = JSON.stringify({
            action: 'chat',
            remove: message_id
        });
        if (_.has(options, 'ws')){
            options.ws.send(doc);

        } else {
            self.message(doc, options.userId);
        }
    }

    toast(message, options){
        const self = this;

        if (!options){
            options = {};
        }
        const doc = JSON.stringify({
            id: uuid.v4(),
            action: 'toast',
            message: message,
            duration: options.duration?options.duration:null,
            from: options.from?options.from:config.get('app.name')
        });

        if (_.has(options, 'ws')){
            options.ws.send(doc);
        } else {
            GameBroker.send('action', {action:doc, userId: options.userId});
        }
    }

    async getPlayerGameState(userId, force){
        const self = this;
        const gamestate = (await gameEngine.getGameState(userId));
        const current = gamestate.current;
        if (!current){
            const doc = self.defaultJSON();
            doc.chat = gamestate.chat;
            doc.chatSidebar = gamestate.chatSidebar;
            doc.chatExpanded = gamestate.chatExpanded;
            return doc;
        }

        const doc = {
            player: true,
            action: 'show page',
            gamestate:{
                id: current.id,
                description: current.description,
                showCode: current.codes && current.codes.length > 0,
                chatSidebar: !(current.start||current.finish),
                chatExpanded:true,
                chat: current.chat
            },
            gamedata: {
                player: _.has(gamestate.player.data, 'public')?gamestate.player.data.public:{},
                run: _.has(gamestate.run.data, 'public')?gamestate.run.data.public:{},
                character: gamestate.player.character,
                user: {
                    name: (await models.user.get(userId)).name
                }
            }
        };
        if (current.show_name){
            doc.gamestate.name = current.name;
        }
        if (force){
            doc.force = true;
        }

        if (current.image_id){
            doc.gamestate.image_id = current.image_id;
            doc.gamestate.image = { url: current.image.url };

            doc.gamestate.map = [];
            for (const area of current.map){
                if (area.condition){
                    if (!await script.runCheck(area.condition, gamestate.player)){
                        continue;
                    }
                }
                if (area.group_id && !_.findWhere(gamestate.player.groups, {id: area.group_id})){
                    continue;
                }
                const areaDoc = {
                    id: area.uuid,
                    shape: area.shape,
                    coords: area.coords,
                    name: area.name
                };

                const areaMeeting = await gameEngine.getAreaMeeting(area, userId);
                if (areaMeeting){
                    areaDoc.meeting = areaMeeting;
                }
                //todo - check for meeting
                doc.gamestate.map.push(areaDoc);
            }
        }
        return doc;
    }

    defaultJSON(){
        return {
            player: false,
            action: 'show default',
            chatSidebar:false,
        };
    }

}

module.exports = MessageSender;
