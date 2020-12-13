'use strict';
const _ = require('underscore');
const validator = require('validator');
const config = require('config');
const models = require('./models');

exports.addNewVariable = async function addNewVariable(variable, oldVariable){
    const players = await models.player.list();
    const visbility = variable.public?'public':'private';
    return Promise.all(
        players.map(async player => {
            if (!_.has(player, 'data')) {
                player.data = await exports.getStartData();
            }
            if (oldVariable){
                const oldVisibility = oldVariable.public?'public':'private';
                if (_.has(player.data[oldVisibility], oldVariable.name)){
                    const oldVisibility = oldVariable.public?'public':'private';
                    if (player.data[oldVisibility][oldVariable.name] === convert(oldVariable.base_value, oldVariable.type)){
                        player.data[oldVisibility][oldVariable.name] = convert(variable.base_value, variable.type);
                    }

                    if (variable.public !== oldVariable.public || variable.name !== oldVariable.name){
                        player.data[visbility][variable.name] = player.data[oldVisibility][oldVariable.name];
                        delete player.data[oldVisibility][oldVariable.name];
                    }
                } else {
                    player.data[visbility][variable.name] = convert(variable.base_value, variable.type);
                }
            } else {
                player.data[visbility][variable.name] = convert(variable.base_value, variable.type);
            }
            return models.player.update(player.id, player);
        })
    );
};

exports.getStartData = async function getStartData(){
    const variables = await models.variable.list();

    const doc = {
        public: {},
        private: {}
    };

    for (const variable of variables){
        doc[variable.public?'public':'private'][variable.name] = convert(variable.base_value, variable.type);
    }
    return doc;
};

exports.validate = async function validate(data){
    const variables = await models.variable.list();

    for(const visbility in data){
        if (!visbility.match(/^(public|private)$/)){
            return false;
        }
        for(const variableName in data[visbility]){
            const variableData = _.findWhere(variables, {name:variableName, public:(visbility==='public')});
            if (variableData){
                let value = data[visbility][variableName].toString();
                switch(variableData.type){
                    case 'integer':

                        if (!_.isNumber(value)){ return false; }
                        break;
                    case 'string':
                        if(!_.isString(value)){ return false; }
                        break;
                    case 'date':
                        if (!validator.isDate(value)){ return false; }
                        break;
                    case 'boolean':
                        if (!value.match(/^(true|false)$/i)){ return false; }
                        break;
                    case 'object':
                        if (!_.isObject(value)){ return false; }
                        value = data[visbility][variableName];
                        break;
                    default:
                        return false;
                }
                data[visbility][variableName] = convert(value, variableData.type);
            }
        }

    }
    return true;
};

function convert(data, type){
    switch(type){
        case 'integer':
            return Number(data);
        case 'string':
            return data.toString();
        case 'date':
            if (data === 'now'){
                return new Date();
            }
            return new Date(data);
        case 'boolean':
            return data === 'true';

        case 'object':
            if (_.isString(data)){
                return JSON.parse(data);
            }
            return data;
    }
}
