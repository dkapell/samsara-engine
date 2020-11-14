const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

async function getRoom(req, res, next){
    const id = req.params.id;
    if (!id){
        return res.status(404);
    }
    try{
        res.locals.room = await req.models.room.get(id);
        res.render('room/stub');
    } catch (err) {
        next(err);
    }
}

const router = express.Router();

router.get('/:id', csrf(), getRoom);

module.exports = router;
