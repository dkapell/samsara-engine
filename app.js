'use strict';
const _ = require('underscore');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const config = require('config');
const flash = require('express-flash');
const redis = require('redis');
const moment = require('moment');
const methodOverride = require('method-override');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

const models = require('./lib/models');
const permission = require('./lib/permission');

const indexRouter = require('./routes/index');
const userRouter = require('./routes/user');
const authRouter = require('./routes/auth');
const roomsRouter = require('./routes/room');
const playersRouter = require('./routes/player');
const runsRouter = require('./routes/run');
const playerGroupsRouter = require('./routes/player_group');
const app = express();

// if running in SSL Only mode, redirect to SSL version
if (config.get('app.secureOnly')){
    app.all('*', function(req, res, next){
        if (req.headers['x-forwarded-proto'] !== 'https') {
            res.redirect('https://' + req.headers.host + req.url);
        } else {
            next();
        }
    });
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride(function(req, res){
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
        const method = req.body._method;
        delete req.body._method;
        return method;
    }
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = {
    secret: config.get('app.sessionSecret'),
    rolling: true,
    saveUninitialized: true,
    resave: false,
};

if (config.get('app.sessionType') === 'redis'){
    const RedisStore = require('connect-redis')(session);
    let redisClient = null;
    if (config.get('app.redisURL')){
        const redisToGo   = require('url').parse(config.get('app.redisURL'));
        redisClient = redis.createClient(redisToGo.port, redisToGo.hostname);

        redisClient.auth(redisToGo.auth.split(':')[1]);

    } else {
        redisClient = redis.createClient();
    }
    sessionConfig.store = new RedisStore({ client: redisClient });
    sessionConfig.resave = true;
}

app.use(session(sessionConfig));
app.use(flash());

app.use(function(req, res, next){
    req.models = models;
    next();
});

app.use(permission());

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(async function(id, cb) {
    try{
        const user = await models.user.get(id);
        cb(null, user);
    } catch (err){
        cb(err);
    }
});

passport.use(new GoogleStrategy({
    clientID: config.get('auth.clientID'),
    clientSecret: config.get('auth.clientSecret'),
    callbackURL: config.get('auth.callbackURL')
},
async function(accessToken, refreshToken, profile, cb) {
    try{
        const user = await models.user.findOrCreate({
            name: profile.displayName,
            google_id: profile.id,
            email: profile.emails[0].value
        });
        cb(null, user);
    } catch (err) {
        cb(err);
    }
})
);


// Set common helpers for the view
app.use(function(req, res, next){
    res.locals.config = config;
    res.locals.session = req.session;
    res.locals.title = config.get('app.name');
    res.locals._ = _;
    res.locals.moment = moment;
    res.locals.activeUser = req.user;
    next();
});


app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/room', roomsRouter);
app.use('/player', playersRouter);
app.use('/run', runsRouter);
app.use('/player_group', playerGroupsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
