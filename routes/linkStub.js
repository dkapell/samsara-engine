const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const permission = require('../lib/permission');

async function getLink(req, res, next){
    const id = req.params.id;
    if (!id){
        return res.status(404);
    }
    try{
        res.locals.link = await req.models.link.get(id);
        res.render('link/stub');
    } catch (err) {
        next(err);
    }
}

const router = express.Router();

router.get('/:id', csrf(), getLink);

module.exports = router;
