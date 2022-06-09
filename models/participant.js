'use strict';
const async = require('async');
const _ = require('underscore');

const models = {
    user: require('./user'),
    meeting: require('./meeting')
};

const Model = require('../lib/Model');

const tableFields = ['id', 'meeting_id', 'user_id', 'joined'];

const Participant = new Model('participants', tableFields, {
    order: ['user_id'],
    postSelect: postProcess,
});

module.exports = Participant;

async function postProcess(participant){
    participant.user = await models.user.get(participant.user_id);
    participant.meeting = await models.meeting.get(participant.meeting_id);
    return participant;
}
