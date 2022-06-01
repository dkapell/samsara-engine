'use strict';

const async = require('async');
const _ = require('underscore');
const models = require('../../lib/models');

(async function main() {

    const screens = await models.screen.list();
    await async.each(screens, async(screen) => {
        if (!screen.map){
            return;
        }
        for (const area of screen.map){
            if (area.name && area.name.match(/gamestate/)){
                area.name = area.name.replace(/gamestate/, 'screen');
            }
            if (area.condition && area.condition.match(/gamestate/)){
                area.condition = area.condition.replace(/gamestate/, 'screen');
            }
            area.actions = fixActions(area.actions);
        }
        screen.map = JSON.stringify(screen.map);

        return models.screen.update(screen.id, screen);
    });

    for (const type of ['code', 'trigger']){
        await fixType(type);
    }

    console.log('done');
    process.exit(0);

})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});

async function fixType(type){
    const items = await models[type].list();

    return async.each(items, async (item) => {
        if (item.condition && item.condition.match(/gamestate/)){
            item.condition = item.condition.replace(/gamestate/, 'screen');
        }
        item.actions = JSON.stringify(fixActions(item.actions));

        return models[type].update(item.id, item);
    });
}

function fixActions(actions){
    return actions.map(action => {
        const doc = {};
        for (const key in action){
            switch (key){
                case 'gamestate_id': doc.screen_id = action[key]; break;
                case 'to_screen_id': doc.to_screen_id = action[key]; break;
                default: doc[key] = action[key]; break;
            }
        }

        return doc;
    });
}
