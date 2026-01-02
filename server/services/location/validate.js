const { calculateDistance } = require('./calculateDistance');
const { get } = require('./get');

/**
 * Validates if a Mapbox geocoding response contains all required address components
 * @param {Array} geocodingResponse - Array of Mapbox geocoding features
 * @returns {Object} - Validation result with isValid boolean and missing components array
 */
const validate = geocodingResponse => {
  if (!Array.isArray(geocodingResponse) || geocodingResponse.length === 0) {
    return {
      isValid: false,
      missingComponents: ['streetAddress', 'postalCode', 'city', 'countryCode'],
      error: 'Invalid or empty geocoding response',
    };
  }

  const missingComponents = [];
  const foundComponents = {
    streetAddress: null,
    postalCode: null,
    city: null,
    countryCode: null,
  };

  // Helper function to find feature by place_type
  const findFeatureByType = placeTypes => {
    return geocodingResponse.find(
      feature => feature.place_type && placeTypes.some(type => feature.place_type.includes(type))
    );
  };

  // Check for street address (address type)
  const addressFeature = findFeatureByType(['address']);

  if (addressFeature && addressFeature.text) {
    foundComponents.streetAddress = addressFeature.address
      ? `${addressFeature.address} ${addressFeature.text}`
      : addressFeature.text;
  } else {
    missingComponents.push('streetAddress');
  }

  // Check for postal code
  const postalCodeFeature = findFeatureByType(['postcode']);
  if (postalCodeFeature && postalCodeFeature.text) {
    foundComponents.postalCode = postalCodeFeature.text;
  } else {
    missingComponents.push('postalCode');
  }

  // Check for city (locality or place type)
  const cityFeature = findFeatureByType(['locality', 'place']);
  if (cityFeature && cityFeature.text) {
    foundComponents.city = cityFeature.text;
  } else {
    missingComponents.push('city');
  }

  // Check for state/region (region type or administrative area)
  const stateFeature = findFeatureByType(['region']);
  if (stateFeature && stateFeature.text) {
    foundComponents.state = stateFeature.text;
  } else {
    missingComponents.push('state');
  }

  // Check for country code
  const countryFeature = findFeatureByType(['country']);
  if (countryFeature && countryFeature.properties && countryFeature.properties.short_code) {
    foundComponents.countryCode = countryFeature.properties.short_code;
  } else {
    missingComponents.push('countryCode');
  }

  return {
    isValid: missingComponents.length === 0,
    missingComponents,
    foundComponents,
    error:
      missingComponents.length > 0
        ? `The address is missing some components: ${missingComponents.join(', ')}`
        : null,
  };
};

const getAndValidate = async origin => {
  const location = await get(origin);
  const validatedLocation = validate(location.features);
  if (!validatedLocation.isValid) {
    const error = new Error(validatedLocation.error);
    error.status = 400;
    error.statusText = validatedLocation.error;
    error.message = validatedLocation.error;
    throw error;
  }
  return { validatedLocation, location };
};

const validateServiceArea = async (from, to, serviceArea) => {
  const calculatedDistance = await calculateDistance(from, to);
  if (calculatedDistance > Number(serviceArea)) {
    const message = "This order is outside of the provider's service area";
    const error = new Error(message);
    error.status = 422;
    error.statusText = message;
    error.message = message;
    error.data = {
      error: message,
    };

    throw error;
  }
  return calculatedDistance ?? 0;
};

module.exports = {
  validate,
  getAndValidate,
  validateServiceArea,
};
