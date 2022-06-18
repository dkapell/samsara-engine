'use strict';
const async = require('async');
const _ = require('underscore');

const Model = require('../lib/Model');

const tableFields = ['id', 'game_id', 'user_id', 'report_id', 'message_id', 'reason', 'created', 'resolved', 'resolved_by', 'resolution'];

const ChatReport = new Model('chat_reports', tableFields, {
    order: ['created desc']
});

module.exports = ChatReport;
