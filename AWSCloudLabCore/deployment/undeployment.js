"use strict";
const AWS = require("aws-sdk");


let s3 = new AWS.S3({
    region: 'ap-northeast-1'
});

let emptyBucket = (bucketName, callback) => {
    let params = {
        Bucket: bucketName,
        Prefix: ''
    };

    s3.listObjects(params, (err, data) => {
        if (err) return callback(err);

        if (data.Contents.length === 0) callback();

        params = {Bucket: bucketName};
        params.Delete = {Objects: []};

        data.Contents.forEach((content) => {
            params.Delete.Objects.push({Key: content.Key});
        });

        s3.deleteObjects(params, (err, data) => {
            if (err) return callback(err);
            console.log(data);
            if (data.code.length === 1000) emptyBucket(bucketName, callback);
            else callback();
        });
    });
};

let cloudformation = new AWS.CloudFormation({
    region: "ap-northeast-1",
    apiVersion: '2010-05-15'
});
let buckets = ["awscloudlab-keypair", "awscloudlab-userlist", "awscloudlab-cloudformation", "awscloudlab-labwork"];
for (let i of buckets) {
    let params = {
        Bucket: i /* required */
    };
    emptyBucket(params.Bucket, () => {
        let params = {
            StackName: 'AWSCloudLab', /* required */
        };
        cloudformation.deleteStack(params, (err, data) => {
            if (err) console.log(err, err.stack); // an error occurred
            else console.log(data);           // successful response
        });
    });
}


