const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { FlightDetails } = require('../models/flightDetails');
const { LuisRecognizer } = require('botbuilder-ai');
const { FlightService } = require('../services/flightService');

const FLIGHT_BOOKING_DIALOG = 'flightBookingDialog';
const WATERFALL_DIALOG = 'waterfallDialog';
const TEXT_PROMPT = 'textPrompt';

class FlightBookingDialog extends ComponentDialog {
    constructor(luisRecognizer) {
        super(FLIGHT_BOOKING_DIALOG);

        this.luisRecognizer = luisRecognizer;
        this.flightService = new FlightService(); // Initialize the flight service

        // Add prompts
        this.addDialog(new TextPrompt(TEXT_PROMPT));

        // Add waterfall dialog with steps
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.originStep.bind(this),
            this.destinationStep.bind(this),
            this.departureDateStep.bind(this),
            this.returnDateStep.bind(this),
            this.travelersStep.bind(this),
            this.classStep.bind(this),
            this.confirmStep.bind(this),
            this.finalStep.bind(this)
        ]));

        // Set the initial dialog to run
        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * Run the dialog
     */
    async run(turnContext, dialogStateAccessor, recognizerResult) {
        const dialogSet = new DialogSet(dialogStateAccessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();

        if (results.status === DialogTurnStatus.empty) {
            // Extract flight details from LUIS result if available
            const flightDetails = new FlightDetails();
            
            if (recognizerResult) {
                // Extract entities
                const fromEntities = this.luisRecognizer.getFromEntities(recognizerResult);
                const toEntities = this.luisRecognizer.getToEntities(recognizerResult);
                const datetimeEntity = this.luisRecognizer.getDatetimeEntity(recognizerResult);
                const travelersEntity = this.luisRecognizer.getTravelersEntity(recognizerResult);
                const classEntity = this.luisRecognizer.getClassEntity(recognizerResult);

                // Set flight details from entities
                if (fromEntities.from) flightDetails.origin = fromEntities.from;
                if (toEntities.to) flightDetails.destination = toEntities.to;
                if (datetimeEntity) flightDetails.departureDate = datetimeEntity;
                if (travelersEntity) flightDetails.travelers = travelersEntity;
                if (classEntity) flightDetails.class = classEntity;
            }

            await dialogContext.beginDialog(FLIGHT_BOOKING_DIALOG, flightDetails);
        }
    }

    async originStep(stepContext) {
        const flightDetails = stepContext.options;

        if (!flightDetails.origin) {
            return await stepContext.prompt(TEXT_PROMPT, 'From which city would you like to fly?');
        } else {
            return await stepContext.next(flightDetails.origin);
        }
    }

    async destinationStep(stepContext) {
        const flightDetails = stepContext.options;
        
        // Set origin if not already set
        if (!flightDetails.origin) {
            flightDetails.origin = stepContext.result;
        }

        if (!flightDetails.destination) {
            return await stepContext.prompt(TEXT_PROMPT, 'To which city would you like to fly?');
        } else {
            return await stepContext.next(flightDetails.destination);
        }
    }

    async departureDateStep(stepContext) {
        const flightDetails = stepContext.options;
        
        // Set destination if not already set
        if (!flightDetails.destination) {
            flightDetails.destination = stepContext.result;
        }

        if (!flightDetails.departureDate) {
            return await stepContext.prompt(TEXT_PROMPT, 'When would you like to depart?(e.g.: "2025-07-15")');
        } else {
            return await stepContext.next(flightDetails.departureDate);
        }
    }

    async returnDateStep(stepContext) {
        const flightDetails = stepContext.options;
        
        // Set departure date if not already set
        if (!flightDetails.departureDate) {
            flightDetails.departureDate = stepContext.result;
        }

        if (!flightDetails.returnDate) {
            return await stepContext.prompt(TEXT_PROMPT, 'When would you like to return? (Leave empty for one-way flight)');
        } else {
            return await stepContext.next(flightDetails.returnDate);
        }
    }

    async travelersStep(stepContext) {
        const flightDetails = stepContext.options;
        
        // Set return date if not already set
        if (!flightDetails.returnDate && stepContext.result) {
            flightDetails.returnDate = stepContext.result;
        }

        if (!flightDetails.travelers) {
            return await stepContext.prompt(TEXT_PROMPT, 'How many travelers?');
        } else {
            return await stepContext.next(flightDetails.travelers);
        }
    }

    async classStep(stepContext) {
        const flightDetails = stepContext.options;
        
        // Set travelers if not already set
        if (!flightDetails.travelers) {
            flightDetails.travelers = stepContext.result;
        }

        if (!flightDetails.class) {
            return await stepContext.prompt(TEXT_PROMPT, 'Which class would you prefer? (Economy, Business, First)');
        } else {
            return await stepContext.next(flightDetails.class);
        }
    }

    async confirmStep(stepContext) {
        const flightDetails = stepContext.options;
        
        // Set class if not already set
        if (!flightDetails.class) {
            flightDetails.class = stepContext.result;
        }

        // Prepare confirmation message
        const msg = `Please confirm your flight details:\n- From: ${flightDetails.origin}\n- To: ${flightDetails.destination}\n- Departure: ${flightDetails.departureDate}`;
        const returnMsg = flightDetails.returnDate ? `\n- Return: ${flightDetails.returnDate}` : '\n- One-way flight';
        const travelersMsg = `\n- Travelers: ${flightDetails.travelers}\n- Class: ${flightDetails.class}`;
        
        await stepContext.context.sendActivity(msg + returnMsg + travelersMsg);
        return await stepContext.prompt(TEXT_PROMPT, 'Is this correct? (yes/no)');
    }

    async finalStep(stepContext) {
        const flightDetails = stepContext.options;
        const confirmation = stepContext.result.toLowerCase();
        
        if (confirmation === 'yes' || confirmation === 'y') {
            // Search for flights based on the details
            await stepContext.context.sendActivity('Great! Searching for flights...');
            
            try {
                // Call the flight service to get real flight data
                const flightOptions = await this.flightService.searchFlights(
                    flightDetails.origin,
                    flightDetails.destination,
                    flightDetails.departureDate,
                    flightDetails.returnDate,
                    flightDetails.travelers,
                    flightDetails.class
                );
                
                // If you want to simulate a delay, use a proper promise-based delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Create flight cards
                await this.sendFlightOptions(stepContext.context, flightOptions);
                
                // Only end the dialog after sending flight options
                return await stepContext.endDialog(flightDetails);
            } catch (error) {
                // Handle API errors gracefully
                await stepContext.context.sendActivity(`Sorry, I encountered an issue while searching for flights: ${error.message}`);
                
                // Fallback to mock data if API fails
                await stepContext.context.sendActivity('Showing some alternative options instead:');
                const mockFlightOptions = this.flightService.getMockFlightData(
                    flightDetails.origin,
                    flightDetails.destination,
                    flightDetails.departureDate,
                    flightDetails.class
                );
                
                await this.sendFlightOptions(stepContext.context, mockFlightOptions);
                return await stepContext.endDialog(flightDetails);
            }
        } else {
            await stepContext.context.sendActivity('No problem. Let\'s start over.');
            return await stepContext.endDialog();
        }
    }

    async sendFlightOptions(context, flights) {
        await context.sendActivity('Here are some flight options I found for you:');
        
        for (const flight of flights) {
            // Build Skyscanner URL for this flight
            const skyscannerUrl = this.buildSkyscannerUrl(flight);
            
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
                            "text": `Price: ${flight.price}`,
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
                        },
                        {
                            "type": "Action.OpenUrl",
                            "title": "Book on Skyscanner",
                            "url": skyscannerUrl
                        }
                    ]
                }
            };
            
            await context.sendActivity({ attachments: [card] });
        }
    }

    // Helper method to build Skyscanner URL with flight details
    buildSkyscannerUrl(flight) {
        try {
            // Format the date as YYMMDD which is used by Skyscanner
            const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                const year = date.getFullYear().toString().substr(-2); // Get last 2 digits of year
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return year + month + day;
            };

            // Get origin and destination codes
            const origin = flight.origin;
            const destination = flight.destination;
            const departureDate = formatDate(flight.departureDate);

            // Construct Skyscanner URL
            // Format: https://www.skyscanner.com/transport/flights/ORIG/DEST/YYMMDD/
            return `https://www.skyscanner.com/transport/flights/${origin}/${destination}/${departureDate}/`;
        } catch (error) {
            // If URL construction fails, return the base Skyscanner URL
            return 'https://www.skyscanner.com';
        }
    }
}

module.exports.FlightBookingDialog = FlightBookingDialog;