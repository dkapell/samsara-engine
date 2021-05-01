'use strict';
const config = require('config');
const jwt = require('jsonwebtoken');

exports.token = function(room){
    if (!(config.get('jitsi.server'))){
        return;
    }
    const jwtConfig = config.get('jitsi.jwt');
    const doc = {
        iss: jwtConfig.issuer,
        room: room,
        exp: Math.floor(Date.now() / 1000) + jwtConfig.duration,
        sub: config.get('jitsi.server'),
        aud: jwtConfig.audience,
    };
    const token = jwt.sign(doc, jwtConfig.secret);
    return token;
};
