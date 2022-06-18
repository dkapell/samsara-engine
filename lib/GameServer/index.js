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

        const game = await models.game.getBySite(request.headers.host);

        const gameId = game?game.id:0;

        if (!_.has(self.clients, gameId)){
            self.clients[gameId] = {};
        }

        if (!_.has(self.clients[gameId], userId)){
            self.clients[gameId][userId] = {};
        }
        self.clients[gameId][userId][clientId] = ws;
        if (!gameId){
            ws.send(JSON.stringify({action: 'noserver'}));
            return;
        }
        await models.connection.create({
            user_id: userId,
            server_id: await GameBroker.getId(),
            client_id: clientId,
            game_id: gameId
        });

        GameBroker.send(gameId, 'client.connect', userId);

        // Inbound message from client
        ws.on('message', async function (message) {

            try{
                const user = await models.user.get(gameId, userId);
                const data = JSON.parse(message);
                self.handleMessage(ws, user, gameId, data);
            } catch (err){
                console.trace(err);
                console.log('Invalid JSON received');
            }
        });

        // Client close
        ws.on('close', async function () {
            const user = await models.user.get(gameId, userId);
            if (config.get('webSocket.debug')){
                const user = await models.user.get(gameId, userId);
                console.log(`User ${user.name} disconnected`);
            }
            delete self.clients[gameId][userId][clientId];
            if (!_.keys(self.clients[gameId][userId]).length){
                delete self.clients[gameId][userId];
            }
            if (!_.keys(self.clients[gameId]).length){
                delete self.clients[gameId];
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
                const screen_id = user.player.screen_id;
                await self.sendLocationUpdate(user.player.run_id, null, screen_id);
            }
            GameBroker.send(gameId, 'client.disconnect', userId);
        });

        const user = await models.user.get(gameId, userId);
        if (config.get('webSocket.debug')){
            console.log(`User ${user.name} connected for ${game?game.name:'admin site' }`);
        }

        await self.sender.screen(userId, gameId, ws);
        await self.handlers.meeting.sendCounts(userId, gameId, ws);
        await self.sender.chatLocations(userId, gameId, ws);
        await self.handlers.chat.handleHistory(ws, user, gameId, {});
        if (user.type === 'player'){
            await self.sendLocationUpdate(user.player.run_id, null, user.player.screen_id);
        }
    }

    // Websockets Ping
    ping(){
        const self = this;
        for(const gameId in self.clients){
            for(const userId in self.clients[gameId]){
                for (const clientId in self.clients[gameId][userId]){
                    const ws = self.clients[gameId][userId][clientId];
                    if (ws.isAlive === false){ return ws.terminate(); }
                    ws.isAlive = false;
                    ws.ping(()=>{});
                }
            }
        }
    }

    // Handle message from client
    async handleMessage(ws, user, gameId, data){
        const self = this;
        const oldScreen = await gameEngine.getScreen(user.id, gameId);
        let force = false;
        switch(data.action){
            case 'code': force = await self.handleCode(ws, user, gameId, data); break;
            case 'area': force = await self.handleArea(ws, user, gameId, data); break;
            case 'chat': await self.handlers.chat.handle(ws, user, gameId, data); break;
            case 'history': await self.handlers.chat.handleHistory(ws, user, gameId, data); break;
            case 'meeting': await self.handlers.meeting.handle(ws, user, gameId, data); break;
            case 'ink': await self.handlers.ink.handle(ws, user, gameId, data); break;
        }

        if (user.player){
            const newScreen = await gameEngine.getScreen(user.id, gameId);

            if (oldScreen.current.id !== newScreen.current.id || force){
                await self.sender.screen(user.id, gameId, null, force);
                await self.handlers.meeting.sendCounts(user.id, gameId, null);

                await self.sendLocationUpdate(user.player.run_id, oldScreen.current.id, newScreen.current.id);
            }
            if( newScreen.transitioning ){
                GameBroker.send(gameId, 'cleartimer', {
                    user_id: user.id,
                    source: self.serverId
                });
                await self.sendPlayerUpdate(gameId);
                if (_.has(self.playerTimers, user.id)){
                    clearTimeout(self.playerTimers[user.id]);
                }

                self.playerTimers[user.id] = setTimeout(async () => {
                    await self.sendScreen(user.id, gameId, null, force);
                    await self.sendLocationUpdate(user.player.run_id, oldScreen.current.id, newScreen.current.id);
                }, (new Date(newScreen.player.statetime).getTime() - new Date().getTime()));
            }
        }
    }

    // Run a trigger on a specific user
    async runTrigger(trigger, user, gameId){
        const self = this;
        if (user.type !== 'player'){
            return;
        }

        const oldScreen = await gameEngine.getScreen(user.id, gameId);
        const actions = await gameEngine.runTrigger(trigger.id, user.id, gameId);
        let force = false;
        for(const action of actions){
            force = await self.handleActions(null, user, gameId, actions);
        }

        const newScreen = await gameEngine.getScreen(user.id, gameId);

        if (oldScreen.current.id !== newScreen.current.id){
            await self.sendScreen(user.id, gameId, null, force);
            await self.sendLocationUpdate(user.player.run_id, oldScreen.current.id, newScreen.current.id);
        } else if( newScreen.transitioning ){
            GameBroker.send(gameId, 'cleartimer', {
                user_id: user.id,
                source: self.serverId
            });
            if (_.has(self.playerTimers, user.id)){
                clearTimeout(self.playerTimers[user.id]);
            }

            self.playerTimers[user.id] = setTimeout(async () => {
                await self.sendScreen(user.id, gameId, null, force);
                await self.sendLocationUpdate(user.player.run_id, oldScreen.current.id, newScreen.current.id);
            }, (new Date(newScreen.player.statetime).getTime() - new Date().getTime()));

        }
    }

    // Handle a client submitting a code
    async handleCode(ws, user, gameId, data){
        if (user.type !== 'player'){
            return;
        }
        try{
            const actions = await gameEngine.openCode(data.code, user.id, gameId);
            ws.send(JSON.stringify({codeAccept:true}));
            let force = false;
            if (actions){
                force = await self.handleActions(ws, user, gameId, actions);
            }
            return force;
        } catch (err){
            const doc = {
                action: 'code error',
                retry: false,
                error: err.message
            };
            console.trace(err);
            ws.send(JSON.stringify(doc));
            return false;
        }
    }

    // Handle a client clicking an area
    async handleArea(ws, user, gameId, data){
        const self = this;
        if (user.type !== 'player'){
            return;
        }
        try{
            const actions = await gameEngine.openArea(data.areaId, user.id, gameId);
            let force = false;
            if (actions){
                force = await self.handleActions(ws, user, gameId, actions);
            }
            return force;
        } catch(err){
            const doc = {
                action: 'area error',
                retry: false,
                error: err.message
            };
            console.trace(err);
            return ws.send(JSON.stringify(doc));
        }
    }

    // Interpret action results from gameEngine
    async handleActions(ws, user, gameId, actions){
        const self = this;
        let force = false;
        for(const action of actions){
            if (action.force) { force = action.force; }
            if (action.action === 'load' && ws){
                ws.send(JSON.stringify(action));
            } else if (action.action === 'runupdate'){
                await self.sendGameDataUpdate(action.run_id);
                await self.sendPlayerUpdate(gameId);
            } else if (action.action === 'playerupdate'){
                await self.sendGameDataUpdate(action.run_id, user.id);
                await self.sendPlayerUpdate(gameId);
            } else if (action.action === 'ink'){
                await self.handlers.ink.run(action.ink_id, user, gameId, action.options);
            } else if (action.action !== 'none'){
                self.sender.action(user.id, action, gameId);
            }
        }
        return force;
    }

    async updateChatLocations(gameId){
        const self = this;
        for (const userId in self.clients[gameId]){
            await self.sender.chatLocations(userId, gameId);
        }
    }

    async updateMeetingCounts(gameId){
        const self = this;
        for (const userId in self.clients){
            await self.handlers.meeting.sendCounts(userId, gameId);
        }
    }

    async sendScreen(userId, gameId, ws, force){
        const self = this;
        return self.sender.screen(userId, gameId, ws, force);
    }

    sendToast(message, options, gameId){
        const self = this;
        self.sender.toast(message, options, gameId);
    }

    async sendPlayerUpdate(gameId){
        const self = this;
        await GameBroker.send(gameId, 'playerupdate', {});
    }

    async sendLocationUpdate(runId, oldScreenId, newScreenId){
        const self = this;
        const run = await models.run.get(runId);
        await GameBroker.send(run.game_id, 'screenchange', {
            runId: runId,
            oldScreenId: oldScreenId,
            newScreenId: newScreenId
        });
    }

    async sendGameDataUpdate(runId, userId){
        const self = this;
        const run = await models.run.get(runId);
        await GameBroker.send(run.game_id, 'gamedata', {
            runId: runId,
            userId: userId
        });
    }
}

module.exports = GameServer;
