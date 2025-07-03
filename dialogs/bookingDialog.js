const { WaterfallDialog, TextPrompt, NumberPrompt, ChoicePrompt, ConfirmPrompt, DialogTurnStatus } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { FlightService } = require('../services/flightService');

const WATERFALL_DIALOG = 'waterfallDialog';
const TEXT_PROMPT = 'textPrompt';
const NUMBER_PROMPT = 'numberPrompt';
const CHOICE_PROMPT = 'choicePrompt';
const CONFIRM_PROMPT = 'confirmPrompt';

class BookingDialog extends CancelAndHelpDialog {
    constructor() {
        super('bookingDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new NumberPrompt(NUMBER_PROMPT))
            .addDialog(new ChoicePrompt(CHOICE_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.selectFlightStep.bind(this),
                this.passengerNameStep.bind(this),
                this.passengerEmailStep.bind(this),
                this.paymentMethodStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async selectFlightStep(stepContext) {
        // In a real implementation, this would use the selected flight from previous dialog
        // For now, we'll simulate having a selected flight
        stepContext.values.selectedFlight = {
            id: 'FL123',
            airline: 'SkyWings Airlines',
            flightNumber: 'SW456',
            origin: 'New York (JFK)',
            destination: 'San Francisco (SFO)',
            departureTime: '10:00 AM',
            arrivalTime: '1:30 PM',
            duration: '3h 30m',
            price: 299.99
        };

        // Display selected flight details
        const flightDetails = `You're booking the following flight:\n\n` +
            `${stepContext.values.selectedFlight.airline} - Flight ${stepContext.values.selectedFlight.flightNumber}\n` +
            `From: ${stepContext.values.selectedFlight.origin}\n` +
            `To: ${stepContext.values.selectedFlight.destination}\n` +
            `Departure: ${stepContext.values.selectedFlight.departureTime}\n` +
            `Arrival: ${stepContext.values.selectedFlight.arrivalTime}\n` +
            `Price: $${stepContext.values.selectedFlight.price}\n`;

        await stepContext.context.sendActivity(flightDetails);
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Please enter passenger name:' });
    }

    async passengerNameStep(stepContext) {
        stepContext.values.passengerName = stepContext.result;
        return await stepContext.prompt(TEXT_PROMPT, { prompt: 'Please enter passenger email for confirmation:' });
    }

    async passengerEmailStep(stepContext) {
        stepContext.values.passengerEmail = stepContext.result;
        return await stepContext.prompt(CHOICE_PROMPT, {
            prompt: 'Please select a payment method:',
            choices: ['Credit Card', 'PayPal', 'Apple Pay']
        });
    }

    async paymentMethodStep(stepContext) {
        stepContext.values.paymentMethod = stepContext.result.value;
        
        // Summarize booking details for confirmation
        const bookingSummary = `Please confirm your booking details:\n\n` +
            `Flight: ${stepContext.values.selectedFlight.airline} ${stepContext.values.selectedFlight.flightNumber}\n` +
            `From: ${stepContext.values.selectedFlight.origin} to ${stepContext.values.selectedFlight.destination}\n` +
            `Departure: ${stepContext.values.selectedFlight.departureTime}\n` +
            `Passenger: ${stepContext.values.passengerName}\n` +
            `Email: ${stepContext.values.passengerEmail}\n` +
            `Payment Method: ${stepContext.values.paymentMethod}\n` +
            `Total Price: $${stepContext.values.selectedFlight.price}\n`;

        await stepContext.context.sendActivity(bookingSummary);
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: 'Would you like to confirm this booking?' });
    }

    async confirmStep(stepContext) {
        if (stepContext.result) {
            // Process the booking
            const flightService = new FlightService();
            const bookingResult = await flightService.bookFlight({
                flightId: stepContext.values.selectedFlight.id,
                passengerName: stepContext.values.passengerName,
                passengerEmail: stepContext.values.passengerEmail,
                paymentMethod: stepContext.values.paymentMethod
            });

            stepContext.values.bookingReference = bookingResult.bookingReference;
            await stepContext.context.sendActivity(`Your booking is confirmed! Booking reference: ${bookingResult.bookingReference}`);
            
            // Send itinerary
            const itinerary = `Here's your itinerary:\n\n` +
                `Booking Reference: ${bookingResult.bookingReference}\n` +
                `Passenger: ${stepContext.values.passengerName}\n` +
                `Flight: ${stepContext.values.selectedFlight.airline} ${stepContext.values.selectedFlight.flightNumber}\n` +
                `From: ${stepContext.values.selectedFlight.origin}\n` +
                `To: ${stepContext.values.selectedFlight.destination}\n` +
                `Date: ${bookingResult.departureDate}\n` +
                `Departure: ${stepContext.values.selectedFlight.departureTime}\n` +
                `Arrival: ${stepContext.values.selectedFlight.arrivalTime}\n\n` +
                `A confirmation email has been sent to ${stepContext.values.passengerEmail}.`;

            await stepContext.context.sendActivity(itinerary);
        } else {
            await stepContext.context.sendActivity('Booking cancelled. Is there anything else I can help you with?');
        }

        return await stepContext.next();
    }

    async finalStep(stepContext) {
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

module.exports.BookingDialog = BookingDialog;