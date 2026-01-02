const locationBaseApi = require('./locationBaseApi');

const handleLocationError = response => {
  if (['InvalidInput', 'NoRoute'].includes(response.data.code)) {
    console.log('Error in calculateDistance');
    const message = response.data.message;
    const error = new Error(message);
    error.status = response.status;
    error.statusText = message;
    error.message = message;
    error.data = {
      error: message,
    };
    throw error;
  }
};

const calculateDistance = async (origin, destination) => {
  try {
    const response = await locationBaseApi.get(
      `/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
    );

    handleLocationError(response);
    const distanceInMeters = response?.data?.routes[0]?.distance;
    const distanceInKm = Math.round(distanceInMeters / 1000); // Convert meters to kilometers and round to nearest integer

    return distanceInKm;
  } catch (error) {
    handleLocationError(error.response);
  }
};

module.exports = { calculateDistance };
