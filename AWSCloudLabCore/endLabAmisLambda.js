"use strict";
const response = require('cfn-response');
const AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {
    console.log(event);
    let region = context.invokedFunctionArn.split(":")[3];
    AWS.config.update({region: region});
    let ec2 = new AWS.EC2();

    let getTags = instanceId => new Promise((resolve, reject)=> {
        let params = {
            DryRun: false,
            Filters: [
                {
                    Name: 'resource-id',
                    Values: [
                        instanceId
                    ]
                }
            ]
        };
        ec2.describeTags(params, function (err, data) {
            data.Tags = data.Tags.map(c=> {
                return {Key: c.Key, Value: c.Value}
            }).filter(p=>!p.Key.startsWith('aws:'));

            if (err) reject(err); // an error occurred
            else
                resolve(data);           // successful response

        });
    });

    let createTags = data=> new Promise((resolve, reject)=> {
        let params = {
            Resources: [/* required */
                data.amiId
            ],
            Tags: data.tags,
            DryRun: false
        };
        ec2.createTags(params, function (err, data) {
            if (err) reject(err); // an error occurred
            else     resolve(data);           // successful response
        });
    });

    let createAmi = data =>new Promise((resolve, reject)=> {
        let params = {
            InstanceId: data.instanceId, /* required */
            Name: data.lab + "-" + data.user, /* required */
            Description: data.course + " " + data.user,
            DryRun: false,
            NoReboot: false
        };
        ec2.createImage(params, function (err, amiId) {
            if (err) reject(err); // an error occurred
            else {
                data.amiId = amiId.ImageId;
                resolve(data); // successful response
            }
        });
    });

    let delay = ms => {
        return new Promise(function (resolve, reject) {
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

        let getAllTags = ()=>new Promise((resolveAll, rejectAll)=> {
            Promise.all(ec2InstanceIds.map(getTags)).then(tags => {
                let data = ec2InstanceIds.map((instanceId, index) => {
                    return {instanceId, user: users[index], course, lab, tags: tags[index].Tags}
                });
                //console.log(data);
                resolveAll(data);
            }).catch(err => {
                rejectAll(err);
            });
        });

        let createAllAmi = instanceData =>new Promise((resolveAll, rejectAll)=> {
            Promise.all(instanceData.map(createAmi)).then(results => {
                console.log(results);
                resolveAll(results);
            }).catch(err => {
                rejectAll(err);
            });
        });

        let createAllTags = instanceData=>new Promise((resolveAll, rejectAll)=> {
            Promise.all(instanceData.map(createTags)).then(results => {
                resolveAll(results);
            }).catch(err => {
                rejectAll(err);
            });
        });


        getAllTags()
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
