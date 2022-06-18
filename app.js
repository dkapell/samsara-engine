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
const {marked} = require('marked');
const jwt_decode = require('jwt-decode');
const methodOverride = require('method-override');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const OAuth2Strategy = require('passport-oauth2').Strategy;
const LocalStrategy = require('passport-localapikey').Strategy;

const models = require('./lib/models');
const permission = require('./lib/permission');
const jitsi = require('./lib/jitsi');

const app = express();

const indexRouter = require('./routes/index');
const userRouter = require('./routes/user');
const authRouter = require('./routes/auth');
const linksRouter = require('./routes/link');
const playersRouter = require('./routes/player');
const runsRouter = require('./routes/run');
const groupsRouter = require('./routes/group');
const imageRouter = require('./routes/image');
const stubRouter = require('./routes/linkStub');
const screenRouter = require('./routes/screen');
const transitionRouter = require('./routes/transition');
const gameRouter = require('./routes/game');
const variableRouter = require('./routes/variable');
const documentRouter = require('./routes/document');
const codeRouter = require('./routes/code');
const triggerRouter = require('./routes/trigger');
const meetingRouter = require('./routes/meeting');
const characterRouter = require('./routes/character');
const inkRouter = require('./routes/ink');


const adminGameRouter = require('./routes/admin/game');

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

if (config.get('app.logRequests')){
    app.use(logger('dev'));
}
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
    if (config.get('app.redis.url')){
        const options = {};
        if (config.get('app.redis.tls')){
            options.tls = {rejectUnauthorized: false};
        }
        redisClient = redis.createClient(config.get('app.redis.url'), options);
    } else {
        redisClient = redis.createClient();
    }
    sessionConfig.store = new RedisStore({ client: redisClient });
    sessionConfig.resave = true;
}

const sessionParser = session(sessionConfig);
app.locals.sessionParser = sessionParser;
app.use(sessionParser);
app.use(flash());

app.use(function(req, res, next){
    req.models = models;
    next();
});

app.use(permission());

// Figure out what game is active, based on URL
app.use(async function(req, res, next){
    let game = await models.game.getBySite(req.headers.host);
    if (!game){
        game = {
            id: 0,
            name: 'Samsara Admin Site',
            theme: 'Flatly',
            css: '',
            site: req.headers.host,
            intercode_login: false,
            default_to_player: false
        };
    }
    req.game = game;

    res.locals.currentGame = game;
    res.locals.cssTheme = config.get(`themes.${game.theme}.dir`);

    req.session.gameId = game.id;
    if (req.game.google_client_id && req.game.google_client_secret){
        if (!_.has(passport._strategies, `google-game-${game.id}`)){
            passport.use(`google-game-${game.id}`, new GoogleStrategy({
                clientID: req.game.google_client_id,
                clientSecret: req.game.google_client_secret,
                callbackURL: config.get('auth.google.callbackURL'),
                passReqToCallback: true
            }, passportVerifyGoogle));

        }
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(async function(req, id, cb) {
    try{
        const user = await models.user.get(req.game.id, id);
        cb(null, user);
    } catch (err){
        cb(err);
    }
});

const googleConfig = config.get('auth.google');

passport.use(new GoogleStrategy({
    clientID: config.get('auth.google.clientID'),
    clientSecret: config.get('auth.google.clientSecret'),
    callbackURL: config.get('auth.google.callbackURL'),
    passReqToCallback: true
}, passportVerifyGoogle));


async function passportVerifyGoogle(req, accessToken, refreshToken, profile, cb) {
    try{
        const user = await models.user.findOrCreate(req.game.id, {
            name: profile.displayName,
            google_id: profile.id,
            email: profile.emails[0].value,
            type: req.game.default_to_player?'player':'none'
        });
        cb(null, user);
    } catch (err) {
        cb(err);
    }
}

if (config.get('auth.intercode.clientID')){
    const intercodeStrategy =  new OAuth2Strategy( config.get('auth.intercode'),
        async function(req, accessToken, refreshToken, profile, cb) {
            try{
                const user = await models.user.findOrCreate(req.game.id, {
                    name: profile.name,
                    intercode_id: profile.id,
                    email: profile.email,
                    type: req.game.default_to_player?'player':'none'

                });
                req.session.accessToken = accessToken;
                cb(null, user);
            } catch (err) {
                cb(err);
            }
        });

    intercodeStrategy.userProfile = function (token, cb) {
        const decoded = jwt_decode(token);
        return cb(null, decoded.user);
    };

    passport.use('intercode', intercodeStrategy);
}

if (config.get('auth.local.key') && app.get('env') === 'development'){
    const localStrategy = new LocalStrategy(
        async function(apikey, cb) {
            const parts = apikey.split(/\//, 2);
            if (parts[0] !== config.get('auth.local.key')){
                cb(null, false);
            }
            try{
                const user = await models.user.get(parts[1]);
                console.log('API Token login for '+ user.name);
                cb(null, user);
            } catch(err){
                cb(err);
            }
        });

    passport.use('localapi', localStrategy);
}



// Set common helpers for the view
app.use(async function(req, res, next){
    res.locals.config = config;
    res.locals.session = req.session;
    res.locals.siteName = req.game.name;
    res.locals.title = req.game.name;
    res.locals._ = _;
    res.locals.moment = moment;
    res.locals.activeUser = req.user;
    res.locals.includeChatSidebar = true;
    res.locals.jitsiActive = await jitsi.active();
    res.locals.marked = marked;
    res.locals.capitalize = function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    next();
});

app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/auth', authRouter);
app.use('/link', linksRouter);
app.use('/player', playersRouter);
app.use('/run', runsRouter);
app.use('/group', groupsRouter);
app.use('/image', imageRouter);
app.use('/stub', stubRouter);
app.use('/screen', screenRouter);
app.use('/transition', transitionRouter);
app.use('/game', gameRouter);
app.use('/variable', variableRouter);
app.use('/document', documentRouter);
app.use('/code', codeRouter);
app.use('/trigger', triggerRouter);
app.use('/meeting', meetingRouter);
app.use('/character', characterRouter);
app.use('/ink', inkRouter);

app.use('/admin/game', adminGameRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    if (err.status !== 404){
        if (req.app.get('env') === 'development'){
            console.trace(err);
        } else {
            console.error(err);
        }
    }
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
