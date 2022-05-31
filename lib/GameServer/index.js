'use strict';
const _ = require('underscore');
const config = require('config');
const WebSocket = require('ws');
const uuid = require('uuid');
const util = require('util');
const async = require('async');
const models = require('../models');

const gameEngine = require('../gameEngine');

const GameBroker = require('../GameBroker');

const MessageSender = require('./MessageSender');

const MeetingHandler = require('./handlers/MeetingHandler');
const ChatHandler = require('./handlers/ChatHandler');
const InkHandler = require('./handlers/InkHandler');
const BrokeredMessageHandler = require('./handlers/BrokeredMessageHandler');

class GameServer {
    constructor(server, app){
        if (GameServer._instance) {
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        GameServer._instance = this;
        this.wss = new WebSocket.Server({ clientTracking: false, noServer: true });
        this.clients = {};
        this.allClients = [];
        this.app = app;
        this.server = server;
        this.playerTimers = {};
        this.serverId = uuid.v4();

        const sender = new MessageSender(this.clients);
        this.sender = sender;

        this.handlers = {
            chat: new ChatHandler(sender),
            meeting: new MeetingHandler(sender),
            ink: new InkHandler(sender),
            brokered: new BrokeredMessageHandler(sender, this.allClients)
        };
        this.init();
    }

    async init() {
        const self = this;
        self.server.on('upgrade', function (request, socket, head) {
            self.app.locals.sessionParser(request, {}, () => {
                self.wss.handleUpgrade(request, socket, head, function (ws) {
                    self.wss.emit('connection', ws, request);
                });
            });
        });

        self.wss.on('connection', async function(ws, request){
            await self.handleConnection(ws, request);
        });

        const interval = setInterval(()=>{
            self.ping();
        }, config.get('webSocket.pingInterval'));

        self.wss.on('close', function close() {
            clearInterval(interval);
        });

        GameBroker.on('message', async function(data){
            await self.handlers.brokered.handle(data);
        });
        await GameBroker.clean();
        setInterval(async () => {
            console.log('Cleaning connections');
            await GameBroker.clean();
            await gameEngine.updateAllTriggers();
        }, config.get('server.cleanIntervalMins') * 60000);

        await gameEngine.updateAllTriggers();

        console.log(`Server ${self.serverId} started`);
    }


    // New Connection
    async handleConnection(ws, request){
        const self = this;
        ws.isAlive = true;
        ws.on('pong', function(){
            this.isAlive = true;
        });

        if (!request.session.passport || !request.session.passport.user){
            if (config.get('webSocket.debug')){
                console.log('Unauthenticated user connected');
            }
            ws.send(JSON.stringify(self.sender.defaultJSON()));
            return;
        }
        let userId = request.session.passport.user;
        if (request.session.assumed_user && request.session.assumed_user.type === 'player'){
            userId = request.session.assumed_user.id;
        }
        const clientId = uuid.v4();

        if (!_.has(self.clients, userId)){
            self.clients[userId] = {};
        }
        self.clients[userId][clientId] = ws;
        await models.connection.create({
            user_id: userId,
            server_id: await GameBroker.getId(),
            client_id: clientId
        });

        GameBroker.send('client.connect', userId);

        // Inbound message from client
        ws.on('message', async function (message) {
            try{
                const user = await models.user.get(userId);
                const data = JSON.parse(message);
                self.handleMessage(ws, user, data);
            } catch (err){
                console.trace(err);
                console.log('Invalid JSON received');
            }
        });

        // Client close
        ws.on('close', async function () {
            const user = await models.user.get(userId);
            if (config.get('webSocket.debug')){
                const user = await models.user.get(userId);
                console.log(`User ${user.name} disconnected`);
            }
            delete self.clients[userId][clientId];
            if (!_.keys(self.clients[userId]).length){
                delete self.clients[userId];
            }

            const connection = await models.connection.find({
                user_id: userId,
                server_id: await GameBroker.getId(),
                client_id: clientId
            });
            if (connection.length){
                await models.connection.delete(connection[0].id);
            }
            if (user.type === 'player'){
                const gamestate_id = user.player.gamestate_id;
                await self.sendLocationUpdate(user.player.run_id, null, gamestate_id);
            }
            GameBroker.send('client.disconnect', userId);
        });

        const user = await models.user.get(userId);
        if (config.get('webSocket.debug')){
            console.log(`User ${user.name} connected`);
        }

        await self.sender.gameState(userId, ws);
        await self.handlers.meeting.sendCounts(userId, ws);
        await self.sender.chatLocations(userId, ws);
        await self.handlers.chat.handleHistory(ws, user, {});
        if (user.type === 'player'){
            await self.sendLocationUpdate(user.player.run_id, null, user.player.gamestate_id);
        }
    }

    // Websockets Ping
    ping(){
        const self = this;
        for(const userId in self.clients){
            for (const clientId in self.clients[userId]){
                const ws = self.clients[userId][clientId];
                if (ws.isAlive === false){ return ws.terminate(); }
                ws.isAlive = false;
                ws.ping(()=>{});
            }
        }
    }

    // Handle message from client
    async handleMessage(ws, user, data){
        const self = this;
        const oldGamestate = await gameEngine.getGameState(user.id);
        let force = false;
        switch(data.action){
            case 'code': force = await self.handleCode(ws, user, data); break;
            case 'area': force = await self.handleArea(ws, user, data); break;
            case 'chat': await self.handlers.chat.handle(ws, user, data); break;
            case 'history': await self.handlers.chat.handleHistory(ws, user, data); break;
            case 'meeting': await self.handlers.meeting.handle(ws, user, data); break;
            case 'ink': await self.handlers.ink.handle(ws, user, data); break;
        }

        if (user.player){
            const newGamestate = await gameEngine.getGameState(user.id);

            if (oldGamestate.current.id !== newGamestate.current.id || force){
                await self.sender.gameState(user.id, null, force);
                await self.handlers.meeting.sendCounts(user.id, null);

                await self.sendLocationUpdate(user.player.run_id, oldGamestate.current.id, newGamestate.current.id);
            }
            if( newGamestate.transitioning ){
                GameBroker.send('cleartimer', {
                    user_id: user.id,
                    source: self.serverId
                });
                await self.sendPlayerUpdate();
                if (_.has(self.playerTimers, user.id)){
                    clearTimeout(self.playerTimers[user.id]);
                }

                self.playerTimers[user.id] = setTimeout(async () => {
                    await self.sendGameState(user.id, null, force);
                    await self.sendLocationUpdate(user.player.run_id, oldGamestate.current.id, newGamestate.current.id);
                }, (new Date(newGamestate.player.statetime).getTime() - new Date().getTime()));
            }
        }
    }

    // Run a trigger on a specific user
    async runTrigger(trigger, user){
        const self = this;
        if (user.type !== 'player'){
            return;
        }
        const oldGamestate = await gameEngine.getGameState(user.id);
        const actions = await gameEngine.runTrigger(trigger.id, user.id);
        let force = false;
        for(const action of actions){
            force = await self.handleActions(null, user, actions);
        }

        const newGamestate = await gameEngine.getGameState(user.id);

        if (oldGamestate.current.id !== newGamestate.current.id){
            await self.sendGameState(user.id, null, force);
            await self.sendLocationUpdate(user.player.run_id, oldGamestate.current.id, newGamestate.current.id);
        } else if( newGamestate.transitioning ){
            GameBroker.send('cleartimer', {
                user_id: user.id,
                source: self.serverId,
            });
            if (_.has(self.playerTimers, user.id)){
                clearTimeout(self.playerTimers[user.id]);
            }

            self.playerTimers[user.id] = setTimeout(async () => {
                await self.sendGameState(user.id, null, force);
                await self.sendLocationUpdate(user.player.run_id, oldGamestate.current.id, newGamestate.current.id);
            }, (new Date(newGamestate.player.statetime).getTime() - new Date().getTime()));

        }
    }

    // Handle a client submitting a code
    async handleCode(ws, user, data){
        if (user.type !== 'player'){
            return;
        }
        try{
            const actions = await gameEngine.openCode(data.code, user.id);
            ws.send(JSON.stringify({codeAccept:true}));
            let force = false;
            if (actions){
                force = await self.handleActions(ws, user, actions);
            }
            return force;
        } catch (err){
            const doc = {
                action: 'code error',
                retry: false,
                error: err.message
            };
            ws.send(JSON.stringify(doc));
            return false;
        }
    }

    // Handle a client clicking an area
    async handleArea(ws, user, data){
        const self = this;
        if (user.type !== 'player'){
            return;
        }
        try{
            const actions = await gameEngine.openArea(data.areaId, user.id);
            let force = false;
            if (actions){
                force = await self.handleActions(ws, user, actions);
            }
            return force;
        } catch(err){
            const doc = {
                action: 'area error',
                retry: false,
                error: err.message
            };
            return ws.send(JSON.stringify(doc));
        }
    }

    // Interpret action results from gameEngine
    async handleActions(ws, user, actions){
        const self = this;
        let force = false;
        for(const action of actions){
            if (action.force) { force = action.force; }
            if (action.action === 'load' && ws){
                ws.send(JSON.stringify(action));
            } else if (action.action === 'runupdate'){
                await self.sendGameDataUpdate(action.run_id);
                await self.sendPlayerUpdate();
            } else if (action.action === 'playerupdate'){
                await self.sendGameDataUpdate(action.run_id, user.id);
                await self.sendPlayerUpdate();
            } else if (action.action === 'ink'){
                await self.handlers.ink.run(action.ink_id, user, action.options);
            } else if (action.action !== 'none'){
                self.sender.action(user.id, action);
            }
        }
        return force;
    }

    async updateChatLocations(){
        const self = this;
        for (const userId in self.clients){
            await self.sender.chatLocations(userId);
        }
    }

    async updateMeetingCounts(){
        const self = this;
        for (const userId in self.clients){
            await self.handlers.meeting.sendCounts(userId);
        }
    }

    async sendGameState(userId, ws, force){
        const self = this;
        return self.sender.gameState(userId, ws, force);
    }

    sendToast(message, options){
        const self = this;
        self.sender.toast(message, options);
    }

    async sendPlayerUpdate(){
        const self = this;
        await GameBroker.send('playerupdate', {});
    }

    async sendLocationUpdate(runId, oldStateId, newStateId){
        const self = this;
        await GameBroker.send('statechange', {
            runId: runId,
            oldStateId: oldStateId,
            newStateId: newStateId
        });
    }

    async sendGameDataUpdate(runId, userId){
        const self = this;
        await GameBroker.send('gamedata', {
            runId: runId,
            userId: userId
        });
    }

    async clearParticipants(userId){
        const participants = await models.participant.find({user_id:userId});
        return async.each(participants, async (participant) => {
            return models.participant.delete(participant.id);
        });
    }
}

module.exports = GameServer;
