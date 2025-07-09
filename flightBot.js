const { ActivityHandler, MessageFactory } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { FlightBookingDialog } = require('./dialogs/flightBookingDialog');
const { CancelAndHelpDialog } = require('./dialogs/cancelAndHelpDialog');
const { FlightSearchDialog } = require('./dialogs/flightSearchDialog');
const { FlightComparisonDialog } = require('./dialogs/flightComparisonDialog');
const { BookingDialog } = require('./dialogs/bookingDialog');
const { UserProfile } = require('./models/userProfile');

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
        this.conversationEnded = this.conversationState.createProperty('ConversationEnded');
        this.userProfile = this.userState.createProperty('UserProfile');
        
        // Create the dialogs
        this.flightBookingDialog = new FlightBookingDialog(this.luisRecognizer);
        this.flightSearchDialog = new FlightSearchDialog();
        this.flightComparisonDialog = new FlightComparisonDialog(this.userState);
        this.bookingDialog = new BookingDialog(this.userState);

        // Set up the onMessage handler
        this.onMessage(async (context, next) => {
            console.log('Processing Message Activity.');
        
            // Check if conversation has been marked as ended
            const conversationEnded = await this.conversationEnded.get(context, false);
            if (conversationEnded) {
                // If conversation was marked as ended, reset it and start fresh
                await this.conversationEnded.set(context, false);
                await this.sendWelcomeMessage(context);
                await next();
                return;
            }

            // Check if we're waiting for the user's name
            const waitingForName = await this.conversationState.createProperty('WaitingForName').get(context, false);
            if (waitingForName) {
                // Get the user's name from the message
                const userProfile = await this.userProfile.get(context, new UserProfile());
                userProfile.name = context.activity.text;
                await this.userProfile.set(context, userProfile);
                
                // Reset the waiting flag
                await this.conversationState.createProperty('WaitingForName').set(context, false);
                
                // Send a personalized welcome message
                await context.sendActivity(`Nice to meet you, ${userProfile.name}! How can I help you today?`);
                await this.sendWelcomeMessage(context, userProfile.name);
                await next();
                return;
            }

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
                    // In the onMessage handler, when handling the SearchFlights intent
                    case 'SearchFlights':
                    // Check if we need to reset the dialog (coming from error handling)
                    if (context.activity.value && context.activity.value.resetDialog) {
                        // Cancel any existing dialogs first
                        const dialogContext = await dialogSet.createContext(context);
                        await dialogContext.cancelAllDialogs();
                    }
                    await this.flightSearchDialog.run(context, this.dialogState);
                    break;
                    case 'CompareFlights':
                        await this.flightComparisonDialog.run(context, this.dialogState);
                        break;
                    case 'BookTicket':
                        // Extract flight information from the activity
                        let selectedFlight = null;
                        if (context.activity.value && context.activity.value.flightNumber) {
                            const flightNumber = context.activity.value.flightNumber;
                            const flightService = new FlightService();
                            // Get flight details by flight number
                            selectedFlight = await flightService.getFlightByNumber(flightNumber);
                        }
                        
                        // Pass the selected flight to the booking dialog
                        await this.bookingDialog.run(context, this.dialogState, { selectedFlight });
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

        // Set up the onMembersAdded handler
        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            
            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    // Check if we already have the user's name
                    const userProfile = await this.userProfile.get(context, {});
                    
                    if (!userProfile.name) {
                        await context.sendActivity('Welcome to Flight Booking Bot! Before we start, may I know your name?');
                        // Set a flag to indicate we're waiting for the name
                        await this.conversationState.createProperty('WaitingForName').set(context, true);
                    } else {
                        await this.sendWelcomeMessage(context, userProfile.name);
                    }
                }
            }
        
            await next();
        });
    }

    /**
     * Send a welcome message along with suggested actions for the user.
     * @param {TurnContext} turnContext A TurnContext instance containing all the data needed for processing this conversation turn.
     * @param {string} userName Optional user name to personalize the greeting
     */
    async sendWelcomeMessage(turnContext, userName = '') {
        const { activity } = turnContext;
        
        // Create a personalized greeting if we have the user's name
        const greeting = userName ? `Welcome to Flight Booking Bot, ${userName}!` : 'Welcome to Flight Booking Bot!';
    
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
                        "text": greeting,
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