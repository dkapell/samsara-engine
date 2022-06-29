'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const models = require('../models');
const gameData = require('../gameData');
const jitsi = require('../jitsi');
const actionLib = require('../actionLib');

const sandboxLib = require('./sandboxLib');

const {VM, VMScript} = require('vm2');
const { ESLint } = require('eslint');

exports.verify = async function verify(script, type, formatterType){
    console.log(type);
    if (!formatterType){
        formatterType = 'stylish';
    }
    if(!script){
        return {verified:true, script: null};
    }

    const globals = {
        run: 'readonly',  // Can not be overwritten, but keys/values can be changed
        public: 'readonly',  // Can not be overwritten, but keys/values can be changed
        private: 'readonly',  // Can not be overwritten, but keys/values can be changed
        character: 'readonly',
        groups: 'readonly',
        _: 'readonly',
        screen_id: 'readonly',
        screens: 'readonly',
        output: 'readonly',// Can not be overwritten, but keys/values can be changed
        args: 'readonly'

    };
    if (type !== 'ink'){
        globals.actions = 'readonly'; // Can not be overwritten, but keys/values can be changed
        globals.jitsiActive= 'readonly';
        globals.user= 'readonly';
    }

    const eslint = new ESLint({
        fix: true,
        allowInlineConfig: false,
        baseConfig: {
            globals: globals,
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

exports.runAction = async function runAction(gameId, script, player, dryrun){
    const run = await models.run.get(player.run_id);
    if (run.game_id !== gameId){
        throw new Error('Invalid Run');
    }
    const sandbox = await sandboxLib.get(player, run);
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

    return postRun(gameId, sandbox, run, player, dryrun);
};

exports.runInk = function runAction(gameId, script, player, run, args){

    const sandbox = sandboxLib.getInk(player, run, {args: args});

    const vm = new VM({
        timeout: 1000,
        sandbox: sandbox,
        fixAsync: true,
    });
    try{
        vm.run(script);
    } catch(err){
        console.trace(err);
        return;
    }

    postRun(gameId, sandbox, run, player);

    if (sandbox.output.inkText){
        return sandbox.output.inkText;
    } else {
        return '';
    }
};

async function postRun(gameId, sandbox, run, player, dryrun = false){
    const result = {
        runUpdated: false,
        playerUpdated:false
    };

    if (sandbox.output.console !== ''){
        console.log(`Script Output: ${sandbox.output.console}`);
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

    if (sandbox.output.to_screen_id){
        result.to_screen_id= sandbox.output.to_screen_id;
        result.delay = sandbox.output.delay;
    }
    if (sandbox.actions && sandbox.actions.length){
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
                    if (link.game_id !== gameId){return; }
                    if (!link.active) { return; }
                    return actionLib.link(link.url);
                }

                case 'video': {
                    if (!_.has(action, 'meetingId')){
                        return;
                    }
                    const meeting = await models.meeting.get(action.meetingId);
                    if (!meeting) { return; }
                    if (meeting.game_id !== gameId){return; }
                    if (!meeting.active) { return; }
                    return actionLib.meeting(meeting);
                }

                case 'image': {
                    const image = await models.image.find({game_id: gameId, id:action.imageId});
                    return actionLib.image(image.url, image.display_name, image.description);
                }

                case 'display':
                    return actionLib.text(gameId, action);

                default:
                    return action;
            }
        });
    }
    return result;
}

exports.runCheck = async function runCheck(script, player){

    const run = await models.run.get(player.run_id);
    const sandbox = await sandboxLib.get(player, run);
    const vm = new VM({
        timeout: 1000,
        sandbox: sandbox,
        fixAsync: true,
    });
    try{
        let start = (new Date()).getTime();
        const value = await vm.run(script);
        if (sandbox.output.console !== ''){
            console.log(`Script Output: ${sandbox.output.console}`);
        }

        return value?true:false;
    } catch(err){
        console.trace(err);
        return false;
    }
};
