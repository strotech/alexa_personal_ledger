Layer
-------
1.  Create a generic folder.In that have different folders for different environments like, nodejs, python, etc.
2.  Inside the nodejs folder, do npm init and npm install --save <dependency>
3.  Create the zip of the environment folder or selct all environments folders and send to zip. Do not zip the single folder containing all the environments dependancies.

Roles, Policies and Trust
--------
The role having policies should be trusted by different services. Therfore, the trust relationships should also be defined.
The role should have the following policies:
1. CloudWatchFullAccess
2. PersonalLedger_Alexa_Skill (Custom - refer the IAM roles folder)

For the trust relationships, refer the IAM roles folder.
  
List of principles
--------------------
https://gist.github.com/shortjared/4c1e3fe52bdfa47522cfe5b41e5d6f22
  
Points to note
-------------------
  1. The table name is referenced directly in the lambda code
