"use strict";
const AWS = require('aws-sdk');
const cons = require('consolidate');
const fs = require('fs-extra');
const md5 = require('js-md5');

const ZipFile = require('./ZipFile');
const S3Manager = require('./S3Manager');
const KeyPairManager = require('./KeyPairManager');

class CloudformationManager {
    constructor(labContext) {
        this.labContext = labContext
    }

    _bindTemplate(path, context) {
        return new Promise((resolve, reject)=> {
            cons.ejs(path, context)
                .then((template) => {
                    //console.log(template);
                    resolve(("" + template).replace("////////", ""));
                })
                .catch(function (err) {
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

    createTemplate() {
        let keyPairManager = new KeyPairManager(this.labContext);
        return this._bindTemplate('template/cloudLab.template', {
            users: this.labContext.users,
            course: this.labContext.users[0].course,
            labContext: this.labContext,
            lab: this.getLabTag(),
            labHash: md5(this.getLabTag()),
            endLabCronExpression: this.getEndLabCronExpression(),
            keyPairs: JSON.stringify(keyPairManager.getAllKeyPairs())
        });
    }

    createDeleteStackLambdaDeploymentPackage() {
        let zipPath = '/tmp/deleteLabStack.zip';

        let copyDependencies = () => new Promise((resolve, reject)=> {
            console.log("copyDependencies");
            let tempFolder = "/tmp/DeleteStack";

            fs.copy(__dirname + "/../", tempFolder, function (err) {
                if (err) return reject(err);
                console.log('Copied node_modules!');
                resolve();
            });
        });

        let zipDeployment = () => new Promise((resolve, reject)=> {
            console.log("zipDeployment");

            let zipFile = new ZipFile({
                sourceDirectory: '/tmp/DeleteStack',
                destinationZip: zipPath
            });

            zipFile.zip().then(resolve).catch(reject);
        });
        let s3Manager = new S3Manager(this.labContext.course.region, this.labContext.configure.cloudformationS3Bucket);

        let getFileSizeInMegabytes = (filename)=> {
            let stats = fs.statSync(filename);
            let fileSizeInBytes = stats["size"];
            return fileSizeInBytes / 1000000.0
        }

        return new Promise((resolve, reject)=> {
            copyDependencies()
                .then(zipDeployment)
                .then(() => {
                    console.log("Upload to S3 " + getFileSizeInMegabytes(zipPath) + "mb");
                    let key = this.getLabTag() + "DeleteStackLambda.zip";
                    return s3Manager.uploadFile(key, zipPath);
                })
                .then(key=>resolve(key))
                .catch(err => {
                    console.error(err);
                    reject(err);
                });
        });

    }

    runCloudformation() {
        let endLabAmi = this.labContext.course.share.find(x=>x === "endLabAmi") != undefined;
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
        return new Promise((resolve, reject)=> {
            cloudformation.createStack(params, function (err, stackData) {
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
            TemplateBody: template.replace("////////", ""),
            TimeoutInMinutes: 15
        };
        let cloudformation = new AWS.CloudFormation({
            region: region,
            apiVersion: '2010-05-1let5'
        });

        return new Promise((resolve, reject)=> {
            cloudformation.createStack(params, function (err, stackData) {
                if (err) reject(err); // an error occurred
                else {
                    console.log(stackData);           // successful
                    resolve(stackData.StackId);
                }
            });
        });
    }


    getLabTag() {
        return this.labContext.lab.id.replace(/[^A-Za-z0-9]/g, '');
    }
}
module.exports = CloudformationManager;