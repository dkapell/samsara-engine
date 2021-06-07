'use strict';

const _ = require('underscore');
const EventEmitter = require('events');
const ws = require('ws');
const bent = require('bent');
const tough = require('tough-cookie');
const config = require('config');
const querystring = require('querystring');

class WSClient extends EventEmitter{
    constructor(options){
        super();
        this.server = options.server;
        this.user = options.user;
        this.secure = _.has(options, 'secure')?options.secure:true;
        this.cookiejar = new tough.CookieJar();
        this.messages = [];
        this.messageCounts = {};
        this.baseURL = `${this.secure?'https':'http'}://${this.server}`;

    }

    async connect(){
        const self = this;
        const result = await self.request('POST', '/auth/token', {apikey:`${config.get('auth.local.key')}/${self.user.id}`});

        const options = {headers:{}};
        options.headers.Cookie = self.cookiejar.getCookieStringSync(self.baseURL);
        const client = new ws(`${self.secure?'wss':'ws'}://${self.server}`, options);

        client.on('message', function(data){
            const message = JSON.parse(data);
            self.messages.push(message);
            if (!_.has(self.messageCounts, message.action)){
                self.messageCounts[message.action] = 0;
            }
            self.messageCounts[message.action]++;
            self.emit('message', {message: message, count: self.messageCounts[message.action], total: self.messages.length});
        });
        return true;
    }

    async request(){
        const self = this;
        const method = arguments[0];
        const path = arguments[1];
        let data = null;
        if (arguments.length === 3){
            data = arguments[2];
        }

        let url =  '/' + path.replace(/^\//, '');
        const headers = {};
        headers.Cookie = self.cookiejar.getCookieStringSync(self.baseURL);

        if (method.match(/get/i)){
            if (data){
                url += '?' + querystring.stringify(data);
            }

            const get = bent(self.baseURL, headers, 200, 302);

            let result = await get(url);

            for (const cookie of result.headers['set-cookie'].map(tough.Cookie.parse)){
                self.cookiejar.setCookieSync(cookie, self.baseURL);
            }
            switch (result.status){
                case 200:
                    return await result.json();
                case 302:
                    result = await get(result.headers.location);
                    return await result.json();
                default:
                    throw new Error('Invalid status code ' + result.status);
            }
        } else {
            const body = {
                _method: method.toUpperCase(),
            };

            if (data){
                for (const key in data){
                    body[key] = data[key];
                }
            }
            const post = bent('POST', self.baseURL, headers, 200, 201, 301);
            const result =  await post(url, body);
            for (const cookie of result.headers['set-cookie'].map(tough.Cookie.parse)){
                self.cookiejar.setCookieSync(cookie, self.baseURL);
            }
            return result.json();
        }
    }
}

module.exports = WSClient;
