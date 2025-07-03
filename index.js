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
    console.error(`\n [onTurnError] unhandled error: ${error}`);
    await context.sendActivity('The bot encountered an error. Please try again later.');
};

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