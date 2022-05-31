'use strict';
const _ = require('underscore');
const async = require('async');
const models = require('../../models');
const gameEngine = require('../../gameEngine');
const GameBroker = require('../../GameBroker');

const chat = require('../../chat');

class BrokeredMessageHandler {
    constructor(sender, allClients){
        this.sender = sender;
        this.allClients = allClients;

    }

    // Handle message from the broker
    async handle(data){
        const self = this;
        try{
            switch(data.type){
                case 'message': {
                    if (data.payload.type === 'report'){
                        const staff = await models.user.listGms();
                        await async.each(staff, async user => {
                            return self.sender.chat(user.id, data.payload.report);
                        });
                        if (data.payload.action === 'remove'){
                            self.sender.removeMessage(data.payload.report.message_id);
                        }
                    } else {
                        const playerMessage = self.handlers.chat.formatPlayerMessage(data.payload);
                        const recipients = await chat.getRecipients(data.payload);
                        await async.each(recipients, async userId => {
                            const recipient = await models.user.get(userId);
                            return self.sender.chat(userId, recipient.type==='player'?playerMessage:data.payload);
                        });
                    }
                    break;
                }

                case 'statechange': {
                    const staff = await models.user.listGms();
                    // Send updated gamestate counts to all players
                    await self.sender.gameData(data.payload.runId);

                    await async.each(staff, async user => {
                        self.sender.chatLocations(user.id);
                    });

                    let players = [];
                    if (!data.payload.run_id || !data.payload.newStateId){
                        await async.each(_.keys(self.clients), async userId => {
                            if (_.findWhere(staff, {id:Number(userId)})){
                                return;
                            }
                            return self.sender.chatLocations(userId);
                        });
                        return;
                    }

                    players = await models.player.find({
                        run_id: data.payload.runId,
                        gamestate_id: data.payload.newStateId
                    });
                    players = players.concat(await models.player.find({
                        run_id: data.payload.runId,
                        gamestate_id: data.payload.oldStateId
                    }));

                    // Send changed chat locations
                    await async.each(players, async player => {
                        if (_.findWhere(staff, {id:Number(player.user_id)})){
                            return;
                        }
                        self.sender.chatLocations(player.user_id);
                    });

                    break;
                }

                case 'client.connect': {
                    if (_.indexOf(self.allClients, data.payload) === -1){
                        self.allClients.push(data.payload);
                    }
                    break;
                }
                case 'client.disconnect': {
                    if (_.indexOf(self.allClients, data.payload) !== -1){
                        self.allClients = self.allClients.filter(userId => {
                            return userId !== data.payload;
                        });
                    }
                    break;
                }
                case 'action': {
                    self.sender.send(data.payload.action, data.payload.userId);
                    break;
                }
                case 'cleartimer': {
                    if (data.payload.source !== self.serverId && _.has(self.playerTimers, data.payload.user_id)){
                        clearTimeout(self.playerTimers[data.payload.user_id]);
                    }
                    break;
                }
                case 'gamedata':{
                    if (data.payload.userId){
                        await self.sender.gameData(data.payload.runId, data.payload.userId);
                    } else {
                        await self.sender.gameData(data.payload.runId);
                    }
                    break;
                }
                case 'playerupdate': {
                    const staff = await models.user.listGms();
                    async.each(staff, async user => {
                        const doc = JSON.stringify({
                            action: 'playerupdate',
                        });
                        self.sender.send(doc, user.id);
                    });

                }
            }
        } catch (err) {
            console.trace(err);
        }
    }
}

module.exports = BrokeredMessageHandler;
