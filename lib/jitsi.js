'use strict';
const _ = require('underscore');
const config = require('config');
const aws = require('aws-sdk');
const jwt = require('jsonwebtoken');
const bent = require('bent');
const async = require('async');
const cache = require('./cache');
const models = require('./models');
const semaphore = require('await-semaphore');

const statusSemaphore = new semaphore.Semaphore(1);

exports.token = function(room){
    if (!(config.get('jitsi.server'))){
        return;
    }
    const jwtConfig = config.get('jitsi.jwt');
    const doc = {
        iss: jwtConfig.issuer,
        room: room,
        exp: Math.floor(Date.now() / 1000) + jwtConfig.duration,
        sub: config.get('jitsi.server'),
        aud: jwtConfig.audience,
    };
    const token = jwt.sign(doc, jwtConfig.secret);
    return token;
};

async function statusServers(){
    if (!(config.get('jitsi.active') && config.get('jitsi.server'))){
        return;
    }
    if(!config.get('jitsi.instance.id')){
        return;
    }

    let videobridges = [];
    if (config.get('jitsi.instance.videobridges')){
        videobridges = config.get('jitsi.instance.videobridges').split(/\s*,\s*/);
    }

    return {
        instance: await checkServerStatus(config.get('jitsi.instance.id')),
        videobridges: await async.reduce(videobridges, {}, async function(memo, instanceId){
            memo[instanceId] = await checkServerStatus(instanceId);
            return memo;
        })
    };
}

async function checkServerStatus(instanceId){
    const release = await statusSemaphore.acquire();
    let status = await cache.check('jitsi-server', instanceId);
    if (status) {
        release();
        return status;
    }
    const params = {
        IncludeAllInstances: true,
        InstanceIds: [ instanceId ]
    };

    const ec2 = new aws.EC2({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',
        region: config.get('jitsi.instance.region'),
    });
    const request = ec2.describeInstanceStatus(params);
    const response = await request.promise();
    status = response.InstanceStatuses[0].InstanceState.Name;
    if (status === 'stopped' || status === 'running'){
        await cache.store('jitsi-server', instanceId, status, 300);
    }
    release();
    return status;
}

exports.active = async function(){
    if (!config.get('jitsi.active')){
        return false;
    }
    if (!config.get('jitsi.server')){
        return false;
    }
    if(config.get('jitsi.instance.id')){
        const status = await statusServers();
        if (status.instance === 'running'){
            return true;
        }
        return false;
    }
    return true;
};

async function startServers(videobridgeCount){
    if (!(config.get('jitsi.active') && config.get('jitsi.server'))){
        return;
    }
    if(!config.get('jitsi.instance.id')){
        return;
    }
    await startServer(config.get('jitsi.instance.id'));

    if (videobridgeCount && config.get('jitsi.instance.videobridges')){
        const videobridges = (await statusServers()).videobridges;

        if (videobridgeCount > videobridges.length){
            videobridgeCount = videobridges.length;
        }

        let running = (_.keys(_.pick(videobridges, function(value, key) {
            return (value === 'running' || value === 'pending');
        }))).length;
        const stopped = _.pick(videobridges, function(value, key) {return value === 'stopped'; });

        for (const instanceId in stopped){
            console.log(`looking to start ${instanceId}`);
            if (running >= videobridgeCount){
                break;
            }
            await startServer(instanceId);
            running++;
        }
    }
}

async function startServer(instanceId){

    if( await checkServerStatus(instanceId) !== 'stopped'){
        return;
    }

    const params = {
        InstanceIds: [ instanceId ]
    };

    const ec2 = new aws.EC2({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        region: config.get('jitsi.instance.region'),
        signatureVersion: 'v4',
    });

    const request = ec2.startInstances(params);
    const response = await request.promise();

    await cache.invalidate('jitsi-server', instanceId);
    return response.StartingInstances[0].CurrentState.Name;
}

async function stopServers(){
    if (!(config.get('jitsi.active') && config.get('jitsi.server'))){
        return;
    }
    if(!config.get('jitsi.instance.id')){
        return;
    }

    await stopServer(config.get('jitsi.instance.id'));

    if (config.get('jitsi.instance.videobridges')){
        const instances = config.get('jitsi.instance.videobridges').split(/\s*,\s*/);
        await async.map(instances, stopServer);
    }
    const participants = await models.participant.find();
    return async.each(participants, async (participant) => {
        return models.participant.delete(participant.id);
    });

}

async function stopServer(instanceId){
    if ( await checkServerStatus(instanceId) !== 'running'){
        return;
    }

    const params = {
        InstanceIds: [ instanceId ]
    };

    const ec2 = new aws.EC2({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        region: config.get('jitsi.instance.region'),
        signatureVersion: 'v4',
    });

    const request = ec2.stopInstances(params);
    const response = await request.promise();
    await cache.invalidate('jitsi-server', instanceId);
    return response.StoppingInstances[0].CurrentState.Name;
}

exports.rooms = async function(){

    const auth = config.get('jitsi.auth');
    const headers = {
        Authorization: 'Basic ' + Buffer.from(auth.username + ':' + auth.password).toString('base64')
    };
    const get = bent(`https://${config.get('jitsi.server')}`, headers, 200);
    let result = await get('/rooms.txt');
    switch (result.status){
        case 200:
            return parseRooms(await result.text());
        default:
            throw new Error('Invalid status code ' + result.status);
    }
};

function parseRooms(text){
    const rooms = {};
    for(const line of text.split(/\n/)){
        if(line.match(/^\d{4}-\d{2}/)){
            const parts = line.split(/\s+/);
            rooms[parts[1]] = Number(parts[3]);
        }
    }
    return rooms;
}

exports.server = {
    status: statusServers,
    start: startServers,
    stop: stopServers
};
