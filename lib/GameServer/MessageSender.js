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
const scriptRunner = require('../scriptRunner');

class MessageSender{
    constructor(clients){
        this.clients = clients;
        this.messageTimers = {
            locations: {},
            playerUpdate:{},
            gamedata:{},
        };
    }

    // Send chat messages to all connected clients
    chat(userId, message, gameId, ws){
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
            self.send(doc, userId, gameId);
        }
    }

    async chatLocations(userId, gameId, ws){
        const self = this;
        if (self.messageTimers.locations && self.messageTimers.locations[gameId] && self.messageTimers.locations[gameId][userId]){
            return;
        }
        if (!_.has(self.messageTimers.locations, gameId)){
            self.messageTimers.locations[gameId] = {};
        }
        self.messageTimers.locations[gameId][userId] = setTimeout(async () => {
            const doc = JSON.stringify({
                action: 'chat',
                locations: await chat.getLocations(userId, gameId),
                userId: userId
            });

            if (ws){
                ws.send(doc);
            } else {
                self.send(doc, userId. gameId);
            }
            delete self.messageTimers.locations[gameId][userId];
        }, 50);
    }

    async gameData(runId, userId){
        const self = this;

        const run = await models.run.get(runId);

        // Send updated screen counts
        let players = [];
        if (userId){
            const player = await models.player.getByUser(userId, run.game_id);
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

        if (self.messageTimers.gamedata[run.game_id]){
            return;
        }

        self.messageTimers.gamedata[run.game_id] = setTimeout(async () => {
            const screenCounts = await gameEngine.getScreenCounts(runId, run.game_id);
            await async.each(players, async player =>{
                const screen = await gameEngine.getScreen(player.user_id, run.game_id);
                const doc = JSON.stringify({
                    action: 'gamedata',
                    gamedata:{
                        screen: screenCounts,
                        player: _.has(screen.player.data, 'public')?screen.player.data.public:{},
                        run: _.has(screen.run.data, 'public')?screen.run.data.public:{},
                        character: screen.player.character,
                        user: {
                            name: (await models.user.get(run.game_id, player.user_id)).name
                        },
                        groups: _.pluck(screen.player.groups.filter(group=>{return group.chat;}), 'name')

                    }
                });
                self.send(doc, player.user_id, player.game_id);
            });
            delete self.messageTimers.gamedata[run.game_id];
        }, delay);
    }

    // Send Player Update message to GMs
    async playerUpdate(gameId){
        const self = this;
        if (self.messageTimers.playerUpdate[gameId]){
            return;
        }

        self.messageTimers.playerUpdate[gameId] = setTimeout(async () => {
            const staff = await models.user.listGms(gameId);
            async.each(staff, async user => {
                const doc = JSON.stringify({
                    action: 'playerupdate',
                });
                self.send(doc, user.id, gameId);
            });
            delete self.messageTimers.playerUpdate[gameId];
        }, 50);
    }

    // Send a message to all connected clients for a specified user
    send(message, userId, gameId){
        const self = this;
        if (userId){
            userId = userId.toString();
            if (_.has(self.clients, gameId) && _.has(self.clients[gameId], userId)){
                for (const clientId in self.clients[gameId][userId]){
                    self.clients[gameId][userId][clientId].send(message);
                }
            }
        } else {
            if (_.has(self.clients, gameId)){

                for (const userId in self.clients[gameId]){
                    for (const clientId in self.clients[gameId][userId]){
                        self.clients[gameId][userId][clientId].send(message);
                    }
                }
            }
        }
    }

    removeMessage(message_id, options, gameId){
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
            self.send(doc, options.userId, gameId);
        }
    }

    toast(message, options, gameId, ws){
        const self = this;

        if (!options){
            options = {};
        }
        const doc = {
            id: uuid.v4(),
            action: 'toast',
            message: message,
            duration: options.duration?options.duration:null,
            from: options.from?options.from:config.get('app.name')
        };

        self.action(options.userId, doc, gameId, ws);
    }

    async screen(userId, gameId, ws, force){
        const self = this;

        const screen = (await gameEngine.getScreen(userId, gameId));
        const current = screen.current;
        if (!current){
            const doc = self.defaultJSON();
            doc.chat = screen.chat;
            doc.chatSidebar = screen.chatSidebar;
            doc.chatExpanded = screen.chatExpanded;
            return self.action(userId, doc, gameId, ws);
        }

        const doc = {
            player: true,
            action: 'show page',
            screen:{
                id: current.id,
                description: current.description,
                showCode: current.codes && current.codes.length > 0,
                chatSidebar: !(current.start||current.finish),
                chatExpanded:true,
                chat: current.chat
            },
            gamedata: {
                player: _.has(screen.player.data, 'public')?screen.player.data.public:{},
                run: _.has(screen.run.data, 'public')?screen.run.data.public:{},
                character: screen.player.character,
                user: {
                    name: (await models.user.get(gameId, userId)).name
                }
            }
        };
        if (current.show_name){
            doc.screen.name = current.name;
        }
        if (force){
            doc.force = true;
        }

        if (current.image_id){
            doc.screen.image_id = current.image_id;
            doc.screen.image = { url: current.image.url };

            doc.screen.map = [];
            for (const area of current.map){
                if (area.condition_id || area.script){
                    let script = area.condition;
                    if (area.condition_id && area.condition_id !== -2){
                        const func = await models.function.get(area.condition_id);
                        script = func.content;
                    }
                    if (!await scriptRunner.runCheck(script, screen.player)){
                        continue;
                    }
                }
                if (area.group_id && !_.findWhere(screen.player.groups, {id: area.group_id})){
                    continue;
                }
                const areaDoc = {
                    id: area.uuid,
                    shape: area.shape,
                    coords: area.coords,
                    name: area.name
                };

                const areaMeeting = await gameEngine.getAreaMeeting(area, userId, gameId);
                if (areaMeeting){
                    areaDoc.meeting = areaMeeting;
                }
                //todo - check for meeting
                doc.screen.map.push(areaDoc);
            }
        }
        return self.action(userId, doc, gameId, ws);
    }

    defaultJSON(){
        return {
            player: false,
            action: 'show default',
            chatSidebar:false,
        };
    }

    // Send an action to the broker or a specific socket
    async action(userId, actionDoc, gameId, ws){
        if (ws){
            ws.send(JSON.stringify(actionDoc));
        } else {
            return GameBroker.send(gameId, 'action', {
                userId: userId,
                action: JSON.stringify(actionDoc),
                gameId: gameId,
            });
        }
    }

    async message(message, gameId){
        return GameBroker.send(gameId, 'message', message);
    }

}

module.exports = MessageSender;
