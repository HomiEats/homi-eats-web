import isEmpty from 'lodash/isEmpty';

/**
 * Transform cart and listings data into a structured format
 * @param {Object} cart - The cart object with authorId -> deliveryMethod -> listingId structure
 * @param {Array} listings - Array of listing objects
 * @returns {Array} Array of objects with authorId, deliveryMethod, and listing data
 */
export const transformCartList = (cart, listings, lineItemsMap) => {
  try {
    if (!cart || !listings || !Array.isArray(listings) || isEmpty(lineItemsMap)) {
      return [];
    }

    // Create a map of listings by ID for quick lookup
    const listingsMap = listings.reduce((acc, listing) => {
      acc[listing.id.uuid] = listing;
      return acc;
    }, {});

    const result = [];

    // Iterate through each author in the cart
    Object.entries(cart).forEach(([authorId, authorData]) => {
      const { pickup, shipping } = authorData;
      const storeName = listings.find(l => l.author.id.uuid === authorId)?.author?.attributes
        ?.profile?.displayName;
      // Process pickup listings
      if (pickup && Object.keys(pickup.listings).length > 0) {
        const pickupListings = Object.entries(pickup.listings)
          .map(([listingId, cartData]) => {
            const listing = listingsMap[listingId];
            return listing ? { ...listing, quantity: cartData.quantity } : null;
          })
          .filter(Boolean); // Remove null entries

        if (pickupListings.length > 0) {
          const key = `${authorId}_pickup`;
          const lineItems = lineItemsMap[key];
          result.push({
            authorId,
            storeName,
            deliveryMethod: 'pickup',
            listings: pickupListings,
            lineItems,
            ...(pickup.deliveryDetails ? { deliveryDetails: pickup.deliveryDetails } : {}),
          });
        }
      }

      // Process shipping listings
      if (shipping && Object.keys(shipping.listings).length > 0) {
        const shippingListings = Object.entries(shipping.listings)
          .map(([listingId, cartData]) => {
            const listing = listingsMap[listingId];
            return listing ? { ...listing, quantity: cartData.quantity } : null;
          })
          .filter(Boolean); // Remove null entries

        if (shippingListings.length > 0) {
          const lineItems = lineItemsMap[`${authorId}_shipping`];
          result.push({
            authorId,
            storeName,
            deliveryMethod: 'shipping',
            listings: shippingListings,
            lineItems,
            ...(shipping.deliveryDetails ? { deliveryDetails: shipping.deliveryDetails } : {}),
          });
        }
      }
    });
    return result;
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * Get provider address with a format
 * @param {Object} location - The location object includes address of provider
 * @returns {String} Provider address
 */
export const getProviderAddress = location => {
  const { address, building } = location || {};
  if (!address && !building) return null;
  if (!address) return building;
  if (!building) return address;
  return `${building} - ${address}`;
};
