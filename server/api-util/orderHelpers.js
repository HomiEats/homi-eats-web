const { denormalisedResponseEntities } = require('./format');
const { fetchCommission } = require('./sdk');

/**
 * Extracts all listing IDs from the order data structure
 * @param {Object} orderedProducts - The order data containing orderedProducts
 * @returns {Array<string>} Array of listing IDs
 */
const retrieveListingIdsOrderedProducts = orderedProducts => {
  if (!orderedProducts) {
    return [];
  }

  try {
    // Helper function to extract listing IDs from a single delivery products object
    const extractListingIds = deliveryProducts => Object.keys(deliveryProducts).filter(Boolean);

    // Flatten the nested structure using modern array methods
    const listingIds = Object.values(orderedProducts).flatMap(authorProducts =>
      Object.values(authorProducts).flatMap(deliveryProducts => extractListingIds(deliveryProducts))
    );

    // Remove duplicates while preserving order
    return [...new Set(listingIds)];
  } catch (error) {
    console.error('Error extracting listing IDs:', error);
    return [];
  }
};

const fetchListingsAndCommission = async (sdk, orderData, bodyParams, isOwnListing) => {
  const showSdk = isOwnListing ? sdk.ownListings.show : sdk.listings.show;
  const listingPromises = () => {
    if (orderData.orderedProducts) {
      return Promise.all(
        Object.keys(orderData.orderedProducts?.listings).map(listingId =>
          showSdk({ id: listingId })
        )
      );
    }
    return Promise.all([showSdk({ id: bodyParams?.params?.listingId })]);
  };

  let listings = [];

  // Fetch listings and commission data
  const [showListingResponses, fetchAssetsResponse] = await Promise.all([
    listingPromises(),
    fetchCommission(sdk),
  ]);

  listings = showListingResponses.map(response => denormalisedResponseEntities(response)[0]);
  const commissionAsset = fetchAssetsResponse.data.data[0];
  return { listings, commissionAsset };
};

module.exports = {
  retrieveListingIdsOrderedProducts,
  fetchListingsAndCommission,
};
