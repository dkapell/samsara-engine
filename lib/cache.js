'use strict'
const _ = require('underscore');

const memCache = {};

const defaultTimeout = 60;

exports.store = function store(name, id, data, timeout){
    const expires = new Date();
    if(!name || !id || !data) { return; }
    timeout = timeout?timeout:defaultTimeout;
    expires.setSeconds(expires.getSeconds() + timeout);
    if (!_.has(memCache, name)){
        memCache[name] = {};
    }
    memCache[name][id.toString()] = {
        data: JSON.parse(JSON.stringify(data)),
        expires: expires.getTime(),
    };
}

exports.check = function check(name, id){
    id = id.toString();
    if (_.has(memCache, name) && _.has(memCache[name], id) && memCache[name][id].expires > (new Date()).getTime()){
        return memCache[name][id].data;
    }
    console.log(`cache miss ${name}:${id}`);

    return null;
}

exports.invalidate = function invalidate(name, id){
    if (id){
        delete memCache[name][id];
    } else {
        delete memCache[name];
    }
}
