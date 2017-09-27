"use strict";
const AWS = require('aws-sdk');

class Ec2Manager {
    constructor() {
    }

    shareSnapshot(snapshotId, awsAccountId) {
        let params = {
            SnapshotId: snapshotId, /* required */
            Attribute: 'createVolumePermission',
            DryRun: false,
            OperationType: 'add',
            UserIds: [
                awsAccountId
            ]
        };
        return new Promise((resolve, reject)=> {
            let ec2 = new AWS.EC2();
            ec2.modifySnapshotAttribute(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else     resolve(data);           // successful response
            });
        })
    }

    shareAmi(imageId, awsAccountId) {
        let params = {
            ImageId: imageId, /* required */
            Attribute: 'launchPermission',
            DryRun: false,
            OperationType: 'add',
            UserIds: [
                awsAccountId
            ]
        };
        return new Promise((resolve, reject)=> {
            let ec2 = new AWS.EC2();
            ec2.modifyImageAttribute(params, (err, data) => {
                if (err && err.code === "AuthFailure") {
                    console.log("AuthFailure cannot share! And, it should be public image.");
                    resolve(data);
                }
                if (err) reject(err); // an error occurred
                else     resolve(data);           // successful response
            });
        })
    }

    getSharableImageIds(lab) {
        return new Promise((resolve, reject)=> {
            let params = {
                Filters: [{
                    Name: 'tag:lab', Values: [lab]
                }]
            };
            let ec2 = new AWS.EC2();
            ec2.describeImages(params, (err, data) => {
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
    }

    getSnapshots(snapshotIds) {
        return new Promise((resolve, reject)=> {
            let params = {DryRun: false, SnapshotIds: snapshotIds};
            let ec2 = new AWS.EC2();
            ec2.describeSnapshots(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else    resolve(data);           // successful response
            });
        });
    }

    detachVolume(volumeId) {
        return new Promise((resolve, reject)=> {
            let params = {
                VolumeId: volumeId, /* required */
                DryRun: false,
                Force: true
            };
            let ec2 = new AWS.EC2();
            ec2.detachVolume(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else    resolve(data);           // successful response
            });
        });
    }


    getInstances(instanceIds) {
        return new Promise((resolve, reject)=> {
            let params = {
                DryRun: false,
                InstanceIds: instanceIds
            };
            //console.log(params);
            let ec2 = new AWS.EC2();
            ec2.describeInstances(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else    resolve(data);           // successful response
            });
        });
    }

    getTags(instanceId) {
        return new Promise((resolve, reject)=> {
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
            let ec2 = new AWS.EC2();
            ec2.describeTags(params, (err, data) => {
                data.Tags = data.Tags.map(c=> {
                    return {Key: c.Key, Value: c.Value}
                }).filter(p=>!p.Key.startsWith('aws:'));

                if (err) reject(err); // an error occurred
                else
                    resolve(data);           // successful response

            });
        });
    }

    createAmi(data) {
        return new Promise((resolve, reject)=> {
            let params = {
                InstanceId: data.instanceId, /* required */
                Name: data.lab + "-" + data.user, /* required */
                Description: data.course + " " + data.user,
                DryRun: false,
                NoReboot: false
            };
            let ec2 = new AWS.EC2();
            ec2.createImage(params, (err, result) => {
                if (err) reject(err); // an error occurred
                else {
                    data.amiId = result.ImageId;
                    resolve(data); // successful response
                }
            });
        });
    }

    createTags(data) {
        return new Promise((resolve, reject)=> {
            let params = {
                Resources: [/* required */
                    data.amiId
                ],
                Tags: data.tags,
                DryRun: false
            };
            let ec2 = new AWS.EC2();
            ec2.createTags(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else     resolve(data);           // successful response
            });
        });
    }

    getEndLabAmisMap(course, teacher) {
        return new Promise((resolve, reject)=> {
            let params = {
                Filters: [{
                    Name: 'tag:course', Values: [course]
                }, {
                    Name: 'tag:teacher', Values: [teacher]
                }]
            };

            let ec2 = new AWS.EC2();
            ec2.describeImages(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else {
                    if (data.Images.length === 0)
                        resolve(new Map());
                    else
                        resolve(data.Images.map(c=> {
                                return {
                                    imageId: c.ImageId,
                                    email: c.Tags.find(p=>p.Key === 'Owner').Value,
                                    creationDate: new Date(c.CreationDate)
                                }
                            }).reduce((previousValue, currentValue) => {
                                let acc = previousValue instanceof Map ? previousValue : new Map().set(previousValue.email, previousValue);
                                if (!acc.has(currentValue.email) || acc.get(currentValue.email).creationDate < currentValue.creationDate)
                                    acc.set(currentValue.email, currentValue);
                                return acc;
                            })
                        );
                } // successful response
            });
        });
    }
}

module.exports = Ec2Manager;