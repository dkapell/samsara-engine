'use strict';
const _ = require('underscore');
const config = require('config');
const aws = require('aws-sdk');
const jwt = require('jsonwebtoken');
const async = require('async');
const cache = require('./cache');


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
    let status = await cache.check('jitsi-server', instanceId);
    if (status) { return status; }

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
        await cache.store('jitsi-server', instanceId, status);
    }
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

exports.server = {
    status: statusServers,
    start: startServers,
    stop: stopServers
};
