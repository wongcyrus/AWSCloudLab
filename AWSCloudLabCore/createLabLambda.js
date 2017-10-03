"use strict";
const async = require('async');
const AWS = require('aws-sdk');
const S3Manager = require('./lib/S3Manager');
const Ec2Manager = require('./lib/Ec2Manager');
const DynamodbManager = require('./lib/DynamodbManager');
const UseRepository = require('./lib/UseRepository');
const CloudformationManager = require('./lib/CloudformationManager');
const rmdir = require('rmdir');

//Constant
const projectId = "awscloudlab",
    courseTableName = "course",
    configureTableName = "configure";

exports.handler = (event, context, callback) => {
    //Get the region of Lambda runtime.
    let region = process.env.AWS_REGION;
    AWS.config.update({region: region});
    console.log("Current region:" + region);
    console.log(event);

    rmdir('/tmp/', function (err, dirs, files) {
        if (err) console.log(err);
        if (dirs) console.log(dirs);
        if (files) console.log(files);
        console.log('all tmp files are removed');
        createLab(event, context, callback, region, event);
    });
};


let createLab = (event, context, callback, region, record) => {

    let lab = record;//attr.unwrap(record.dynamodb.NewImage);
    console.log(lab);

    let dynamodbManager = new DynamodbManager(region);

    async.waterfall([
        (next) => {
            console.log("Get Configure");
            dynamodbManager.getItem(configureTableName, {projectId}).then(
                data => next(null, data),
                err => next(err)
            );
        },
        (configure, next) => {
            console.log("Get Course");
            dynamodbManager.getItem(courseTableName, {course: lab.course, teacher: lab.teacher}).then(
                data => next(null, {
                    configure: configure,
                    course: data,
                    accountId: context.invokedFunctionArn.split(":")[4]
                }),
                err => next(err)
            );
        },
        (labContext, next) => {
            console.log("Download Student List Excel from S3");
            console.log(labContext);

            let filename = labContext.course.course + '.xlsx';
            let filePathname = "/tmp/" + filename;

            let s3Manager = new S3Manager(labContext.course.region, labContext.configure.userListS3Bucket);
            s3Manager.getObject(filename, filePathname).then(() => {
                console.log('all writes are now complete.' + filePathname);
                next(null, labContext, filePathname);
            }, err => next(err));

        }, (labContext, filePathname, next) => {
            console.log("Get User List from Excel");
            labContext.lab = lab;
            let useRepository = new UseRepository(filePathname, labContext);
            let users = useRepository.getAll();
            console.log(JSON.parse(JSON.stringify(users)));
            labContext.users = users;
            next(null, labContext);
        }, (labContext, next) => {
            if (labContext.course.continue) {
                console.log("Get Last Lab AMI ID.");
                let ec2Manager = new Ec2Manager();
                ec2Manager.getEndLabAmisMap(labContext.course.course, labContext.course.teacher).then(
                    endLabAmiMap => {
                        console.log(endLabAmiMap);
                        //The first lab class will not have Image!
                        if (endLabAmiMap.size > 0) {
                            labContext.users = labContext.users.map(user => {
                                user.endLabAmi = endLabAmiMap.get(user.email).imageId;
                                return user;
                            });
                        }
                        console.log(labContext.users);
                        next(null, labContext);
                    }, err => next(err));
            } else {
                next(null, labContext)
            }
        }, (labContext, next) => {
            console.log("Create Cloudformation Template.");
            let cloudformationManager = new CloudformationManager(labContext);
            let s3Manager = new S3Manager(labContext.course.region, labContext.configure.cloudformationS3Bucket);

            s3Manager.uploadFile("deployLambda.yaml", 'template/deployLambda.yaml')
                .then(() => cloudformationManager.createDeleteStackLambdaDeploymentPackage())
                .then(lambdaKey => {
                    console.log(lambdaKey);
                    return cloudformationManager.createLabTemplate()
                })
                .then(template => {
                    labContext.template = template;
                    s3Manager.uploadString(cloudformationManager.getLabTag() + ".yaml", template);
                })
                .then(val => next(null, labContext))
                .catch(err => next(err, labContext));
        },
        (labContext, next) => {
            console.log("Run Cloudformation");
            let cloudformationManager = new CloudformationManager(labContext);

            cloudformationManager.runCloudformation()
                .then(stackId => {
                    labContext.stackId = stackId;
                    next(null, labContext)
                }, err => next(err, null));
        }
    ], (err, result) => {
        if (err) {
            console.error(err);
            callback(err);
        }

        console.log("Successfully processed " + JSON.stringify(event) + " records.");
        console.log("Remain: " + context.getRemainingTimeInMillis() + " ms");
        callback(null, "Success");
    });
};

