'use strict';
var pg = require('pg');
var config = require('config');
var parseDbUrl = require('parse-database-url');


if ( config.has('db.poolSize')){
    pg.defaults.poolSize = config.get('db.poolSize');
}

var dbURL = config.get('app.dbURL') + '?ssl=true';

var pool = new pg.Pool(parseDbUrl(dbURL));

pool.on('error', function (err, client) {
    console.error('idle client error', err.message, err.stack);
});

// Helper Functions

// Handle errors with postgres driver
function handleError(err, client, done){
    // no error occurred, continue with the request
    if(!err) return false;
    // else close connection and hand back failure
    done(client);
    return true;
}

// Rollback helper for postgres transactions
function rollback(client, done){
    client.query('ROLLBACK', function(err) {
        return done(err);
    });
}

exports.query = async function(query, data){
    return pool.query(query, data);
};

exports.end = function(){
    pool.end();
};

