#!/usr/bin/env node
'use strict';

const async = require('async');
const _ = require('underscore');
const WSClient = require('./WSClient');
const models = require('../../lib/models');
const { program } = require('commander');

program
    .option('-s, --server <servername>', 'Server (required)')
    .option('-p, --port <port>', 'Server port')
    .option('-r --run <id>', 'Run to use (required)')
    .option('-i, --insecure', 'Use Insecure (HTTP/WS) connection', false)
    .parse(process.argv);

const options = program.opts();
if (!options.server || !options.run){
    program.help();
}

const messageCounts = {};
let messageTotal = 0;
let changed = false;

(async function main() {
    const players = await models.player.find({run_id: options.run});
    const connections = await async.map(players, async player => {
        const user = await models.user.get(player.game_id, player.user_id);

        const client = new WSClient({
            server: `${options.server}${options.port?`:${options.port}`:''}`,
            user:user,
            secure: !options.insecure
        });
        await client.connect();
        console.log(`${user.name} Connected`);
        client.on('message', function(data){
            const action = data.message.action === 'chat' ? `chat-${data.message.locations?'locations':'other'}`:data.message.action;
            if (!_.has(messageCounts, action)){
                messageCounts[action] = 0;
            }
            messageCounts[action]++;
            messageTotal++;
            console.log(`${user.name}: received ${action} message: ${data.count}:${messageCounts[action]} | ${data.total}:${messageTotal}`);
            changed = true;
        });
        return client;
    });

    setInterval(() => {
        if (changed){
            console.log(JSON.stringify(messageCounts, null, 2));
            changed = false;
        }
    }, 2000);

    // process.exit(0);
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});
