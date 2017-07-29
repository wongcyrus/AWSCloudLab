"use strict";
const exec = require('child_process').exec;
const fs = require('fs.extra');
const AWS = require('aws-sdk');
const S3Manager = require('./../lib/S3Manager');
const dataSeed = require('./dataSeed');

// const configure = {
//     "projectId": "awscloudlab",
//     "labRegion": "ap-northeast-1",
//     "userListS3Bucket": "student2.cloudlabhk.com",
//     "keypairS3Bucket": "keypairs2.cloudlabhk.com",
//     "cloudformationS3Bucket": "cloudformation2.cloudlabhk.com",
//     "labWorkBucket": "labwork2.cloudlabhk.com",
//     "senderEmail": "noreply@cloudlabhk.com",
//     "sesRegion": "us-east-1",
//     "expirationInDays": 180
// };

const configure = {
    "projectId": "awscloudlab",
    "labRegion": "ap-northeast-1",
    "userListS3Bucket": "student2.cloudlabhk.com",
    "keypairS3Bucket": "keypairs2.cloudlabhk.com",
    "cloudformationS3Bucket": "cloudformation2.cloudlabhk.com",
    "labWorkBucket": "labwork3.cloudlabhk.com",
    "senderEmail": "cloudlabaws@gmail.com",
    "smtpHost": "smtp.gmail.com",
    "stmpUser": "cloudlabaws@gmail.com",
    "smtpPassword": "XXXXXXXXXXXXXXXXXXX",
    "expirationInDays": 180
};

AWS.config.update({region: configure.labRegion});

let awscloudlabschedulerJar = "awscloudlabscheduler-1.0.jar";
let awscloudlabschedulerZip = "awscloudlab_latest.zip";
let awscloudlabschedulerJarFilePath = __dirname + '/../dist/' + awscloudlabschedulerJar;
let awscloudlabschedulerZipFilePath = __dirname + '/../dist/' + awscloudlabschedulerZip;

let runCommand = (cmd, workingDir) => new Promise((resolve, reject) => {
    exec(cmd, {cwd: workingDir}, (error, stdout, stderr) => {
        if (error) {
            console.log(`stderr: ${stderr}`);
            console.log(`stderr: ${error}`);
            reject(`exec error: ${error}`);
            return;
        }
        console.log(cmd + `\nstdout:\n ${stdout}`);
        resolve(cmd + `\nstdout:\n ${stdout}`);
    });
});
let packageLambdaZip = () => runCommand('grunt --gruntfile Gruntfile.js lambda_package:awsCloudLabBuilder', __dirname + '/../');
let runGradleFatJar = () => runCommand('gradle fatJar', __dirname + '/../../AWSCloudLabScheduler');

let copyFatJar = () => new Promise((resolve, reject) => {
    let source = __dirname + '/../../AWSCloudLabScheduler/build/libs/awscloudlabscheduler-1.0.jar';
    fs.copy(source, awscloudlabschedulerJarFilePath, {replace: true}, (err) => {
        if (err) {
            reject(err);
        }
        resolve(awscloudlabschedulerJarFilePath);
    });
});

let packageLambda = () => new Promise((resolve, reject) => {
    Promise.all([runGradleFatJar().then(copyFatJar()), packageLambdaZip()])
        .then(results => {
            results.forEach(console.log);
            resolve("Package Completed!");
        })
        .catch(err => {
            reject(err);
        });
});


let createSourceAndLabworkBucket = () => new Promise((resolveAll, rejectAny) => {
    let s3 = new AWS.S3();

    let createBucket = (bucket) => new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket, /* required */
            CreateBucketConfiguration: {
                LocationConstraint: configure.labRegion
            }
        };
        s3.createBucket(params, (err, data) => {
            //Bucket may exist and cause error, and ignore it!
            if (err && err.code != 'BucketAlreadyOwnedByYou')
                reject(err, err.stack); // an error occurred
            resolve(data);           // successful response
        });
    });

    Promise.all([createBucket(configure.cloudformationS3Bucket), createBucket(configure.labWorkBucket)])
        .then(results => {
            results.forEach(console.log);
            resolveAll("Upload Completed!");
        }).catch(err => {
        rejectAny(err);
    });
});

let uploadLambdaCode = () => new Promise((resolve, reject) => {
    let s3Manager = new S3Manager(configure.labRegion, configure.cloudformationS3Bucket);
    Promise.all([
        s3Manager.uploadFile("LambdaFunction.yaml", __dirname + "/cfn/LambdaFunction.yaml"),
        s3Manager.uploadFile("DynamoDB.yaml", __dirname + "/cfn/DynamoDB.yaml"),
        s3Manager.uploadFile("AWSCloudLabBackend.yaml", __dirname + "/cfn/AWSCloudLabBackend.yaml"),
        s3Manager.uploadFile("S3.yaml", __dirname + "/cfn/S3.yaml"),
        s3Manager.uploadFile("SNS.yaml", __dirname + "/cfn/SNS.yaml"),
        s3Manager.uploadFile(awscloudlabschedulerZip, awscloudlabschedulerZipFilePath),
        s3Manager.uploadFile(awscloudlabschedulerJar, awscloudlabschedulerJarFilePath)
    ]).then(results => {
        results.forEach(console.log);
        resolve("Upload Completed!");
    }).catch(err => {
        reject(err);
    });
});


let createAWSCloudLabStack = () => new Promise((resolve, reject) => {
    let params = {
        StackName: "AWSCloudLab", /* required */
        Capabilities: [
            'CAPABILITY_IAM'
        ],
        Parameters: [
            {
                ParameterKey: 'SourceBucket',
                ParameterValue: configure.cloudformationS3Bucket,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'KeypairsBucket',
                ParameterValue: configure.keypairS3Bucket,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'UserListBucket',
                ParameterValue: configure.userListS3Bucket,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'DynamoDBStackUrl',
                ParameterValue: `https://s3-${configure.labRegion}.amazonaws.com/${configure.cloudformationS3Bucket}/DynamoDB.yaml`,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'LambdaStackUrl',
                ParameterValue: `https://s3-${configure.labRegion}.amazonaws.com/${configure.cloudformationS3Bucket}/LambdaFunction.yaml`,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'S3StackUrl',
                ParameterValue: `https://s3-${configure.labRegion}.amazonaws.com/${configure.cloudformationS3Bucket}/S3.yaml`,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'SNSStackUrl',
                ParameterValue: `https://s3-${configure.labRegion}.amazonaws.com/${configure.cloudformationS3Bucket}/SNS.yaml`,
                UsePreviousValue: true
            },
            {
                ParameterKey: 'ExpirationInDays',
                ParameterValue: "" + configure.expirationInDays,
                UsePreviousValue: true
            }
        ]
        ,
        Tags: [
            {
                Key: 'Project',
                Value: "AWS Cloud Lab"
            }
        ],
        TemplateURL: `https://s3-${configure.labRegion}.amazonaws.com/${configure.cloudformationS3Bucket}/AWSCloudLabBackend.yaml`,
        TimeoutInMinutes: 15
    };
    let cloudformation = new AWS.CloudFormation({
        region: configure.labRegion,
        apiVersion: '2010-05-1let5'
    });
    cloudformation.createStack(params, (err, stackData) => {
        if (err) reject(err); // an error occurred
        else {
            console.log(stackData);           // successful
            resolve(stackData.ResponseMetadata.StackId);
        }
    });
});

let delay = ms => {
    return new Promise((resolve, reject) => {
        console.log("Delay for " + ms + "ms.");
        setTimeout(resolve, ms); // (A)
    });
}
let delay1Min = () => delay(1000 * 60);

packageLambda()
    .then(createSourceAndLabworkBucket())
    .then(uploadLambdaCode)
    .then(createAWSCloudLabStack)
    .then(delay1Min)
    .then(c => {
        console.log(c);
        dataSeed.run(configure);
    })
    .catch(console.error);

//dataSeed.run(configure);




