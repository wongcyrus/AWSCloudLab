"use strict";
const async = require('async');
const AWS = require('aws-sdk');
const S3Manager = require('./lib/S3Manager');
const DynamodbManager = require('./lib/DynamodbManager');
const UseRepository = require('./lib/UseRepository');
const CloudformationManager = require('./lib/CloudformationManager');

//Constant
const projectId = "awscloudlab",
    courseTableName = "course",
    configureTableName = "configure";

exports.handler = function (event, context, callback) {
    //Get the region of Lambda runtime.
    let region = context.invokedFunctionArn.split(":")[3];
    AWS.config.update({region: region});
    console.log("Current region:" + region);

    console.log(event);

    createLab(event, context, callback, region, event);

    //Don'tags call success!
    //http://stackoverflow.com/questions/30739965/querying-dynamodb-with-lambda-does-nothing
    console.log("Successfully processed " + JSON.stringify(event) + " records.");
    console.log("Remain: " + context.getRemainingTimeInMillis() + " ms");
};


let createLab = function (event, context, callback, region, record) {

    let lab = record;//attr.unwrap(record.dynamodb.NewImage);
    console.log(lab);

    let dynamodbManager = new DynamodbManager(region);

    async.waterfall([
        function (next) {
            console.log("Get Configure");
            dynamodbManager.getItem(configureTableName, {projectId}).then(
                data => next(null, data),
                err => next(err)
            );
        },
        function (configure, next) {
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
        function (labContext, next) {
            console.log("Download Student List Excel from S3");
            console.log(labContext);

            let filename = labContext.course.course + '.xlsx';
            let filePathname = "/tmp/" + filename;

            let s3Manager = new S3Manager(labContext.course.region, labContext.configure.userListS3Bucket);
            s3Manager.getObject(filename, filePathname).then(()=> {
                console.log('all writes are now complete.' + filePathname);
                next(null, labContext, filePathname);
            }, err => next(err));

        }, function (labContext, filePathname, next) {
            console.log("Get User List from Excel");
            labContext.lab = lab;
            let useRepository = new UseRepository(filePathname, labContext);
            let users = useRepository.getAll();
            console.log(JSON.parse(JSON.stringify(users)));
            labContext.users = users;
            next(null, labContext);
        }, function (labContext, next) {
            console.log("Create Cloudformation Template.");
            let cloudformationManager = new CloudformationManager(labContext);
            let s3Manager = new S3Manager(labContext.course.region, labContext.configure.cloudformationS3Bucket);

            s3Manager.uploadFile("deployLambda.template", 'template/deployLambda.template')
                .then(()=>cloudformationManager.createDeleteStackLambdaDeploymentPackage())
                .then(lambdaKey=> {
                    console.log(lambdaKey);
                    return cloudformationManager.createTemplate()
                })
                .then(template=> {
                    labContext.template = template;
                    s3Manager.uploadString(cloudformationManager.getLabTag() + ".template", template);
                })
                .then(val => next(null, labContext))
                .catch(err=> next(err, labContext));
        },
        function (labContext, next) {
            console.log("Run Cloudformation");
            let cloudformationManager = new CloudformationManager(labContext);

            cloudformationManager.runCloudformation()
                .then(stackId=> {
                    labContext.stackId = stackId;
                    next(null, labContext)
                }, err=>next(err, null));
        }
    ], function (err, result) {
        if (err) {
            console.error(err);
            callback(err);
        }
        console.log("done!");
        callback(null, "Success");
    });
};

