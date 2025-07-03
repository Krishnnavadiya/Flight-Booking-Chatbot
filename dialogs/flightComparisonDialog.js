const { WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { FlightService } = require('../services/flightService');

const WATERFALL_DIALOG = 'waterfallDialog';
const TEXT_PROMPT = 'textPrompt';

class FlightComparisonDialog extends CancelAndHelpDialog {
    constructor() {
        super('flightComparisonDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.originStep.bind(this),
                this.destinationStep.bind(this),
                this.dateStep.bind(this),
                this.compareStep.bind(this)
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
        const flights = await flightService.searchFlights(
            stepContext.values.origin,
            stepContext.values.destination,
            stepContext.values.date
        );

        if (flights && flights.length > 0) {
            // Sort flights by price
            const sortedByPrice = [...flights].sort((a, b) => a.price - b.price);
            
            // Sort flights by duration
            const sortedByDuration = [...flights].sort((a, b) => {
                const durationA = this.parseDuration(a.duration);
                const durationB = this.parseDuration(b.duration);
                return durationA - durationB;
            });

            // Format comparison results
            let comparisonResults = 'Here\'s a comparison of available flights:\n\n';
            
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
        } else {
            await stepContext.context.sendActivity('I couldn\'t find any flights matching your criteria. Please try different search parameters.');
        }

        return await stepContext.endDialog();
    }

    // Helper method to convert duration string to minutes for comparison
    parseDuration(durationStr) {
        const parts = durationStr.split('h ');
        const hours = parseInt(parts[0], 10);
        const minutes = parts.length > 1 ? parseInt(parts[1].replace('m', ''), 10) : 0;
        return hours * 60 + minutes;
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