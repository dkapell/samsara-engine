'use strict';

const chat = require('../../chat');

class ChatHandler {

    constructor(sender){
        this.sender = sender;
    }

    // Handle chat messages
    async handle(ws, user, gameId, data){
        const self = this;
        if(user.type === 'none'){ return; }
        try{
            const message = await chat.handler(user, gameId, data);
            if (message){
                self.sender.message(message, gameId);
            }
        } catch(err){
            console.trace(err);
            const doc = {
                action: 'chat error',
                retry: true,
                error: err.message,
            };
            return self.sender.action(user.id, doc, gameId, ws);
        }
    }


    // Handle chat history requests
    async handleHistory(ws, user, gameId, data){
        const self = this;
        let messageHistory = await chat.getHistory(user, gameId, data.options);
        if (user.type === 'player'){
            messageHistory = messageHistory.map(chat.formatPlayerMessage);
        }

        const doc = {
            action: 'chat',
            history:true,
            messages: messageHistory,
            read: await chat.getRead(user, gameId),
            block: await chat.getBlocks(user, gameId),
            userId: user.id
        };

        return self.sender.action(user.id, doc, gameId, ws);
    }
}

module.exports = ChatHandler;
