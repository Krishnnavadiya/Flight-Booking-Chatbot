const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

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
    }

    async searchFlights(origin, destination, departureDate, returnDate, travelers, class_) {
        try {
            // In a real application, this would query a database or external API
            // For demo purposes, we'll return mock data
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
        } catch (error) {
            console.error('Error searching flights:', error);
            throw error;
        }
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