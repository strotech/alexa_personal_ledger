const Alexa = require('ask-sdk-core');
const AWS = require("aws-sdk");
var docClient;
AWS.config.update({region: 'us-east-1'});

const yearCorrector=(date)=>{
    let correctedDate;
    let splittedDate=date.split("-");
    let correctedYear=new Date().getFullYear();
    correctedDate=correctedYear+"-"+splittedDate[1]+"-"+splittedDate[2];
    return correctedDate;
}

const monthHash = {
    January : "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12"
   };

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const speakOutput = 'Welcome, you can say Daily ledger to start chatting with me. Using this skill, you can add and track the daily expenses for every month over the year. To add the details of an expense, you can say like, fifty rupees spent on tea on second june. To retrieve the details, say like, get amount spent on tea for the month of june. What would you like to do?';
        const STS = new AWS.STS({ apiVersion: '2011-06-15' });
        const credentials = await STS.assumeRole({
            RoleArn: 'arn:aws:iam::465392140585:role/alexa-lambda-dynamo-personal-ledger',
            RoleSessionName: 'PersonalLedgerSkillRoleSession' // You can rename with any name
        }, (err, res) => {
            if (err) {
                console.log('AssumeRole FAILED: ', err);
                throw new Error('Error while assuming role');
            }
            return res;
        }).promise();

        // 2. Make a new DynamoDB instance with the assumed role credentials
        //    and scan the DynamoDB table
        const dynamoDB = new AWS.DynamoDB({
            apiVersion: '2012-08-10',
            accessKeyId: credentials.Credentials.AccessKeyId,
            secretAccessKey: credentials.Credentials.SecretAccessKey,
            sessionToken: credentials.Credentials.SessionToken
        });
        docClient = dynamoDB;

        

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const AddExpensesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddExpensesIntent';
    },
    async handle(handlerInput) {
       console.log(handlerInput.requestEnvelope.request.intent.slots.entryDate.value)
        const params={ TableName: 'PersonalLedger',
                    Item: {
                        date: {N:new Date(yearCorrector(handlerInput.requestEnvelope.request.intent.slots.entryDate.value)).getTime().toString()},
                        entry: {S:handlerInput.requestEnvelope.request.intent.slots.entry.value},
                        amount: {N:handlerInput.requestEnvelope.request.intent.slots.amount.value}
                    }, 
        }
        
        await docClient.putItem(params, (err,data) => {
            if (err) {
                console.log('Put FAILED', err);
                throw new Error('Error while putting details');
            } else {
                console.log("Success", data);
            }
        }).promise();
        
        const speakOutput = 'Details have been saved';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Do you wish to add any details?')
            .getResponse();
    }
};

const FetchIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'FetchIntent';
    },
    async handle(handlerInput) {
        
        const monthNumber=monthHash[handlerInput.requestEnvelope.request.intent.slots.entriesMonth.value];
        const searchYear=new Date().getFullYear();
        console.log("month start:"+new Date(`${searchYear}-${monthNumber}-01`).getTime().toString())
        console.log("month end:"+new Date(`${searchYear}-${monthNumber}-${new Date(searchYear, monthNumber, 0).getDate()}`).getTime().toString())
        const params={ TableName: 'PersonalLedger',
            ProjectionExpression: "amount",
            ExpressionAttributeNames:{
                "#entryItem": "entry",
                "#entryDate": "date",
            },
            ExpressionAttributeValues: {
                ":entryItemVal": {S:handlerInput.requestEnvelope.request.intent.slots.entry.value},
                ":monthStart":{N:new Date(`${searchYear}-${monthNumber}-01`).getTime().toString()},
                ":monthEnd":{N:new Date(`${searchYear}-${monthNumber}-${new Date(searchYear, monthNumber, 0).getDate()}`).getTime().toString()}
            },
            FilterExpression: "(#entryItem = :entryItemVal) and (#entryDate between :monthStart and :monthEnd)" 
        }
        
        const tableData = await docClient.scan(params, (err, data) => {
            if (err) {
                console.log('Scan FAILED', err);
                throw new Error('Error while fetching details');
            }
            
            return data;
        }).promise();
        let sum=0;
        console.log(tableData);
        tableData.Items.forEach(item=>sum+=Number(item.amount.N))
        console.log(sum);
        const speakOutput = `${sum} rupees spent on ${handlerInput.requestEnvelope.request.intent.slots.entry.value}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Do you wish to add any details?')
            .getResponse();
            
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        AddExpensesIntentHandler,
        FetchIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();