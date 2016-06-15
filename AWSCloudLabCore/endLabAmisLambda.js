"use strict";
const response = require('cfn-response');
const AWS = require('aws-sdk');
const Ec2Manager = require('./lib/Ec2Manager');
const PromiseHelper = require('./lib/PromiseHelper');

exports.handler = (event, context, callback) => {
    console.log(event);
    let region = context.invokedFunctionArn.split(":")[3];
    AWS.config.update({region: region});
    let ec2Manager = new Ec2Manager();
    let promiseHelper = new PromiseHelper();

    let delay = ms => {
        return new Promise((resolve, reject) => {
            console.log("Delay for " + ms + "ms.");
            setTimeout(resolve, ms); // (A)
        });
    }
    let delay1Min = ()=> delay(1000 * 60);

    if (event.RequestType === 'Delete') {
        let ec2InstanceIds = event.ResourceProperties.Ec2Instances;
        let users = event.ResourceProperties.Users;
        let course = event.ResourceProperties.Course;
        let lab = event.ResourceProperties.Lab;
        let labStorageVolumes = event.ResourceProperties.LabStorageVolumes;

        let getAllTags = () => new Promise((resolveAll, rejectAll) => {
            Promise.all(ec2InstanceIds.map(ec2Manager.getTags)).then(tags => {
                let data = ec2InstanceIds.map((instanceId, index) => {
                    return {instanceId, user: users[index], course, lab, tags: tags[index].Tags}
                });
                //console.log(data);
                resolveAll(data);
            }).catch(err => {
                rejectAll(err);
            });
        });

        let detachAllVolumes = () => promiseHelper.all(labStorageVolumes, ec2Manager.detachVolume);
        let createAllAmi = instanceData => promiseHelper.all(instanceData, ec2Manager.createAmi);
        let createAllTags = instanceData => promiseHelper.all(instanceData, ec2Manager.createTags);

        detachAllVolumes()
            .then(()=> getAllTags())
            .then(createAllAmi)
            .then(createAllTags)
            .then(delay1Min) //Give 1 mins for the AMI creation become stable.
            .then(()=> {
                response.send(event, context, response.SUCCESS);
                callback(null, "Competed! EndLab Ami");
            })
            .catch(err=> {
                //Ensure EC2 must be terminated next, so let it success!
                console.error(err);
                response.send(event, context, response.SUCCESS);
                callback(err, "Error! EndLab Ami");
            });
    } else {
        response.send(event, context, response.SUCCESS);
        callback(null, "Do Nothing! EndLab Ami");
    }
}
