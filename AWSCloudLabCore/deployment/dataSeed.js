"use strict";
//https://github.com/awslabs/dynamodb-document-js-sdk

const AWS = require("aws-sdk");
const s3 = require('s3');

module.exports.run = configure => {
    AWS.config.update({region: configure.labRegion});
    let docClient = new AWS.DynamoDB.DocumentClient();

    let pfunc = (err, data) => {
        if (err) {
            console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Added item:", JSON.stringify(data, null, 2));
        }
    };

    let params = {
        TableName: "configure",
        Item: configure
    };
    docClient.put(params, pfunc);

    params = {
        TableName: "calendar",
        Item: {
            "teacher": "cywong@vtc.edu.hk",
            "icsUrl": "https://calendar.google.com/calendar/ical/spe8ehlqjkv8hd7mdjs3d2g80c%40group.calendar.google.com/public/basic.ics"
        }
    };
    docClient.put(params, pfunc);

    params = {
        TableName: "course",
        Item: {
            "course": "ITP4104 Lab A",
            "teacher": "cywong@vtc.edu.hk",
            "region": "ap-northeast-1",
            "imageId": "ami-d76d77b0",
            "labMaterialSnapshotId": "snap-017f11db799e495da",
            "labStorageSnapshotId": "snap-017f11db799e495da",
            "instanceType": "t2.nano",
            "continue": true,
            "share": ["imageId", "labMaterialSnapshotId", "labStorageSnapshotId", "endLabAmi"]
        }
    };
    docClient.put(params, pfunc);

    params = {
        TableName: "course",
        Item: {
            "course": "ITP4104 Lab B",
            "teacher": "cywong@vtc.edu.hk",
            "region": "ap-northeast-1",
            "imageId": "ami-447a9d25",
            "labMaterialSnapshotId": "snap-1f62f2f0",
            "labStorageSnapshotId": "snap-1f62f2f0",
            "instanceType": "t2.nano",
            "continue": true,
            "share": ["imageId", "labMaterialSnapshotId", "labStorageSnapshotId", "endLabAmi"]
        }
    };
    docClient.put(params, pfunc);

    params = {
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
    uploader.on('error', function (err) {
        console.error("unable to sync:", err.stack);
    });
    uploader.on('progress', function () {
        console.log("progress", uploader.progressAmount, uploader.progressTotal);
    });
    uploader.on('end', function () {
        console.log("done uploading");
    });
};

