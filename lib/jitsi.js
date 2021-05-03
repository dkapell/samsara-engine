'use strict';
const config = require('config');
const aws = require('aws-sdk');
const jwt = require('jsonwebtoken');
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


async function statusServer(){
    if (!(config.get('jitsi.active') && config.get('jitsi.server'))){
        return;
    }
    if(!config.get('jitsi.instance.id')){
        return;
    }
    let status = await cache.check('jitsi-server', config.get('jitsi.instance.id'));

    if (status) { return status; }

    const params = {
        IncludeAllInstances: true,
        InstanceIds: [ config.get('jitsi.instance.id') ]
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
        await cache.store('jitsi-server', config.get('jitsi.instance.id'), status);
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
        return (await statusServer() === 'running');
    }
    return true;
};

async function startServer(){
    if (!(config.get('jitsi.active') && config.get('jitsi.server'))){
        return;
    }
    if(!config.get('jitsi.instance.id')){
        return;
    }

    const status = await statusServer();

    if (status !== 'stopped'){
        return;
    }

    const params = {
        InstanceIds: [ config.get('jitsi.instance.id') ]
    };

    const ec2 = new aws.EC2({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        region: config.get('jitsi.instance.region'),
        signatureVersion: 'v4',
    });

    const request = ec2.startInstances(params);
    const response = await request.promise();

    await cache.invalidate('jitsi-server', config.get('jitsi.instance.id'));
    return response.StartingInstances[0].CurrentState.Name;
}

async function stopServer(){
    if (!(config.get('jitsi.active') && config.get('jitsi.server'))){
        return;
    }
    if(!config.get('jitsi.instance.id')){
        return;
    }

    const status = await statusServer();

    if (status !== 'running'){
        return;
    }

    const params = {
        InstanceIds: [ config.get('jitsi.instance.id') ]
    };

    const ec2 = new aws.EC2({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        region: config.get('jitsi.instance.region'),
        signatureVersion: 'v4',
    });

    const request = ec2.stopInstances(params);
    const response = await request.promise();
    await cache.invalidate('jitsi-server', config.get('jitsi.instance.id'));
    return response.StoppingInstances[0].CurrentState.Name;
}

exports.server = {
    status: statusServer,
    start: startServer,
    stop: stopServer
};
