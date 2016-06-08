//Follow https://medium.com/@SlyFireFox/micro-services-with-aws-lambda-and-api-gateway-part-1-f11aaaa5bdef
//Run
//npm install -g grunt-cli
//npm install grunt-aws-lambda grunt-pack --save-dev

var grunt = require('grunt');
grunt.loadNpmTasks('grunt-aws-lambda');

grunt.initConfig({
    lambda_invoke: {
        default: {}
    },
    lambda_deploy: {
        awsCloudLabBuilder: {
            arn: 'arn:aws:lambda:ap-northeast-1:641280019922:function:AWSCloudLabBuilder',
            options: {
                region: 'ap-northeast-1',
                handler: 'createLabLambda.handler'
            }
        },
        awsCloudLabTerminator: {
            options: {
                region: 'ap-northeast-1',
                handler: 'deleteLabStackLambda.handler'
            },
            arn: 'arn:aws:lambda:ap-northeast-1:641280019922:function:AWSCloudLabTerminator'
        },
        awsCloudLabEndedLab: {
            options: {
                region: 'ap-northeast-1',
                handler: 'endedLabStackLambda.handler'
            },
            arn: 'arn:aws:lambda:ap-northeast-1:641280019922:function:AWSCloudLabEndedLab'
        }
    },
    lambda_package: {
        awsCloudLabBuilder: {
            options: {
                include_time: false,
                include_version: false
            }
        },
        awsCloudLabTerminator: {
            options: {
                include_time: false,
                include_version: false
            }
        }
        ,
        awsCloudLabEndedLab: {
            options: {
                include_time: false,
                include_version: false
            }
        }
    }
});

grunt.registerTask('deploy_Builder', ['lambda_package:awsCloudLabBuilder', 'lambda_deploy:awsCloudLabBuilder']);
grunt.registerTask('deploy_Terminator', ['lambda_package:awsCloudLabTerminator', 'lambda_deploy:awsCloudLabTerminator']);
grunt.registerTask('deploy_EndedLab', ['lambda_package:awsCloudLabEndedLab', 'lambda_deploy:awsCloudLabEndedLab']);
