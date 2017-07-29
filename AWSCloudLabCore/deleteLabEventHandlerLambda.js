"use strict";
const AWS = require('aws-sdk');
//It can be simplify once Lambda can be tagged!

exports.handler = (event, context, callback) => {
    let region = process.env.AWS_REGION;
    AWS.config.update({region: region});
    console.log("Current region:" + region);

    let lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

    let getStackId = ()=>new Promise((resolve, reject)=> {
        lambda.getFunction({FunctionName: context.invokedFunctionArn}, (err, response) => {
            if (err) reject(err); // an error occurred
            else     resolve(response.Configuration.Description);           // successful response
        });
    });

    let invokeTerminator = (stackId)=> {
        let params = {
            FunctionName: 'AWSCloudLabTerminator', /* required */
            InvokeArgs: JSON.stringify({stackId})
        };
        lambda.invokeAsync(params, (err, data) => {
            if (err) callback(err, null); // an error occurred
            else    callback(null, data);           // successful response
        });
        callback(null);
    };

    getStackId().then(invokeTerminator).catch(err=>callback(err, null));
};