'use strict';
const _ = require('underscore');

const Model = require('../lib/Model');

const tableFields = ['game_id', 'user_id', 'location', 'message_id', 'seen', 'emailed'];

const ReadMessage = new Model('read_messages', tableFields, {
    keyFields: ['game_id', 'user_id', 'location'],
    order: ['user_id', 'location']
});

ReadMessage.upsert = async function upsert(data){
    const self = this;
    const read_message = await self.findOne({
        user_id: data.user_id,
        location: data.location,
        game_id: data.game_id
    });
    if (read_message) {
        for (const field in data){
            if (_.has(read_message, field)){
                read_message[field] = data[field];
            }
        }
        return self.update(null, read_message);
    } else {
        return self.create(data);
    }
};

module.exports = ReadMessage;
