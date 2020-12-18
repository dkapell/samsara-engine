'use strict';
const _ = require('underscore');
const models = require('./models');
const gameData = require('./gameData');

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
        output: {to_state_id:null, delay: 0, console:null}
    };
}

exports.runAction = async function execute(script, player){
    const run = models.run.get(player.run_id);
    const sandbox = await getSandbox(player, run);

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
    const current = await models.player.get(player.id);
    const currentRun = await models.run.get(run.id);

    if (gameData.validate(player.data, 'player') && !_.isEqual(current.data, player.data)){
        await models.player.update(player.id, player);
    }

    if (gameData.validate(run.data, 'run') && !_.isEqual(currentRun.data, run.data)){
        await models.run.update(run.id, run);
    }

    if (sandbox.output.to_state_id){
        return {to_state_id:sandbox.output.to_state_id, delay: sandbox.output.delay};
    }
    return {};
};

exports.runCheck = async function runCheck(script, player){
    const run = models.run.get(player.run_id);
    const sandbox = await getSandbox(player, run);
    const vm = new VM({
        timeout: 1000,
        sandbox: sandbox,
        fixAsync: true,
    });
    try{
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
