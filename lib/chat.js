'use strict';

const _ = require('underscore');
const uuid = require('uuid');
const xssEscape = require('xss-escape');
const models = require('./models');
const async = require('async');

exports.handler = async function message(user, data){
    switch(data.type){
        case 'message':
            return await chatMessage(user, data);
        case 'read':
            return await chatRead(user, data);
        case 'block':
            return await exports.addBlock(user, data.user_id);
        case 'unblock':
            return await exports.clearBlock(user, data.user_id);
        case 'report':
            return await exports.reportMessage(user, data);
        case 'report-ignore':
            return await exports.ignoreReport(user, data);
        case 'report-remove':
            return await exports.removeReportedMessage(user, data);
        case 'report-clear':
            return await exports.clearReport(user, data);
    }
};

async function chatMessage(user, data){
    let location = data.location;
    let location_id = data.location_id;
    let content = data.content;
    if (user.player){
        if (location === 'gamestate'){
            if (new Date().getTime() < new Date(user.player.statetime).getTime()){
                location_id = user.player.prev_gamestate_id;
            } else {
                location_id = user.player.gamestate_id;
            }
        }
        if(location === 'group' && !_.findWhere(user.player.groups, {id: location_id})){
            return;
        }
    }

    if (!location.match(/^(gamestate|direct|group|gm)$/)){
        return false;
    }

    if (location === 'gamestate'){
        const gamestate = await models.gamestate.get(location_id);
        if (gamestate.start || gamestate.finish || !gamestate.chat){
            return;
        }
    }

    const doc = {
        message_id: uuid.v4(),
        run_id: user.player?user.player.run_id:(await models.run.getCurrent()).id,
        location: location,
        location_id: location!=='gm'?Number(location_id):null,
        content: xssEscape(content),
        user_id: user.id,
    };

    const id = await models.message.create(doc);
    const message = await models.message.get(id);
    await chatRead(user, message);
    return await fillMessage(message);
}

async function chatRead(user, data){
    const doc = {
        user_id: user.id,
        location: data.location,
        message_id: data.message_id,
        seen: new Date(),
        emailed: false,
    };

    await models.read_message.upsert(doc);
}

async function fillMessage(message, cache){
    if (message.type === 'report'){
        message.message = await fillMessage(await models.message.findOne({message_id:message.message_id}), cache);
        message.reporter = getDisplayName(await getValue('user', message.user_id));
        if (message.resolved_by){
            message.resolver = getDisplayName(await getValue('user', message.resolved_by));
        }
    } else {
        switch (message.location){
            case 'group': {
                const group = await getValue('group', message.location_id);
                if (group){
                    message.location_name = group.name;
                } else {
                    message.location_name = 'Deleted Group';
                }
                break;
            }
            case 'gamestate': {
                const gamestate = await getValue('gamestate', message.location_id);
                if (gamestate){
                    message.location_name = gamestate.name;
                } else {
                    message.location_name = 'Deleted Gamestate';
                }
                break;
            }
            case 'direct': {
                const name = getDisplayName(await getValue('user', message.location_id));
                message.location_fullname = name.full;
                message.location_name = name.player;
                break;
            }
            default:
                message.location_name = null;
        }
        message.sender = getDisplayName(await getValue('user', message.user_id));
    }
    return message;

    async function getValue(type, id){
        id = Number(id);

        if (cache && cache[type] && _.findWhere(cache[type], {id:id})){
            return _.findWhere(cache[type], {id:id});
        }
        const data = await models[type].get(id);
        if (cache && cache[type]){
            cache[type].push(data);
        }
        return data;
    }
}

exports.getRecipients = async function getRecipients(message){
    let  recipients = [message.user_id];
    const users = await models.user.listGms();
    recipients = recipients.concat(_.pluck(users, 'id'));
    switch(message.location){
        case 'gamestate': {
            let currentPlayers = await models.player.find({gamestate_id: message.location_id, run_id:message.run_id});
            let prevPlayers = await models.player.find({prev_gamestate_id: message.location_id, run_id:message.run_id});

            currentPlayers = currentPlayers.filter( player => {
                return (new Date().getTime() > new Date(player.statetime).getTime());
            });

            prevPlayers = prevPlayers.filter( player => {
                return (new Date().getTime() < new Date(player.statetime).getTime());
            });

            recipients = recipients.concat(_.pluck(currentPlayers, 'user_id'));
            recipients = recipients.concat(_.pluck(prevPlayers, 'user_id'));
            break;
        }

        case 'group':{
            const players = await models.player.listByGroupAndRun(message.location_id, message.run_id);
            recipients = recipients.concat(_.pluck(players, 'user_id'));
            break;
        }

        case 'gm':{
            break;
        }

        case 'direct':{
            recipients.push(message.location_id);
            break;
        }
    }
    return _.uniq(recipients);
};

exports.getHistory = async function getHistory(user, options){
    const run = await models.run.getCurrent();
    let messages = [];
    if (!options){
        options = {};
    }

    if (!options.type || options.type === 'direct'){
        for (const message of await models.message.find({location:'direct', location_id:user.id})){
            messages.push(message);
        }

        for (const message of await models.message.find({location:'direct', user_id:user.id})){
            messages.push(message);
        }
    }
    if (user.player){
        if (!options.type || options.type === 'group'){
            const groups = await async.mapLimit(user.player.groups, 5, async group => {
                return models.message.find({location:'group', location_id:group.id, run_id: user.player.run_id});
            });
            for (const group of groups){
                for (const message of group){
                    messages.push(message);
                }
            }
        }
        if (!options.type || options.type === 'gamestate'){

            for (const message of await models.message.find({location:'gamestate', location_id: user.player.gamestate_id, run_id: user.player.run_id})){
                if (new Date(message.created) > new Date(user.player.statetime)){
                    messages.push(message);
                }
            }
        }
        if (!options.type || options.type === 'gm'){
            for (const message of await models.message.find({location:'gm', user_id:user.id}, {limit:getLimit('gm', 40, options)})) {
                messages.push(message);
            }
        }

    } else if (user.type !== 'none'){
        if (!options.type || options.type === 'gm'){
            for (const message of await models.message.find({location:'gm'}, {limit:getLimit('gm', 40, options)})) {
                messages.push(message);
            }
        }
        if (!options.type || options.type === 'gamestate'){

            for (const message of await models.message.find({location:'gamestate', run_id: run.id},  {limit:getLimit('gamestate', 100, options)})){
                messages.push(message);
            }
        }
        if (!options.type || options.type === 'group'){
            for (const message of await models.message.find({location:'group', run_id: run.id},  {limit:getLimit('group', 100, options)})){
                messages.push(message);
            }
        }
        if (!options.type || options.type === 'report'){
            for (const report of await models.chat_report.find({}, {limit:getLimit('report', 40, options)})){
                report.type = 'report';
                messages.push(report);
            }
        }

    }
    messages = messages.sort((a, b) => {
        return a.created - b.created;
    });
    if (!options.all){
        messages = messages.filter(message => {
            return !message.removed;
        });
    }
    const cache = {
        user: await models.user.list(),
        gamestate: await models.gamestate.list(),
        group: await models.group.list()
    };
    return async.mapLimit(messages, 10, async message => {
        if (message.user_id === user.id){
            message.self = true;
        }
        return fillMessage(message, cache);
    });

};

function getLimit(type, base, options){
    if(!_.has(options, 'limit')){
        return base;
    }
    if (_.isObject(options.limit)){
        if (_.has(options.limit, type)){
            return options.limit[type];
        }
        return base;
    }
    return options.limit;
}

exports.getRead = async function getRead(user){
    const read_messages = await models.read_message.find({user_id: user.id});
    return _.indexBy(read_messages, 'location');
};

exports.getBlocks = async function getBlocks(user){
    const blockedUsers = await models.chat_block.find({user_id: user.id});
    return _.pluck(blockedUsers, 'blocked_user_id');
};

exports.addBlock = async function addBlock(user, blockedUserId){
    const doc = {
        user_id: user.id,
        blocked_user_id: blockedUserId
    };
    const block = await models.chat_block.findOne(doc);
    if (block){ return; }
    await models.chat_block.create(doc);
};

exports.clearBlock = async function addBlock(user, blockedUserId){
    const doc = {
        user_id: user.id,
        blocked_user_id: blockedUserId
    };
    const block = await models.chat_block.findOne(doc);
    if (!block){ return; }
    await models.chat_block.delete(block.id);
};

exports.reportMessage = async function reportMessage(user, data){
    const message_id = data.message_id;
    if (!message_id) { return; }
    const id = await models.chat_report.create({
        user_id: user.id,
        message_id: message_id,
        reason: data.reason?xssEscape(data.reason):'No reason provided'
    });
    const report = await models.chat_report.get(id);
    report.type = 'report';
    return {type: 'report', action:'new', report: await fillMessage(report)};
};

exports.ignoreReport = async function ignoreReport(user, data){
    if (user.type === 'player' || user.type === 'none'){
        return;
    }
    const report = await models.chat_report.findOne({report_id: data.report_id});
    if (!report) {
        return;
    }
    report.resolved = new Date();
    report.resolved_by = user.id;
    report.resolution = 'ignored';
    await models.chat_report.update(report.id, report);
    report.type = 'report';
    return {type: 'report', action:'ignore', report: await fillMessage(report)};
};

exports.removeReportedMessage = async function removeReportedMessage(user, data){
    if (user.type === 'player' || user.type === 'none'){
        return;
    }
    const report = await models.chat_report.findOne({report_id: data.report_id});
    if (!report) {
        return;
    }
    const message = await models.message.findOne({message_id: report.message_id});
    if (!message) {
        return;
    }
    message.removed = true;
    await models.message.update(message.id, message);
    report.resolved = new Date();
    report.resolved_by = user.id;
    report.resolution = 'removed';
    await models.chat_report.update(report.id, report);
    report.type = 'report';
    return {type: 'report', action:'remove', report: await fillMessage(report)};
};

exports.clearReport = async function clearReport(user, data){
    if (user.type === 'player' || user.type === 'none'){
        return;
    }
    const report = await models.chat_report.findOne({report_id: data.report_id});
    if (!report) {
        return;
    }
    const message = await models.message.findOne({message_id: report.message_id});
    if (!message) {
        return;
    }
    if (message.removed){
        message.removed = false;
        await models.message.update(message.id, message);
    }
    report.resolved = null;
    report.resolved_by = null;
    report.resolution = null;
    await models.chat_report.update(report.id, report);
    report.type = 'report';
    return {type: 'report', action:'clear', report: await fillMessage(report)};
};

exports.getLocations = async function getLocations(userId){
    const user = await models.user.get(userId);
    const run = await models.run.getCurrent();
    const doc = {
        group: [],
        direct: [],
    };
    if (user.type === 'none'){
        return doc;
    } else if (user.type === 'player'){
        const groups = user.player.groups.filter(group => {return group.chat; });
        doc.group = await async.mapLimit(groups, 10, async group => {
            return {
                id: group.id,
                name: group.name,
                users: await getPlayerList(await models.player.listByGroupAndRun(group.id, run.id), 'player')
            };
        });
        let location_id = null;
        if (new Date().getTime() < new Date(user.player.statetime).getTime()){
            location_id = user.player.prev_gamestate_id;
        } else {
            location_id = user.player.gamestate_id;
        }

        const gamestate = await models.gamestate.get(location_id);
        if (gamestate.chat){
            doc.current = await getPlayerList(await models.player.find({run_id: run.id, gamestate_id: gamestate.id}), 'player');
        } else {
            doc.current = [];
        }
    } else {
        const groups = (await models.group.list()).filter(group => {return group.chat; });
        doc.group = await async.mapLimit(groups, 10, async group => {
            return {
                id: group.id,
                name: group.name,
                users: await getPlayerList(await models.player.listByGroupAndRun(group.id, run.id), 'full')
            };
        });

        const gamestates = await models.gamestate.listForChat();

        doc.gamestate = await async.mapLimit(gamestates, 5, async gamestate => {
            return {
                id: gamestate.id,
                name: gamestate.name,
                users: await getPlayerList(await models.player.find({run_id: run.id, gamestate_id: gamestate.id}), 'full')
            };
        });
    }
    return doc;
};

async function getPlayerList(players, type){
    return await async.mapLimit(players, 5, async player => {
        const user = await models.user.get(player.user_id);
        return {
            id: player.user_id,
            name: await getDisplayName(user, type)
        };
    });
}

function getDisplayName(user, type){
    const doc = {
        player: null,
        full: null,
        type: user.type === 'player'?'player':'staff'
    };
    if (user.type === 'player' && user.player.character){
        doc.player = user.player.character;
        doc.full = `${user.name} (${user.player.character})`;
    } else {
        doc.player = user.name;
        doc.full = user.name;
    }
    if (!type){
        return doc;
    }
    if (type === 'player'){
        return doc.player;
    }
    return doc.full;
}

