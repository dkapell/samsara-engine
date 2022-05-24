'use strict';
const _ = require('underscore');
const GameBroker = require('../../GameBroker');
const InkEngine = require('../../InkEngine');

class InkHandler {
    constructor(inkEngines){
        this.inkEngines = {};
    }

    // Handle ink choice messages.
    async handle(ws, user, data){
        const self = this;
        if(user.type !== 'player'){ return; }

        if (!_.has(self.inkEngines, user.id)){
            return;
        }
        switch (data.type){
            case 'choice': self.inkEngines[user.id].choice(Number(data.idx)); break;
        }
    }

    // run an ink story
    async run(inkId, user, options, ws){
        const self = this;
        const doc = JSON.stringify({
            action: 'ink',
            type: 'open',
            fullscreen: options.fullscreen
        });
        if (ws){
            ws.send(doc);
        } else {
            GameBroker.send('action', {
                userId:user.id,
                action: doc
            });
        }

        const engine = new InkEngine(inkId, user.id, {
            startPoint: options.startPoint,
            restart: options.restart
        });

        self.inkEngines[user.id] = engine;

        await engine.init();

        engine.on('end', () => {
            delete self.inkEngines[user.id];
            const endInkDoc = JSON.stringify({
                action: 'ink',
                type: 'end'
            });

            GameBroker.send('action', {
                userId:user.id,
                action: endInkDoc
            });
        });

        engine.on('story', (text) => {
            const storyDoc =  JSON.stringify({
                action: 'ink',
                type: 'text',
                text: text
            });
            GameBroker.send('action', {
                userId:user.id,
                action: storyDoc
            });
        });


        engine.on('tags', (tags) => {
            //TODO - images, gamestate, documents, etc
            //console.log(`Tags: ${tags.join(', ')}`);
        });

        engine.on('error', (err) => {
            console.trace(err);
        });


        engine.on('choices', async (choices, hasRefresh) => {
            const choicesDoc = JSON.stringify({
                action: 'ink',
                type: 'choices',
                choices: choices
            });
            GameBroker.send('action', {
                userId:user.id,
                action: choicesDoc
            });
        });

        await engine.continue();
    }
}

module.exports = InkHandler;
