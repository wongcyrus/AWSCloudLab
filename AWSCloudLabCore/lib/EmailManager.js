"use strict";
const AWS = require('aws-sdk');
const mailcomposer = require("mailcomposer");
const nodemailer = require('nodemailer');

class EmailManager {
    constructor(senderEmail, sesRegion, smtpHost, stmpUser, smtpPassword) {
        this.sesRegion = sesRegion;
        this.senderEmail = senderEmail;
        this.smtpHost = smtpHost;
        this.stmpUser = stmpUser;
        this.smtpPassword = smtpPassword;
    }

    sendEmail(to, subject, htmlMessage, textMessage, attachmentFilePath) {
        let options = {
            from: this.senderEmail,
            to: to,
            subject: subject,
            body: textMessage,
            text: textMessage,
            html: htmlMessage
        };
        if (attachmentFilePath) {
            let segments = attachmentFilePath.split("/");
            options.attachments = [{   // file on disk as an attachment
                filename: segments[segments.length - 1].replace(/@/g,'_'),
                path: attachmentFilePath // stream this file
            }]
        }
        return new Promise((resolve, reject) => {
            if (this.sesRegion) {
                let ses = new AWS.SES({region: this.sesRegion});
                let mail = mailcomposer(options);
                mail.build(function (err, messageSource) {
                    if (err) {
                        reject(err);
                    } else {
                        ses.sendRawEmail({RawMessage: {Data: messageSource}}, function (err, data) {
                            if (err) {
                                reject(err, err.stack);
                            } else {
                                resolve(data);
                            }
                        });
                    }
                });
            } else {
                let smtpConfig = {
                    host: this.smtpHost,
                    port: 465,
                    secure: true, // use SSL
                    auth: {
                        user: this.stmpUser,
                        pass: this.smtpPassword
                    }
                };
                let transporter = nodemailer.createTransport(smtpConfig);
                // let mailOptions = {
                //     from: this.senderEmail,
                //     to: to,
                //     subject: subject,
                //     text: textMessage,
                //     html: htmlMessage
                // };
                transporter.sendMail(options, function (error, info) {
                    if (error) {
                        reject(error);
                    }
                    resolve('Message sent: ' + info);
                });
            }
        });
    }
}
module.exports = EmailManager;