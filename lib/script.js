'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const models = require('./models');
const gameData = require('./gameData');
const jitsi = require('./jitsi');
const actionLib = require('./actionLib');

const {VM, VMScript} = require('vm2');
const { ESLint } = require('eslint');

exports.verify = async function verify(script, formatterType){
    if (!formatterType){
        formatterType = 'stylish';
    }
    if(!script){
        return {verified:true, script: null};
    }
    const eslint = new ESLint({
        fix: true,
        allowInlineConfig: false,
        baseConfig: {
            globals: {
                run: 'readonly',  // Can not be overwritten, but keys/values can be changed
                public: 'readonly',  // Can not be overwritten, but keys/values can be changed
                private: 'readonly',  // Can not be overwritten, but keys/values can be changed
                player: 'readonly',
                character: 'readonly',
                groups: 'readonly',
                _: 'readonly',
                gamestate_id: 'readonly',
                gamestates: 'readonly',
                output: 'readonly',// Can not be overwritten, but keys/values can be changed
                actions: 'readonly',// Can not be overwritten, but keys/values can be changed
                jitsiActive: 'readonly'
            },
            rules: {
                'object-curly-spacing':2,
                'no-console': 2
            }
        }
    });
    let results = null;
    try{
        results = await eslint.lintText(script);
    } catch(err) {
        return {verified:false, errors:err};
    }
    if (results[0].errorCount){
        const formatter = await eslint.loadFormatter(formatterType);
        const scriptErrors = formatter.format(results);
        return {verified:false, errors:scriptErrors};
    }
    const lintedScript = results[0].output?results[0].output:script;
    try{
        script = new VMScript(lintedScript);
    }catch(err){
        return {verified:false, errors:err};
    }
    return {verified:true, script: lintedScript};
};

async function getSandbox(player, run){
    const actions = [];
    let log = null;
    return {
        _ : _,
        run: run.data,
        public: player.data.public,
        private: player.data.private,
        player: (await models.user.get(player.user_id)).name,
        character: player.character,
        groups: player.groups,
        gamestate_id: player.gamestate_id,
        gamestates: (await models.gamestate.list()).filter(state => {return !state.template;}),
        jitsiActive: await jitsi.active(),
        output: {
            to_state_id:null,
            delay: 0,
            console:log,
            log: function(text) { log += text; },
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

                actions.push(doc);
            },
            link: function(id){
                actions.push({
                    action: 'load',
                    ready: false,
                    linkId: id
                });
            },
            meeting: function(id){
                actions.push({
                    action: 'video',
                    ready: false,
                    domain: config.get('jitsi.server'),
                    meetingId: id,
                });
            },
            closemeeting: function(){
                actions.push({
                    action: 'closevideo',
                    ready: true
                });
            },
            closeink: function(){
                actions.push({
                    action: 'closeink',
                    ready: true
                });
            },
            image: function(id){
                actions.push({
                    action: 'image',
                    imageId: id,
                    ready: false
                });
            },
            forceupdate: function(){
                actions.push({
                    action: 'none',
                    force: true,
                    ready: true
                });
            },
            ink: function(id, options){
                actions.push({
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
        },
        actions: actions
    };
}

exports.runAction = async function runAction(script, player, dryrun){
    const run = await models.run.get(player.run_id);
    const sandbox = await getSandbox(player, run);
    const result = {
        runUpdated: false,
        playerUpdated:false
    };
    const vm = new VM({
        timeout: 1000,
        sandbox: sandbox,
        fixAsync: true,
    });
    try{
        await vm.run(script);
    } catch(err){
        console.trace(err);
        return;
    }

    if (sandbox.output.console){
        console.log(`Script Output ${sandbox.output.console}`);
    }
    const current = await models.player.get(player.id, true);
    const currentRun = await models.run.get(run.id);

    if (await gameData.validate(player.data, 'player') && !_.isEqual(current.data, player.data) && !dryrun){
        await models.player.update(player.id, player);
        result.playerUpdated = true;
    }

    if (await gameData.validate(run.data, 'run') && !_.isEqual(currentRun.data, run.data && !dryrun)){
        await models.run.update(run.id, run);
        result.runUpdated = true;
    }

    if (sandbox.output.to_state_id){
        result.to_state_id= sandbox.output.to_state_id;
        result.delay = sandbox.output.delay;
    }
    if (sandbox.actions.length){
        result.actions = await async.map(sandbox.actions, async action => {
            if (action.ready){
                delete action.ready;
                return action;
            }
            delete action.ready;
            switch (action.action){
                case 'load': {
                    if (!_.has(action, 'linkId')){
                        return;
                    }
                    const link = await models.link.get(action.linkId);
                    if (!link) { return; }
                    if (!link.active) { return; }
                    return actionLib.link(link.url);
                }

                case 'video': {
                    if (!_.has(action, 'meetingId')){
                        return;
                    }
                    const meeting = await models.meeting.get(action.meetingId);
                    if (!meeting) { return; }
                    if (!meeting.active) { return; }
                    return actionLib.meeting(meeting);
                }

                case 'image': {
                    const image = await models.image.get(action.imageId);
                    return actionLib.image(image.url, image.display_name, image.description);
                }

                case 'display':
                    return actionLib.text(action);

                default:
                    return action;
            }
        });
    }
    return result;
};

exports.runCheck = async function runCheck(script, player){

    const run = await models.run.get(player.run_id);
    const sandbox = await getSandbox(player, run);
    const vm = new VM({
        timeout: 1000,
        sandbox: sandbox,
        fixAsync: true,
    });
    try{
        let start = (new Date()).getTime();
        const value = await vm.run(script);
        if (sandbox.output.console){
            console.log(`Script Output ${sandbox.output.console}`);
        }

        return value?true:false;
    } catch(err){
        console.trace(err);
        return false;
    }
};
