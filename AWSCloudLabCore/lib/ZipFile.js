"use strict";
const archiver = require('archiver');
const fs = require('fs');

class ZipFile {
    constructor(options) {
        this.sourceDirectory = options.sourceDirectory;
        this.destinationZip = options.destinationZip;
    }

    zip() {
        return new Promise((resolve, reject) => {
            let archive = archiver.create('zip', {});
            let output = fs.createWriteStream(this.destinationZip);

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);

            archive.bulk([{
                expand: true,
                cwd: this.sourceDirectory,
                src: ['**']
            }]);

            archive.finalize();
        });
    };


}


module.exports = ZipFile;
