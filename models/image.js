'use strict';
const async = require('async');
const config = require('config');
const _ = require('underscore');
const validator = require('validator');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'name', 'display_name', 'description', 'status', 'is_screen', 'is_popup', 'is_inventory'];

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

function postProcess(image){
    const key = ['images', image.id, image.name].join('/');
    image.url = `https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`;
    return image;
}
