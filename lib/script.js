'use strict';
const _ = require('underscore');
const models = require('./models');
const userData = require('./userData');

const {VM, VMScript} = require('vm2');
const { ESLint } = require('eslint');

exports.verify = async function verify(script){
    const eslint = new ESLint({
        fix: true,
        allowInlineConfig: false,
        baseConfig: {
            globals: {
                data: 'readonly',  // Can not be overwritten, but keys/values can be changed
                character: 'readonly',
                groups: 'readonly',
                _: 'readonly',
                gamestate_id: 'readonly',
                gamestates: 'readonly',
                output: 'readonly',// Can not be overwritten, but keys/values can be changed
            },
            rules: {
                'object-curly-spacing':2
            }
        }
    });
    let results = null;
    try{
        results = await eslint.lintText(script);

    } catch(err) {
        console.log(err);
        return {verified:false, errors:err};
    }
    if (results[0].errorCount){
        const formatter = await eslint.loadFormatter('stylish');
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

async function getSandbox(player){
    return {
        _ : _,
        data:player.data,
        character: player.character,
        groups: player.groups,
        gamestate_id: player.gamestate_id,
        gamestates: (await models.gamestate.list()).filter(state => {return !state.template;}),
        output: {to_state_id:null, delay: 0, console:null}
    };
}

exports.runAction = async function execute(script, player){
    const sandbox = await getSandbox(player);
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
    const validated = userData.validate(player.data);
    if (!_.isEqual(current.data, player.data)){
        console.log('would update data to ' + JSON.stringify(player.data));
    }

    if (sandbox.output.to_state_id){
        return {to_state_id:sandbox.output.to_state_id, delay: sandbox.output.delay};
    }
    return {};
};

exports.runCheck = async function runCheck(script, player){
    const sandbox = await getSandbox(player);
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
