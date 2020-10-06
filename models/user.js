'use strict';
const async = require('async');
const _ = require('underscore');
const database = require('../lib/database');
const validator = require('validator');

const models = {
};

const tableFields = ['name', 'email', 'google_id', 'is_admin', 'is_gm'];


exports.get = function(id, cb){
    const query = 'select * from users where id = $1';
    database.query(query, [id], function(err, result){
        if (err) { return cb(err); }
        if (result.rows.length){
            return cb(null, result.rows[0]);
        }
        return cb();
    });
};

exports.getByEmail = function(text, cb){
    const query = 'select * from users where email = $1';
    database.query(query, [text], function(err, result){
        if (err) { return cb(err); }
        if (result.rows.length){
            return cb(null, result.rows[0]);
        }
        return cb();
    });
};
exports.getByGoogleId = function(text, cb){
    const query = 'select * from users where google_id = $1';
    database.query(query, [text], function(err, result){
        if (err) { return cb(err); }
        if (result.rows.length){
            return cb(null, result.rows[0]);
        }
        return cb();
    });
};

exports.list = function(cb){
    const query = 'select * from users order by name';
    database.query(query, function(err, result){
        if (err) { return cb(err); }
        return cb(null, result.rows);
    });
};

exports.create = function(data, cb){
    if (! validate(data)){
        return process.nextTick(function(){
            cb('Invalid Data');
        });
    }
    const queryFields = [];
    const queryData = [];
    const queryValues = [];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryFields.push(field);
            queryValues.push('$' + queryFields.length);
            queryData.push(data[field]);
        }
    }

    let query = 'insert into users (';
    query += queryFields.join (', ');
    query += ') values (';
    query += queryValues.join (', ');
    query += ') returning id';
    database.query(query, queryData, function(err, result){
        if (err) { return cb(err); }
        return cb(null, result.rows[0].id);
    });
};

exports.update =  function(id, data, cb){
    if (! validate(data)){
        return process.nextTick(function(){
            cb('Invalid Data');
        });
    }
    const queryUpdates = [];
    const queryData = [id];
    for (const field of tableFields){
        if (_.has(data, field)){
            queryUpdates.push(field + ' = $' + (queryUpdates.length+2));
            queryData.push(data[field]);
        }
    }

    let query = 'update users set ';
    query += queryUpdates.join(', ');
    query += ' where id = $1';

    database.query(query, queryData, cb);
};

exports.delete =  function(id, cb){
    const query = 'delete from users where id = $1';
    database.query(query, [id], cb);
};

exports.findOrCreate = function(data, cb){
    console.log(JSON.stringify(data, null, 2));
    exports.getByGoogleId(data.google_id, function(err, user){
        if (err) { return cb(err); }
        if (user) {
            for (const field in data){
                if (_.has(user, field)){
                    user[field] = data[field];
                }
            }
            exports.update(user.id, user, function(err){
                if (err) { return cb(err); }
                exports.get(user.id, cb);
            });
        } else {
            exports.getByEmail(data.email, function(err, user){
                if (user) {
                    for (const field in data){
                        if (_.has(user, field)){
                            user[field] = data[field];
                        }
                    }
                    exports.update(user.id, user, function(err){
                        if (err) { return cb(err); }
                        exports.get(user.id, cb);
                    });
                } else {
                    exports.create(data, function(err, id){
                        if (err) { return cb(err); }
                        exports.get(id, cb);
                    });
                }
            });
        }
    });
};


function validate(data){
    if (! validator.isLength(data.name, 2, 255)){
        return false;
    }
    if (! validator.isLength(data.email, 3, 100)){
        return false;
    }
    return true;
}
