'use strict';
const _ = require('underscore');
const async = require('async');
const config = require('config');
const models = require('./models');
const gameData = require('./gameData');
const inkjs = require('inkjs');
const EventEmitter = require('events');


class InkEngine extends EventEmitter{
    constructor(inkId, userId, gameId, options = {}){
        super(options);
        const self = this;
        this.inkId = inkId;
        this.userId = userId;
        this.gameId = gameId;
        this.inUpdate = 0;
        this.endRequested = false;
        this.hasRefresh = false;
        this.options = options;
        this.currentTags = [];
    }

    async init() {
        const self = this;
        const ink = await models.ink.get(self.gameId, self.inkId);
        self.story = new inkjs.Story(ink.compiled);
        const variables = await models.variable.listInk(self.gameId);
        const player = await models.player.getByUser(self.userId, self.gameId);
        self.playerId = player.id;
        self.runId = player.run_id;

        self.story.onError = (message, errorType) => {
            self.emit('error', message, errorType);
        };

        for (const variable of variables){
            try{
                self.story.ObserveVariable(variable.ink_name, async (ink_name, value) => {
                    self.inUpdate++;
                    await self.updateVariable(ink_name, value);
                    self.inUpdate--;
                    if (self.endRequested){
                        self.end();
                    }
                });
            } catch (e){

            }
        }

        // Jump to saved state if we have one, and we're arent asked to restart
        if (!_.has(self.options, 'restart') || ! self.options.restart){
            await self.loadScreen();
        }

        // Jump to start point if this is the first time starting this story

        if (_.has(self.options, 'startPoint') && self.options.startPoint && !(await self.hasSavePoint())){
            self.jumpTo(self.options.startPoint);
        }
    }

    jumpTo(stateName){
        const self = this;
        try{
            self.story.ChoosePathString(stateName);
        }
        catch (e){
            self.emit('error', e);
        }
    }

    async hasSavePoint(){
        const self = this;
        const ink_state = await models.ink_state.findOne({player_id: self.playerId, ink_id: self.inkId});
        return ink_state?true:false;
    }


    async loadScreen(){
        const self = this;
        const ink_state = await models.ink_state.findOne({player_id: self.playerId, ink_id: self.inkId});
        if (ink_state){
            self.story.state.LoadJson(ink_state.state);
        }
    }

    async saveScreen(complete = false){
        const self = this;
        let ink_state = await models.ink_state.findOne({player_id: self.playerId, ink_id: self.inkId});
        const state = self.story.state.ToJson();
        if (ink_state){
            ink_state.updated = new Date();
            ink_state.state = state;
            ink_state.complete = complete;
            return models.ink_state.update(ink_state.id, ink_state);
        } else {
            ink_state = {
                ink_id: self.inkId,
                player_id: self.playerId,
                state: state,
                complete: complete,
                updated: new Date()
            };
            return models.ink_state.create(ink_state);
        }
    }

    async reset(){
        const self = this;
        let ink_state = await models.ink_state.findOne({player_id: self.playerId, ink_id: self.inkId});

        if (ink_state){
            await models.ink_state.delete(ink_state.id);
        }
        self.story.ResetScreen();

        if (_.has(self.options, 'startPoint') && self.options.startPoint){
            self.jumpTo(self.options.startPoint);
        }
    }

    async continue(){
        const self = this;

        const data = {};

        await self.setVariables();

        const output = [];

        //check we haven't reached the end of the story
        if (!self.story.canContinue && self.story.currentChoices.length === 0) {
            output.push({
                type: 'end'
            });
            self.emit('data', output);
            self.end();
        }

        while (self.story.canContinue){
            const text = self.story.Continue();
            const tags = self.story.currentTags;
            self.currentTags = _.union(self.currentTags, tags);
            const doc = {
                type: 'text',
                tags: {
                    line: tags,
                    knot: self.currentTags
                },
                text: text
            };
            output.push(doc);
        }


        if (self.story.currentChoices.length > 0){
            const doc = {
                type: 'choices',
                choices: [],
                hasRefresh: false
            };

            self.hasRefresh = false;

            for (let i = 0; i < self.story.currentChoices.length; ++i) {
                const choice = self.story.currentChoices[i];
                if (choice.text.match(/^\[\s*REFRESH\s*\]/)){
                    self.hasRefresh = true;
                    doc.hasRefresh = true;
                } else {
                    doc.choices.push({
                        idx: i,
                        text: choice.text
                    });
                }
            }

            output.push(doc);
            self.emit('data', output);

            //            self.emit('choices', choices, self.hasRefresh);

        } else {
            output.push({
                type: 'end'
            });
            self.emit('data', output);
            self.end();
        }
    }

    async setVariables(){
        const self = this;
        const player = await models.player.getByUser(self.userId, self.gameId);
        const run = await models.run.get(player.run_id);

        const data = {
            player: player.data,
            run: run.data,
        };
        const variables = await models.variable.listInk(self.gameId);
        for (const variable of variables){
            if (_.has(data, variable.player?'player':'run')){
                if (_.has(data[variable.player?'player':'run'], variable.public?'public':'private')){
                    const value = data[variable.player?'player':'run'][variable.public?'public':'private'][variable.name];
                    try{
                        const current = self.story.variablesScreen[variable.ink_name];
                        if (current !== value){
                            self.story.variablesScreen[variable.ink_name] = value;
                        }
                    } catch (e){

                    }
                }
            }
        }
    }

    async updateVariable(ink_name, value){
        const self = this;
        const variable = await models.variable.findOne({ink_name:ink_name, game_id: self.gameId});
        if (!variable){ return; }
        const player = await models.player.get(self.playerId);

        if (variable.player){
            const data = player.data[variable.public?'public':'private'];

            if (_.has(data, variable.name) && value !== data[variable.name]){
                player.data[variable.public?'public':'private'][variable.name] = value;
                return models.player.update(player.id, player);
            }
        } else {
            const run = await models.run.get(player.run_id);
            const data = run.data[variable.public?'public':'private'];
            if (_.has(data, variable.name) && value !== data[variable.name]){
                run.data[variable.public?'public':'private'][variable.name] = value;
                await models.run.update(run.id, run);
                self.emit('update', variable.id, value);
            }
        }

    }

    async choice(choiceIdx){
        const self = this;
        //todo add overflow check
        self.currentTags = [];
        self.story.ChooseChoiceIndex(choiceIdx);
        await self.saveScreen();
        return self.continue();
    }

    async end(){
        const self = this;
        if (!self.inUpdate){
            this.emit('end');
        } else {
            self.endRequested = true;
        }
    }


    async refresh(){
        const self = this;
        if (!self.hasRefresh){
            return;
        }
        let refreshChoice = null;
        for (let i = 0; i < self.story.currentChoices.length; ++i) {
            const choice = self.story.currentChoices[i];
            if (choice.text.match(/^\[\s*REFRESH\s*\]/)){
                refreshChoice = i;
                break;
            }
        }
        if(!_.isNull(refreshChoice)){
            return self.choice(refreshChoice);
        }
    }

    async globalTags(){
        return self.story.globalTags();
    }
}

module.exports = InkEngine;

