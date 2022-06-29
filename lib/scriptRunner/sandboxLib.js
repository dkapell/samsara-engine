'use strict';
const _ = require('underscore');
const async = require('async');
const util = require('util');
const config = require('config');


const models = require('../models');
const jitsi = require('../jitsi');

class Sandbox{
    constructor(player, run, options){
        const self = this;

        let log = null;

        self._ = _;

        self.run= run.data;
        self.public= player.data.public;
        self.private= player.data.private;
        self.character= player.character;
        self.groups= player.groups;
        self.screen_id= player.screen_id;

        if (_.has(options, 'args')){
            self.args = options.args;
        }

        self.output =  {
            to_screen_id: null,
            delay: 0,
            console: '',
            log: function(text) { self.output.console += text; },
            inkText: '',
            ink: function(text) { self.output.inkText += text; },
        };

        if (_.has(options, 'noActions') && options.noActions){
            return;
        }

        self.actions = [];
        self.action=  {
            text: function(content, options){
                const doc = {
                    action:'display',
                    content: content,
                    duration:options.duration?options.duration:0,
                    location: options.location?options.location:'inline',
                    name: options.name?options.name:'',
                    ready: true
                };
                if(_.has(options, 'documentId')){
                    doc.documentId = options.documentId;
                    doc.ready = false;
                }

                self.actions.push(doc);
            },
            link: function(id){
                self.actions.push({
                    action: 'load',
                    ready: false,
                    linkId: id
                });
            },
            meeting: function(id){
                self.actions.push({
                    action: 'video',
                    ready: false,
                    domain: config.get('jitsi.server'),
                    meetingId: id,
                });
            },
            closemeeting: function(){
                self.actions.push({
                    action: 'closevideo',
                    ready: true
                });
            },
            closeink: function(){
                self.actions.push({
                    action: 'closeink',
                    ready: true
                });
            },
            image: function(id){
                self.actions.push({
                    action: 'image',
                    imageId: id,
                    ready: false
                });
            },
            forceupdate: function(){
                self.actions.push({
                    action: 'none',
                    force: true,
                    ready: true
                });
            },
            ink: function(id, options){
                self.actions.push({
                    action: 'ink',
                    ink_id: id,
                    options: {
                        fullscreen: options.fullscreen,
                        startPoint: options.startPoint,
                        restart: options.restart
                    },
                    ready: true
                });
            }
        };
    }

    async init(player, run){
        const self = this;

        self.user = (await models.user.get(run.game_id, player.user_id)).name;
        self. screens = (await models.screen.find({game_id: run.game_id})).filter(screen => {return !screen.template;});
        self.jitsiActive =  await jitsi.active();
    }
}

exports.get = async function getSandbox(player, run, options = {}){
    const sandbox = new Sandbox(player, run, options);
    await sandbox.init(player, run);
    return sandbox;
};

exports.getInk = function getInkSandbox(player, run, options = {}){
    options.noActions = true;
    return new Sandbox(player, run, options);

};
