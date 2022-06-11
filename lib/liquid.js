'use strict';
const _ = require('underscore');
const config = require('config');
const models = require('./models');
const gameEngine = require('./gameEngine');
const gameData = require('./gameData');

const { Liquid } = require('liquidjs');
const engine = new Liquid();

exports.render = async function render(userId, input, gameId){
    const user = await models.user.get(gameId, userId);
    const screenCounts = await gameEngine.getScreenCounts(user.type==='player'?user.player.run_id:null, gameId);
    let playerData = (await gameData.getStartData('player'), gameId).public;
    let runData = (await gameData.getStartData('run'), gameId).public;
    if (user.type === 'player'){
        playerData = _.has(user.player.data, 'public')?user.player.data.public:{};
        const run = await models.run.get(user.player.run_id);
        runData = _.has(run.data, 'public')?run.data.public:{};
    }

    const doc = {
        screen: screenCounts,
        player: playerData,
        run: runData,
        character: user.type==='player'?user.player.character:'Character Name',
        user: user.name
    };
    return engine.parseAndRender(input, doc);
};
