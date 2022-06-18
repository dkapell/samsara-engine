'use strict';

const async = require('async');
const _ = require('underscore');
const database = require('./database');
const validator = require('validator');
const cache = require('./cache');

class Model {

    constructor(table, fields, options){
        this.table = table;
        this.fields = fields;
        this.options = options;
    }

    async get(id, options = {}){
        const self = this;
        if (_.indexOf(self.fields, 'id') === -1){
            return;
        }
        let record = await cache.check(self.table, id);
        if (record){
            if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                record = await options.postSelect(record);

            } else if (_.has(self.options, 'postSelect') && _.isFunction(self.options.postSelect)){
                record = await self.options.postSelect(record);
            }
            return record;
        }
        const query = `select * from ${self.table} where id = $1`;
        try{
            const result = await database.query(query, [id]);

            await cache.store(self.table, id, record);

            if (result.rows.length){
                record = result.rows[0];
                if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                    record = await options.postSelect(record);

                } else if (_.has(self.options, 'postSelect') && _.isFunction(self.options.postSelect)){
                    record = await self.options.postSelect(record);
                }

                await cache.store(self.table, id, record);
                return record;
            }
            return;
        } catch (e){
            console.error(`Get Error: ${self.table}:${id}`);
            throw e;
        }
    }

    async find(conditions = {}, options = {}){
        const self = this;
        const queryParts = [];
        const queryData = [];
        for (const field of self.fields){
            if (_.has(conditions, field)){
                queryParts.push(field + ' = $' + (queryParts.length+1));
                queryData.push(conditions[field]);
            }
        }
        let query = `select * from ${self.table}`;
        if (queryParts.length){
            query += ' where ' + queryParts.join(' and ');
        }

        if (_.has(options, 'order') && _.isArray(options.order)){
            query += ` order by ${options.order.join(', ')}`;

        } else if (_.has(self.options, 'order') && _.isArray(self.options.order)){
            query += ` order by ${self.options.order.join(', ')}`;
        }

        if (_.has(options, 'offset')){
            query += ` offset ${Number(options.offset)}`;
        }

        if (_.has(options, 'limit')){
            query += ` limit ${Number(options.limit)}`;
        }
        try {
            const result = await database.query(query, queryData);

            if (_.has(options, 'postSelect') && _.isFunction(options.postSelect)){
                return async.map(result.rows, options.postSelect);

            } else if (_.has(self.options, 'postSelect') && _.isFunction(self.options.postSelect)){
                return async.map(result.rows, self.options.postSelect);

            } else {
                return result.rows;
            }

        } catch (e){
            console.error(`Find Error: ${self.table}:${JSON.stringify(conditions)}`);
            throw e;
        }
    }

    async findOne(conditions, options = {}){
        const self = this;
        options.limit = 1;
        const results = await self.find(conditions, options);
        if (results.length){
            return results[0];
        }
        return;
    }

    async list(){
        const self = this;
        return self.find({});
    }

    async create(data){
        const self = this;
        if (_.has(self.options.validator) && _.isFunction(self.options.validator) && ! self.options.validator(data)){
            throw new Error('Invalid Data');
        }
        if (_.indexOf(self.fields, 'game_id') !== -1){
            // Require game_id on row creation
            if (!_.has(data, 'game_id')){
                throw new Error('Game Id must be specified');
            }
        }

        const queryFields = [];
        const queryData = [];
        const queryValues = [];
        for (const field of self.fields){
            if (field === 'id'){
                continue;
            }
            if (_.has(data, field)){
                queryFields.push(field);
                queryValues.push('$' + queryFields.length);
                queryData.push(data[field]);
            }
        }

        let query = `insert into ${self.table} (`;
        query += queryFields.join (', ');
        query += ') values (';
        query += queryValues.join (', ');

        if (_.indexOf(self.fields, 'id') !== -1){
            query += ') returning id';
        } else {
            query += ')';
        }
        try{
            const result = await database.query(query, queryData);
            if (_.indexOf(self.fields, 'id') !== -1){
                const id = result.rows[0].id;
                if (_.has(self.options, 'postSave') && _.isFunction(self.options.postSave)){
                    await self.options.postSave(id, data);
                }

                return id;
            } else {
                return;
            }
        } catch (e){
            console.error(`Create Error: ${self.table}: ${JSON.stringify(data)}`);
            throw e;
        }
    }

    async update(id, data){
        const self = this;
        if (_.has(self.options.validator) && _.isFunction(self.options.validator) && ! self.options.validator(data)){
            throw new Error('Invalid Data');
        }

        const queryUpdates = [];
        const queryData = [];
        const whereUpdates = [];
        if (_.indexOf(self.fields, 'id') !== -1){
            queryData.push(id);
            whereUpdates.push('id = $1');
        } else {
            for (const field of self.options.keyFields){
                if(!_.has(data, field)){
                    throw new Error('missing key field:' + field);
                }
                whereUpdates.push(field + ' = $' + (whereUpdates.length+1));
                queryData.push(data[field]);
            }
        }

        for (const field of self.fields){

            // never update game_id once set
            if (field === 'game_id'){
                continue;
            }
            if (field === 'id'){
                continue;
            }
            // do not update key fields
            if (_.indexOf(self.options.keyFields, field) !== -1){
                continue;
            }

            if (_.has(data, field)){
                queryUpdates.push(field + ' = $' + (whereUpdates.length + queryUpdates.length+1));
                queryData.push(data[field]);
            }
        }


        let query = `update ${self.table} set `;
        query += queryUpdates.join(', ');
        query += ` where ${whereUpdates.join(' and ')};`;
        try {
            await database.query(query, queryData);

            if (_.has(self.options, 'postSave') && _.isFunction(self.options.postSave)){
                await self.options.postSave(id, data);
            }

            await cache.invalidate(self.table, id);
        } catch (e){
            console.error(`Update Error: ${self.table}: ${id}: ${JSON.stringify(data)}`);
            throw e;
        }
    }

    async delete(id){
        const self = this;
        let data = null;
        if (_.has(self.options, 'postDelete') && _.isFunction(self.options.postDelete)){
            data = await self.get(id);
            if (!data) { return; }
        }
        const query = `delete from ${self.table} where id = $1`;
        try{
            await database.query(query, [id]);
            await cache.invalidate(self.table, id);
            if (_.has(self.options, 'postDelete') && _.isFunction(self.options.postDelete)){
                await self.options.postDelete(id, data);
            }
        } catch (e){
            console.error(`Delete Error: ${self.table}: ${id}`);
            throw e;
        }
    }

}

module.exports = Model;

