"use strict";
const AWS = require('aws-sdk');
const fs = require("fs");

class S3Manager {
    constructor(region, bucket) {
        this.region = region;
        this.bucket = bucket;
    }

    uploadFile(key, filePath) {
        return new Promise((resolve, reject) => {
            let fileStream = fs.createReadStream(filePath);
            fileStream.on('error', (err) => {
                if (err) {
                    throw err;
                }
            });
            fileStream.on('open', ()=> {
                let s3 = new AWS.S3({
                    region: this.region
                });
                s3.putObject({
                    Bucket: this.bucket,
                    Key: key,
                    Body: fileStream
                }, (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(key);
                });
            });
        });

    }

    uploadString(key, data) {
        let s3 = new AWS.S3({
            region: this.region,
            params: {
                Bucket: this.bucket,
                Key: key
            }
        });

        return new Promise((resolve, reject) => {
            s3.upload({Body: data}, (err, data) => {
                if (err) {
                    console.log("Error uploaded to " + this.bucket + "/" + key + "\n" + err);
                    reject(err);
                }
                else {
                    console.log("Successfully uploaded to " + this.bucket + "/" + key);
                    resolve(data);
                }
            });
        });
    }

    getObject(key, filePathname) {
        return new Promise((resolve, reject) => {
            let s3 = new AWS.S3();
            let params = {Bucket: this.bucket, Key: key};
            let file = require('fs').createWriteStream(filePathname);

            file.on('close', function () {
                console.log('file done'); //prints, file created
                resolve();
            });

            s3.getObject(params).createReadStream()
                .on('end', () => {
                    console.log('s3 done');
                })
                .on('error', (error) => {
                    reject(error);
                })
                .pipe(file)
        });
    }
}

module.exports = S3Manager;