const locationBaseApi = require('./locationBaseApi');

const get = async origin => {
  const placeUrl = `/geocoding/v5/mapbox.places/${origin.lng},${origin.lat}.json`;

  const placeResponse = await locationBaseApi.get(placeUrl);
  return placeResponse.data;
};

module.exports = { get };
