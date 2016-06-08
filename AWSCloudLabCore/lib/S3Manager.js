"use strict";
const AWS = require('aws-sdk');
const fs = require("fs");
const s3Client = require('s3');

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
                }, function (err) {
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
            let options = {
                s3Client: s3
            };
            let client = s3Client.createClient(options);
            let params = {
                localFile: filePathname,
                s3Params: {
                    Bucket: this.bucket,
                    Key: key
                }
            };
            console.log(params);
            let downloader = client.downloadFile(params);
            downloader.on('error', function (err) {
                console.error("unable to download:", err.stack);
                reject(err);
            });
            downloader.on('progress', function () {
                console.log("progress", downloader.progressAmount, downloader.progressTotal);
            });
            downloader.on('end', function () {
                console.log("done downloading");
                resolve(filePathname);
            });

            // let params = {Bucket: this.bucket, Key: key};
            //  let file = fs.createWriteStream(filePathname);
            //  s3.getObject(params).createReadStream().pipe(file);
            //  file.on('finish', resolve(filePathname));

        });

    }
}

module.exports = S3Manager;