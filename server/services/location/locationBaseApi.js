const axios = require('axios');

const baseUrl = `https://api.mapbox.com`;

const MAPBOX_API_KEY = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const locationBaseApi = axios.create({
  baseURL: baseUrl,
  params: {
    access_token: MAPBOX_API_KEY,
  },
});

module.exports = locationBaseApi;
