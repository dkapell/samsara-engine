'use strict';
const _ = require('underscore');
const config = require('config');
const jitsi = require('./jitsi');
const models = require('./models');


exports.link = function (url, stub = false){
    return {
        action:'load',
        url:url,
        stub: stub
    };
};

exports.meeting = function(meeting){
    const doc = {
        action: 'video',
        domain: config.get('jitsi.server'),
        meetingName: meeting.meeting_id,
    };
    if (meeting.public){
        doc.jwt = jitsi.token(meeting.meeting_id);
        doc.subject = meeting.name;
    }
    return doc;
};

exports.closeMeeting = function(){
    return {
        action: 'closevideo'
    };
};

exports.closeInk = function(){
    return {
        action: 'closeink'
    };
};

exports.text = async function(action){
    const doc = {
        action:'display',
        content: action.content?action.content:'',
        duration:action.duration?action.duration:0,
        location: action.location,
        name: ''
    };

    if (_.has(action, 'document_id')){
        const text = await models.document.get(action.document_id);
        if(action.location === 'popout'){
            doc.action = 'load';
            doc.url = `/document/code/${text.code}`;

        } else {
            doc.content = text.content;
            doc.name = text.name;
        }
    }
    return doc;

};

exports.image = function(url, name, content){
    return {
        action:'image',
        image_url:url,
        name: name,
        content: content
    };
};

exports.ink = function(inkId, fullscreen, startPoint, restart){
    return {
        action: 'ink',
        ink_id: inkId,
        options: {
            fullscreen: fullscreen,
            startPoint: startPoint,
            restart: restart
        }
    };
};
