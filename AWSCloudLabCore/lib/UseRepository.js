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

        //TODO: Image ID should support continuing the last lab with student custom AMIS
        //Let email be the id!

        let users = userArray.map(s => {
            let email = s[0].toLocaleLowerCase();
            return {
                id: email,
                password: randomstring.generate({
                    length: 12,
                    charset: 'alphanumeric'
                }),
                key: this.keyPairManager.getKeyPairName({id: email}),
                awsAccount: s[3],
                imageId: this.labContext.course.imageId,
                labMaterialSnapshotId: this.labContext.course.labMaterialSnapshotId,
                labStorageSnapshotId: this.labContext.course.labStorageSnapshotId
            };
        });
        return users;
    }
}

module.exports = UseRepository;