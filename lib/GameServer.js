'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');
const WebSocket = require('ws');
const uuid = require('uuid');
const util = require('util');
const gameEngine = require('../lib/gameEngine');


const defaultJSON = {
    player: false,
    action: 'show default'
};
class GameServer {
    constructor(server, app){
        this.wss = new WebSocket.Server({ clientTracking: false, noServer: true });
        this.clients = {};
        this.app = app;
        this.server = server;
        this.init();
    }

    init() {
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
    }

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
        const user = await models.user.get(userId);
        const clientId = uuid.v4();
        if (config.get('webSocket.debug')){
            console.log(`User ${user.name} connected`);
        }
        if (!_.has(self.clients, userId)){
            self.clients[userId] = {};
        }
        self.clients[userId][clientId] = ws;

        ws.on('message', function (message) {
            try{
                const data = JSON.parse(message);
                self.handleMessage(ws, user, data);
            } catch (err){
                console.log('Invalid JSON received');
            }
        });

        ws.on('close', function () {
            if (config.get('webSocket.debug')){
                console.log(`User ${user.name} disconnected`);
            }
            delete self.clients[userId][clientId];
            if (!_.keys(self.clients[userId]).length){
                delete self.clients[userId];
            }
        });

        self.sendGameState(userId, ws);
    }

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

    async handleMessage(ws, user, data){
        const self = this;
        const oldGamestate = await gameEngine.getGameState(user.id);
        switch(data.action){
            case 'code': await self.handleCode(ws, user, data); break;
            case 'area': await self.handleArea(ws, user, data); break;
        }


        const newGamestate = await gameEngine.getGameState(user.id);

        if (oldGamestate.current.id !== newGamestate.current.id){
            self.sendGameState(user.id);
        } else if( newGamestate.transitioning ){
            setTimeout(() => {
                self.sendGameState(user.id);
            }, (new Date(newGamestate.player.statetime).getTime() - new Date().getTime()));
        }
    }

    async handleCode(ws, user, data){
        if (user.type !== 'player'){
            return;
        }
        try{
            const actions = await gameEngine.openCode(data.code, user.id);
            ws.send(JSON.stringify({codeAccept:true}));
            if (actions){

                for(const action of actions){
                    ws.send(JSON.stringify(action));
                }
            }
        } catch (err){
            const doc = {
                action: 'code error',
                retry: false,
                error: err.message
            };
            if (err.message === config.get('game.linkName') + ' is not active'){
                doc.retry = true;
            }
            return ws.send(JSON.stringify(doc));
        }
    }

    async handleArea(ws, user, data){
        const self = this;
        if (user.type !== 'player'){
            return;
        }
        try{
            const areaId = Number(data.areaId);
            const actions = await gameEngine.openArea(areaId, user.id);
            if (actions){
                for(const action of actions){
                    ws.send(JSON.stringify(action));
                }
            }
        } catch(err){
            const doc = {
                action: 'area error',
                retry: false,
                error: err.message
            };
            return ws.send(JSON.stringify(doc));
        }
    }

    async sendGameState(userId, ws){
        const self = this;
        const playerGameState = JSON.stringify(await self.getPlayerGameState(userId));
        if (ws){
            ws.send(playerGameState);
        } else {
            for (const clientId in self.clients[userId]){
                self.clients[userId][clientId].send(playerGameState);
            }
        }
    }

    async getPlayerGameState(userId){
        const self = this;
        const gamestate = (await gameEngine.getGameState(userId)).current;
        if (!gamestate){
            return defaultJSON;
        }

        const doc = {
            player: true,
            action: 'show page',
            gamestate:{
                id: gamestate.id,
                description: gamestate.description,
                showCode: gamestate.codes && gamestate.codes.length > 0
            }
        };

        if (gamestate.image_id){
            doc.gamestate.image_id = gamestate.image_id;
            doc.gamestate.image = { url: gamestate.image.url };

            doc.gamestate.map = [];
            for (const area of gamestate.map){
                doc.gamestate.map.push({
                    id: area.id,
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

        } else if (_.has(options, 'userId')){
            const userId = options.userId.toString();

            const promises = [];
            for (const clientId in self.clients[userId]){
                self.clients[userId][clientId].send(doc);
            }

        } else {
            for (const userId in self.clients){
                for (const clientId in self.clients[userId]){
                    self.clients[userId][clientId].send(doc);
                }
            }
        }

    }

}

module.exports = GameServer;


