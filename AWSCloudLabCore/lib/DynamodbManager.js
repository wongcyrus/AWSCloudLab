"use strict";
const AWS = require('aws-sdk');

class DynamodbManager {

    constructor(region) {
        this.docClient = new AWS.DynamoDB.DocumentClient({region: region});
    }

    getItem(tableName, key) {
        let params = {};
        params.TableName = tableName;
        params.Key = key;
        console.log(params);

        return new Promise((resolve, reject)=> {
            this.docClient.get(params, (err, dbData) => {
                if (err) {
                    console.log(err, err.stack);
                    reject(err);
                } else {
                  
                    console.log(JSON.parse(JSON.stringify(dbData)));
                    resolve(dbData.Item);
                }
            });
        });
    }
}
module.exports = DynamodbManager;