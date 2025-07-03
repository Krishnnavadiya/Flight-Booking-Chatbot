const { ComponentDialog, DialogTurnStatus } = require('botbuilder-dialogs');

/**
 * This base dialog provides interrupt handling for Cancel and Help commands
 */
class CancelAndHelpDialog extends ComponentDialog {
    constructor(id) {
        super(id);
    }

    async onContinueDialog(innerDc) {
        const result = await this.interrupt(innerDc);
        if (result) {
            return result;
        }
        return await super.onContinueDialog(innerDc);
    }

    async interrupt(innerDc) {
        if (innerDc.context.activity.text) {
            const text = innerDc.context.activity.text.toLowerCase();

            switch (text) {
                case 'help':
                case '?':
                    const helpMessageText = 'I can help you search for flights, compare prices, and book tickets. What would you like to do?';
                    await innerDc.context.sendActivity(helpMessageText);
                    return { status: DialogTurnStatus.waiting };
                case 'cancel':
                case 'quit':
                    const cancelMessageText = 'Cancelling current operation. What else can I help you with?';
                    await innerDc.context.sendActivity(cancelMessageText);
                    return await innerDc.cancelAllDialogs();
            }
        }

        return null;
    }
}

module.exports.CancelAndHelpDialog = CancelAndHelpDialog;