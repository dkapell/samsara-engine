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
        objects.map(async datum => {
            if (!_.has(datum, 'data') || !datum.data) {
                datum.data = await exports.getStartData(type);
            }
            if (oldVariable){
                const oldVisibility = oldVariable.public?'public':'private';
                if (_.has(datum.data[oldVisibility], oldVariable.name)){
                    const oldVisibility = oldVariable.public?'public':'private';
                    if (datum.data[oldVisibility][oldVariable.name] === convert(oldVariable.base_value, oldVariable.type)){
                        datum.data[oldVisibility][oldVariable.name] = convert(variable.base_value, variable.type);
                    }

                    if (variable.public !== oldVariable.public || variable.name !== oldVariable.name){
                        datum.data[visbility][variable.name] = datum.data[oldVisibility][oldVariable.name];
                        delete datum.data[oldVisibility][oldVariable.name];
                    }
                } else {
                    datum.data[visbility][variable.name] = convert(variable.base_value, variable.type);
                }
            } else {
                datum.data[visbility][variable.name] = convert(variable.base_value, variable.type);
            }
            return models[type].update(datum.id, datum);
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