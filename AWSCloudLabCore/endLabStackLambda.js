"use strict";
const AWS = require('aws-sdk');
const cons = require('consolidate');
const mailcomposer = require("mailcomposer");

const DynamodbManager = require('./lib/DynamodbManager');
const CloudformationManager = require('./lib/CloudformationManager');
const EmailManager = require('./lib/EmailManager');
const Ec2Manager = require('./lib/Ec2Manager');
const S3Manager = require('./lib/S3Manager');

const projectId = "awscloudlab";

let configure;
let course;

exports.handler = (event, context, callback) => {
    let region = context.invokedFunctionArn.split(":")[3];
    AWS.config.update({region: region});

    let ec2Manager = new Ec2Manager();
    let cloudformationManager = new CloudformationManager();

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


    let getLabStackId = (message)=> {
        let keypairMap = new Map();
        message.split('\n').forEach(line => keypairMap.set(line.split("=")[0], (line.split("=")[1] + "").replace(/'/g, "")));

        if (keypairMap.get('ResourceType') === 'AWS::CloudFormation::Stack' &&
            keypairMap.get('ResourceStatus') === 'DELETE_COMPLETE' &&
            keypairMap.get('LogicalResourceId') === keypairMap.get('StackName')) {
            return keypairMap.get('StackId');
        }
        return undefined;
    };


    let shareSnapshot = context=> new Promise((resolveAll, rejectAll)=> {

        let validToShare = resource =>course.share.find(x=>x === resource) && context[resource] && context[resource] !== "";
        let sharePromises = [];
        if (validToShare("labStorageSnapshotId")) {
            console.log("Share labStorageSnapshotId:" + context.labStorageSnapshotId + " to " + context.awsAccountId);
            sharePromises.push(ec2Manager.shareSnapshot(context.labStorageSnapshotId, context.awsAccountId));
        }
        if (validToShare("labMaterialSnapshotId")) {
            sharePromises.push(ec2Manager.shareSnapshot(context.labMaterialSnapshotId, context.awsAccountId));
        }
        if (validToShare("imageId")) {
            sharePromises.push(ec2Manager.shareAmi(course.imageId, context.awsAccountId));
        }
        if (validToShare("endLabAmi")) {
            sharePromises.push(ec2Manager.shareAmi(context.endLabAmi, context.awsAccountId));
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

    let sendEmails = shareables => {
        let emailManager = new EmailManager(configure.senderEmail, configure.sesRegion, configure.smtpHost, configure.stmpUser, configure.smtpPassword);
        return Promise.all(shareables.map(s=> emailManager.sendEmail(s.email, s.course.course + " End Lab Resources", s.emailBody, JSON.stringify(context))));
    };


    let sharingAndBackup = (studentResource)=> {
        let lab = studentResource[0].lab, teacher = studentResource[0].teacher, course = studentResource[0].course.course;
        let isValidateAwsAccountId = awsAccountId => (/^\d+$/.test(awsAccountId) && awsAccountId.length == 12);
        let shareableResource = studentResource.filter(s=>isValidateAwsAccountId(s.awsAccountId));

        let sendShareEmails;
        if (studentResource[0].course.share.find(x=>x === "endLabAmi")) {
            sendShareEmails = ()=> ec2Manager.getSharableImageIds(lab)
                .then(images=> {
                    console.log(images);
                    if (images.length > 0)
                        shareableResource.map(s=> {
                            s.endLabAmi = images.find(p=>p.email === s.email).imageId;
                            return s;
                        });
                    else shareableResource;
                })
                .then(()=> Promise.all(shareableResource.map(shareSnapshot)))
                .then(()=> Promise.all(shareableResource.map(bindEmailTemplate)))
                .then(sendEmails);
        }
        else {
            sendShareEmails = ()=> Promise.all(shareableResource.map(shareSnapshot))
                .then(()=> Promise.all(shareableResource.map(bindEmailTemplate)))
                .then(sendEmails);
        }

        console.log("Send back up email.");
        let backupToS3 = () => cloudformationManager.bindBackupCfnTemplate(studentResource, region, configure.labWorkBucket)
            .then(template=>cloudformationManager.runEndLabCloudformation(lab, teacher, course, template, region));
        return Promise.all([sendShareEmails(), backupToS3()]);
    };

    let stackId = getLabStackId(event.Records[0].Sns.Message);
    let IsSnapshotEvent = event => event.ResourceType === 'AWS::EC2::Snapshot' && event.ResourceStatus === 'CREATE_COMPLETE';
    let IsEc2Event = event => event.ResourceType === 'AWS::EC2::Instance' && event.ResourceStatus === 'CREATE_COMPLETE';

    let getUserFromInstanceTags = events => {
        return new Promise((resolve, reject)=> {
            ec2Manager.getInstances(events.filter(IsEc2Event).map(s=>s.PhysicalResourceId))
                .then(o =>o.Reservations.map(r=>r.Instances).map(r=>r[0].Tags))
                .then(tags=> tags.map(s=> {
                    console.log(s);
                    return {
                        email: s.find(p=>p.Key === 'Owner').Value,
                        course: course,
                        lab: s.find(p=>p.Key === 'lab').Value,
                        teacher: s.find(p=>p.Key === 'teacher').Value,
                        awsAccountId: s.find(p=>p.Key === 'AWSAccount').Value
                    };
                })).then(users => resolve(users), err=>reject(err));
        });
    };

    let getSnapshotIds = events => {
        return new Promise((resolve, reject)=> {
            ec2Manager.getSnapshots(events.filter(IsSnapshotEvent).map(s=>s.PhysicalResourceId))
                .then(c=> c.Snapshots.map(s=> {
                    return {
                        labStorageSnapshotId: s.SnapshotId,
                        email: s.Tags.find(p=>p.Key === 'Owner').Value
                    };
                })).then(snapshots => resolve(snapshots), err=>reject(err));
        });
    };


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
                return cloudformationManager.getStackEvents(stackId, region);
            })
            .then(events=>
                new Promise((resolveAll, rejectAll)=> {
                        Promise.all([
                            getUserFromInstanceTags(events),
                            getSnapshotIds(events)
                        ]).then(results => {
                            console.log("users");
                            let users = results[0];
                            let snapshots = results[1];
                            users = users.map(u=> {
                                u.labStorageSnapshotId = snapshots.find(p=>p.email === u.email).labStorageSnapshotId;
                                return u;
                            })
                            console.log(users);
                            resolveAll(users);
                        }).catch(err => {
                            rejectAll(err);
                        })
                    }
                ))
            .then(sharingAndBackup)
            .then(message => callback(null, "Done!\n" + message))
            .catch(err=>callback(err));
    }
    else {
        callback(null, "Not End Lab Stack!");
    }
};








