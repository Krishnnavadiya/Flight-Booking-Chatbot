const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const Amadeus = require('amadeus');

dotenv.config();

class FlightService {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Initialize Amadeus client
        this.amadeus = new Amadeus({
            clientId: process.env.AMADEUS_CLIENT_ID,
            clientSecret: process.env.AMADEUS_CLIENT_SECRET
        });
    }

    async searchFlights(origin, destination, departureDate, returnDate, travelers = 1, class_ = 'ECONOMY') {
        try {
            // Convert city names to IATA codes (in a real app, you'd use the Amadeus Airport & City Search API)
            // For simplicity, we'll assume the user inputs IATA codes directly
            const originCode = origin.length === 3 ? origin : await this.getCityCode(origin);
            const destinationCode = destination.length === 3 ? destination : await this.getCityCode(destination);
            
            if (!originCode || !destinationCode) {
                throw new Error('Could not determine airport codes for the specified cities');
            }

            // Format the date as YYYY-MM-DD if it's not already
            const formattedDepartureDate = this.formatDate(departureDate);
            
            // Prepare the search parameters
            const searchParams = {
                originLocationCode: originCode,
                destinationLocationCode: destinationCode,
                departureDate: formattedDepartureDate,
                adults: parseInt(travelers) || 1,
                currencyCode: 'USD',
                max: 10 // Limit results to 10 flights
            };
            
            // Add return date if provided (for round trip)
            if (returnDate) {
                searchParams.returnDate = this.formatDate(returnDate);
            }
            
            // Add cabin class if provided
            if (class_) {
                // Map user-friendly class names to Amadeus format
                const classMap = {
                    'economy': 'ECONOMY',
                    'business': 'BUSINESS',
                    'first': 'FIRST'
                };
                searchParams.travelClass = classMap[class_.toLowerCase()] || 'ECONOMY';
            }
            
            // Call Amadeus API to search for flights
            const response = await this.amadeus.shopping.flightOffersSearch.get(searchParams);
            
            // Transform the Amadeus response to our application's format
            return this.transformAmadeusResponse(response.data);
        } catch (error) {
            console.error('Error searching flights:', error);
            
            // If API call fails, fall back to mock data for demo purposes
            console.log('Falling back to mock data');
            return this.getMockFlightData(origin, destination, departureDate, class_);
        }
    }

    // Helper method to transform Amadeus API response to our application's format
    transformAmadeusResponse(flightOffers) {
        if (!flightOffers || flightOffers.length === 0) {
            return [];
        }

        return flightOffers.map((offer, index) => {
            const flight = offer.itineraries[0];
            const firstSegment = flight.segments[0];
            const lastSegment = flight.segments[flight.segments.length - 1];
            
            // Calculate total duration in minutes
            const durationStr = flight.duration.replace('PT', '');
            let hours = 0;
            let minutes = 0;
            
            if (durationStr.includes('H')) {
                const hoursPart = durationStr.split('H')[0];
                hours = parseInt(hoursPart, 10);
                if (durationStr.includes('M')) {
                    const minutesPart = durationStr.split('H')[1].replace('M', '');
                    minutes = parseInt(minutesPart, 10);
                }
            } else if (durationStr.includes('M')) {
                const minutesPart = durationStr.replace('M', '');
                minutes = parseInt(minutesPart, 10);
            }
            
            const formattedDuration = `${hours}h ${minutes}m`;
            
            // Format departure and arrival times
            const departureDateTime = new Date(firstSegment.departure.at);
            const arrivalDateTime = new Date(lastSegment.arrival.at);
            
            const departureTime = departureDateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const arrivalTime = arrivalDateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            // Get airline code and flight number
            const airline = firstSegment.carrierCode;
            const flightNumber = `${airline}${firstSegment.number}`;
            
            // Get price
            const price = parseFloat(offer.price.total);
            
            return {
                id: offer.id,
                airline: airline,
                flightNumber: flightNumber,
                origin: firstSegment.departure.iataCode,
                destination: lastSegment.arrival.iataCode,
                departureDate: departureDateTime.toISOString().split('T')[0],
                departureTime: departureTime,
                arrivalTime: arrivalTime,
                duration: formattedDuration,
                price: price,
                class: offer.travelerPricings[0].fareDetailsBySegment[0].cabin,
                availableSeats: 9 // Amadeus doesn't always provide this, so we use a default
            };
        });
    }

    // Helper method to format date strings
    formatDate(dateStr) {
        // If it's already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        
        // Try to parse the date string
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            // If parsing fails, return today's date as fallback
            const today = new Date();
            return today.toISOString().split('T')[0];
        }
        
        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0];
    }

    // Helper method to get IATA code for a city
    // In a real app, you would use the Amadeus Airport & City Search API
    async getCityCode(cityName) {
        // This is a simplified mapping for demo purposes
        const cityMap = {
            'new york': 'NYC',
            'london': 'LON',
            'paris': 'PAR',
            'tokyo': 'TYO',
            'delhi': 'DEL',
            'mumbai': 'BOM',
            'bangalore': 'BLR',
            'chennai': 'MAA',
            'hyderabad': 'HYD',
            'kolkata': 'CCU',
            'dubai': 'DXB',
            'singapore': 'SIN',
            'sydney': 'SYD'
        };
        
        return cityMap[cityName.toLowerCase()] || null;
    }

    // Fallback mock data method
    getMockFlightData(origin, destination, departureDate, class_) {
        return [
            {
                id: '1',
                airline: 'AirIndia',
                flightNumber: 'AI101',
                origin: origin,
                destination: destination,
                departureDate: departureDate,
                departureTime: '10:00 AM',
                arrivalTime: '12:30 PM',
                duration: '2h 30m',
                price: 450,
                class: class_,
                availableSeats: 45
            },
            {
                id: '2',
                airline: 'IndiGo',
                flightNumber: 'IG202',
                origin: origin,
                destination: destination,
                departureDate: departureDate,
                departureTime: '2:15 PM',
                arrivalTime: '4:45 PM',
                duration: '2h 30m',
                price: 380,
                class: class_,
                availableSeats: 32
            },
            {
                id: '3',
                airline: 'SpiceJet',
                flightNumber: 'SJ303',
                origin: origin,
                destination: destination,
                departureDate: departureDate,
                departureTime: '7:30 PM',
                arrivalTime: '10:00 PM',
                duration: '2h 30m',
                price: 420,
                class: class_,
                availableSeats: 28
            }
        ];
    }

    async bookFlight(flightId, userDetails) {
        try {
            // In a real application, this would create a booking in a database
            // For demo purposes, we'll return a mock booking confirmation
            return {
                bookingId: 'BK' + Math.floor(Math.random() * 10000),
                flightId: flightId,
                status: 'Confirmed',
                passengerName: userDetails.name,
                passengerEmail: userDetails.email,
                paymentStatus: 'Completed'
            };
        } catch (error) {
            console.error('Error booking flight:', error);
            throw error;
        }
    }

    async getBookingDetails(bookingId) {
        try {
            // In a real application, this would fetch booking details from a database
            // For demo purposes, we'll return mock data
            return {
                bookingId: bookingId,
                flightDetails: {
                    airline: 'AirIndia',
                    flightNumber: 'AI101',
                    origin: 'New Delhi',
                    destination: 'Mumbai',
                    departureDate: '2023-12-15',
                    departureTime: '10:00 AM',
                    arrivalTime: '12:30 PM'
                },
                passengerDetails: {
                    name: 'John Doe',
                    email: 'john@example.com'
                },
                status: 'Confirmed'
            };
        } catch (error) {
            console.error('Error getting booking details:', error);
            throw error;
        }
    }
}

module.exports.FlightService = FlightService;