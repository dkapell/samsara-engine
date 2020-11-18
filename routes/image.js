const express = require('express');
const csrf = require('csurf');
const _ = require('underscore');
const config = require('config');
const aws = require('aws-sdk');
const permission = require('../lib/permission');

/* GET images listing. */
async function list(req, res, next){
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
        ],
        current: 'Images'
    };
    try {
        res.locals.images = await req.models.image.list();
        res.render('image/list', { pageTitle: 'Images' });
    } catch (err){
        next(err);
    }
}

function showNew(req, res, next){
    res.locals.image = {
        description:null,
    };
    res.locals.breadcrumbs = {
        path: [
            { url: '/', name: 'Home'},
            { url: '/image', name: 'Images'},
        ],
        current: 'New'
    };

    res.locals.csrfToken = req.csrfToken();
    if (_.has(req.session, 'imageData')){
        res.locals.image = req.session.imageData;
        delete req.session.imageData;
    }
    res.render('image/new');
}

async function showEdit(req, res, next){
    const id = req.params.id;
    res.locals.csrfToken = req.csrfToken();

    try{
        const image = await req.models.image.get(id);
        res.locals.image = image;
        if (_.has(req.session, 'imageData')){
            res.locals.image = req.session.imageData;
            delete req.session.imageData;
        }
        res.locals.breadcrumbs = {
            path: [
                { url: '/', name: 'Home'},
                { url: '/image', name: 'Images'},
            ],
            current: 'Edit: ' + image.name
        };

        res.render('image/edit');
    } catch(err){
        next(err);
    }
}

async function update(req, res, next){
    const id = req.params.id;
    const image = req.body.image;
    req.session.imageData = image;

    try {
        const current = await req.models.image.get(id);

        await req.models.image.update(id, image);
        delete req.session.imageData;
        req.flash('success', 'Updated Image ' + image.name);
        res.redirect('/image');
    } catch(err) {
        req.flash('error', err.toString());
        return (res.redirect('/image/'+id));

    }
}

async function remove(req, res, next){
    const id = req.params.id;
    try {
        await req.models.image.delete(id);
        req.flash('success', 'Removed Image');
        res.redirect('/image');
    } catch(err) {
        return next(err);
    }
}

async function signS3(req, res, next){

    const fileName = decodeURIComponent(req.query.filename);
    const fileType = decodeURIComponent(req.query.filetype);

    if (!fileType.match(/^image/)){
        return res.json({success:false, error: 'invalid file type'});
    }

    const imageId = await req.models.image.create({
        name: fileName
    });
    const key = ['images', imageId, fileName].join('/');

    const s3 = new aws.S3({
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretKey'),
        signatureVersion: 'v4',
    });

    const s3Params = {
        Bucket: config.get('aws.imageBucket'),
        Key: key,
        Expires: 60,
        ContentType: fileType,
        ACL: 'public-read'
    };

    s3.getSignedUrl('putObject', s3Params, function(err, data){
        if(err){ return next(err); }
        res.json({
            success:true,
            data: {
                signedRequest: data,
                url: `https://${config.get('aws.imageBucket')}.s3.amazonaws.com/${key}`,
                imageId: imageId
            }
        });
    });
}

const router = express.Router();

router.use(permission('creator'));
router.use(function(req, res, next){
    res.locals.siteSection='config';
    next();
});

router.get('/', list);
router.get('/new', csrf(), showNew);
router.get('/sign-s3', csrf(), signS3);
router.get('/:id', csrf(), showEdit);
router.put('/:id', csrf(), update);
router.delete('/:id', remove);

module.exports = router;
