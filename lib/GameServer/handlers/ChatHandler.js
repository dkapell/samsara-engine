'use strict';

const chat = require('../../chat');
const GameBroker = require('../../GameBroker');

class ChatHandler {

    constructor(){}

    // Handle chat messages
    async handle(ws, user, data){
        const self = this;
        if(user.type === 'none'){ return; }
        try{
            const message = await chat.handler(user, data);
            if (message){
                GameBroker.send('message', message);
            }
        } catch(err){
            console.trace(err);
            const doc = {
                action: 'chat error',
                retry: true,
                error: err.message,
            };
            return ws.send(JSON.stringify(doc));
        }
    }


    // Handle chat history requests
    async handleHistory(ws, user, data){
        const self = this;
        let messageHistory = await chat.getHistory(user, data.options);
        if (user.type === 'player'){
            messageHistory = messageHistory.map(self.formatPlayerMessage);
        }
        ws.send(JSON.stringify({
            action: 'chat',
            history:true,
            messages: messageHistory,
            read: await chat.getRead(user),
            block: await chat.getBlocks(user),
            userId: user.id
        }));
    }

    formatPlayerMessage(message){
        const self = this;
        return {
            message_id: message.message_id,
            location: message.location,
            location_id: message.location_id,
            location_name: message.location_name,
            content: message.content,
            created: message.created,
            user_id: message.user_id,
            user_type: message.user_type === 'player' ? 'player': 'staff',
            recipient_type: 'player',
            sender: message.sender.player,
            self:message.self
        };
    }
}

module.exports = ChatHandler;
