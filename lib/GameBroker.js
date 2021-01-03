'use strict';
const redis = require('redis');
const { promisify } = require('util');
const config = require('config');
const EventEmitter = require('events');


class GameBroker extends EventEmitter{
    constructor(){
        super();
        if (GameBroker._instance) {
            throw new Error('Singleton classes can\'t be instantiated more than once.');
        }
        GameBroker._instance = this;
        const self = this;
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
            this.subscriber.subscribe(this.channel);
        } else {
            this.type = 'local';
        }
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
}

function getClient(){
    let redisClient = null;
    if (config.get('app.redisURL')){
        const redisToGo   = require('url').parse(config.get('app.redisURL'));
        redisClient = redis.createClient(redisToGo.port, redisToGo.hostname);

        redisClient.auth(redisToGo.auth.split(':')[1]);

    } else {
        redisClient = redis.createClient();
    }
    return redisClient;
}

module.exports = new GameBroker();
