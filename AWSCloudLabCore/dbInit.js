"use strict";
//https://github.com/awslabs/dynamodb-document-js-sdk
const AWS = require("aws-sdk");
const response = require('cfn-response');


exports.handler = (event, context, callback) => {
    if (event.RequestType === 'Create') {
        AWS.config.update({region: process.env.labRegion});
        let docClient = new AWS.DynamoDB.DocumentClient();

        let config = {};

        if (process.env.sesRegion !== "")
            config = {
                "cloudformationS3Bucket": process.env.cloudformationS3Bucket,
                "expirationInDays": process.env.expirationInDays,
                "keypairS3Bucket": process.env.KeypairsBucket,
                "labRegion": process.env.labRegion,
                "labWorkBucket": process.env.labWorkBucket,
                "projectId": "awscloudlab",
                "senderEmail": process.env.senderEmail,
                "sesRegion": process.env.sesRegion,
                "userListS3Bucket": process.env.UserListBucket,
            };
        else
            config = {
                "cloudformationS3Bucket": process.env.cloudformationS3Bucket,
                "expirationInDays": process.env.expirationInDays,
                "keypairS3Bucket": process.env.KeypairsBucket,
                "labRegion": process.env.labRegion,
                "labWorkBucket": process.env.labWorkBucket,
                "projectId": "awscloudlab",
                "senderEmail": process.env.senderEmail,
                "smtpHost": process.env.smtpHost,
                "smtpPassword": process.env.smtpPassword,
                "stmpUser": process.env.stmpUser,
                "userListS3Bucket": process.env.UserListBucket,
            };

        let data = [{
            TableName: "configure",
            Item: config
        }, {
            TableName: "calendar",
            Item: {
                "teacher": process.env.teacherEmail,
                "icsUrl": process.env.teacherCalenderIcsUrl
            }
        }, {
            TableName: "course",
            Item: {
                "course": process.env.teacherCourse,
                "teacher": process.env.teacherEmail,
                "region": process.env.labRegion,
                "imageId": process.env.imageId,
                "labMaterialSnapshotId": process.env.labMaterialSnapshotId,
                "labStorageSnapshotId": process.env.labStorageSnapshotId,
                "instanceType": process.env.instanceType,
                "continue": JSON.parse(process.env.continue.toLowerCase()),
                "share": process.env.share.split(',').map(x => x.trim())
            }
        }];

        let putFunc = (params) => new Promise((resolve, reject) => {
            docClient.put(params, (err, data) => {
                if (err) {
                    console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    console.log("Added item:", JSON.stringify(data, null, 2));
                    resolve(data);
                }
            });
        });

        Promise.all(data.map(putFunc)).then(values => {
            console.log(values);
            response.send(event, context, response.SUCCESS);
            callback(null, "Done!")
        }).catch(reason => {
            console.log(reason);
            response.send(event, context, response.FAILED);
            callback(reason, null);
        });
    } else {
        response.send(event, context, response.SUCCESS);
    }
};

