"use strict";
const AWS = require('aws-sdk');
const S3Manager = require('./S3Manager');

class KeyPairManager {
    constructor(labContext) {
        this.labContext = labContext
    }

    getKeyPairName(user) {
        return this.labContext.lab.id + "/" + user.id.toLocaleLowerCase();
    }

    _parallelGenerate(context, func) {
        return new Promise((resolve, reject) => {
            console.log(context);
            Promise.all(context.map(func))
                .then(resolve, reject);
        });
    }

    createKeyPairs(region, keypairS3Bucket, keypairs) {
        let ec2 = new AWS.EC2({region: region});
        let createKeyPairPromise = keypair => new Promise((resolve, reject)=> {
            ec2.createKeyPair({KeyName: keypair, DryRun: false}, (err, data)=> {
                if (err) {
                    console.log(err); // an error occurred
                    reject(err);
                }
                else {
                    console.log(data);           // successful response
                    let context = {keypair, data};
                    resolve(context);
                }
            });
        });
        let s3UploadPromise = context => {
            console.log(context.keypair);
            console.log(context.data);
            return s3Manager.uploadString(context.keypair + ".pem", context.data.KeyMaterial);
        };

        let s3Manager = new S3Manager(region, keypairS3Bucket);

        let createKeyPairs = context =>this._parallelGenerate(context, createKeyPairPromise);
        let uploadKeysPairs = context =>this._parallelGenerate(context, s3UploadPromise);

        return createKeyPairs(keypairs)
            .then(uploadKeysPairs);
    }


    deleteKeyPairs(region, keypairs) {
        let ec2 = new AWS.EC2({region: region});

        let deleteKeyPairPromise = keypair => new Promise((resolve, reject)=> {
            ec2.deleteKeyPair({KeyName: keypair, DryRun: false}, (err, data)=> {
                if (err) {
                    console.log(err); // an error occurred
                    //TODO: Investigate why sometimes get NetworkingError, and may implement the retry logic!
                    resolve(err);
                }
                else {
                    console.log(data);           // successful response
                    let context = {keypair, data};
                    resolve(context);
                }
            });
        });
        let deleteKeyPairs = context =>this._parallelGenerate(context, deleteKeyPairPromise);

        return deleteKeyPairs(keypairs);
    }

    getAllKeyPairs() {
        return this.labContext.users.map(u=>this.getKeyPairName(u));
    }
}

module.exports = KeyPairManager;