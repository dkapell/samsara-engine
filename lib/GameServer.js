'use strict';
const _ = require('underscore');
const config = require('config');
const WebSocket = require('ws');
const uuid = require('uuid');
const util = require('util');
const models = require('./models');
const gameEngine = require('./gameEngine');
const script = require('./script');
const chat = require('./chat');
const GameBroker = require('./GameBroker');
const async = require('async');

const defaultJSON = {
    player: false,
    action: 'show default',
    chatSidebar:false,
};

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
            await self.handleBrokeredMessage(data);
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
            ws.send(JSON.stringify(defaultJSON));
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

        await self.sendGameState(userId, ws);
        await self.sendChatLocations(userId, ws);
        await self.handleChatHistory(ws, user, {});
        if (user.type === 'player'){
            await self.sendGameData(user.player.run_id);
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
            case 'chat': await self.handleChat(ws, user, data); break;
            case 'history': await self.handleChatHistory(ws, user, data); break;
        }

        if (user.player){
            const newGamestate = await gameEngine.getGameState(user.id);

            if (oldGamestate.current.id !== newGamestate.current.id || force){
                await self.sendGameState(user.id, null, force);
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
            if (action.force) { force = action.force; }
            if (action.action === 'runupdate'){
                await self.sendGameDataUpdate(action.run_id);
                await self.sendPlayerUpdate();
            } else if (action.action === 'playerupdate'){
                await self.sendGameDataUpdate(action.run_id, user.id);
                await self.sendPlayerUpdate();
            } else if (action.action !== 'none'){
                GameBroker.send('action', {
                    userId:user.id,
                    action: JSON.stringify(action)
                });
            }
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
                for(const action of actions){
                    if (action.force) { force = action.force; }
                    if (action.action === 'load'){
                        ws.send(JSON.stringify(action));
                    } else if (action.action === 'runupdate'){
                        await self.sendGameDataUpdate(action.run_id);
                        await self.sendPlayerUpdate();
                    } else if (action.action === 'playerupdate'){
                        await self.sendGameDataUpdate(action.run_id, user.id);
                        await self.sendPlayerUpdate();
                    } else if (action.action !== 'none'){
                        GameBroker.send('action', {
                            userId:user.id,
                            action: JSON.stringify(action)
                        });
                    }
                }
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
                for(const action of actions){
                    if (action.force) { force = action.force; }
                    if (action.action === 'load'){
                        ws.send(JSON.stringify(action));
                    } else if (action.action === 'runupdate'){
                        await self.sendGameDataUpdate(action.run_id);
                        await self.sendPlayerUpdate();
                    } else if (action.action === 'playerupdate'){
                        await self.sendGameDataUpdate(action.run_id, user.id);
                        await self.sendPlayerUpdate();
                    } else if (action.action !== 'none'){
                        GameBroker.send('action', {
                            userId:user.id,
                            action: JSON.stringify(action)
                        });
                    }
                }
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

    // Handle chat messages
    async handleChat(ws, user, data){
        const self = this;
        if(user.type === 'none'){ return; }
        try{
            const message = await chat.handler(user, data);
            if (message){
                GameBroker.send('message', message);
            }
        } catch(err){
            console.trace(err);
            const doc = {
                action: 'chat error',
                retry: true,
                error: err.message,
            };
            return ws.send(JSON.stringify(doc));
        }
    }


    // Handle chat history requests
    async handleChatHistory(ws, user, data){
        let messageHistory = await chat.getHistory(user, data.options);
        if (user.type === 'player'){
            messageHistory = messageHistory.map(formatPlayerMessage);
        }
        ws.send(JSON.stringify({
            action: 'chat',
            history:true,
            messages: messageHistory,
            read: await chat.getRead(user),
            block: await chat.getBlocks(user),
            userId: user.id
        }));
    }


    // Handle message from the broker
    async handleBrokeredMessage(data){
        const self = this;
        try{
            switch(data.type){
                case 'message': {
                    if (data.payload.type === 'report'){
                        const staff = await models.user.listGms();
                        await async.each(staff, async user => {
                            return self.sendChat(user.id, data.payload.report);
                        });
                        if (data.payload.action === 'remove'){
                            await self.removeMessage(data.payload.report.message_id);
                        }
                    } else {
                        const playerMessage = formatPlayerMessage(data.payload);
                        const recipients = await chat.getRecipients(data.payload);
                        await async.each(recipients, async userId => {
                            const recipient = await models.user.get(userId);
                            return self.sendChat(userId, recipient.type==='player'?playerMessage:data.payload);
                        });
                    }
                    break;
                }

                case 'statechange': {
                    const staff = await models.user.listGms();
                    // Send updated gamestate counts to all players
                    await self.sendGameData(data.payload.runId);

                    await async.each(staff, async user => {
                        self.sendChatLocations(user.id);
                    });

                    let players = [];
                    if (!data.payload.run_id || !data.payload.newStateId){
                        await async.each(_.keys(self.clients), async userId => {
                            if (_.findWhere(staff, {id:Number(userId)})){
                                return;
                            }
                            return self.sendChatLocations(userId);
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
                        self.sendChatLocations(player.user_id);
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
                    self.sendMessage(data.payload.action, data.payload.userId);
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
                        await self.sendGameData(data.payload.runId, data.payload.userId);
                    } else {
                        await self.sendGameData(data.payload.runId);
                    }
                    break;
                }
                case 'playerupdate': {
                    const staff = await models.user.listGms();
                    async.each(staff, async user => {
                        const doc = JSON.stringify({
                            action: 'playerupdate',
                        });
                        self.sendMessage(doc, user.id);
                    });

                }
            }
        } catch (err) {
            console.trace(err);
        }
    }

    async sendChat(userId, message, ws){
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
            self.sendMessage(doc, userId);
        }
    }

    async sendGameState(userId, ws, force){
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

    async sendChatLocations(userId, ws){
        const self = this;
        const doc = JSON.stringify({
            action: 'chat',
            locations: await chat.getLocations(userId),
            userId: userId
        });
        if (ws){
            ws.send(doc);
        } else {
            self.sendMessage(doc, userId);
        }
    }

    async sendGameData(runId, userId){
        const self = this;
        // Send updated gamestate counts
        const gamestateCounts = await gameEngine.getGamestateCounts(runId);
        let players = [];
        if (userId){
            const player = await models.player.get(userId);
            if(player){
                players.push(player);
            }
        } else {
            players = await models.player.find({run_id:runId});
        }
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
                    }
                }
            });
            self.sendMessage(doc, player.user_id);
        });
    }

    sendMessage(message, userId){
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

    async updateChatLocations(){
        const self = this;
        for (const userId in self.clients){
            await self.sendChatLocations(userId);
        }
    }

    async getPlayerGameState(userId, force){
        const self = this;
        const gamestate = (await gameEngine.getGameState(userId));
        const current = gamestate.current;
        if (!current){
            const doc = _.clone(defaultJSON);
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
                doc.gamestate.map.push({
                    id: area.uuid,
                    shape: area.shape,
                    coords: area.coords,
                    name: area.name
                });
            }
        }
        return doc;
    }

    sendToast(message, options){
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

    async sendToBroker(type, data){
        return GameBroker.send(type, data);
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

    async removeMessage(message_id, options){
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
            self.sendMessage(doc, options.userId);
        }
    }
}

function formatPlayerMessage(message){
    return {
        message_id: message.message_id,
        location: message.location,
        location_id: message.location_id,
        location_name: message.location_name,
        content: message.content,
        created: message.created,
        user_id: message.user_id,
        user_type: message.user_type === 'player' ? 'player': 'staff',
        recipient_type: 'player',
        sender: message.sender.player,
        self:message.self
    };
}


module.exports = GameServer;


