# AWS Cloud Lab
AWS Cloud Lab is aims to facilitate educators using AWS in their teaching. Using AWS, teacher can **create the tailor made lab environment for every students in every lab exercise**, and **get rid of the physical computer limitation**. 

Mr. Cyrus Wong working group of Hong Kong Institute of Vocational Education (IVE) has built up the AWS Cloud Lab V1, and widely adopted in the teaching of Higher Diploma in Cloud and Data Centre Administration for 3 years. V1 is under the IP of IVE, and there are several weakness in V1 i.e. API driven, and the need of running window server. In order to share the goodness of using AWS in Lab exercise, I   rewrites the system and share to all educators who loves AWS, and hope improving their teaching with AWS.
The main focus of AWS Cloud Lab V2:

1. Integrate with existing tools - Excel for student management, and course schedule with public calendar i.e. Google Calendar.
2. Fully utilize AWS Services – allow students to rebuild the lab environments with their AWS account.
3. Automation – Educators don’t have to do anything before or after their classes.
4. Easy Deploy and Manage– Cloudformation for all deployments, and only use managed AWS Services.
5. Serverless – No server, then no server down!

AWS Cloud Lab Environments with Marking Accelerator (V1) has received 
- Gold Award - Hong Kong ICT Awards 2014: Best Student Invention (College & Undergraduates) Award by Hong Kong Government.
- APICTA 2015 - Merit Award (Tertiary Student Project)

###Project Details and Design
https://www.linkedin.com/pulse/aws-cloud-lab-one-more-real-educational-use-case-part-wong
###Architecture
https://www.linkedin.com/pulse/aws-cloud-lab-one-more-real-educational-use-case-part-wong-1

(Marking Accelerator has moved to a new project. )

##Creator
Mr. Cyrus Wong, R&D Coordinator (Data Scientist & AWS certified Professional) of Cloud Innovation Centre - IVE (Lee Wai Lee) - Department of Information Technology, and the AWS All 7 Certified Community Hero of Hong Kong.

Linkedin 		https://hk.linkedin.com/in/cyruswong
AWS Community Hero https://aws.amazon.com/tw/heroes/asia-pacific/cyrus-wong/

##How to setup and configure

the AWS Cloud Lab Project in Window Platform (All tools are platform independent!)

##Deployment

###Download and Install build tools

AWS CLI
Node.js 4.4.5
JDK 8
Gradle 2.14 - set up path
Any Git Client
Build the project

Install grunt 
npm install -g grunt-cli
Get the code 
git clone https://github.com/wongcyrus/AWSCloudLab.git
Create AWS User attaches with with AdministratorAccess (Since deployment needs to create IAM role!) and get Access Key Pair  and run 
aws configure 
Go to \AWSCloudLabCore, and npm update
Go to \AWSCloudLabCore\deployment, and npm update
Deployment

Please refer to the next section, update configure in deployment.js, and data seed in dataSeed.js.
node deployment.js
(You may need to run it twice as there is a timing issue on creating \AWSCloudLab\AWSCloudLabCore\dist folder! Fix it soon.)
Please refer to the next section, upload Class Name List to userListS3Bucket. 
Configuration

##System Configuration - deployment.js

You have to update const configure = {.....}, and it will save to the DynamoDB table "configure".
- "projectId": "awscloudlab" (Don't change it)
- "labRegion": "aws region code (Must have Lambda!)" 
- "userListS3Bucket": "Bucket of Class Name List" 
- "keypairS3Bucket": "Bucket save all EC2 keypairs"
- "cloudformationS3Bucket": "Bucket save all Cloudformation and Lambda package"
- "labWorkBucket": "Save student works"
- "senderEmail": "system sender email address"
- "expirationInDays": "Number of day to keep the key pair in KeypairsBucket"

The system Email support 
SES (Once SES Region is defined, then it will use SES.)
- "sesRegion": "Your SES Region code"
SMTP
- "smtpHost": "SMTP Host"
- "stmpUser": "SMTP User"
- "smtpPassword": "SMTP Password"


##Course Data

- calendar (Save Teacher's calendar)
- teacher - Teacher email, and must match course table - teacher.
- icsUrl - Public Calendar ica uri.
- course (Save course information, and basic lab server configure.)
- course - Course Name, and it must match calendar title.
- teacher -Teacher email, and must match calendar table - teacher.
- imageId - AMI ID, and it must be in region attribute.
- instanceType - Instance type that available in region must support VPC.
- labMaterialSnapshotId - Snapshot ID, and it must be in region attribute. It will not be backup! Teacher uses it to share lab related files to students!
labStorageSnapshotId - Snapshot ID, and it must be in region attribute. It will backup with snapshot, and share to student, if student provides his AWS Account ID.
- region - AWS EC2 Region (The original design is to support multiple regions, but now you should always set the same region of the system regsion.)
continue - true, It will use the end lab ami for the second lab! imageId will only be used in the first lab.
share - ["imageId", "labMaterialSnapshotId", "labStorageSnapshotId", "endLabAmi"] define what can share to students.

##Class Name List 

3 columns, and please use the sample excel 
email, role (teacher or student), and awsAccount (Student AWS account number for sharing.)

- FILENAME MUST MATCH COURSE NAME!
- EXCEL must be XLXS.
