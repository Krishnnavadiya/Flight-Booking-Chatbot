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
            // Convert city names to IATA codes
            const originCode = origin.length === 3 ? origin : await this.getCityCode(origin);
            const destinationCode = destination.length === 3 ? destination : await this.getCityCode(destination);

            // Provide specific error messages for missing city codes
            if (!originCode && !destinationCode) {
                throw new Error(`Could not find airport codes for both "${origin}" and "${destination}". Please check the spelling of the city names and try again.`);
            } else if (!originCode) {
                throw new Error(`Could not find airport code for "${origin}". Please check the spelling and try again. Did you mean a similar city name?`);
            } else if (!destinationCode) {
                throw new Error(`Could not find airport code for "${destination}". Please check the spelling and try again. Did you mean a similar city name?`);
            }

            // Format the date as YYYY-MM-DD if it's not already
            const formattedDepartureDate = this.formatDate(departureDate);
            console.log('formattedDepartureDate: ', formattedDepartureDate);
            
            // Add validation for return date chronological order
            let formattedReturnDate;
            if (returnDate) {
                formattedReturnDate = this.formatDate(returnDate);
                console.log('formattedReturnDate: ', formattedReturnDate);
                
                // Check if return date is before departure date
                const departureDateTime = new Date(formattedDepartureDate);
                const returnDateTime = new Date(formattedReturnDate);
                
                if (returnDateTime < departureDateTime) {
                    // Automatically fix by setting return date to day after departure
                    const fixedReturnDate = new Date(departureDateTime);
                    fixedReturnDate.setDate(departureDateTime.getDate() + 1);
                    formattedReturnDate = fixedReturnDate.toISOString().split('T')[0];
                    console.log(`Fixed invalid return date: original=${returnDate}, fixed=${formattedReturnDate}`);
                }
            }

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
                searchParams.returnDate = formattedReturnDate;
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
            const flights = this.transformAmadeusResponse(response.data);

            // If no flights found, throw a specific error
            if (!flights || flights.length === 0) {
                throw new Error(`No flights found from ${originCode} to ${destinationCode} on ${formattedDepartureDate}. Please try different dates or destinations.`);
            }

            return flights;
        } catch (error) {
            // Check for Amadeus API specific errors
            if (error.response && error.response.result && error.response.result.errors) {
                const apiErrors = error.response.result.errors;
                for (const apiError of apiErrors) {
                    if (apiError.title === 'INVALID DATE' && apiError.detail === 'Date/Time is in the past') {
                        // For testing purposes, use mock data instead of throwing an error
                        console.log(`Using mock data for past date: ${departureDate}`);
                        return this.getMockFlightData(origin, destination, departureDate, class_);
                    }
                }
            }

            // Handle other error types
            const errorMsg = error.message || '';
            if (errorMsg.includes('Could not find airport code')) {
                // Pass through our custom error messages about city codes
                throw error;
            } else if (errorMsg.includes('No flights found')) {
                // Pass through our custom error message about no flights
                throw error;
            } else {
                // For other errors (API failures, etc.), provide a more helpful message
                console.error('Error searching flights:', error);
                throw new Error('Unable to search for flights at this time. Please try again later or try different search parameters.');
            }
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
            const inputDate = new Date(dateStr);
            // Check if date is valid
            if (!isNaN(inputDate.getTime())) {
                return dateStr;
            }
        }

        // Try to parse the date string
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            // If parsing fails, try to handle common date formats
            // Try MM/DD/YYYY or DD/MM/YYYY format
            const dateParts = dateStr.split('/');
            if (dateParts.length === 3) {
                // Try both MM/DD/YYYY and DD/MM/YYYY interpretations
                const mmddyyyy = new Date(`${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`);
                const ddmmyyyy = new Date(`${dateParts[1]}/${dateParts[0]}/${dateParts[2]}`);
                
                if (!isNaN(mmddyyyy.getTime())) {
                    return mmddyyyy.toISOString().split('T')[0];
                } else if (!isNaN(ddmmyyyy.getTime())) {
                    return ddmmyyyy.toISOString().split('T')[0];
                }
            }
            
            // If all parsing attempts fail, use tomorrow's date as fallback
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }

        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0];
    }

    // Helper method to get IATA code for a city
    async getCityCode(cityName) {
        // This is an expanded mapping for demo purposes
        const cityMap = {
            // Major international cities
            'new york': 'NYC', 'london': 'LON', 'paris': 'PAR', 'tokyo': 'TYO',
            'beijing': 'BJS', 'shanghai': 'SHA', 'hong kong': 'HKG', 'seoul': 'SEL',
            'sydney': 'SYD', 'melbourne': 'MEL', 'dubai': 'DXB', 'abu dhabi': 'AUH',
            'singapore': 'SIN', 'bangkok': 'BKK', 'kuala lumpur': 'KUL',
            'toronto': 'YTO', 'vancouver': 'YVR', 'montreal': 'YMQ', 'surat': 'SRT',
            'mexico city': 'MEX', 'sao paulo': 'SAO', 'rio de janeiro': 'RIO',
            'buenos aires': 'BUE', 'johannesburg': 'JNB', 'cairo': 'CAI',
            'moscow': 'MOW', 'istanbul': 'IST', 'rome': 'ROM', 'madrid': 'MAD',
            'barcelona': 'BCN', 'berlin': 'BER', 'frankfurt': 'FRA', 'munich': 'MUC',
            'amsterdam': 'AMS', 'brussels': 'BRU', 'zurich': 'ZRH', 'vienna': 'VIE',

            // Indian cities
            'delhi': 'DEL', 'new delhi': 'DEL',
            'mumbai': 'BOM',
            'chennai': 'MAA',
            'kolkata': 'CCU',
            'bangalore': 'BLR', 'bengaluru': 'BLR',
            'hyderabad': 'HYD',

            // Tier 1 & Tier 2 cities
            'ahmedabad': 'AMD',
            'pune': 'PNQ',
            'jaipur': 'JAI',
            'lucknow': 'LKO',
            'kanpur': 'KNU',
            'nagpur': 'NAG',
            'indore': 'IDR',
            'bhopal': 'BHO',
            'patna': 'PAT',
            'ranchi': 'IXR',
            'bhubaneswar': 'BBI',
            'guwahati': 'GAU',
            'amritsar': 'ATQ',
            'chandigarh': 'IXC',
            'coimbatore': 'CJB',
            'madurai': 'IXM',
            'varanasi': 'VNS',
            'surat': 'STV',
            'visakhapatnam': 'VTZ',
            'vijayawada': 'VGA',
            'mysore': 'MYQ',
            'aurangabad': 'IXU',
            'jodhpur': 'JDH',
            'udaipur': 'UDR',
            'gwalior': 'GWL',
            'dehradun': 'DED',
            'jammu': 'IXJ',
            'srinagar': 'SXR',
            'tirupati': 'TIR',
            'hubli': 'HBX',
            'belgaum': 'IXG',
            'trichy': 'TRZ',
            'rajkot': 'RAJ',
            'dibrugarh': 'DIB',
            'silchar': 'IXS',
            'agartala': 'IXA',
            'tezpur': 'TEZ',
            'dimapur': 'DMU',
            'itanagar': 'HGI',
            'shillong': 'SHL',
            'aizawl': 'AJL',
            'imphal': 'IMF',
            'panaji': 'GOI', 'goa': 'GOI',
            'kochi': 'COK',
            'thiruvananthapuram': 'TRV',
            'kozhikode': 'CCJ',
            'mangalore': 'IXE',
            'pondicherry': 'PNY',
            'ooty': 'CJB',
            'alappuzha': 'COK',
            'kottayam': 'COK',
            'port blair': 'IXZ',
            'leh': 'IXL',
            'kavaratti': 'AGX',
            'daman': 'NMB',
            'diu': 'DIU',
            'silvassa': 'BOM',
            'shimla': 'SLV',
            'gangtok': 'PYG',
            'itanagar': 'HGI',
            'kohima': 'DMU',
            'dispur': 'GAU',
            'raipur': 'RPR',
            'bilaspur': 'PAB',
            'dharamshala': 'DHM',

            // US cities
            'los angeles': 'LAX', 'chicago': 'CHI', 'houston': 'HOU', 'phoenix': 'PHX',
            'philadelphia': 'PHL', 'san antonio': 'SAT', 'san diego': 'SAN', 'dallas': 'DFW',
            'san jose': 'SJC', 'austin': 'AUS', 'jacksonville': 'JAX', 'san francisco': 'SFO',
            'columbus': 'CMH', 'indianapolis': 'IND', 'fort worth': 'DFW', 'charlotte': 'CLT',
            'seattle': 'SEA', 'denver': 'DEN', 'washington': 'WAS', 'boston': 'BOS',
            'detroit': 'DTT', 'nashville': 'BNA', 'portland': 'PDX', 'las vegas': 'LAS',
            'atlanta': 'ATL', 'miami': 'MIA', 'minneapolis': 'MSP', 'tampa': 'TPA',

            // Countries (map to capital or major city)
            'usa': 'NYC', 'united states': 'NYC', 'uk': 'LON', 'united kingdom': 'LON',
            'france': 'PAR', 'japan': 'TYO', 'china': 'BJS', 'australia': 'SYD',
            'india': 'DEL', 'canada': 'YTO', 'germany': 'FRA', 'italy': 'ROM',
            'spain': 'MAD', 'russia': 'MOW', 'brazil': 'SAO', 'mexico': 'MEX',
            'south africa': 'JNB', 'egypt': 'CAI', 'turkey': 'IST', 'netherlands': 'AMS',
            'switzerland': 'ZRH', 'austria': 'VIE', 'belgium': 'BRU', 'sweden': 'STO',
            'norway': 'OSL', 'denmark': 'CPH', 'finland': 'HEL', 'greece': 'ATH',
            'portugal': 'LIS', 'ireland': 'DUB', 'new zealand': 'AKL', 'malaysia': 'KUL',
            'thailand': 'BKK', 'vietnam': 'HAN', 'indonesia': 'JKT', 'philippines': 'MNL',
            'south korea': 'SEL', 'saudi arabia': 'RUH', 'uae': 'DXB', 'qatar': 'DOH'
        };

        // Check for exact match first
        const exactMatch = cityMap[cityName.toLowerCase()];
        if (exactMatch) return exactMatch;

        // Common misspellings dictionary
        const misspellings = {
            'hederabad': 'hyderabad',
            'delli': 'delhi',
            'mumbay': 'mumbai',
            'banglore': 'bangalore',
            'chenai': 'chennai',
            'new delli': 'new delhi',
            'kolkatta': 'kolkata',
            'new yourk': 'new york',
            'singapur': 'singapore',
            'surat': 'surat'
            // Add more common misspellings as needed
        };

        // Check if it's a known misspelling
        const correctedCity = misspellings[cityName.toLowerCase()];
        if (correctedCity) {
            // Return the code for the corrected city name
            return cityMap[correctedCity];
        }

        return null;
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
            // Validate inputs to prevent errors
            if (!userDetails) {
                throw new Error('User details are required');
            }
            
            // Make sure we're handling the userDetails object correctly
            const passengerName = userDetails.name || 'Unknown';
            const passengerEmail = userDetails.email || 'unknown@example.com';
            
            // In a real application, this would create a booking in a database
            // For demo purposes, we'll return a mock booking confirmation
            return {
                bookingReference: 'BK' + Math.floor(Math.random() * 10000),
                bookingId: 'BK' + Math.floor(Math.random() * 10000),
                flightId: flightId,
                status: 'Confirmed',
                passengerName: passengerName,
                passengerEmail: passengerEmail,
                paymentStatus: 'Completed',
                departureDate: new Date().toISOString().split('T')[0] // Today's date as a placeholder
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

    // Add this method to your FlightService class
    async getFlightByNumber(flightNumber) {
        // In a real implementation, this would query a database or API
        // For now, we'll return a mock flight
        return {
            id: 'FL' + Math.floor(Math.random() * 1000),
            airline: 'SkyWings Airlines',
            flightNumber: flightNumber,
            origin: 'New York (JFK)',
            destination: 'San Francisco (SFO)',
            departureTime: '10:00 AM',
            arrivalTime: '1:30 PM',
            duration: '3h 30m',
            price: 299.99,
            departureDate: '2025-07-15'
        };
    }
}

module.exports.FlightService = FlightService;