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
                filename: segments[segments.length - 1].replace(/@/g, '_'),
                path: attachmentFilePath // stream this file
            }]
        }
        return new Promise((resolve, reject) => {
            if (this.sesRegion) {
                let ses = new AWS.SES({region: this.sesRegion});
                let mail = mailcomposer(options);
                mail.build((err, messageSource) => {
                    if (err) {
                        reject(err);
                    } else {
                        ses.sendRawEmail({RawMessage: {Data: messageSource}}, (err, data) => {
                            if (err) {
                                reject(err, err.stack);
                            } else {
                                resolve(data);
                            }
                        });
                    }
                });
            } else {
                // create reusable transporter object using the default SMTP transport
                let transporter = nodemailer.createTransport({
                    host: this.smtpHost,
                    port: 465,
                    secure: true, // secure:true for port 465, secure:false for port 587
                    auth: {
                        user: this.stmpUser,
                        pass: this.smtpPassword
                    }
                });

                // send mail with defined transport object
                transporter.sendMail(options, (error, info) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve('Message sent: ' + info);
                });
            }
        });
    }
}

module.exports = EmailManager;