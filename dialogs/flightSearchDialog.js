


const { WaterfallDialog, TextPrompt, DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { FlightService } = require('../services/flightService');

const WATERFALL_DIALOG = 'waterfallDialog';
const TEXT_PROMPT = 'textPrompt';

class FlightSearchDialog extends CancelAndHelpDialog {
    constructor() {
        super('flightSearchDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.originStep.bind(this),
                this.destinationStep.bind(this),
                this.dateStep.bind(this),
                this.searchStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async originStep(stepContext) {
        // Clear any existing values to ensure a fresh start
        stepContext.values.origin = undefined;
        stepContext.values.destination = undefined;
        stepContext.values.date = undefined;
        
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Where would you like to fly from?' });
    }

    async destinationStep(stepContext) {
        stepContext.values.origin = stepContext.result;
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Where would you like to fly to?' });
    }

    async dateStep(stepContext) {
        stepContext.values.destination = stepContext.result;
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'When would you like to travel?(e.g.: "2025-07-15")' });
    }

    async searchStep(stepContext) {
        stepContext.values.date = stepContext.result;
        
        // Call flight service to search for flights
        const flightService = new FlightService();
        const flights = await flightService.searchFlights(
            stepContext.values.origin,
            stepContext.values.destination,
            stepContext.values.date  // Fixed: removed the hyphen
        );

        if (flights && flights.length > 0) {
            // Format flight results
            let flightResults = 'Here are the available flights:\n\n';
            flights.forEach((flight, index) => {
                flightResults += `${index + 1}. ${flight.airline} - Flight ${flight.flightNumber}\n`;
                flightResults += `   ${flight.departureTime} → ${flight.arrivalTime}\n`;
                flightResults += `   Duration: ${flight.duration}\n`;
                flightResults += `   Price: $${flight.price}\n\n`;
            });

            await stepContext.context.sendActivity(flightResults);
            
            // Store the flights in dialog state for potential booking
            stepContext.values.flights = flights;
            
            // Present options after showing flight results
            const card = this.createOptionsCard(flights);
            await stepContext.context.sendActivity({ attachments: [card] });
        } else {
            await stepContext.context.sendActivity('I couldn\'t find any flights matching your criteria. Please try different search parameters.');
            
            // Present the same options as when flights are found
            const card = this.createOptionsCard();
            await stepContext.context.sendActivity({ attachments: [card] });
        }

        return await stepContext.endDialog();
    }

    // Helper method to create a consistent options card
    createOptionsCard(flights = null) {
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
                        "title": "Search Another Flight",
                        "data": { "intent": "SearchFlights", "resetDialog": true }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "Book a Flight",
                        "data": { "intent": "BookTicket", "flights": flights }
                    },
                    {
                        "type": "Action.Submit",
                        "title": "Compare Prices",
                        "data": { "intent": "CompareFlights" }
                    }
                ]
            }
        };
        
        return card;
    }

    async run(turnContext, accessor, recognizerResult) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        
        // Cancel any active dialog first to ensure a fresh start
        await dialogContext.cancelAllDialogs();
        
        // Then begin a new dialog
        await dialogContext.beginDialog(this.id);
    }
}

module.exports.FlightSearchDialog = FlightSearchDialog;