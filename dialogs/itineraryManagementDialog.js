const { WaterfallDialog, TextPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { FlightService } = require('../services/flightService');

const WATERFALL_DIALOG = 'waterfallDialog';
const TEXT_PROMPT = 'textPrompt';
const CHOICE_PROMPT = 'choicePrompt';

class ItineraryManagementDialog extends CancelAndHelpDialog {
    constructor() {
        super('itineraryManagementDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ChoicePrompt(CHOICE_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.bookingReferenceStep.bind(this),
                this.actionSelectionStep.bind(this),
                this.processActionStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async bookingReferenceStep(stepContext) {
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Please enter your booking reference:' });
    }

    async actionSelectionStep(stepContext) {
        stepContext.values.bookingReference = stepContext.result;
        
        // Get booking details
        const flightService = new FlightService();
        try {
            const booking = await flightService.getBookingDetails(stepContext.values.bookingReference);
            stepContext.values.booking = booking;
            
            // Display booking details
            const bookingDetails = `Booking Reference: ${booking.bookingId}\n` +
                `Flight: ${booking.flightDetails.airline} ${booking.flightDetails.flightNumber}\n` +
                `From: ${booking.flightDetails.origin} to ${booking.flightDetails.destination}\n` +
                `Date: ${booking.flightDetails.departureDate}\n` +
                `Passenger: ${booking.passengerDetails.name}\n`;
                
            await stepContext.context.sendActivity(bookingDetails);
            
            // Prompt for action
            return await stepContext.prompt(CHOICE_PROMPT, {
                prompt: 'What would you like to do with this booking?',
                choices: ['View Details', 'Change Seats', 'Cancel Booking', 'Email Itinerary']
            });
        } catch (error) {
            await stepContext.context.sendActivity(`I couldn't find a booking with reference ${stepContext.values.bookingReference}. Please check and try again.`);
            return await stepContext.endDialog();
        }
    }

    async processActionStep(stepContext) {
        const action = stepContext.result.value;
        
        switch (action) {
            case 'View Details':
                // Additional details could be shown here
                await stepContext.context.sendActivity('Here are your complete booking details...');
                break;
            case 'Change Seats':
                await stepContext.context.sendActivity('Seat selection functionality would be implemented here.');
                break;
            case 'Cancel Booking':
                await stepContext.context.sendActivity('To confirm cancellation, please type "CONFIRM CANCEL"');
                return await stepContext.prompt(TEXT_PROMPT, { prompt: 'This action cannot be undone.' });
            case 'Email Itinerary':
                await stepContext.context.sendActivity(`Your itinerary has been sent to ${stepContext.values.booking.passengerDetails.email}.`);
                break;
        }
        
        return await stepContext.next();
    }

    async finalStep(stepContext) {
        await stepContext.context.sendActivity('Is there anything else you would like to do with your booking?');
        return await stepContext.endDialog();
    }
}

module.exports.ItineraryManagementDialog = ItineraryManagementDialog;