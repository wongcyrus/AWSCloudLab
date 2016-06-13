"use strict";
const AWS = require('aws-sdk');
const cons = require('consolidate');
const mailcomposer = require("mailcomposer");

const DynamodbManager = require('./lib/DynamodbManager');
const CloudformationManager = require('./lib/CloudformationManager');
const EmailManager = require('./lib/EmailManager');

const projectId = "awscloudlab";

let configure;
let course;

exports.handler = (event, context, callback) => {
    let region = context.invokedFunctionArn.split(":")[3];
    AWS.config.update({region: region});

    let cloudformation = new AWS.CloudFormation({
        region: region,
        apiVersion: '2010-05-1let5'
    });
    let ec2 = new AWS.EC2();

    let getConfigure = ()=> new Promise((resolve, reject)=> {
        console.log("Get Configure");
        let dynamodbManager = new DynamodbManager(region);
        dynamodbManager.getItem("configure", {projectId}).then(
            data => resolve(data),
            err => reject(err)
        );
    });
    let getLab = stackName=> new Promise((resolve, reject)=> {
        console.log("Get Lab");
        let dynamodbManager = new DynamodbManager(region);
        dynamodbManager.getItem("lab", {id: stackName}).then(
            data => resolve({course: data.course, teacher: data.teacher}),
            err => reject(err)
        );
    });
    let getCourse = courseAndTeacher=> new Promise((resolve, reject)=> {
        console.log("Get course");
        let dynamodbManager = new DynamodbManager(region);
        dynamodbManager.getItem("course", courseAndTeacher).then(
            data => resolve(data),
            err => reject(err)
        );
    });

    let getStackEvents = (stackName, nextToken) => new Promise((resolve, reject)=> {
        var params = {
            StackName: stackName
        };
        if (nextToken)
            params.NextToken = nextToken;
        cloudformation.describeStackEvents(params, function (err, data) {
            if (err)reject(err, err.stack); // an error occurred
            else {
                if (data.NextToken) {
                    console.log("Inter " + data.StackEvents.length);
                    getStackEvents(stackName, data.NextToken)
                        .then(events => resolve(data.StackEvents.concat(events)));
                } else {
                    console.log("Final " + data.StackEvents.length);
                    resolve(data.StackEvents);           // successful response
                }
            }
        });
    });

    let getLabStackId = (message)=> {
        let keypairMap = new Map();
        message.split('\n').forEach(line => keypairMap.set(line.split("=")[0], (line.split("=")[1] + "").replace(/'/g, "")));

        if (keypairMap.get('ResourceType') === 'AWS::CloudFormation::Stack' &&
            keypairMap.get('ResourceStatus') === 'DELETE_COMPLETE' &&
            keypairMap.get('LogicalResourceId') === keypairMap.get('StackName')) {
            return keypairMap.get('StackId');
        }
        return undefined;
    }

    let getSnapshots = (snapshotIds)=> new Promise((resolve, reject)=> {
        let params = {DryRun: false, SnapshotIds: snapshotIds};
        ec2.describeSnapshots(params, function (err, data) {
            if (err) reject(err); // an error occurred
            else    resolve(data);           // successful response
        });
    });

    let shareSnapshot = context=> new Promise((resolveAll, rejectAll)=> {
        let sharePromises = [];
        if (course.share.find(x=>x === "labStorageSnapshotId")) {
            let params = {
                SnapshotId: context.labStorageSnapshotId, /* required */
                Attribute: 'createVolumePermission',
                DryRun: false,
                OperationType: 'add',
                UserIds: [
                    context.awsAccountId
                ]
            };
            sharePromises.push(new Promise((resolve, reject)=> {
                    ec2.modifySnapshotAttribute(params, function (err, data) {
                        if (err) reject(err); // an error occurred
                        else     resolve(data);           // successful response
                    });
                })
            );
        }
        if (course.share.find(x=>x === "labMaterialSnapshotId")) {
            let params = {
                SnapshotId: course.labMaterialSnapshotId, /* required */
                Attribute: 'createVolumePermission',
                DryRun: false,
                OperationType: 'add',
                UserIds: [
                    context.awsAccountId
                ]
            };
            sharePromises.push(new Promise((resolve, reject)=> {
                    ec2.modifySnapshotAttribute(params, function (err, data) {
                        if (err) reject(err); // an error occurred
                        else     resolve(data);           // successful response
                    });
                })
            );
        }

        if (course.share.find(x=>x === "imageId")) {
            let params = {
                ImageId: course.imageId, /* required */
                Attribute: 'launchPermission',
                DryRun: false,
                OperationType: 'add',
                UserIds: [
                    context.awsAccountId
                ]
            };
            sharePromises.push(new Promise((resolve, reject)=> {
                    ec2.modifyImageAttribute(params, function (err, data) {
                        if (err && err.code === "AuthFailure") {
                            console.log("AuthFailure cannot share! And, it should be public image.");
                            resolve(data);
                        }
                        if (err) reject(err); // an error occurred
                        else     resolve(data);           // successful response
                    });
                })
            );
        }

        if (course.share.find(x=>x === "endLabAmi")) {
            let params = {
                ImageId: context.endLabAmi, /* required */
                Attribute: 'launchPermission',
                DryRun: false,
                OperationType: 'add',
                UserIds: [
                    context.awsAccountId
                ]
            };
            sharePromises.push(new Promise((resolve, reject)=> {
                    ec2.modifyImageAttribute(params, function (err, data) {
                        if (err && err.code === "AuthFailure") {
                            console.log("AuthFailure cannot share! And, it should be public image.");
                            resolve(data);
                        }
                        if (err) reject(err); // an error occurred
                        else     resolve(data);           // successful response
                    });
                })
            );
        }
        if (sharePromises.length == 0) {
            resolveAll(context);
        } else {
            Promise.all(sharePromises)
                .then(()=> resolveAll(context))
                .catch(rejectAll);
        }
    });

    let bindEmailTemplate = context => new Promise((resolve, reject)=> {
        console.log(context);

        context.labWorkBucket = configure.labWorkBucket;
        context.labStorageSnapshotUrl = `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#Snapshots:visibility=private;search=${context.labStorageSnapshotId}`;
        if (course.share.find(x=>x === "labStorageSnapshotId") == undefined) {
            context.labStorageSnapshotId = undefined;
        }
        if (course.share.find(x=>x === "labMaterialSnapshotId")) {
            context.labMaterialSnapshotId = course.labMaterialSnapshotId;
            context.labMaterialSnapshotUrl = `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#Snapshots:visibility=private;search=${context.labMaterialSnapshotId}`;
        }
        if (course.share.find(x=>x === "imageId")) {
            context.imageId = course.imageId;
            context.imageIdUrl = `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}1#Images:visibility=private-images;search=${context.imageId}`;
        }

        if (course.share.find(x=>x === "endLabAmi")) {
            context.endLabImageIdUrl = `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#Images:visibility=private-images;imageId=${context.endLabAmi}`;
        }

        cons.ejs(__dirname + '/template/endLabEmail.ejs', context)
            .then((template) => {
                context.emailBody = template;
                resolve(context);
            })
            .catch(function (err) {
                reject(err);
            });
    });

    let bindBackupScriptTemplate = context => new Promise((resolve, reject)=> {
        context = {
            users: context,
            region: region,
            labWorkBucket: configure.labWorkBucket
        }
        cons.ejs(__dirname + '/template/backupScript.ejs', context)
            .then((template) => {
                context.backupScriptLines = template.split("\r\n").map(l=>l.replace(/"/g, '\\"'));
                resolve(context);
            })
            .catch(function (err) {
                reject(err);
            });
    });
    let bindBackupCfnTemplate = context => new Promise((resolve, reject)=> {
        cons.ejs(__dirname + '/template/backupLabStorage.template', context)
            .then((template) => {
                resolve(template);
            })
            .catch(function (err) {
                reject(err);
            });
    });

    let sendEmails = shareables => {
        let emailManager = new EmailManager(configure.senderEmail, configure.sesRegion, configure.smtpHost, configure.stmpUser, configure.smtpPassword);
        return Promise.all(shareables.map(s=> emailManager.sendEmail(s.email, s.course.course + " End Lab Resources", s.emailBody, JSON.stringify(context))));
    }

    let getSharableImageIds = lab => new Promise((resolve, reject)=> {
        let params = {
            Filters: [{
                Name: 'tag:lab', Values: [lab]
            }]
        };
        ec2.describeImages(params, function (err, data) {
            if (err) reject(err); // an error occurred
            else {
                resolve(data.Images.map(c=> {
                    return {
                        imageId: c.ImageId,
                        email: c.Tags.find(p=>p.Key === 'Owner').Value
                    }
                }));
            }
            // successful response
        });
    });

    let sharingAndBackup = (studentSnapshots)=> {
        let lab = studentSnapshots[0].lab, teacher = studentSnapshots[0].teacher, course = studentSnapshots[0].course.course;
        let isValidateAwsAccountId = awsAccountId => (/^\d+$/.test(awsAccountId) && awsAccountId.length == 12);
        let shareableSnapshots = studentSnapshots.filter(s=>isValidateAwsAccountId(s.awsAccountId));

        let sendShareEmails;
        if (studentSnapshots[0].course.share.find(x=>x === "endLabAmi")) {
            sendShareEmails = ()=> getSharableImageIds(lab)
                .then(images=> {
                    console.log(images);
                    shareableSnapshots.map(s=> {
                        s.endLabAmi = images.find(p=>p.email === s.email).imageId;
                        return s;
                    });
                })
                .then(()=> Promise.all(shareableSnapshots.map(shareSnapshot)))
                .then(()=> Promise.all(shareableSnapshots.map(bindEmailTemplate)))
                .then(sendEmails);
        }
        else {
            sendShareEmails = ()=> Promise.all(shareableSnapshots.map(shareSnapshot))
                .then(()=> Promise.all(shareableSnapshots.map(bindEmailTemplate)))
                .then(sendEmails);
        }

        let cloudformationManager = new CloudformationManager();
        let backupToS3 = () => bindBackupScriptTemplate(studentSnapshots)
            .then(bindBackupCfnTemplate)
            .then(template=>cloudformationManager.runEndLabCloudformation(lab, teacher, course, template, region));
        return Promise.all([sendShareEmails(), backupToS3()]);
    }

    let stackId = getLabStackId(event.Records[0].Sns.Message);
    let IsSnapshotEvent = event => event.ResourceType === 'AWS::EC2::Snapshot' && event.ResourceStatus === 'CREATE_COMPLETE';

    if (stackId) {
        console.log("stackId=" + stackId);
        console.log(event.Records[0].Sns);
        let stackName = stackId.split("/")[1];
        getLab(stackName)
            .then(getCourse)
            .then(c=> {
                course = c;
                return getConfigure()
            })
            .then(c=> {
                configure = c;
                return getStackEvents(stackId);
            })
            .then(events=> getSnapshots(events.filter(IsSnapshotEvent).map(s=>s.PhysicalResourceId)))
            .then(c=> c.Snapshots.map(s=> {
                return {
                    labStorageSnapshotId: s.SnapshotId,
                    snapshotId: s.SnapshotId,
                    email: s.Tags.find(p=>p.Key === 'Owner').Value,
                    course: course,
                    lab: s.Tags.find(p=>p.Key === 'lab').Value,
                    teacher: s.Tags.find(p=>p.Key === 'teacher').Value,
                    awsAccountId: s.Tags.find(p=>p.Key === 'AWSAccount').Value
                };
            }))
            .then(sharingAndBackup)
            .then(message => callback(null, "Done!\n" + message))
            .catch(err=>callback(err));
    } else {
        callback(null, "Not End Lab Stack!");
    }
}








