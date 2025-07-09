# Flight Booking Bot ✈️

A conversational AI bot that streamlines the flight booking process, allowing users to search for flights, compare prices, and book tickets directly through a chat interface. 💬🛫

## Table of Contents 🗂️

* [Overview](#overview)
* [Features](#features)

  * [Conversational Search](#conversational-search)
  * [Real-time Flight Search](#real-time-flight-search)
  * [Price Comparison](#price-comparison)
  * [Flight Filtering](#flight-filtering)
  * [Secure Booking](#secure-booking)
  * [Confirmation and Itinerary Management](#confirmation-and-itinerary-management)
  * [Multilingual Support](#multilingual-support)
* [Technology Stack](#technology-stack)
* [Getting Started](#getting-started)

  * [Prerequisites](#prerequisites)
  * [Installation](#installation)
* [Configuration](#configuration)
* [Usage Examples](#usage-examples)

  * [Searching for Flights](#searching-for-flights)
  * [Comparing Flight Options](#comparing-flight-options)
  * [Booking a Flight](#booking-a-flight)
* [Project Structure](#project-structure)
* [Resources](#resources)
* [License](#license)
* [Acknowledgments](#acknowledgments)

## Overview 🌍

This intelligent bot enables users to have natural conversations about their travel plans. Simply tell the bot your desired travel dates and destinations, and it presents the best options from various airlines. The bot handles everything from initial search to final booking confirmation, all within a seamless chat interface. 👩‍💻🛄

## Features ✨

### Conversational Search 🗣️

* Natural language interaction to specify origin, destination, dates, number of travelers, and more. 🧳
* Intuitive dialog flow guides users through each step of the booking process.

### Real-time Flight Search 🔍

* Live flight data integration from multiple airlines for up-to-date prices and availability. ⏱️
* Connector modules support various flight data providers.

### Price Comparison 💰

* Compare fares across airlines and travel classes. 🏷️
* Sort and filter options by price, duration, layovers, and user preferences.

### Flight Filtering 🎛️

* Narrow results by price range, specific airlines, travel duration, stopovers, and other criteria. 🚦
* Advanced filter settings for tailored search results.

### Secure Booking 🔒

* In-chat booking with secure payment gateway integration. 💳
* Compliance with privacy and data protection standards. 🛡️

### Confirmation and Itinerary Management 📋

* Instant booking confirmation and e-ticket delivery within the chat. 📧
* Modify or cancel bookings and view full itinerary details. 🔄

### Multilingual Support 🌐

* Support for multiple languages with localized responses. 🗺️
* Language detection and switching based on user preferences. 🈯️

## Technology Stack 🛠️

* **Bot Framework SDK**: Microsoft’s framework for building conversational experiences 🤖
* **Node.js**: Server-side JavaScript runtime 🖥️
* **Express**: Web framework for Node.js 🕸️
* **MySQL**: Relational database for storing user and booking data 🗄️
* **Azure Bot Service**: Hosting and deployment platform ☁️
* **Conversational Language Understanding (CLU)**: NLP service for intent recognition 💡

## Getting Started 🚀

### Prerequisites 📋

* Node.js (v12 or higher)
* MySQL database 🛢️
* Bot Framework Emulator (for local testing) ⚙️
* Azure account (for deployment) ☁️

### Installation 💻

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/flight-booking-bot.git
   cd flight-booking-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   * Create a `.env` file in the project root
   * Add the following variables:

     ```env
     PORT=3978
     MYSQL_HOST=localhost
     MYSQL_USER=root
     MYSQL_PASSWORD=yourpassword
     MYSQL_DATABASE=flights_db
     CLU_PROJECT_NAME=flychatbot
     CLU_DEPLOYMENT_NAME=depv1
     CLU_API_KEY=yourapikey
     CLU_API_ENDPOINT=yourCluEndpoint
     AZURE_APP_ID=your-app-id
     AZURE_APP_PASSWORD=your-app-password
     AMADEUS_CLIENT_ID=yourClientId
     AMADEUS_CLIENT_SECRET=yourSecretkey
     ```

4. **Start the bot** 🏁

   ```bash
   npm start
   ```

5. **Connect with Bot Framework Emulator** 🔗

   * Open Bot Framework Emulator
   * Connect to `http://localhost:3978/api/messages`

## Configuration 🔧

Update settings in `config/default.json` to adjust API endpoints, timeouts, and other parameters.

## Usage Examples 📝

### Searching for Flights ✈️

```text
User: I need a flight from New Delhi to London on August 15, 2025.
Bot: Searching for flights...
```

### Sample Search Flow 🗨️

```text
User: I need to find a flight from Delhi to Mumbai
Bot: Where would you like to fly from?
User: Delhi
Bot: Where would you like to fly to?
User: Mumbai
Bot: When would you like to travel? (e.g.: "2025-07-15")
User: 2025-07-15
Bot: Here are the available flights:

1. Air India - Flight AI123
   10:00 AM → 12:30 PM
   Duration: 2h 30m
   Price: $150

2. IndiGo - Flight 6E456
   11:30 AM → 1:45 PM
   Duration: 2h 15m
   Price: $125

[Options displayed: Search Another Flight, Book a Flight, Compare Prices]
```

### Comparing Flight Options 🔀

```text
User: I want to compare flights
Bot: Where would you like to fly from?
User: New York
Bot: Where would you like to fly to?
User: London
Bot: When would you like to depart? (e.g.: "2025-07-15")
User: 2025-07-15
Bot: When would you like to return? (Leave empty for one-way flight)
User: 2025-07-22

Bot: Here are the available flights:

Best Price Options:
1. British Airways BA178 - $450 - 7:30 PM → 7:45 AM (7h 15m)
2. Virgin Atlantic VS26 - $475 - 8:00 PM → 8:30 AM (7h 30m)
3. American Airlines AA100 - $490 - 6:00 PM → 6:30 AM (7h 30m)

Fastest Options:
1. British Airways BA112 - 7h 00m - 9:00 AM → 9:00 PM ($550)
2. Delta DL2 - 7h 05m - 10:30 AM → 10:35 PM ($525)
3. United UA90 - 7h 10m - 11:00 AM → 11:10 PM ($510)

[Interactive flight cards displayed with "Select Flight" buttons]

Bot: Please enter the flight number you want to book:
User: BA178
Bot: You've selected British Airways flight BA178 for $450.
```

### Booking a Flight 🛫

```text
User: I want to book a flight
Bot: From which city would you like to fly?
User: San Francisco
Bot: To which city would you like to fly?
User: Tokyo
Bot: When would you like to depart? (e.g.: "2025-07-15")
User: 2025-07-15
Bot: When would you like to return? (Leave empty for one-way flight)
User: 2025-07-30
Bot: How many travelers?
User: 2
Bot: Which class would you prefer? (Economy, Business, First)
User: Business

Bot: Please confirm your flight details:
- From: San Francisco
- To: Tokyo
- Departure: 2025-07-15
- Return: 2025-07-30
- Travelers: 2
- Class: Business

Is this correct? (yes/no)
User: yes

Bot: Great! Searching for flights...
[Flight options displayed]

User: [Selects a flight]
Bot: Please enter passenger name:
User: John Smith
Bot: Please enter passenger email for confirmation:
User: john.smith@example.com
Bot: Please select a payment method:
[Options: Credit Card, PayPal, Apple Pay]
User: Credit Card

Bot: Please confirm your booking details:
Flight: Japan Airlines JL1
From: San Francisco to Tokyo
Departure: 11:00 AM
Passenger: John Smith
Email: john.smith@example.com
Payment Method: Credit Card
Total Price: $2,450

Would you like to confirm this booking?
User: Yes

Bot: Your booking is confirmed! Booking reference: BK7392
[Itinerary details displayed]
A confirmation email has been sent to john.smith@example.com.
Thank you for booking with our flight service! We hope you have a pleasant journey.
```

## Project Structure 📁 📁 📁

```
flight-booking-bot/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── services/
│   ├── dialogs/
│   └── index.js
├── config/
│   └── default.json
├── .env
├── package.json
└── README.md
```

## Resources 📚

* [Bot Framework SDK](https://aka.ms/botframework)
* [Node.js Documentation](https://nodejs.org/docs/)
* [Express Documentation](https://expressjs.com/)
* [MySQL Documentation](https://dev.mysql.com/doc/)
* [CLU Documentation](https://docs.microsoft.com/azure/cognitive-services/language-service/)

## License 📝

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

* Microsoft Bot Framework team for the SDK and documentation
* Flight data providers for API access
