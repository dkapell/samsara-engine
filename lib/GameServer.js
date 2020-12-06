'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');
const WebSocket = require('ws');
const uuid = require('uuid');
const gameEngine = require('../lib/gameEngine');

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
                if (!request.session.passport || !request.session.passport.user) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }
                self.wss.handleUpgrade(request, socket, head, function (ws) {
                    self.wss.emit('connection', ws, request);
                });
            });
        });

        self.wss.on('connection', async function(ws, request){
            await self.handleConnection(ws, request);
        });

        const interval = setInterval(self.ping, 10000);

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
        let userId = request.session.passport.user;
        if (request.session.assumed_user && request.session.assumed_user.type === 'player'){
            userId = request.session.assumed_user.id;
        }
        const user = await models.user.get(userId);
        const clientId = uuid.v4();

        console.log(`User ${user.name} connected`);
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
            console.log(`User ${user.name} disconnected`);
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
            const result = await gameEngine.openCode(data.code, user.id);

            if(!result){
                throw new Error(config.get('game.linkName') + ' not found');
            }
            if (result.link.url === 'stub'){
                return ws.send(JSON.stringify({
                    action: 'load',
                    url:'/stub/' + result.link.id,
                    codeAccept: true
                }));
            } else {
                return ws.send(JSON.stringify({
                    action: 'load',
                    url: result.link.url,
                    codeAccept: true
                }));
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
            const actions = await gameEngine.checkArea(areaId, user.id);
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
            return {
                player: false,
                action: 'show default'
            };
        }



        const doc = {
            player: true,
            action: 'show page',
            gamestate:{
                id: gamestate.id,
                description: gamestate.description,
                showCode: gamestate.links && gamestate.links.length > 0
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
}

module.exports = GameServer;


