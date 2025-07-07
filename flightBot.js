const { ActivityHandler, MessageFactory } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { FlightBookingDialog } = require('./dialogs/flightBookingDialog');
const { CancelAndHelpDialog } = require('./dialogs/cancelAndHelpDialog');
const { FlightSearchDialog } = require('./dialogs/flightSearchDialog');
const { FlightComparisonDialog } = require('./dialogs/flightComparisonDialog');
const { BookingDialog } = require('./dialogs/bookingDialog');

class FlightBot extends ActivityHandler {
    constructor(conversationState, userState, luisRecognizer) {
        super();
        
        if (!conversationState) throw new Error('Missing parameter: conversationState');
        if (!userState) throw new Error('Missing parameter: userState');
        if (!luisRecognizer) throw new Error('Missing parameter: luisRecognizer');

        this.conversationState = conversationState;
        this.userState = userState;
        this.luisRecognizer = luisRecognizer;
        this.dialogState = this.conversationState.createProperty('DialogState');
        
        // Create the dialogs
        this.flightBookingDialog = new FlightBookingDialog(this.luisRecognizer);
        this.flightSearchDialog = new FlightSearchDialog();
        this.flightComparisonDialog = new FlightComparisonDialog();
        this.bookingDialog = new BookingDialog();

        this.onMessage(async (context, next) => {
            console.log('Processing Message Activity.');

            // First, check if there's an active dialog
            // Create a DialogSet with the accessor
            const dialogSet = new DialogSet(this.dialogState);
            
            // Add all dialogs to the DialogSet
            dialogSet.add(this.flightBookingDialog);
            dialogSet.add(this.flightSearchDialog);
            dialogSet.add(this.flightComparisonDialog);
            dialogSet.add(this.bookingDialog);
            
            // Then create the context from the DialogSet
            const dc = await dialogSet.createContext(context);
            const dialogTurnResult = await dc.continueDialog();
            
            // If the dialog is active and waiting for a response, don't try to determine intent
            if (dialogTurnResult.status !== DialogTurnStatus.empty) {
                console.log('Dialog is active, continuing dialog without intent recognition');
            } else {
                // No active dialog, so determine intent
                let intent;
                if (context.activity.value && context.activity.value.intent) {
                    // Use the intent from the card submission
                    intent = context.activity.value.intent;
                    console.log(`Using intent from card submission: ${intent}`);
                } else {
                    // Use LUIS/CLU to determine intent
                    const recognizerResult = await this.luisRecognizer.executeLuisQuery(context);
                    intent = LuisRecognizer.topIntent(recognizerResult);
                    console.log(`Using intent from LUIS/CLU: ${intent}`);
                }

                // Route based on intent
                switch (intent) {
                    case 'BookFlight':
                        await this.flightBookingDialog.run(context, this.dialogState);
                        break;
                    case 'SearchFlights':
                        await this.flightSearchDialog.run(context, this.dialogState);
                        break;
                    case 'CompareFlights':
                        await this.flightComparisonDialog.run(context, this.dialogState);
                        break;
                    case 'BookTicket':
                        await this.bookingDialog.run(context, this.dialogState);
                        break;
                    case 'Cancel':
                        await context.sendActivity('Cancelling your request.');
                        break;
                    default:
                        // Help or unknown intent
                        await context.sendActivity(`I'm sorry, I didn't understand that. I can help you search for flights, compare prices, and book tickets.`);
                        break;
                }
            }

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            
            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await this.sendWelcomeMessage(context);
                }
            }

            await next();
        });
    }

    /**
     * Send a welcome message along with suggested actions for the user.
     * @param {TurnContext} turnContext A TurnContext instance containing all the data needed for processing this conversation turn.
     */
    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;

        // Create a hero card with suggested actions
        const card = {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.0",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "Welcome to Flight Booking Bot!",
                        "weight": "bolder",
                        "size": "large"
                    },
                    {
                        "type": "TextBlock",
                        "text": "I can help you search for flights, compare prices, and book tickets.",
                        "wrap": true
                    },
                    {
                        "type": "TextBlock",
                        "text": "How can I help you today?",
                        "wrap": true
                    }
                ],
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Search Flights",
                        "data": { "intent": "SearchFlights" }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "Book a Flight",
                        "data": { "intent": "BookFlight" }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "Compare Prices",
                        "data": { "intent": "CompareFlights" }
                    }
                ]
            }
        };

        await turnContext.sendActivity({ attachments: [card] });
    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);
        
        // Save any state changes. The load happened during the execution of the Dialog.
        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }
}

module.exports.FlightBot = FlightBot;