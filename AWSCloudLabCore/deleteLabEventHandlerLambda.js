"use strict";
const AWS = require('aws-sdk');
//It can be simplify once Lambda can be tagged!

exports.handler = function (event, context, callback) {
    let region = context.invokedFunctionArn.split(":")[3];
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
        lambda.invokeAsync(params, function (err, data) {
            if (err) callback(err, null); // an error occurred
            else    callback(null, data);           // successful response
        });
        callback(null);
    };

    getStackId().then(invokeTerminator).catch(err=>callback(err, null));
};