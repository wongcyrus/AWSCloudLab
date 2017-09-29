"use strict";
const zipdir = require('zip-dir');

class ZipFile {
    constructor(options) {
        this.sourceDirectory = options.sourceDirectory;
        this.destinationZip = options.destinationZip;
    }

    zip() {
        return new Promise((resolve, reject) => {
            zipdir(this.sourceDirectory, {saveTo: this.destinationZip}, function (err, buffer) {
                if (err) reject(err);
                console.log("done");
                resolve();
            });
        });
    }
}

module.exports = ZipFile;
