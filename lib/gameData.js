'use strict';
const _ = require('underscore');
const validator = require('validator');
const config = require('config');
const models = require('./models');

exports.addNewVariable = async function addNewVariable(variable, oldVariable){
    const type = variable.player?'player':'run';
    const objects = await models[type].list();
    const visbility = variable.public?'public':'private';

    return Promise.all(
        objects.map(async item => {
            if (!_.has(item, 'data') || !item.data || !_.has(item.data, 'public') || !_.has(item.data, 'private')) {
                item.data = await exports.getStartData(type);
            }

            if (oldVariable){
                const oldVisibility = oldVariable.public?'public':'private';
                if (_.has(item.data[oldVisibility], oldVariable.name)){
                    const oldVisibility = oldVariable.public?'public':'private';
                    if (_.isEqual(item.data[oldVisibility][oldVariable.name], convert(oldVariable.base_value, oldVariable.type))){
                        item.data[oldVisibility][oldVariable.name] = convert(variable.base_value, variable.type);
                    }

                    if (variable.public !== oldVariable.public || variable.name !== oldVariable.name){
                        item.data[visbility][variable.name] = item.data[oldVisibility][oldVariable.name];
                        delete item.data[oldVisibility][oldVariable.name];
                    }
                } else {
                    item.data[visbility][variable.name] = convert(variable.base_value, variable.type);
                }
            } else {
                item.data[visbility][variable.name] = convert(variable.base_value, variable.type);
            }
            return models[type].update(item.id, item);
        })
    );
};

exports.getStartData = async function getStartData(type){
    const variables = await models.variable.find({player:(type==='player')});

    const doc = {
        public: {},
        private: {}
    };

    for (const variable of variables){
        doc[variable.public?'public':'private'][variable.name] = convert(variable.base_value, variable.type);
    }
    return doc;
};

exports.validate = async function validate(data, type){
    const variables = await models.variable.find({player:type==='player'});

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
                        value = data[visbility][variableName];
                        if (_.isArray(value) || !_.isObject(value)){ return false; }
                        break;
                    case 'array':
                        value = data[visbility][variableName];
                        if (!_.isArray(value)){ return false; }
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
            if (_.isNull(data)) { return null; }

            return Number(JSON.parse(data));
        case 'string':
            if (_.isNull(data)) { return null; }
            return JSON.parse(data);
        case 'date':
            if (data === 'now'){
                return new Date();
            }
            return new Date(JSON.parse(data));
        case 'boolean':
            return data === 'true';

        case 'object':
        case 'array':
            if (_.isString(data)){
                return JSON.parse(data);
            }
            return data;
    }
}
