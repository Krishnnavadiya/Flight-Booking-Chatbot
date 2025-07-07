const { WaterfallDialog, TextPrompt, DialogTurnStatus } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { FlightService } = require('../services/flightService');
const { BookingDialog } = require('./bookingDialog');

const WATERFALL_DIALOG = 'waterfallDialog';
const TEXT_PROMPT = 'textPrompt';
const BOOKING_DIALOG = 'bookingDialog';

class FlightComparisonDialog extends CancelAndHelpDialog {
    constructor() {
        super('flightComparisonDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new BookingDialog())
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.originStep.bind(this),
                this.destinationStep.bind(this),
                this.dateStep.bind(this),
                this.compareStep.bind(this),
                this.retryStep.bind(this),
                this.selectionStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async originStep(stepContext) {
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Where would you like to fly from?' });
    }

    async destinationStep(stepContext) {
        stepContext.values.origin = stepContext.result;
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Where would you like to fly to?' });
    }

    async dateStep(stepContext) {
        stepContext.values.destination = stepContext.result;
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'When would you like to travel?' });
    }

    async compareStep(stepContext) {
        stepContext.values.date = stepContext.result;
        
        // Call flight service to compare flights
        const flightService = new FlightService();
        try {
            const flights = await flightService.searchFlights(
                stepContext.values.origin,
                stepContext.values.destination,
                stepContext.values.date
            );
    
            if (flights && flights.length > 0) {
                // Store flights in dialog state for later use
                stepContext.values.flights = flights;
                
                // Sort flights by price
                const sortedByPrice = [...flights].sort((a, b) => a.price - b.price);
                
                // Sort flights by duration
                const sortedByDuration = [...flights].sort((a, b) => {
                    const durationA = this.parseDuration(a.duration);
                    const durationB = this.parseDuration(b.duration);
                    return durationA - durationB;
                });
    
                // Format comparison results
                let comparisonResults = 'Here are the available flights:\n\n';
                
                comparisonResults += 'Best Price Options:\n';
                for (let i = 0; i < Math.min(3, sortedByPrice.length); i++) {
                    const flight = sortedByPrice[i];
                    comparisonResults += `${i + 1}. ${flight.airline} - $${flight.price} - ${flight.departureTime} → ${flight.arrivalTime} (${flight.duration})\n`;
                }
                
                comparisonResults += '\nFastest Options:\n';
                for (let i = 0; i < Math.min(3, sortedByDuration.length); i++) {
                    const flight = sortedByDuration[i];
                    comparisonResults += `${i + 1}. ${flight.airline} - ${flight.duration} - ${flight.departureTime} → ${flight.arrivalTime} ($${flight.price})\n`;
                }
    
                await stepContext.context.sendActivity(comparisonResults);
                
                // Continue to next step to handle selection
                return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Please enter the flight number you want to book:' });
            } else {
                throw new Error('No flights found for your search criteria.');
            }
        } catch (error) {
            // Handle specific error messages - SAFELY CHECK ERROR MESSAGE
            const errorMessage = error.message || 'An error occurred during flight search';
            await stepContext.context.sendActivity(errorMessage);
            
            // Safely check error message content
            const errorText = String(errorMessage);
            
            // Suggest alternative options
            if (errorText.includes('Could not find airport code')) {
                await stepContext.context.sendActivity('Here are some popular cities you can try: Delhi, Mumbai, New York, London, Dubai, Singapore, Tokyo.');
            } else if (errorText.includes('No flights found')) {
                await stepContext.context.sendActivity('You might want to try different dates or popular routes like Delhi-Mumbai, Delhi-Bangalore, or Mumbai-Bangalore.');
            }
            
            // Set a flag to indicate we're in retry mode
            stepContext.values.retryMode = true;
            
            // Ask if the user wants to try again
            return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Would you like to try searching again? (yes/no)' });
        }
    }

    // Add a new step after compareStep to handle retry responses
    async retryStep(stepContext) {
        // Check if we're in retry mode
        if (stepContext.values.retryMode) {
            const response = stepContext.result.toLowerCase();
            
            if (response === 'yes') {
                // Restart the dialog
                return await stepContext.replaceDialog(this.id);
            } else {
                // End the dialog
                await stepContext.context.sendActivity('Thank you for using our flight search service.');
                return await stepContext.endDialog();
            }
        }
        
        // If not in retry mode, this is a flight selection
        return await this.selectionStep(stepContext);
    }

    async selectionStep(stepContext) {
        const selectedFlightNumber = stepContext.result;
        
        // Check if user wants to cancel
        if (selectedFlightNumber.toLowerCase() === 'cancel') {
            await stepContext.context.sendActivity('Flight selection cancelled.');
            return await stepContext.endDialog();
        }
        
        // Find the selected flight
        const selectedFlight = stepContext.values.flights.find(f => f.flightNumber === selectedFlightNumber);
        
        if (selectedFlight) {
            await stepContext.context.sendActivity(`You've selected ${selectedFlight.airline} flight ${selectedFlight.flightNumber} for $${selectedFlight.price}.`);
            
            // Pass the selected flight to the booking dialog
            return await stepContext.beginDialog(BOOKING_DIALOG, { selectedFlight });
        } else {
            await stepContext.context.sendActivity(`I couldn't find flight ${selectedFlightNumber}. Please try again.`);
            return await stepContext.replaceDialog(this.id, stepContext.values);
        }
    }

    // Helper method to convert duration string to minutes for comparison
    parseDuration(durationStr) {
        const parts = durationStr.split('h ');
        const hours = parseInt(parts[0], 10);
        const minutes = parts.length > 1 ? parseInt(parts[1].replace('m', ''), 10) : 0;
        return hours * 60 + minutes;
    }

    // Helper method to send flight options as interactive cards
    async sendFlightOptionsAsCards(context, flights) {
        await context.sendActivity('Here are all available flights. You can select any of these:');
        
        for (const flight of flights) {
            const card = {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.0",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": `${flight.airline} - ${flight.flightNumber}`,
                            "weight": "bolder",
                            "size": "medium"
                        },
                        {
                            "type": "ColumnSet",
                            "columns": [
                                {
                                    "type": "Column",
                                    "width": "auto",
                                    "items": [
                                        {
                                            "type": "TextBlock",
                                            "text": flight.departureTime,
                                            "weight": "bolder"
                                        },
                                        {
                                            "type": "TextBlock",
                                            "text": "Departure",
                                            "isSubtle": true
                                        }
                                    ]
                                },
                                {
                                    "type": "Column",
                                    "width": "auto",
                                    "items": [
                                        {
                                            "type": "TextBlock",
                                            "text": flight.duration,
                                            "weight": "bolder"
                                        },
                                        {
                                            "type": "TextBlock",
                                            "text": "Duration",
                                            "isSubtle": true
                                        }
                                    ]
                                },
                                {
                                    "type": "Column",
                                    "width": "auto",
                                    "items": [
                                        {
                                            "type": "TextBlock",
                                            "text": flight.arrivalTime,
                                            "weight": "bolder"
                                        },
                                        {
                                            "type": "TextBlock",
                                            "text": "Arrival",
                                            "isSubtle": true
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "type": "TextBlock",
                            "text": `Price: $${flight.price}`,
                            "weight": "bolder"
                        }
                    ],
                    "actions": [
                        {
                            "type": "Action.Submit",
                            "title": "Select Flight",
                            "data": { 
                                "intent": "BookTicket",
                                "flightNumber": flight.flightNumber 
                            }
                        }
                    ]
                }
            };
            
            await context.sendActivity({ attachments: [card] });
        }
    }

    async run(turnContext, accessor, recognizerResult) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }
}

module.exports.FlightComparisonDialog = FlightComparisonDialog;