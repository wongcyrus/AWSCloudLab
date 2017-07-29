"use strict";
const response = require('cfn-response');
const AWS = require('aws-sdk');
const cons = require('consolidate');
const mailcomposer = require("mailcomposer");
const EmailManager = require('./lib/EmailManager');
const S3Manager = require('./lib/S3Manager');

exports.handler = (event, context, callback) => {
    let region = process.env.AWS_REGION;
    let awsAccountId = context.invokedFunctionArn.split(":")[4];
    AWS.config.update({region: region});

    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    if (event.RequestType === 'Delete') {
        response.send(event, context, response.SUCCESS);
        return;
    }

    let keypairsBucket = event.ResourceProperties.KeyPairsBucket;

    let StackName = event.StackId;

    let getStackIdPromise = () => new Promise((resolve, reject) => {
        let cfn = new AWS.CloudFormation();
        cfn.describeStackResources({StackName}, (err, data) => {
            if (err) {
                console.log(err);
                reject(err);
            }
            else {
                let ec2InstanceIds = data.StackResources.filter(r => r.ResourceType === 'AWS::EC2::Instance').map(r => r.PhysicalResourceId);
                resolve(ec2InstanceIds);
            }
        });
    });

    let getEC2Ids = InstanceIds => new Promise((resolve, reject) => {
        let ec2 = new AWS.EC2();
        ec2.describeInstances({InstanceIds}, (err, data) => {
            if (err) reject(err, err.stack); // an error occurred
            else
                resolve(data.Reservations
                    .map(p => {
                        return {
                            id: p.Instances[0].InstanceId, tags: p.Instances[0].Tags, keyName: p.Instances[0].KeyName
                        }
                    })
                    .map(d => {
                        let email = d.tags.find(p => p.Key === "Owner").Value;
                        let iamUser = d.tags.find(p => p.Key === "IAMUser").Value;
                        let password = d.tags.find(p => p.Key === "Password").Value;
                        let course = d.tags.find(p => p.Key === "course").Value;
                        return {id: d.id, email, iamUser, password, course, keyName: d.keyName};
                    })
                );           // successful response
        });
    });

    let bindTemplate = context => new Promise((resolve, reject) => {
        let emailContext = context;
        emailContext.signInUrl = `https://${awsAccountId}.signin.aws.amazon.com/console`;
        emailContext.instanceInUrl = `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#Instances:instanceId=${emailContext.id};sort=instanceId`;

        cons.ejs(__dirname + '/template/userEmail.ejs', emailContext)
            .then((template) => {
                emailContext.emailBody = template;
                resolve(emailContext);
            })
            .catch((err) => {
                reject(err);
            });
    });

    let getPemKeyDownloadLink = context => new Promise((resolve, reject) => {
        let key = context.keyName + ".pem";
        let filePathname = "/tmp/key/" + context.keyName.replace(/[^A-Za-z0-9]/g, '') + ".pem";

        let s3Manager = new S3Manager(region, keypairsBucket);
        s3Manager.getObject(key, filePathname).then(() => {
            context.pemKeyFilePathname = filePathname;
            resolve(context);
        }, err => reject(err));
    });


    let sendEmailToUser = context => {
        let senderEmail = event.ResourceProperties.SenderEmail;
        let sesRegion = event.ResourceProperties.SesRegion;
        let smtpHost = event.ResourceProperties.SmtpHost;
        let stmpUser = event.ResourceProperties.StmpUser;
        let smtpPassword = event.ResourceProperties.SmtpPassword;
        let emailManager = new EmailManager(senderEmail, sesRegion, smtpHost, stmpUser, smtpPassword);
        return emailManager.sendEmail(context.email, context.course + " " + (new Date()).toDateString(), context.emailBody, JSON.stringify(context), context.pemKeyFilePathname);
    };

    let parallelGenerate = (context, func) => new Promise((resolve, reject) => {
        console.log(context);
        Promise.all(context.map(func))
            .then(resolve, reject);
    });

    let generateUserEmailTemplate = (context) => parallelGenerate(context, bindTemplate);
    let generateUserEmail = (context) => parallelGenerate(context, sendEmailToUser);
    let generatePrivateKeyUrls = (context) => parallelGenerate(context, getPemKeyDownloadLink);

    getStackIdPromise()
        .then(getEC2Ids)
        .then(generatePrivateKeyUrls)
        .then(generateUserEmailTemplate)
        .then(generateUserEmail)
        .then(c => {
            console.log(c);
            response.send(event, context, response.SUCCESS);
            callback(null, "Email Sent")
        }).catch(err => {
            console.log(err);
            response.send(event, context, response.FAILED);
            callback(err, null);
        }
    );
};
