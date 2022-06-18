'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const models = require('./models');
const uuid = require('uuid');
const { nanoid } = require('nanoid');

const gameData = require('./gameData');
const imageManager = require('./imageManager');

const tables = [
    {
        name: 'run',
        required: false,
        default: 'one',
        fieldNames: ['run_id']
    },
    {
        name: 'group',
        required: true,
        fieldNames: ['group_id'],
        collectionFieldNames: ['groups']
    },
    {
        name: 'image',
        required: true,
        fieldNames: ['image_id']
    },
    {
        name: 'link',
        required: true,
        fieldNames: ['link_id']
    },
    {
        name: 'meeting',
        required: true,
        fieldNames: ['meeting_id']
    },
    {
        name: 'ink',
        required: true,
        fieldNames: ['ink_id']
    },
    {
        name: 'code',
        required: true,
        fieldNames: ['code_id'],
        collectionFieldNames: ['codes'],
    },
    {
        name: 'document',
        required: true,
        fieldNames: ['document_id']
    },
    {
        name: 'screen',
        required: true,
        fieldNames: ['screen_id', 'from_screen_id', 'to_screen_id', 'prev_screen_id']
    },
    {
        name: 'transition',
        required: true,
    },
    {
        name: 'trigger',
        required: true,
    },
    {
        name: 'player',
        required: false,
        playerTable: true,
        default: 'fake',
        fieldNames: ['player_id']
    },
    {
        name: 'character',
        required: true,
        fieldNames: ['character_id']
    },
    {
        name: 'variable',
        required: true,
    },
    {
        name: 'message',
        required: false,
        requires: ['player'],
        playerTable: true,
        default: 'none',
        fieldNames: ['message_id']
    },
    {
        name: 'read_message',
        requires: ['message', 'player'],
        playerTable: true,
        required: false,
        default: 'none'
    },
    {
        name: 'chat_block',
        requires: ['player'],
        playerTable: true,
        required: false,
        default: 'none'
    },
    {
        name: 'chat_report',
        requires: ['message', 'player'],
        playerTable: true,
        required: false,
        default: 'none'
    },

];
exports.tables = tables;

exports.clone = async function clone(gameId, options = {}){
    const oldGame = await models.game.get(gameId);
    if (!oldGame){
        throw new Error('Old Game not found');
    }
    if (!_.has(options, 'tables')){
        options.tables = {};
    }

    const newGame = {};
    for (const field in oldGame){
        if (field === 'id'){continue;}
        if (field === 'created'){continue;}
        if (field === 'updated'){continue;}
        if (field === 'name'){
            newGame.name = _.has(options, 'game') && options.game.name?options.game.name:`Clone of ${oldGame.name}`;
        } else {
            newGame[field] = _.has(options, 'game') && options.game[field]?options.game[field]:oldGame[field];
        }
    }

    const newGameId = await models.game.create(newGame);

    options.cache = {};
    options.jsonTables = [];

    for (const tableConfig of tables){
        await copyTable(tableConfig, gameId, newGameId, options);
    }

    for (const table of options.jsonTables){
        await updateTableJson(table, newGameId, options);
    }

    if (options.fakeUsers){
        await makeFakeUsers(newGameId);
    }

    return newGameId;
};

async function copyTable(tableConfig, oldGameId, newGameId, options){
    const table = tableConfig.name;
    let willCopy = false;

    if (tableConfig.required){
        // required table
        willCopy = true;
    } else {
        if (options.tables[table]) {
            // User specified to copy table
            if (tableConfig.requires){
                let hasAllRequired = true;
                for (const requiredTable of tableConfig.requires){
                    if (!options.tables[requiredTable]){
                        hasAllRequired = false;
                    }
                }
                if (hasAllRequired){
                    // Parent tables were copied
                    willCopy = true;
                }
            } else {
                willCopy = true;
            }
        } else if (_.has(tableConfig, 'requires')){
            let hasAllRequired = true;
            for (const requiredTable of tableConfig.requires){
                if (!options.tables[requiredTable]){
                    hasAllRequired = false;
                }
            }
            if (hasAllRequired){
                // Parent tables were copied
                willCopy = true;
            }
        }
    }

    if (!willCopy){
        return makeDefaultTable(tableConfig, oldGameId, newGameId, options);
    }
    console.log(`Cloning ${table} from ${oldGameId} to ${newGameId}` );

    if (!_.has(options.cache, table)){
        options.cache[table] = {};
    }

    const rows = await models[table].find({game_id:oldGameId});

    return async.each(rows, async (row) => {
        const oldId = row.id;

        let oldKey = null;
        if (table === 'image'){
            oldKey = imageManager.getKey(row);
        }
        delete row.id;
        row.game_id = newGameId;


        for (const field in row){
            // check if field can be replaced
            for (const tableConf of tables){
                if (_.has(options.cache, tableConf.name) && _.has(tableConf, 'fieldNames') && _.indexOf(tableConf.fieldNames, field) !== -1){
                    if (tableConf.name !== table){
                        row[field] = options.cache[tableConf.name][row[field]];
                    }
                }
                if (_.has(options.cache, tableConf.name) && _.has(tableConf, 'collectionFieldNames') && _.indexOf(tableConf.collectionFieldNames, field) !== -1){
                    if (tableConf.name !== table){
                        for (const item of row[field]){
                            item.id = options.cache[tableConf.name][item.id];
                        }
                    }
                }
            }
            if (table === 'meeting' && field === 'meeting_id'){
                row.meeting_id = nanoid(10);
            }

            if (field === 'map' || field === 'actions'){
                if (_.indexOf(options.jsonTables, table) === -1){
                    options.jsonTables.push(table);
                }
                row[field] = JSON.stringify(row[field]);
            }
        }
        const newId = await models[table].create(row);
        options.cache[table][oldId] = newId;
        row.id = newId;
        if (table === 'image'){
            const newKey = imageManager.getKey(row);
            await imageManager.copy(oldKey, newKey);
        }
    });
}

async function makeDefaultTable(tableConfig, oldGameId, newGameId, options){
    const table = tableConfig.name;
    switch(tableConfig.default){
        case 'none': return;
        case 'fake': return;
        case 'one': {
            console.log(`Making default ${table} for ${newGameId}` );
            const row = await models[table].findOne({game_id:oldGameId});
            const oldId = row.id;
            delete row.id;
            row.game_id = newGameId;

            if (table === 'run'){
                row.name = 'Default Run';
                row.data = gameData.getStartData('run', oldGameId);
                row.current = true;
                row.show_stubs = false;
            }
            const newId = await models[table].create(row);
            if (!_.has(options.cache, table)){
                options.cache[table] = {};
            }
            options.cache[table][oldId] = newId;
            return;
        }
    }
}

async function updateTableJson(table, newGameId, options){
    const rows = await models[table].find({game_id: newGameId});
    return async.each(rows, async(row) => {
        for (const field in row){
            if (field === 'map'){
                for (const area of row.map){
                    if (area.uuid) {
                        area.uuid = uuid.v4();
                    }
                    if (area.actions){
                        area.actions = updateActions(area.actions, options.cache);
                    }
                    if (area.group_id){
                        area.group_id = options.cache.group[area.group_id];
                    }
                }

                row.map = JSON.stringify(row.map);
            }
            if (field === 'actions'){
                row.actions = JSON.stringify(updateActions(row.actions, options.cache));
            }
        }
        return models[table].update(row.id, row);
    });
}


function updateActions(actions, cache){
    return actions.map(action => {
        const doc = {};
        for (const key in action){
            doc[key] = action[key];
            for (const tableConf of tables){
                if (_.has(cache, tableConf.name) && _.has(tableConf, 'fieldNames') && _.indexOf(tableConf.fieldNames, key) !== -1){
                    doc[key] = cache[tableConf.name][action[key]];
                }
            }
        }
        return doc;
    });
}

async function makeFakeUsers(gameId){
    console.log(`Making fake users for ${gameId}`);
    const run = await models.run.getCurrent(gameId);
    const screen = await models.screen.getStart(gameId);
    const characters = await models.character.find({game_id: gameId});
    let counter = 1;
    for (const character of characters){
        const user = {
            name:`Fake User ${counter}`,
            email: `fake-${counter}@fake.com`
        };
        let currentUser = await models.user.findOne(gameId, user);
        if (!currentUser){
            const userId = await models.user.create(user);
            currentUser = await models.user.get(userId);
        }

        if (currentUser.gameType !== 'unset') { continue; }

        await models.game_user.create({game_id: gameId, user_id: currentUser.id, type:'player'});

        await models.player.create({
            user_id:currentUser.id,
            game_id: gameId,
            run_id:run.id,
            screen_id: screen.id,
            prev_screen_id:null,
            character: character.name,
            groups: character.groups,
            data: character.data,
            character_sheet: character.character_sheet
        });
        counter++;
    }
}
