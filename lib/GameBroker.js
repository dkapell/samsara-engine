'use strict';
const redis = require('redis');
const { promisify } = require('util');
const config = require('config');
const EventEmitter = require('events');
const uuid = require('uuid');
const _ = require('underscore');
const models = require('./models');


class GameBroker extends EventEmitter{
    constructor(){
        super();
        if (GameBroker._instance) {
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        GameBroker._instance = this;
        const self = this;
        const id = uuid.v4();
        if (config.get('game.brokerType') === 'redis'){
            this.type = 'redis';
            this.channel = config.get('game.channel');
            this.subscriber = getClient();
            this.subscriber.on('error', function(error) {
                console.error(error);
            });
            this.publisher = getClient();
            this.publisher.on('error', function(error) {
                console.error(error);
            });
            this.subscriber.on('message', function(channel, message){
                self.handleMessage(channel, message);
            });
            this.subscribe();
            this.subscriber.subscribe(this.channel);
        } else {
            this.type = 'local';
        }
    }

    async subscribe(){
        const self = this;
        const clientAsync = promisify(self.subscriber.client).bind(self.subscriber);
        self.id = clientAsync('id');
        await self.subscriber.subscribe(self.channel);
        self.ready = true;
    }

    handleMessage(channel, message) {
        const self = this;
        try{
            const data = JSON.parse(message);
            self.emit('message', data);
        } catch (err){
            console.trace(err);
        }
    }

    async send(type, data){
        const self = this;
        if (self.type === 'redis'){
            const publishAsync = promisify(self.publisher.publish).bind(self.publisher);
            await publishAsync(self.channel, JSON.stringify({type: type, payload: data}));
        } else {
            self.emit('message', data);
        }
    }

    async pubId(){
        const self = this;
        if (self.type === 'redis'){
            const idAsync = promisify(self.publisher.client).bind(self.publisher);
            return await idAsync('id');

        } else {
            return self.id;
        }
    }

    async getId(){
        const self = this;
        if (Promise.resolve(self.id) === self.id){
            self.id = await self.id;
        }
        return self.id;
    }

    async clean(){
        const self = this;
        const connections = await models.connection.list();
        const active = await self.clients();
        for (const connection of connections){
            if (!_.findWhere(active, {id: connection.server_id.toString()})){
                await models.connection.delete(connection.id);
            }
        }
    }

    async clients(){
        const self = this;
        if (self.type === 'redis'){
            const clientAsync = promisify(self.publisher.client).bind(self.publisher);
            const data = await clientAsync('list');
            return data.trim().split('\n').map(row => {
                return row.split(/\s+/).reduce((o, e) => {
                    const [key, value] = e.split(/=/);
                    o[key] = value;
                    return o;
                }, {});

            });

        } else {
            return self.id;
        }
    }
}

function getClient(){
    let redisClient = null;
    if (config.get('app.redis.url')){
        const options = {};
        if (config.get('app.redis.tls')){
            options.tls = {rejectUnauthorized: false};
        }
        redisClient = redis.createClient(config.get('app.redis.url'), options);

    } else {
        redisClient = redis.createClient();
    }
    return redisClient;
}

module.exports = new GameBroker();
