"use strict";
//https://github.com/awslabs/dynamodb-document-js-sdk
const AWS = require("aws-sdk");


exports.handler = (event, context, callback) => {
    if (event.RequestType === 'Create') {
        AWS.config.update({region: process.env.labRegion});
        let docClient = new AWS.DynamoDB.DocumentClient();

        let pfunc = (err, data) => {
            if (err) {
                console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("Added item:", JSON.stringify(data, null, 2));
            }
        };

        let configure = {
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


        let params = {
            TableName: "configure",
            Item: configure
        };
        docClient.put(params, pfunc);

        params = {
            TableName: "calendar",
            Item: {
                "teacher": process.env.teacherEmail,
                "icsUrl": process.env.teacherCalenderIcsUrl
            }
        };
        docClient.put(params, pfunc);

        params = {
            TableName: "course",
            Item: {
                "course": process.env.teacherCourse,
                "teacher": process.env.teacherEmail,
                "region": process.env.labRegion,
                "imageId": process.env.imageId,
                "labMaterialSnapshotId": process.env.labMaterialSnapshotId,
                "labStorageSnapshotId": process.env.labStorageSnapshotId,
                "instanceType": process.env.instanceType,
                "continue": process.env.continue,
                "share": process.env.share.split(',')
            }
        };

        docClient.put(params, pfunc);

        callback(null, "Done!")
    }

};

