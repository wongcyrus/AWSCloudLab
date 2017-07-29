"use strict";
const AWS = require('aws-sdk');
const response = require('cfn-response');

const KeyPairManager = require('./lib/KeyPairManager');

exports.handler = (event, context, callback) => {

    let region = process.env.AWS_REGION;
    AWS.config.update({region: region});

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

    let keyPairManager = new KeyPairManager();
    let keypaires = event.ResourceProperties.Keypairs;
    if (event.RequestType === 'Create') {
        keyPairManager.createKeyPairs(region, event.ResourceProperties.KeypairS3Bucket, keypaires)
            .then(val => response.send(event, context, response.SUCCESS))
            .catch(err => response.send(event, context, response.FAILED));
        callback(null, "Create and uploaded Key pairs.");
    } else if (event.RequestType === 'Delete') {
        keyPairManager.deleteKeyPairs(region, keypaires)
            .then(val => response.send(event, context, response.SUCCESS))
            .catch(err => response.send(event, context, response.FAILED));
        callback(null, "Deleted Key pairs.");
    }
};





