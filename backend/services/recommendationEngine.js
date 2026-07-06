/**
 * Calculates a matching score between a hostel property and student preferences.
 * Match Score (Max 100) = Distance Score (Max 40) + Price Fit (Max 30) + Amenities Fit (Max 20) + Trust Contribution (Max 10)
 * 
 * @param {object} hostel Hostel record from DB
 * @param {number} preferredBudget Maximum budget preference
 * @param {number} distance Calculated distance from campus in km
 * @param {string[]} preferredAmenities List of desired amenities
 * @returns {number} Score from 0 to 100
 */
const calculateMatchScore = (hostel, preferredBudget, distance, preferredAmenities = []) => {
    let score = 0;

    // 1. Distance Score (Max 40)
    if (distance <= 2) {
        score += 40;
    } else if (distance <= 5) {
        score += 25;
    } else if (distance <= 10) {
        score += 10;
    }

    // 2. Price Fit (Max 30)
    const price = parseFloat(hostel.starting_price) || 0;
    if (preferredBudget && price > 0) {
        if (price <= preferredBudget) {
            score += 30; // Within budget
        } else if (price <= preferredBudget * 1.2) {
            score += 15; // Slightly over budget (up to 20%)
        } else if (price <= preferredBudget * 1.5) {
            score += 5;  // Moderately over budget (up to 50%)
        }
    } else {
        score += 20; // Default price contribution if budget unspecified
    }

    // 3. Amenities Fit (Max 20)
    const hostelAmenities = Array.isArray(hostel.amenities) 
        ? hostel.amenities 
        : (typeof hostel.amenities === 'string' ? JSON.parse(hostel.amenities) : []);

    if (preferredAmenities.length > 0 && hostelAmenities.length > 0) {
        const matchingAmenities = preferredAmenities.filter(amenity => 
            hostelAmenities.some(ha => ha.toLowerCase() === amenity.toLowerCase())
        );
        const matchPercentage = matchingAmenities.length / preferredAmenities.length;
        score += Math.round(matchPercentage * 20);
    } else {
        score += 10; // Default base contribution if no preference list
    }

    // 4. Trust Contribution (Max 10)
    const trustScore = parseFloat(hostel.trust_score) || 50.00;
    score += Math.round((trustScore / 100) * 10);

    return Math.min(100, Math.max(0, score));
};

module.exports = { calculateMatchScore };
