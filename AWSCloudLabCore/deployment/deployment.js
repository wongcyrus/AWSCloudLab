"use strict";
const exec = require('child_process').exec;
const fs = require('fs.extra');
const AWS = require('aws-sdk');
const S3Manager = require('./../lib/S3Manager');
const dataSeed = require('./dataSeed');

const configure = {
    "projectId": "awscloudlab",
    "labRegion": "ap-northeast-1",
    "userListS3Bucket": "awscloudlab-userlist",
    "sourceBucket": "cloudformation2.cloudlabhk.com"
};

AWS.config.update({region: configure.labRegion});

let awscloudlabschedulerJar = "awscloudlabscheduler-1.0.jar";
let awscloudlabschedulerZip = "awscloudlab_latest.zip";
let awscloudlabCloudFormation = "AWSCloudLab.yaml";
let awscloudlabschedulerJarFilePath = __dirname + '/../dist/' + awscloudlabschedulerJar;
let awscloudlabschedulerZipFilePath = __dirname + '/../dist/' + awscloudlabschedulerZip;
let awscloudlabCloudFormationFilePath = __dirname + '/../dist/' + awscloudlabCloudFormation;

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


let uploadCode = () => new Promise((resolve, reject) => {
    console.log("Upload Code");
    let s3Manager = new S3Manager(configure.labRegion, configure.sourceBucket);
    Promise.all([
        s3Manager.uploadFile(awscloudlabCloudFormation, awscloudlabCloudFormationFilePath),
        s3Manager.uploadFile(awscloudlabschedulerZip, awscloudlabschedulerZipFilePath),
        s3Manager.uploadFile(awscloudlabschedulerJar, awscloudlabschedulerJarFilePath)
    ]).then(results => {
        results.forEach(console.log);
        resolve("Upload Completed!");
    }).catch(err => {
        reject(err);
    });
});

let cloudformation = new AWS.CloudFormation({
    region: configure.labRegion,
    apiVersion: '2010-05-15'
});

let createAWSCloudLabCreateStackSet = () => new Promise((resolve, reject) => {
    let params = {
        ChangeSetName: "AWSCloudLabChangeSet", /* required */
        StackName: 'AWSCloudLab', /* required */
        ChangeSetType: "CREATE",
        Capabilities: [
            'CAPABILITY_IAM'
        ],
        Parameters: [
            {
                ParameterKey: 'dynamodbAutoscaling',
                ParameterValue: "false"
            },
            {
                ParameterKey: 'continue',
                ParameterValue: "false"
            }
        ]
        ,
        Tags: [
            {
                Key: 'Project',
                Value: "AWS Cloud Lab"
            }
        ],
        TemplateURL: `https://s3-${configure.labRegion}.amazonaws.com/${configure.sourceBucket}/${awscloudlabCloudFormation}`
    };

    cloudformation.createChangeSet(params, (err, stackData) => {
        if (err) reject(err); // an error occurred
        else {
            console.log(stackData);           // successful
            resolve(stackData.StackId);
        }
    });
});
let createAWSCloudLabExecuteStackSet = (stackSetId) => new Promise((resolve, reject) => {
    let params = {
        ChangeSetName: "AWSCloudLabChangeSet", /* required */
        StackName: "AWSCloudLab"
    };
    console.log(params);
    cloudformation.executeChangeSet(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data);           // successful response
            resolve(data);
        }
    });
});

let invokeAWSCloudLabScheduler = (stackSetId) => new Promise((resolve, reject) => {
    let lambda = new AWS.Lambda({region: configure.labRegion, apiVersion: '2015-03-31'});
    let params = {
        FunctionName: "AWSCloudLabScheduler",
        InvokeArgs: ""
    };
    lambda.invokeAsync(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data);           // successful response
            resolve(data);
        }
    });
});

let delay = (ms, data) => {
    return new Promise((resolve, reject) => {
        console.log("Delay for " + ms + "ms. " + data);
        setTimeout(() => resolve(data), ms); // (A)
    });
};
let delay1Min = () => delay(1000 * 60, "No data");
let delay30Seconds = data => delay(1000 * 30, data);
packageLambda()
    .then(uploadCode)
    //uploadCode()
    .then(createAWSCloudLabCreateStackSet)
    .then(delay30Seconds)
    .then(createAWSCloudLabExecuteStackSet)
    .then(delay1Min)
    .then(c => {
        console.log(c);
        dataSeed.run(configure);
    })
    .then(delay1Min)
    .then(invokeAWSCloudLabScheduler)
    .catch(console.error);





