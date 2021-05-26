const express = require('express');
const csrf = require('csurf');
const pluralize = require('pluralize');
const config = require('config');
const async = require('async');
const _ = require('underscore');
const { nanoid } = require('nanoid');
const permission = require('../lib/permission');
const jitsi = require('../lib/jitsi');

/* GET meetings listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Meetings'
    };
    try {
        res.locals.meetings = await req.models.meeting.list();

        await async.each(res.locals.meetings, async(meeting) => {
            if (meeting.gamestate_id){
                meeting.gamestate = await req.models.gamestate.get(meeting.gamestate_id);
            }
        });
        res.locals.jitsi = {
            configured: config.get('jitsi.server'),
            instance: config.get('jitsi.instance.id'),
            videobridges: config.get('jitsi.instance.videobridges').split(/\s*,\s*/),
            status: await jitsi.server.status()
        };
        res.locals.csrfToken = req.csrfToken();

        //res.locals.gamestates = await req.models.gamestate.list();
        res.render('meeting/list', { pageTitle: 'Meetings' });
    } catch (err){
        next(err);
    }
}

async function show(req, res, next){
    if (! await jitsi.active()){
        return res.render('meeting/noservice');
    }
    try {
        const meeting = await req.models.meeting.get(req.params.id);
        if (meeting.gamestate_id){
            meeting.gamestate = await req.models.gamestate.get(meeting.gamestate_id);
        }
        meeting.domain = config.get('jitsi.server');
        meeting.jwt = jitsi.token(meeting.meeting_id);
        res.locals.meeting = meeting;
        res.locals.page_breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/meeting', name: 'Meetings'},
            ],
            current: meeting.name
        };
        res.render('meeting/show');
    } catch(err){
        next(err);
    }
}

async function showNew(req, res, next){
    try{
        res.locals.meeting = {
            name: null,
            description: null,
            meeting_id: nanoid(10),
            active: true,
            gm: null,
            gamestate_id: null,
        };
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/meeting', name: 'Meetings'},
            ],
            current: 'New'
        };
        res.locals.gamestates = await req.models.gamestate.list();
        res.locals.csrfToken = req.csrfToken();
        if (_.has(req.session, 'meetingData')){
            res.locals.meeting = req.session.meetingData;
            delete req.session.meetingData;
        }
        res.render('meeting/new');
    } catch(err){
        next(err);
    }
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const meeting = await req.models.meeting.get(id);
        res.locals.meeting = meeting;
        if (_.has(req.session, 'meetingData')){
            res.locals.meeting = req.session.meetingData;
            delete req.session.meetingData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/meeting', name: 'Meetings'},
            ],
            current: 'Edit: ' + meeting.name
        };
        res.locals.gamestates = await req.models.gamestate.list();
        res.render('meeting/edit');
    } catch(err){
        next(err);
    }
}

async function create(req, res, next){
    const meeting = req.body.meeting;

    req.session.meetingData = meeting;

    try{
        if (meeting.gamestate_id === ''){
            meeting.gamestate_id = null;
        }
        await req.models.meeting.create(meeting);
        delete req.session.meetingData;
        req.flash('success', `Created Meeting ${meeting.name}`);
        res.redirect('/meeting');
    } catch (err) {
        req.flash('error', err.toString());
        return res.redirect('/meeting/new');
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const meeting = req.body.meeting;
    req.session.meetingData = meeting;
    if (!_.has(meeting, 'active')){
        meeting.active = false;
    }
    if (meeting.gamestate_id === ''){
        meeting.gamestate_id = null;
    }

    try {
        const current = await req.models.meeting.get(id);

        await req.models.meeting.update(id, meeting);
        delete req.session.meetingData;
        req.flash('success', `Updated Meeting ${meeting.name}`);
        res.redirect('/meeting');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/meeting/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.meeting.delete(id);
        req.flash('success', 'Removed Meeting');
        res.redirect('/meeting');
    } catch(err) {
        return next(err);
    }
}

async function startJitsi(req, res, next){
    try{
        console.log(`starting Jitsi with ${Number(req.body.videobridges)} videobridges`);
        await jitsi.server.start(Number(req.body.videobridges));
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

async function stopJitsi(req, res, next){
    try{
        await jitsi.server.stop();
        res.json({success:true});
    } catch(err){
        res.json({success:false, error: err.message});
    }
}

const router = express.Router();

router.use(permission('gm'));
router.use(function(req, res, next){
    res.locals.siteSection='gm';
    next();
});

router.get('/', csrf(), list);
router.get('/new', csrf(), showNew);
router.get('/:id', csrf(), showEdit);
router.get('/:id/open', csrf(), show);
router.post('/', csrf(), create);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

router.put('/jitsi/start', csrf(), permission('admin'), startJitsi);
router.put('/jitsi/stop', csrf(), permission('admin'), stopJitsi);
module.exports = router;
