"use strict";
//https://github.com/awslabs/dynamodb-document-js-sdk

const AWS = require("aws-sdk");
const s3 = require('s3');

module.exports.run = configure => {
    AWS.config.update({region: configure.labRegion});

    let params = {
        localDir: __dirname + "/namelist/",
        deleteRemoved: false,
        s3Params: {
            Bucket: configure.userListS3Bucket,
            Prefix: "",
            // other options supported by putObject, except Body and ContentLength.
            // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
        },
    };
    let awsS3Client = new AWS.S3({
        region: configure.region
    });
    let options = {
        s3Client: awsS3Client,
        // more options available. See API docs below.
    };
    let client = s3.createClient(options);
    let uploader = client.uploadDir(params);
    uploader.on('error', (err) => {
        console.error("unable to sync:", err.stack);
    });
    uploader.on('progress', () => {
        console.log("progress", uploader.progressAmount, uploader.progressTotal);
    });
    uploader.on('end', () => {
        console.log("done uploading");
    });
};

