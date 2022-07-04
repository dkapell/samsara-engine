'use strict';
const _ = require('underscore');
const validator = require('validator');

const Model = require('../lib/Model');
const imageManager = require('../lib/imageManager');

const tableFields = ['id', 'game_id', 'name', 'display_name', 'description', 'status', 'type'];

const Image = new Model('images', tableFields, {
    order: ['name'],
    validator: validate,
    postSelect: postProcess
});

module.exports = Image;

function validate(data){
    if (_.has(data, 'name') && ! validator.isLength(data.name, 2, 80)){
        return false;
    }
    return true;
}

async function postProcess(image){
    image.url = imageManager.getUrl(image);
    return image;
}
