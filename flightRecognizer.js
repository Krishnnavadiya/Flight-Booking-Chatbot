const { ConversationAnalysisClient } = require('@azure/ai-language-conversations');
const { AzureKeyCredential } = require('@azure/core-auth');

class FlightRecognizer {
    constructor(config) {
        const cluIsConfigured = config && config.projectName && config.deploymentName && config.apiKey && config.endpoint;
        if (cluIsConfigured) {
            this.client = new ConversationAnalysisClient(
                config.endpoint,
                new AzureKeyCredential(config.apiKey)
            );
            this.projectName = config.projectName;
            this.deploymentName = config.deploymentName;
        }
    }

    get isConfigured() {
        return (this.client !== undefined);
    }

    /**
     * Returns an object with preformatted CLU results for the bot's dialogs to consume.
     */
    async executeLuisQuery(context) {
        if (this.isConfigured) {
            try {
                // Call the CLU service with the correct structure
                const result = await this.client.analyzeConversation({
                    analysisInput: {
                        conversationItem: {
                            text: context.activity.text,
                            id: context.activity.id,
                            participantId: context.activity.from.id
                        }
                    },
                    parameters: {
                        projectName: this.projectName,
                        deploymentName: this.deploymentName,
                        verbose: true,
                        stringIndexType: "TextElement_V8"
                    },
                    // Define the task for conversational language understanding
                    tasks: [{
                        kind: "ConversationalLanguageUnderstanding",
                        parameters: {
                            projectName: this.projectName,
                            deploymentName: this.deploymentName
                        }
                    }]
                });

                // Format the response to match the expected structure from LUIS
                // This allows minimal changes to the rest of your bot code
                return this.formatCluResponse(result, context.activity.text);
            } catch (error) {
                console.error(`Error calling CLU service: ${error}`);
                return this.getDefaultResult(context.activity.text);
            }
        }
        
        // Return a default result when CLU is not configured
        return this.getDefaultResult(context.activity.text);
    }

    /**
     * Format CLU response to match LUIS response structure
     * This helps maintain compatibility with existing dialog code
     */
    formatCluResponse(cluResult, query) {
        // Get the top intent from CLU result
        const conversationResult = cluResult.result;
        const topIntent = conversationResult.prediction.topIntent;
        
        // Create a LUIS-like response structure
        const result = {
            text: query,
            intents: {},
            entities: {
                $instance: {}
            }
        };

        // Add intents with scores
        conversationResult.prediction.intents.forEach(intent => {
            result.intents[intent.category] = { score: intent.confidenceScore };
        });

        // Add entities
        if (conversationResult.prediction.entities) {
            conversationResult.prediction.entities.forEach(entity => {
                // Handle entity extraction based on entity type
                switch (entity.category) {
                    case 'From':
                        if (!result.entities.From) result.entities.From = [];
                        if (!result.entities.$instance.From) result.entities.$instance.From = [];
                        
                        result.entities.From.push({
                            Airport: [[entity.text]]
                        });
                        
                        result.entities.$instance.From.push({
                            text: entity.text,
                            startIndex: entity.offset,
                            endIndex: entity.offset + entity.length
                        });
                        break;
                    
                    case 'To':
                        if (!result.entities.To) result.entities.To = [];
                        if (!result.entities.$instance.To) result.entities.$instance.To = [];
                        
                        result.entities.To.push({
                            Airport: [[entity.text]]
                        });
                        
                        result.entities.$instance.To.push({
                            text: entity.text,
                            startIndex: entity.offset,
                            endIndex: entity.offset + entity.length
                        });
                        break;
                    
                    case 'datetime':
                        if (!result.entities.datetime) result.entities.datetime = [];
                        result.entities.datetime.push({
                            timex: [entity.text]
                        });
                        break;
                    
                    case 'number':
                        if (!result.entities.number) result.entities.number = [];
                        result.entities.number.push(entity.text);
                        break;
                    
                    case 'class':
                        if (!result.entities.class) result.entities.class = [];
                        result.entities.class.push(entity.text);
                        break;
                    
                    default:
                        // Handle other entity types as needed
                        break;
                }
            });
        }

        return result;
    }

    getDefaultResult(query) {
        return {
            text: query,
            intents: { None: { score: 1.0 } },
            entities: {}
        };
    }

    // Keep the existing entity extraction methods to maintain compatibility
    getFromEntities(result) {
        let fromValue, fromAirportValue;
        if (result.entities.$instance.From) {
            fromValue = result.entities.$instance.From[0].text;
        }
        if (result.entities.From && result.entities.From[0].Airport) {
            fromAirportValue = result.entities.From[0].Airport[0][0];
        }

        return { from: fromValue, fromAirport: fromAirportValue };
    }

    getToEntities(result) {
        let toValue, toAirportValue;
        if (result.entities.$instance.To) {
            toValue = result.entities.$instance.To[0].text;
        }
        if (result.entities.To && result.entities.To[0].Airport) {
            toAirportValue = result.entities.To[0].Airport[0][0];
        }

        return { to: toValue, toAirport: toAirportValue };
    }

    getDatetimeEntity(result) {
        const datetimeEntity = result.entities.datetime;
        if (!datetimeEntity || !datetimeEntity[0]) return undefined;

        const timex = datetimeEntity[0].timex;
        if (!timex || !timex[0]) return undefined;

        const datetime = timex[0].split('T')[0];
        return datetime;
    }

    getTravelersEntity(result) {
        const numberEntity = result.entities.number;
        if (!numberEntity || !numberEntity[0]) return undefined;

        return numberEntity[0];
    }

    getClassEntity(result) {
        const classEntity = result.entities.class;
        if (!classEntity || !classEntity[0]) return undefined;

        return classEntity[0];
    }
}

module.exports.FlightRecognizer = FlightRecognizer;