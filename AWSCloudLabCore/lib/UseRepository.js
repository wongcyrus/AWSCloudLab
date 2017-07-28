"use strict";
const xlsx = require('node-xlsx');
const _ = require('underscore');
const KeyPairManager = require('./KeyPairManager');
const randomstring = require("randomstring");

class UseRepository {

    constructor(filePathname, labContext) {
        this.filePathname = filePathname;
        this.labContext = labContext;
        this.keyPairManager = new KeyPairManager(labContext);
    }

    getAll() {
        let userExcel = xlsx.parse(this.filePathname); // parses a file
        let userArray = _.rest(_.find(userExcel, function (s) {
            return s.name === "UserList"
        }).data, 1);

        let users = userArray.map(s => {
            let email = s[0].toLocaleLowerCase();
            return {
                email: email,
                password: randomstring.generate({
                    length: 12,
                    charset: 'alphanumeric'
                }) + "@1Aws",
                key: this.keyPairManager.getKeyPairName({email}),
                awsAccount: s[2],
                role: s[1],
                imageId: this.labContext.course.imageId,
                labMaterialSnapshotId: this.labContext.course.labMaterialSnapshotId,
                labStorageSnapshotId: this.labContext.course.labStorageSnapshotId
            };
        });
        return users;
    }
}

module.exports = UseRepository;