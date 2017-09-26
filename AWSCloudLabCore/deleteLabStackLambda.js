"use strict";
const AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {

    let region = process.env.AWS_REGION;
    AWS.config.update({region: region});
    console.log(event);
    
    let cloudformation = new AWS.CloudFormation({
        region: region,
        apiVersion: '2010-05-1let5'
    });

    let deleteStack = () => new Promise((resolve, reject) => {
        let params = {
            StackName: event.stackId
        };
        //Cannot wait for the result as it this lambda will block the delete Stack!
        cloudformation.deleteStack(params, (err, data) => {
            if (err) reject(err); // an error occurred
        });
        resolve();
    });

    deleteStack()
        .then(s => callback(null, s))
        .catch(err=>callback(err));

};




