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
        awsCloudLabEndLab: {
            options: {
                region: 'ap-northeast-1',
                handler: 'endLabStackLambda.handler'
            },
            arn: 'arn:aws:lambda:ap-northeast-1:641280019922:function:AWSCloudLabEndedLab'
        },
        awsCloudLabEndLabAMI: {
            options: {
                region: 'ap-northeast-1',
                handler: 'endLabAmisLambda.handler'
            },
            arn: 'arn:aws:lambda:ap-northeast-1:641280019922:function:AWSCloudLabEndLabAmi'
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
        },
        awsCloudLabEndLab: {
            options: {
                include_time: false,
                include_version: false
            }
        }
        ,
        awsCloudLabEndLabAMI: {
            options: {
                include_time: false,
                include_version: false
            }
        }
    }
});

grunt.registerTask('deploy_Builder', ['lambda_package:awsCloudLabBuilder', 'lambda_deploy:awsCloudLabBuilder']);
grunt.registerTask('deploy_Terminator', ['lambda_package:awsCloudLabTerminator', 'lambda_deploy:awsCloudLabTerminator']);
grunt.registerTask('deploy_EndLab', ['lambda_package:awsCloudLabEndLab', 'lambda_deploy:awsCloudLabEndLab']);
grunt.registerTask('deploy_EndLabAMI', ['lambda_package:awsCloudLabEndLabAMI', 'lambda_deploy:awsCloudLabEndLabAMI']);
