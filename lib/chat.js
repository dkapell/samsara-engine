'use strict';

const _ = require('underscore');
const uuid = require('uuid');
const xssEscape = require('xss-escape');
const models = require('./models');
const async = require('async');

exports.handler = async function message(user, gameId, data){
    switch(data.type){
        case 'message':
            return await chatMessage(user, gameId, data);
        case 'read':
            return await chatRead(user, gameId, data);
        case 'block':
            return await exports.addBlock(user, gameId, data.user_id);
        case 'unblock':
            return await exports.clearBlock(user, gameId, data.user_id);
        case 'report':
            return await exports.reportMessage(user, gameId, data);
        case 'report-ignore':
            return await exports.ignoreReport(user, gameId, data);
        case 'report-remove':
            return await exports.removeReportedMessage(user, gameId, data);
        case 'report-clear':
            return await exports.clearReport(user, gameId, data);
    }
};

async function chatMessage(user, gameId, data){
    let location = data.location;
    let location_id = data.location_id;
    let content = data.content;
    if (user.player){
        if (location === 'screen'){
            if (new Date().getTime() < new Date(user.player.statetime).getTime()){
                location_id = user.player.prev_screen_id;
            } else {
                location_id = user.player.screen_id;
            }
        }
        if(location === 'group' && !_.findWhere(user.player.groups, {id: location_id})){
            return;
        }
    }

    if (!location.match(/^(screen|direct|group|gm)$/)){
        return false;
    }

    if (location === 'screen'){
        const screen = await models.screen.get(location_id);
        if (screen.game_id !== gameId){
            return;
        }
        if (screen.start || screen.finish || !screen.chat){
            return;
        }
    }

    const doc = {
        message_id: uuid.v4(),
        run_id: user.player?user.player.run_id:(await models.run.getCurrent(gameId)).id,
        location: location,
        location_id: location!=='gm'?Number(location_id):null,
        content: xssEscape(content),
        user_id: user.id
    };
    try{
        const id = await models.message.create(doc);
        const message = await models.message.get(id);
        await chatRead(user, gameId, message);
        return await fillMessage(message, gameId);
    } catch(err){
        console.trace(err);
        return false;
    }
}

async function chatRead(user, gameId, data){
    const doc = {
        user_id: user.id,
        location: data.location,
        message_id: data.message_id,
        seen: new Date(),
        emailed: false
    };

    if (!doc.message_id) {return; }
    try{
        return await models.read_message.upsert(doc);
    } catch (e){
        return;
    }
}

async function fillMessage(message, gameId, cache){
    if (message.type === 'report'){
        message.message = await fillMessage(await models.message.findOne({message_id:message.message_id, game_id:gameId}), gameId, cache);
        message.reporter = getDisplayName(await getValue('user', message.user_id)); //Todo fix
        if (message.resolved_by){
            message.resolver = getDisplayName(await getValue('user', message.resolved_by)); //Todo fix
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
            case 'screen': {
                const screen = await getValue('screen', message.location_id);
                if (screen){
                    message.location_name = screen.name;
                } else {
                    message.location_name = 'Deleted Screen';
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
    if (message.location !== 'direct'){
        const users = await models.user.listGms();
        recipients = recipients.concat(_.pluck(users, 'id'));
    }
    switch(message.location){
        case 'screen': {
            let currentPlayers = await models.player.find({screen_id: message.location_id, run_id:message.run_id});
            let prevPlayers = await models.player.find({prev_screen_id: message.location_id, run_id:message.run_id});

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

exports.getHistory = async function getHistory(user, gameId, options){
    const run = await models.run.getCurrent(gameId);
    let messages = [];
    if (!options){
        options = {};
    }

    if (!options.type || options.type === 'direct'){
        for (const message of await models.message.find({location:'direct', location_id:user.id, game_id:gameId})){
            messages.push(message);
        }

        for (const message of await models.message.find({location:'direct', user_id:user.id, game_id:gameId})){
            messages.push(message);
        }
    }
    if (user.player){
        if (!options.type || options.type === 'group'){
            const groups = await async.mapLimit(user.player.groups, 5, async group => {
                return models.message.find({
                    location:'group',
                    location_id:group.id,
                    run_id: user.player.run_id
                });
            });
            for (const group of groups){
                for (const message of group){
                    messages.push(message);
                }
            }
        }
        if (!options.type || options.type === 'screen'){

            for (const message of await models.message.find({
                location:'screen',
                location_id: user.player.screen_id,
                run_id: user.player.run_id
            })){
                if (new Date(message.created) > new Date(user.player.statetime)){
                    messages.push(message);
                }
            }
        }
        if (!options.type || options.type === 'gm'){
            for (const message of await models.message.find({
                location:'gm',
                user_id:user.id
            }, {limit:getLimit('gm', 40, options)})) {
                messages.push(message);
            }
        }

    } else if (user.type !== 'none'){
        if (!options.type || options.type === 'gm'){
            for (const message of await models.message.find({location:'gm', game_id:gameId}, {limit:getLimit('gm', 40, options)})) {
                messages.push(message);
            }
        }
        if (!options.type || options.type === 'screen'){

            for (const message of await models.message.find({location:'screen', run_id: run.id, game_id:gameId},  {limit:getLimit('screen', 100, options)})){
                messages.push(message);
            }
        }
        if (!options.type || options.type === 'group'){
            for (const message of await models.message.find({location:'group', run_id: run.id, game_id:gameId},  {limit:getLimit('group', 100, options)})){
                messages.push(message);
            }
        }
        if (!options.type || options.type === 'report'){
            for (const report of await models.chat_report.find({game_id:gameId}, {limit:getLimit('report', 40, options)})){
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
        screen: await models.screen.find({gameId: gameId}),
        group: await models.group.find({gameId: gameId})
    };
    return async.mapLimit(messages, 10, async message => {
        if (message.user_id === user.id){
            message.self = true;
        }
        return fillMessage(message, gameId, cache);
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

exports.getRead = async function getRead(user, gameId){
    const read_messages = await models.read_message.find({user_id:user.id, game_id:gameId});

    return _.indexBy(read_messages, 'location');
};

exports.getBlocks = async function getBlocks(user, gameId){
    const blockedUsers = await models.chat_block.find({user_id: user.id, game_id:gameId});
    return _.pluck(blockedUsers, 'blocked_user_id');
};

exports.addBlock = async function addBlock(user, gameId, blockedUserId){
    const doc = {
        user_id: user.id,
        blocked_user_id: blockedUserId,
        game_id: gameId
    };
    const block = await models.chat_block.findOne(doc);
    if (block){ return; }
    await models.chat_block.create(doc);
};

exports.clearBlock = async function addBlock(user, gameId, blockedUserId){
    const doc = {
        user_id: user.id,
        blocked_user_id: blockedUserId,
        game_id: gameId
    };
    const block = await models.chat_block.findOne(doc);
    if (!block){ return; }
    await models.chat_block.delete(block.id);
};

exports.reportMessage = async function reportMessage(user, gameId, data){
    const message_id = data.message_id;
    if (!message_id) { return; }
    const id = await models.chat_report.create({
        gameId: gameId,
        user_id: user.id,
        message_id: message_id,
        reason: data.reason?xssEscape(data.reason):'No reason provided'
    });
    const report = await models.chat_report.get(id);
    report.type = 'report';
    return {type: 'report', action:'new', report: await fillMessage(report, gameId)};
};

exports.ignoreReport = async function ignoreReport(user, gameId, data){
    if (user.type === 'player' || user.type === 'none'){
        return;
    }
    const report = await models.chat_report.findOne({game_id:gameId, report_id: data.report_id});
    if (!report) {
        return;
    }
    report.resolved = new Date();
    report.resolved_by = user.id;
    report.resolution = 'ignored';
    await models.chat_report.update(report.id, report);
    report.type = 'report';
    return {type: 'report', action:'ignore', report: await fillMessage(report, gameId)};
};

exports.removeReportedMessage = async function removeReportedMessage(user, gameId, data){
    if (user.type === 'player' || user.type === 'none'){
        return;
    }
    const report = await models.chat_report.findOne({game_id:gameId, report_id: data.report_id});
    if (!report) {
        return;
    }
    const message = await models.message.findOne({message_id: report.message_id, game_id:gameId});
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
    return {type: 'report', action:'remove', report: await fillMessage(report, gameId)};
};

exports.clearReport = async function clearReport(user, gameId, data){
    if (user.type === 'player' || user.type === 'none'){
        return;
    }
    const report = await models.chat_report.findOne({game_id:gameId, report_id: data.report_id});
    if (!report) {
        return;
    }
    const message = await models.message.findOne({message_id: report.message_id, game_id:gameId});
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
    return {type: 'report', action:'clear', report: await fillMessage(report, gameId)};
};

exports.getLocations = async function getLocations(userId, gameId){
    const user = await models.user.get(userId);
    const run = await models.run.getCurrent(gameId);
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
            location_id = user.player.prev_screen_id;
        } else {
            location_id = user.player.screen_id;
        }

        const screen = await models.screen.get(location_id);
        if (screen.chat){
            doc.current = await getPlayerList(await models.player.find({run_id: run.id, screen_id: screen.id}), 'player');
        } else {
            doc.current = [];
        }
    } else {
        const groups = (await models.group.find({gameId: gameId})).filter(group => {return group.chat; });
        doc.group = await async.mapLimit(groups, 10, async group => {
            return {
                id: group.id,
                name: group.name,
                users: await getPlayerList(await models.player.listByGroupAndRun(group.id, run.id), 'full')
            };
        });

        const screens = await models.screen.listForChat(gameId);

        doc.screen = await async.mapLimit(screens, 5, async screen => {
            return {
                id: screen.id,
                name: screen.name,
                users: await getPlayerList(await models.player.find({run_id: run.id, screen_id: screen.id}), 'full')
            };
        });
    }
    return doc;
};

exports.formatPlayerMessage = function formatPlayerMessage(message){
    return {
        message_id: message.message_id,
        location: message.location,
        location_id: message.location_id,
        location_name: message.location_name,
        content: message.content,
        created: message.created,
        user_id: message.user_id,
        user_type: message.user_type === 'player' ? 'player': 'staff',
        recipient_type: 'player',
        sender: message.sender.player,
        self:message.self
    };
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

