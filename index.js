// Import required packages
const path = require('path');
const restify = require('restify');
const dotenv = require('dotenv');

// Import required bot services
const { BotFrameworkAdapter, ConversationState, MemoryStorage, UserState } = require('botbuilder');

// Import our custom bot class
const { FlightBot } = require('./flightBot');
const { FlightRecognizer } = require('./flightRecognizer');

// Read environment variables from .env file
dotenv.config();

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log('\nGet Bot Framework Emulator: https://github.com/Microsoft/BotFramework-Emulator/releases');
    console.log('\nTo talk to your bot, open the emulator and select "Open Bot"');
});

// Create adapter
const adapter = new BotFrameworkAdapter({
    appId: process.env.MICROSOFTAPPID,
    appPassword: process.env.MICROSOFTAPPPASSWORD
});

// Catch-all for errors
adapter.onTurnError = async (context, error) => {
    // Log the error
    console.error(`\n [onTurnError] unhandled error: ${error}`);
    
    // Send a more helpful message to the user
    const errorMsg = error.message || '';
    if (errorMsg.includes('Could not find airport code')) {
        await context.sendActivity('The bot encountered an error with the city name you provided. Please try again with a different city name.');
        
        // Present options to try again
        await sendOptionsCard(context);
    } else if (errorMsg.includes('No flights found')) {
        await context.sendActivity('No flights were found for your search criteria. Please try different dates or destinations.');
        
        // Present options to try again
        await sendOptionsCard(context);
    } else {
        // Generic error message
        await context.sendActivity('The bot encountered an error. Please try again later.');
    }
};

// Helper function to send options card
// In the sendOptionsCard function
async function sendOptionsCard(context) {
    const card = {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "What would you like to do next?",
                    "wrap": true
                }
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Search Flights",
                    "data": { "intent": "SearchFlights", "resetDialog": true }
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
    
    await context.sendActivity({ attachments: [card] });
}

// Create storage, state and LUIS recognizer
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// Replace LUIS configuration with CLU configuration
const luisConfig = {
    projectName: process.env.CLU_PROJECT_NAME,
    deploymentName: process.env.CLU_DEPLOYMENT_NAME,
    apiKey: process.env.CLU_API_KEY,
    endpoint: process.env.CLU_API_ENDPOINT
};

// Initialize the recognizer
const luisRecognizer = new FlightRecognizer(luisConfig);

// const luisRecognizer = new FlightRecognizer({
//     applicationId: process.env.LUISAPPID,
//     endpointKey: process.env.LUISAPIKEY,
//     endpoint: `https://${process.env.LUISAPIHOSTNAME}.api.cognitive.microsoft.com`
// });

// Create the main dialog
const bot = new FlightBot(conversationState, userState, luisRecognizer);

// Listen for incoming requests - Option 1: Async approach (recommended)
server.post('/api/messages', async (req, res) => {
    await adapter.processActivity(req, res, async (context) => {
        await bot.run(context);
    });
});

// OR Option 2: Callback approach
// server.post('/api/messages', (req, res, next) => {
//     adapter.processActivity(req, res, async (context) => {
//         await bot.run(context);
//     }).then(() => next());
// });