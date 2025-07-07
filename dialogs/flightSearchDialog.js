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

    async searchStep(stepContext) {
        stepContext.values.date = stepContext.result;
        
        // Call flight service to search for flights
        const flightService = new FlightService();
        const flights = await flightService.searchFlights(
            stepContext.values.origin,
            stepContext.values.destination,
            stepContext.values.date
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
        } else {
            await stepContext.context.sendActivity('I couldn\'t find any flights matching your criteria. Please try different search parameters.');
        }

        return await stepContext.endDialog();
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

module.exports.FlightSearchDialog = FlightSearchDialog;