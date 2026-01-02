import { isEmpty } from 'lodash';

const updateListingQuantity = (cart, authorId, listingId, deliveryMethod, quantity) => {
  return {
    ...cart,
    [authorId]: {
      ...cart[authorId],
      [deliveryMethod]: {
        ...cart[authorId][deliveryMethod],
        listings: {
          ...cart[authorId][deliveryMethod].listings,
          [listingId]: { quantity },
        },
      },
    },
  };
};

/**
 * Removes a listing from the cart
 * @param {Object} cart - The current cart object
 * @param {string} authorId - The author/seller ID
 * @param {string} listingId - The listing ID
 * @param {string} deliveryMethod - The delivery method
 * @returns {Object} The updated cart object
 */
const removeListing = (cart, authorId, listingId, deliveryMethod) => {
  const newListings = { ...cart[authorId][deliveryMethod].listings };
  delete newListings[listingId];
  return {
    ...cart,
    [authorId]: {
      ...cart[authorId],
      [deliveryMethod]: {
        ...cart[authorId][deliveryMethod],
        listings: newListings,
      },
    },
  };
};

/**
 * Updates cart data by adding or updating a listing with specified delivery method and quantity
 * @param {Object} cart - The current cart object
 * @param {string} authorId - The author/seller ID
 * @param {string} listingId - The listing ID
 * @param {string} deliveryMethod - The delivery method
 * @param {number} quantity - The quantity to set
 * @param {Object} deliveryDetails - The delivery data
 * @returns {Object} The updated cart object, or undefined if validation fails
 */
export const updateCartData = (
  cart,
  authorId,
  listingId,
  deliveryMethod,
  quantity,
  deliveryDetails
) => {
  try {
    // Validate required parameters
    if (!isValidCartUpdate(cart, authorId, listingId, deliveryMethod, quantity)) {
      return undefined;
    }

    let newCart = { ...cart };

    // Ensure the cart structure exists
    newCart = ensureCartStructure(newCart, authorId, deliveryMethod, listingId);
    // Update the listing quantity
    if (quantity > 0) {
      if (!isEmpty(deliveryDetails)) {
        newCart[authorId][deliveryMethod].deliveryDetails = deliveryDetails;
      }

      newCart = updateListingQuantity(newCart, authorId, listingId, deliveryMethod, quantity);
    } else {
      newCart = removeListing(newCart, authorId, listingId, deliveryMethod);
    }
    // Clean up empty structures
    newCart = cleanupEmptyStructures(newCart, authorId);
    return newCart;
  } catch (error) {
    console.error('Error updating cart:', error);
    throw error;
  }
};

/**
 * Validates that all required parameters are present and valid
 */
const isValidCartUpdate = (cart, authorId, listingId, deliveryMethod, quantity) => {
  return cart && authorId && listingId && deliveryMethod && typeof quantity === 'number';
};

/**
 * Ensures the nested cart structure exists for the given path
 */
const ensureCartStructure = (cart, authorId, deliveryMethod, listingId) => {
  if (!cart[authorId]) {
    cart = { ...cart, [authorId]: {} };
  }

  if (!cart[authorId][deliveryMethod]) {
    cart = { ...cart, [authorId]: { ...cart[authorId], [deliveryMethod]: {} } };
  }

  if (!cart[authorId][deliveryMethod].listings) {
    cart = {
      ...cart,
      [authorId]: {
        ...cart[authorId],
        [deliveryMethod]: { ...cart[authorId][deliveryMethod], listings: {} },
      },
    };
  }

  if (!cart[authorId][deliveryMethod].listings[listingId]) {
    cart = {
      ...cart,
      [authorId]: {
        ...cart[authorId],
        [deliveryMethod]: {
          ...cart[authorId][deliveryMethod],
          listings: { ...cart[authorId][deliveryMethod].listings, [listingId]: {} },
        },
      },
    };
  }
  return cart;
};

/**
 * Removes the listing from other delivery methods to avoid duplicates
 */
const removeListingFromOtherDeliveryMethods = (
  cart,
  authorId,
  listingId,
  currentDeliveryMethod
) => {
  const authorCart = cart[authorId];

  Object.keys(authorCart).forEach(deliveryMethod => {
    if (
      deliveryMethod !== currentDeliveryMethod &&
      authorCart[deliveryMethod].listings[listingId]
    ) {
      delete authorCart[deliveryMethod].listings[listingId];
    }
  });
  return cart;
};

/**
 * Cleans up empty structures to maintain cart integrity
 */
const cleanupEmptyStructures = (cart, authorId) => {
  const authorCart = cart[authorId];
  // Clean up empty delivery methods
  Object.keys(authorCart).forEach(deliveryMethod => {
    if (Object.keys(authorCart[deliveryMethod].listings).length === 0) {
      delete authorCart[deliveryMethod];
    }
  });

  // Clean up empty authors
  if (Object.keys(authorCart).length === 0) {
    delete cart[authorId];
  }

  // Note: The original code had a check for empty carts, but this would always be false
  // since we're adding at least one item. Removed for clarity.
  return cart;
};

export const isListingInCart = (cart, listingId, authorId) => {
  const authorCart = cart?.[authorId];
  if (!authorCart) {
    return false;
  }

  const deliveryMethods = Object.keys(authorCart);
  for (const deliveryMethod of deliveryMethods) {
    if (authorCart[deliveryMethod].listings[listingId]) {
      return true;
    }
  }
};

export const retrieveListingIdsOrderedProducts = orderedProducts => {
  if (!orderedProducts) {
    return [];
  }

  const { listings } = orderedProducts;
  return Object.keys(listings);
};

export const getCartCount = (cart = {}) => {
  if (!cart) {
    return 0;
  }

  return Object.keys(cart).reduce((acc, authorId) => {
    return (
      acc +
      Object.keys(cart[authorId]).reduce((acc, deliveryMethod) => {
        return acc + Object.keys(cart[authorId][deliveryMethod].listings).length;
      }, 0)
    );
  }, 0);
};
