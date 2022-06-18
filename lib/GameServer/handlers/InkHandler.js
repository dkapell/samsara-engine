'use strict';
const _ = require('underscore');
const async = require('async');
const models = require('../../models');
const InkEngine = require('../../InkEngine');
const actionLib = require('../../actionLib');
const jitsi = require('../../jitsi');

class InkHandler {
    constructor(sender){
        this.sender = sender;
        this.inkEngines = {};
        this.lineOptions = {};
    }

    // Handle ink choice messages.
    async handle(ws, user, gameId, data){
        const self = this;
        if(user.type !== 'player'){ return; }

        if (!_.has(self.inkEngines, gameId) || !_.has(self.inkEngines[gameId], user.id)){
            return;
        }
        switch (data.type){
            case 'choice': self.inkEngines[gameId][user.id].choice(Number(data.idx)); break;
        }
    }

    // run an ink story
    async run(inkId, user, gameId, options, ws){
        const self = this;
        const doc = {
            action: 'ink',
            type: 'open',
            fullscreen: options.fullscreen
        };
        await self.sender.action(user.id, doc, gameId, ws);

        const engine = new InkEngine(inkId, user.id, gameId, {
            startPoint: options.startPoint,
            restart: options.restart
        });

        if(!_.has(self.inkEngines, gameId)){
            self.inkEngines[gameId] = {};
        }
        self.inkEngines[gameId][user.id] = engine;

        await engine.init();

        engine.on('end', async() => {
            // todo use partial stories
            delete self.inkEngines[gameId][user.id];
        });

        engine.on('data', async (data) => {
            const parsed = await async.map(data, async (datum) => {
                switch (datum.type){
                    case  'text': {
                        const options = await self.parseTags(datum.tags, user, gameId);

                        return {
                            type: 'text',
                            text: datum.text,
                            options: options
                        };
                    }

                    case 'choices':
                        return datum;

                    case 'end':
                        return datum;
                }
            });
            await self.sender.action(user.id, {
                action: 'ink',
                type: 'data',
                data: parsed,
            }, gameId, ws);
        });

        engine.on('error', (err) => {
            console.trace(err);
        });

        await engine.continue();
    }

    async parseTags(tags, user, gameId){
        const self = this;
        const lineOptions = await self._handleLineTags(tags.line, user, gameId);
        const knotOptions = await self._handleKnotTags(tags.knot, user, gameId);

        return Object.assign({}, knotOptions, lineOptions);
    }

    async _handleLineTags(tags, user, gameId){
        const self = this;
        const options = {};
        await async.each(tags, async (tag) => {
            const parts = tag.split(/[_-\s+]/);
            switch(parts[0]){
                case 'link':
                    return self._handleLink(user, gameId, parts[1]);

                case 'meeting':
                    return self._handleMeeting(user, gameId, parts[1]);

                case 'closemeeting':
                    return self._handleCloseMeeting(user, gameId);

                case 'closeink':
                    return self._handleCloseInk(user, gameId);

                case 'document':
                    return self._handleText(user, gameId, parts[1], parts[2], parts[3]);

                case 'image':
                    return self._handleImage(user, gameId, parts[1]);

                case 'screen':
                    break;
                case 'color':
                    options.color = parts[1];
                    break;
                case 'bgcolor':
                    options.bgcolor = parts[1];
                    break;

                case 'class':
                    options.class = parts[1];
                    break;
                default:
            }
        });
        return options;
    }

    async _handleKnotTags(tags, user){
        const self = this;
        const options = {};
        await async.each(tags, async (tag) => {
            const parts = tag.split(/[_-\s+]/);
            switch(parts[0]){
                case 'color':
                    options.color = parts[1];
                    break;
                case 'bgcolor':
                    options.bgcolor = parts[1];
                    break;

                case 'class':
                    options.class = parts[1];
                    break;
                default:
            }
        });
        return options;
    }

    async _handleLink(user, gameId, linkId){
        const self = this;
        if (!linkId.match(/^\d+$/)){ return; }

        const link = await models.link.find({game_id: gameId, id:Number(linkId)});
        if (!link) { return; }
        if (!link.active) { return; }

        self.sender.action(user.id, actionLib.link(link.url), gameId);
    }

    async _handleMeeting(user, gameId, meetingId){
        const self = this;

        if (!meetingId.match(/^\d+$/)){ return; }

        const meeting = await models.meeting.find({game_id: gameId, id:Number(meetingId)});

        if (!meeting) { return; }

        if (meeting.game_id !== gameId){ return; }

        if (!meeting.active){ return; }

        if (!await jitsi.active()){ return; }

        self.sender.action(user.id, actionLib.meeting(meeting), gameId);
    }

    async _handleCloseMeeting(user, gameId){
        const self = this;
        self.sender.action(user.id, actionLib.closeMeeting(), gameId);
    }

    async _handleCloseInk(user, gameId){
        const self = this;
        self.sender.action(user.id, actionLib.closeInk(), gameId);
    }

    async _handleImage(user, gameId, imageId){
        const self = this;
        if (!imageId.match(/^\d+$/)){ return; }
        const image = await models.image.find({game_id: gameId, id: Number(imageId)});
        const imageActionDoc = actionLib.image(image.url, image.display_name, image.description);

        self.sender.action(user.id, imageActionDoc, gameId);
    }

    async _handleText(user, gameId, documentId, location, duration){
        if (!documentId.match(/^\d+$/)){ return; }
        if (!location.match(/^(inline|popup|popout)$/)){ return;}
        if (duration && !duration.match(/^\d+$/)){ return; }
        const textActionDoc = await actionLib.text(gameId, {
            document_id: Number(documentId),
            location: location,
            duration: duration
        });
        self.sender.action(user.id, textActionDoc, gameId);
    }
}

module.exports = InkHandler;
