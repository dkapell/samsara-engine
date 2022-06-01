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
        const doc = {
            action: 'ink',
            type: 'open',
            fullscreen: options.fullscreen
        };
        await self.sender.action(user.id, doc, ws);

        const engine = new InkEngine(inkId, user.id, {
            startPoint: options.startPoint,
            restart: options.restart
        });

        self.inkEngines[user.id] = engine;

        await engine.init();

        engine.on('end', async() => {
            // TODO use partial stories
            delete self.inkEngines[user.id];
        });

        engine.on('data', async (data) => {
            const parsed = await async.map(data, async (datum) => {
                switch (datum.type){
                    case  'text': {
                        const options = await self.parseTags(datum.tags, user);

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
            }, ws);
        });

        engine.on('error', (err) => {
            console.trace(err);
        });

        await engine.continue();
    }

    async parseTags(tags, user){
        const self = this;
        const lineOptions = await self._handleLineTags(tags.line, user);
        const knotOptions = await self._handleKnotTags(tags.knot, user);

        return Object.assign({}, knotOptions, lineOptions);
    }

    async _handleLineTags(tags, user){
        const self = this;
        const options = {};
        await async.each(tags, async (tag) => {
            const parts = tag.split(/[_-\s+]/);
            switch(parts[0]){
                case 'link':
                    return self._handleLink(user, parts[1]);

                case 'meeting':
                    return self._handleMeeting(user, parts[1]);

                case 'closemeeting':
                    return self._handleCloseMeeting(user);

                case 'closeink':
                    return self._handleCloseInk(user, );

                case 'document':
                    return self._handleText(user, parts[1], parts[2], parts[3]);

                case 'image':
                    return self._handleImage(user, parts[1]);

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

    async _handleLink(user, linkId){
        const self = this;
        if (!linkId.match(/^\d+$/)){ return; }

        const link = await models.link.get(Number(linkId));
        if (!link) { return; }
        if (!link.active) { return; }

        self.sender.action(user.id, actionLib.link(link.url));
    }

    async _handleMeeting(user, meetingId){
        const self = this;

        if (!meetingId.match(/^\d+$/)){ return; }

        const meeting = await models.meeting.get(Number(meetingId));

        if (!meeting) { return; }

        if (!meeting.active){ return; }

        if (!await jitsi.active()){ return; }

        self.sender.action(user.id, actionLib.meeting(meeting));
    }

    async _handleCloseMeeting(user){
        const self = this;
        self.sender.action(user.id, actionLib.closeMeeting());
    }

    async _handleCloseInk(user){
        const self = this;
        self.sender.action(user.id, actionLib.closeInk());
    }

    async _handleImage(user,imageId){
        const self = this;
        console.log;
        if (!imageId.match(/^\d+$/)){ return; }
        const image = await models.image.get(Number(imageId));
        const imageActionDoc = actionLib.image(image.url, image.display_name, image.description);

        self.sender.action(user.id, imageActionDoc);
    }

    async _handleText(user, documentId, location, duration){
        if (!documentId.match(/^\d+$/)){ return; }
        if (!location.match(/^(inline|popup|popout)$/)){ return;}
        if (duration && !duration.match(/^\d+$/)){ return; }
        const textActionDoc = await actionLib.text({
            document_id: Number(documentId),
            location: location,
            duration: duration
        });
        self.sender.action(user.id, textActionDoc);
    }
}

module.exports = InkHandler;
