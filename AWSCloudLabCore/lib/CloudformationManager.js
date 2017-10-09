"use strict";
const AWS = require('aws-sdk');
const cons = require('consolidate');
const fs = require('fs.extra');
const md5 = require('js-md5');
const filesize = require('file-size');

const ZipFile = require('./ZipFile');
const S3Manager = require('./S3Manager');
const KeyPairManager = require('./KeyPairManager');

class CloudformationManager {
    constructor(labContext) {
        this.labContext = labContext
    }

    _bindTemplate(path, context) {
        return new Promise((resolve, reject) => {
            cons.ejs(path, context)
                .then(template => {
                    resolve("" + template);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    getEndLabCronExpression() {
        let endTime = new Date(this.labContext.lab.endDateTime + 30 * 60000);
        let hour = endTime.getUTCHours();
        let minute = endTime.getUTCMinutes();

        return `${minute} ${hour} * * ? *`;
    }

    createLabTemplate() {
        let keyPairManager = new KeyPairManager(this.labContext);
        return this._bindTemplate('template/cloudLab.yaml', {
            users: this.labContext.users,
            course: this.labContext.users[0].course,
            labContext: this.labContext,
            lab: this.getLabTag(),
            labHash: md5(this.getLabTag()),
            endLabCronExpression: this.getEndLabCronExpression(),
            keyPairs: JSON.stringify(keyPairManager.getAllKeyPairs())
        });
    }

    bindBackupCfnTemplate(context, region, labWorkBucket) {
        context = {
            users: context,
            region: region,
            labWorkBucket: labWorkBucket
        };
        //No idea why cannot reference this._bindTemplate!
        return new Promise((resolve, reject) => {
            console.log('Create bindBackupCfnTemplate');
            cons.ejs('template/backupLabStorage.yaml', context)
                .then(template => {
                    resolve(template);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    createDeleteStackLambdaDeploymentPackage() {
        let zipPath = '/tmp/deleteLabStack.zip';

        let copyDependencies = () => new Promise((resolve, reject) => {
            console.log("copyDependencies");
            let tempFolder = "/tmp/DeleteStack";

            fs.copyRecursive(__dirname + "/../", tempFolder, err => {
                if (err) {
                    reject(err);
                }
                console.log('Copied node_modules!');
                resolve();
            });
        });

        let zipDeployment = () => new Promise((resolve, reject) => {
            console.log("Zip Deployment");

            let zipFile = new ZipFile({
                sourceDirectory: '/tmp/DeleteStack/',
                destinationZip: zipPath
            });

            zipFile.zip().then(resolve).catch(reject);
        });
        let s3Manager = new S3Manager(this.labContext.course.region, this.labContext.configure.cloudformationS3Bucket);

        let getFileSizeInMegabytes = (filename) => {
            let fd = fs.openSync(filename, 'a');
            let stats = fs.fstatSync(fd);
            let fileSizeInBytes = stats["size"];
            return filesize(fileSizeInBytes).human();
        };

        return new Promise((resolve, reject) => {
            copyDependencies()
                .then(zipDeployment)
                .then(() => {
                    console.log("Upload to S3 " + getFileSizeInMegabytes(zipPath));
                    let key = this.getLabTag() + "DeleteStackLambda.zip";
                    return s3Manager.uploadFile(key, zipPath);
                })
                .then(key => resolve(key))
                .catch(err => {
                    console.error(err);
                    reject(err);
                });
        });

    }

    runCloudformation() {
        let endLabAmi = this.labContext.course.share.find(x => x === "endLabAmi") !== undefined;
        let params = {
            StackName: this.getLabTag(), /* required */
            Capabilities: [
                'CAPABILITY_IAM'
            ],
            NotificationARNs: [
                `arn:aws:sns:${this.labContext.course.region}:${this.labContext.accountId}:AWSCloudLabStackEvent`
            ],
            Parameters: [
                {
                    ParameterKey: 'InstanceType',
                    ParameterValue: this.labContext.course.instanceType
                },
                {
                    ParameterKey: 'EndLabAMILambdaArn',
                    ParameterValue: `arn:aws:lambda:${this.labContext.course.region}:${this.labContext.accountId}:function:AWSCloudLabEndLabAmi`
                },
                {
                    ParameterKey: 'EndLabAMI',
                    ParameterValue: `${endLabAmi}`
                },
                {
                    ParameterKey: 'SmtpPassword',
                    ParameterValue: this.labContext.configure.smtpPassword || ""
                },
                {
                    ParameterKey: 'BootstrapDocument',
                    ParameterValue: this.labContext.BootstrapDocument || ""
                }
            ],
            Tags: [
                {
                    Key: 'lab',
                    Value: this.getLabTag()
                },
                {
                    Key: 'teacher',
                    Value: this.labContext.course.teacher
                },
                {
                    Key: 'course',
                    Value: this.labContext.course.course
                }
            ],
            TemplateBody: this.labContext.template,
            TimeoutInMinutes: 15
        };

        let cloudformation = new AWS.CloudFormation({
            region: this.labContext.course.region,
            apiVersion: '2010-05-1let5'
        });
        return new Promise((resolve, reject) => {
            cloudformation.createStack(params, (err, stackData) => {
                if (err) reject(err); // an error occurred
                else {
                    console.log(stackData);           // successful
                    resolve(stackData.StackId);
                }
            });
        });
    }

    runEndLabCloudformation(stackId, teacher, course, template, region) {
        let params = {
            StackName: stackId + "-EndLabProcess", /* required */
            Capabilities: [
                'CAPABILITY_IAM'
            ],
            Tags: [
                {
                    Key: 'lab',
                    Value: stackId
                },
                {
                    Key: 'teacher',
                    Value: teacher
                },
                {
                    Key: 'course',
                    Value: course
                }
            ],
            TemplateBody: template,
            TimeoutInMinutes: 15
        };
        let cloudformation = new AWS.CloudFormation({
            region: region,
            apiVersion: '2010-05-1let5'
        });

        return new Promise((resolve, reject) => {
            cloudformation.createStack(params, (err, stackData) => {
                if (err) {
                    console.error("runEndLabCloudformation Error");
                    console.error(params);
                    console.error(template);
                    reject(err);
                } // an error occurred
                else {
                    console.log(stackData);           // successful
                    resolve(stackData.StackId);
                }
            });
        });
    }

    getStackEvents(stackName, region, nextToken) {
        let _this = this;
        return new Promise((resolve, reject) => {
            const params = {
                StackName: stackName
            };
            if (nextToken)
                params.NextToken = nextToken;
            let cloudformation = new AWS.CloudFormation({
                region: region,
                apiVersion: '2010-05-1let5'
            });
            cloudformation.describeStackEvents(params, (err, data) => {
                if (err) reject(err, err.stack); // an error occurred
                else {
                    if (data.NextToken) {
                        console.log("Inter " + data.StackEvents.length);
                        _this.getStackEvents(stackName, region, data.NextToken)
                            .then(events => resolve(data.StackEvents.concat(events)));
                    } else {
                        console.log("Final " + data.StackEvents.length);
                        resolve(data.StackEvents);           // successful response
                    }
                }
            });
        });
    }

    getLabTag() {
        return this.labContext.lab.id.replace(/[^A-Za-z0-9]/g, '');
    }
}

module.exports = CloudformationManager;