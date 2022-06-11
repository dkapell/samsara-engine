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

    async handle(ws, user, gameId, data){
        const self = this;
        try{
            const participants = await models.participant.find({user_id:user.id, game_id: gameId});
            const meeting = await models.meeting.find({game_id:data.gameId, meeting_id: data.meetingId});

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
                            user_id: user.id,
                            game_id: gameId
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
                    const screen = await gameEngine.getScreen(user.id, gameId);
                    const players = await models.player.find({run_id: screen.run.id, screen_id: screen.current.id});
                    await async.each(players, async player => {
                        return self.sendCounts(player.user_id, gameId);
                    });
                    if (screen.prev){
                        const prev_players = await models.player.find({run_id: screen.run.id, screen_id: screen.prev.id});
                        await async.each(prev_players, async player => {
                            return self.sendCounts(player.user_id, gameId);
                        });
                    }
                } else {
                    const runId = (await models.run.getCurrent(gameId)).id;
                    const screens = await gameEngine.getScreensFromMeeting(updatedMeeting);
                    return async.each(screens, async (screen) => {
                        const players = await models.player.find({run_id: runId, screen_id: screen.id});
                        return async.each(players, async player => {
                            return self.sendCounts(player.user_id, gameId);
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
            self.sender.action(user.id, doc, gameId, ws);
        }
    }

    async sendCounts(userId, gameId, ws){
        const self = this;
        if (self.meetingTimers && self.meetingTimers[userId]){
            return;
        }
        self.meetingTimers[userId] = setTimeout(async () => {
            const screen = await gameEngine.getScreen(userId, gameId);
            if (!screen.current){
                return;
            }
            const doc = {
                action: 'meetings',
                meetings: await gameEngine.getMeetingCounts(userId, screen.current),
                userId: userId
            };
            self.sender.action(userId, doc, gameId, ws);
            delete self.meetingTimers[userId];
        }, 50);
    }
}

module.exports = MeetingHandler;
