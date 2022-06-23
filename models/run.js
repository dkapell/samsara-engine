'use strict';
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'current', 'data', 'show_stubs'];

const Run = new Model('runs', tableFields, {
    order: ['name'],
    validator: validate
});

Run.getCurrent = async function getCurrent(gameId){
    const self = this;
    return self.findOne({game_id: gameId, current: true});
};

module.exports = Run;

function validate(data){
    if (! validator.isLength(data.name, 2, 80)){
        return false;
    }

    return true;
}
