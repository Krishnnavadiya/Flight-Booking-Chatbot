class FlightDetails {
    constructor(origin, destination, departureDate, returnDate, travelers, class_) {
        this.origin = origin;
        this.destination = destination;
        this.departureDate = departureDate;
        this.returnDate = returnDate;
        this.travelers = travelers;
        this.class = class_;
    }
}

module.exports.FlightDetails = FlightDetails;