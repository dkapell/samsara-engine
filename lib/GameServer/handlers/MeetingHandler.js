'use strict';
const _ = require('underscore');
const async = require('async');
const models = require('../../models');
const gameEngine = require('../../gameEngine');

class MeetingHandler {
    constructor(sender){
        this.sender = sender;
        this.meetingTimers = {};
    }

    async handle(ws, user, data){
        const self = this;
        try{
            const participants = await models.participant.find({user_id:user.id});
            const meeting = await models.meeting.getByMeetingId(data.meetingId);

            const meetingsUpdated = [];

            switch (data.type){
                case 'join':{
                    if (!meeting){return;}
                    let found = false;
                    if (participants.length) {
                        async.each(participants, async (participant) => {
                            if (participant.meeting_id === meeting.id){
                                found = true;
                                return;
                            } else {
                                return models.participant.delete(participant.id);
                            }
                        });
                    }
                    if (!found){
                        await models.participant.create({
                            meeting_id: meeting.id,
                            user_id: user.id
                        });
                        if (meeting.show_users){
                            meetingsUpdated.push(meeting.id);
                        }
                    }
                    break;
                }
                case 'leave': {
                    if (participants.length){
                        async.each(participants, async (participant) => {
                            if (meeting && participant.meeting_id !== meeting.id){
                                return;
                            }
                            if (participant.meeting.show_users){
                                meetingsUpdated.push(participant.meeting.id);
                            }
                            return models.participant.delete(participant.id);

                        });
                    }
                }
            }
            if (!meetingsUpdated.length){
                return;
            }
            for (const updatedMeeting of meetingsUpdated){
                if (user.type === 'player'){
                    const screen = await gameEngine.getScreen(user.id);
                    const players = await models.player.find({run_id: screen.run.id, screen_id: screen.current.id});
                    await async.each(players, async player => {
                        return self.sendCounts(player.user_id);
                    });
                    if (screen.prev){
                        const prev_players = await models.player.find({run_id: screen.run.id, screen_id: screen.prev.id});
                        await async.each(prev_players, async player => {
                            return self.sendCounts(player.user_id);
                        });
                    }
                } else {
                    const runId = (await models.run.getCurrent()).id;
                    const screens = await gameEngine.getScreensFromMeeting(updatedMeeting.id);
                    return async.each(screens, async (screen) => {
                        const players = await models.player.find({run_id: runId, screen_id: screen.id});
                        return async.each(players, async player => {
                            return self.sendCounts(player.user_id);
                        });
                    });
                }
            }
        } catch(err){
            console.trace(err);
            const doc = {
                action: 'meeting error',
                retry: true,
                error: err.message,
            };
            self.sender.action(user.id, doc, ws);
        }
    }

    async sendCounts(userId, ws){
        const self = this;
        if (self.meetingTimers && self.meetingTimers[userId]){
            return;
        }
        self.meetingTimers[userId] = setTimeout(async () => {
            const screen = await gameEngine.getScreen(userId);
            if (!screen.current){
                return;
            }
            const doc = {
                action: 'meetings',
                meetings: await gameEngine.getMeetingCounts(userId, screen.current.id),
                userId: userId
            };
            self.sender.action(userId, doc, ws);
            delete self.meetingTimers[userId];
        }, 50);
    }
}

module.exports = MeetingHandler;
