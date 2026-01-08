const {
  calculateQuantityFromDates,
  calculateQuantityFromHours,
  calculateShippingFee,
  getProviderCommissionMaybe,
  getCustomerCommissionMaybe,
} = require('./lineItemHelpers');
const { types } = require('sharetribe-flex-sdk');
const { Money } = types;

/**
 * Get quantity and add extra line-items that are related to delivery method
 *
 * @param {Object} orderData should contain stockReservationQuantity and deliveryMethod
 * @param {*} publicData should contain shipping prices
 * @param {*} currency should point to the currency of listing's price.
 */
const getItemQuantityAndLineItems = (orderData, publicData, currency) => {
  // Check delivery method and shipping prices
  const quantity = orderData ? orderData.stockReservationQuantity : null;
  const deliveryMethod = orderData && orderData.deliveryMethod;
  const isShipping = deliveryMethod === 'shipping';
  const { shippingPriceInSubunitsOneItem, shippingPriceInSubunitsAdditionalItems } =
    publicData || {};

  // Calculate shipping fee if applicable
  const shippingFee = isShipping
    ? calculateShippingFee(
        shippingPriceInSubunitsOneItem,
        shippingPriceInSubunitsAdditionalItems,
        currency,
        quantity
      )
    : null;

  return { quantity };
};

/**
 * Get quantity for fixed bookings with seats.
 * @param {Object} orderData
 * @param {number} [orderData.seats]
 */
const getFixedQuantityAndLineItems = orderData => {
  const { seats } = orderData || {};
  const hasSeats = !!seats;
  // If there are seats, the quantity is split to factors: units and seats.
  // E.g. 1 session x 2 seats (aka unit price is multiplied by 2)
  return hasSeats ? { units: 1, seats, extraLineItems: [] } : { quantity: 1, extraLineItems: [] };
};

/**
 * Get quantity for arbitrary units for time-based bookings.
 *
 * @param {Object} orderData
 * @param {string} orderData.bookingStart
 * @param {string} orderData.bookingEnd
 * @param {number} [orderData.seats]
 */
const getHourQuantityAndLineItems = orderData => {
  const { bookingStart, bookingEnd, seats } = orderData || {};
  const hasSeats = !!seats;
  const units =
    bookingStart && bookingEnd ? calculateQuantityFromHours(bookingStart, bookingEnd) : null;

  // If there are seats, the quantity is split to factors: units and seats.
  // E.g. 3 hours x 2 seats (aka unit price is multiplied by 6)
  return hasSeats ? { units, seats, extraLineItems: [] } : { quantity: units, extraLineItems: [] };
};

/**
 * Calculate quantity based on days or nights between given bookingDates.
 *
 * @param {Object} orderData
 * @param {string} orderData.bookingStart
 * @param {string} orderData.bookingEnd
 * @param {number} [orderData.seats]
 * @param {'line-item/day' | 'line-item/night'} code
 */
const getDateRangeQuantityAndLineItems = (orderData, code) => {
  const { bookingStart, bookingEnd, seats } = orderData;
  const hasSeats = !!seats;
  const units =
    bookingStart && bookingEnd ? calculateQuantityFromDates(bookingStart, bookingEnd, code) : null;

  // If there are seats, the quantity is split to factors: units and seats.
  // E.g. 3 nights x 4 seats (aka unit price is multiplied by 12)
  return hasSeats ? { units, seats, extraLineItems: [] } : { quantity: units, extraLineItems: [] };
};

const getDefaultLineItems = (orderData, customerCommission, providerCommission, listing) => {
  const publicData = listing.attributes.publicData;
  // Note: the unitType needs to be one of the following:
  // day, night, hour, fixed, or item (these are related to payment processes)
  const { unitType, priceVariants, priceVariationsEnabled } = publicData;

  const isBookable = ['day', 'night', 'hour', 'fixed'].includes(unitType);
  const priceAttribute = listing.attributes.price;
  const currency = priceAttribute.currency;

  const { priceVariantName } = orderData || {};
  const priceVariantConfig = priceVariants
    ? priceVariants.find(pv => pv.name === priceVariantName)
    : null;
  const { priceInSubunits } = priceVariantConfig || {};
  const isPriceInSubunitsValid = Number.isInteger(priceInSubunits) && priceInSubunits >= 0;

  const unitPrice =
    isBookable && priceVariationsEnabled && isPriceInSubunitsValid
      ? new Money(priceInSubunits, currency)
      : priceAttribute;

  /**
   * Pricing starts with order's base price:
   * Listing's price is related to a single unit. It needs to be multiplied by quantity
   *
   * Initial line-item needs therefore:
   * - code (based on unitType)
   * - unitPrice
   * - quantity
   * - includedFor
   */

  const code = `line-item/${unitType}`;

  // Here "extra line-items" means line-items that are tied to unit type
  // E.g. by default, "shipping-fee" is tied to 'item' aka buying products.
  const quantityAndExtraLineItems =
    unitType === 'item'
      ? getItemQuantityAndLineItems(orderData, publicData, currency)
      : unitType === 'fixed'
      ? getFixedQuantityAndLineItems(orderData)
      : unitType === 'hour'
      ? getHourQuantityAndLineItems(orderData)
      : ['day', 'night'].includes(unitType)
      ? getDateRangeQuantityAndLineItems(orderData, code)
      : {};

  const { quantity, units, seats, extraLineItems } = quantityAndExtraLineItems;

  // Throw error if there is no quantity information given
  if (!quantity && !(units && seats)) {
    const missingFields = [];

    if (!quantity) missingFields.push('quantity');
    if (!units) missingFields.push('units');
    if (!seats) missingFields.push('seats');

    const message = `Error: orderData is missing the following information: ${missingFields.join(
      ', '
    )}. Quantity or either units & seats is required.`;

    const error = new Error(message);
    error.status = 400;
    error.statusText = message;
    error.data = {};
    throw error;
  }

  /**
   * If you want to use pre-defined component and translations for printing the lineItems base price for order,
   * you should use one of the codes:
   * line-item/night, line-item/day, line-item/hour or line-item/item.
   *
   * Pre-definded commission components expects line item code to be one of the following:
   * 'line-item/provider-commission', 'line-item/customer-commission'
   *
   * By default OrderBreakdown prints line items inside LineItemUnknownItemsMaybe if the lineItem code is not recognized. */

  const quantityOrSeats = !!units && !!seats ? { units, seats } : { quantity };
  const order = {
    code,
    unitPrice,
    ...quantityOrSeats,
    includeFor: ['customer', 'provider'],
  };

  // Let's keep the base price (order) as first line item and provider and customer commissions as last.
  // Note: the order matters only if OrderBreakdown component doesn't recognize line-item.
  const lineItems = [
    order,
    ...extraLineItems,
    ...getProviderCommissionMaybe(providerCommission, [order], priceAttribute),
    ...getCustomerCommissionMaybe(customerCommission, [order], priceAttribute),
  ];

  return lineItems;
};

const getProductOrderLineItems = (orderData, listings, providerCommission, customerCommission) => {
  const ordererListings = orderData.orderedProducts.listings;
  const deliveryMethod = orderData.orderedProducts.deliveryMethod;
  let orderQuantity = 0;
  const isShipping = deliveryMethod === 'shipping';
  const listingLineItems = listings.map(listing => {
    const quantity = ordererListings[listing.id.uuid].quantity;

    const publicData = listing.attributes.publicData;

    orderQuantity += Number(quantity);

    // Note: the unitType needs to be one of the following:
    // day, night, hour, fixed, or item (these are related to payment processes)
    const { unitType } = publicData;

    const priceAttribute = listing.attributes.price;

    /**
     * Pricing starts with order's base price:
     * Listing's price is related to a single unit. It needs to be multiplied by quantity
     *
     * Initial line-item needs therefore:
     * - code (based on unitType)
     * - unitPrice
     * - quantity
     * - includedFor
     */

    const code = `line-item/${unitType}-${listing.id.uuid}`;

    // Throw error if there is no quantity information given
    if (!quantity) {
      const message = `Error: orderData is missing the following information: quantity.`;

      const error = new Error(message);
      error.status = 400;
      error.statusText = message;
      error.data = {};
      throw error;
    }

    const orderLineItem = {
      code,
      unitPrice: priceAttribute,
      quantity,
      includeFor: ['customer', 'provider'],
    };
    return orderLineItem;
  });

  const currency = listingLineItems?.[0]?.unitPrice?.currency;
  if (!currency) {
    const error = new Error('Currency not found');
    error.status = 400;
    error.statusText = 'Currency not found';
    error.data = {};
    throw error;
  }

  const {
    shippingPriceInSubunitsOneItem,
    shippingPriceInSubunitsAdditionalItems,
  } = listings.reduce(
    (acc, listing) => {
      const { publicData } = listing.attributes;
      return {
        shippingPriceInSubunitsOneItem: Math.min(
          acc.shippingPriceInSubunitsOneItem,
          publicData.shippingPriceInSubunitsOneItem
        ),
        shippingPriceInSubunitsAdditionalItems: Math.min(
          acc.shippingPriceInSubunitsAdditionalItems,
          publicData.shippingPriceInSubunitsAdditionalItems
        ),
      };
    },
    {
      shippingPriceInSubunitsOneItem: Infinity,
      shippingPriceInSubunitsAdditionalItems: Infinity,
    }
  );

  const shippingFeeUnitPrice = isShipping
    ? calculateShippingFee(
        shippingPriceInSubunitsOneItem,
        shippingPriceInSubunitsAdditionalItems,
        currency,
        orderQuantity
      )
    : null;

  const deliveryLineItemMaybe = !!isShipping
    ? [
        {
          code: 'line-item/shipping-fee',
          unitPrice: shippingFeeUnitPrice,
          quantity: 1,
          includeFor: ['customer', 'provider'],
        },
      ]
    : [];

  const customerCommissionMaybe = getCustomerCommissionMaybe(
    customerCommission,
    [...deliveryLineItemMaybe, ...listingLineItems],
    currency
  );

  const providerCommissionMaybe = getProviderCommissionMaybe(
    providerCommission,
    [...listingLineItems, ...deliveryLineItemMaybe],
    currency
  );
  // Let's keep the base price (order) as first line item and provider and customer commissions as last.
  // Note: the order matters only if OrderBreakdown component doesn't recognize line-item.
  const lineItems = [
    ...listingLineItems,
    ...deliveryLineItemMaybe,
    ...providerCommissionMaybe,
    ...customerCommissionMaybe,
  ];

  return lineItems;
};

/**
 * Returns collection of lineItems (max 50)
 *
 * All the line-items dedicated to _customer_ define the "payin total".
 * Similarly, the sum of all the line-items included for _provider_ create "payout total".
 * Platform gets the commission, which is the difference between payin and payout totals.
 *
 * Each line items has following fields:
 * - `code`: string, mandatory, indentifies line item type (e.g. \"line-item/cleaning-fee\"), maximum length 64 characters.
 * - `unitPrice`: money, mandatory
 * - `lineTotal`: money
 * - `quantity`: number
 * - `percentage`: number (e.g. 15.5 for 15.5%)
 * - `seats`: number
 * - `units`: number
 * - `includeFor`: array containing strings \"customer\" or \"provider\", default [\":customer\"  \":provider\" ]
 *
 * Line item must have either `quantity` or `percentage` or both `seats` and `units`.
 *
 * `includeFor` defines commissions. Customer commission is added by defining `includeFor` array `["customer"]` and provider commission by `["provider"]`.
 *
 * @param {Object} listings
 * @param {Object} orderData
 * @param {Object} providerCommission
 * @param {Object} customerCommission
 * @param {number} shippingFee
 * @returns {Array} lineItems
 */
exports.transactionLineItems = (listings, orderData, providerCommission, customerCommission) => {
  if (orderData.orderedProducts) {
    return getProductOrderLineItems(orderData, listings, providerCommission, customerCommission);
  } else {
    const [listing] = listings;
    return getDefaultLineItems(orderData, customerCommission, providerCommission, listing);
  }
};

exports.formatLineItems = (lineItems, listings) => {
  const formattedLineItems = lineItems.map(item => {
    const code = item.code;
    const isPercentage = typeof item.percentage !== 'undefined';
    if (code.includes('item-')) {
      const listingId = code.split('item-')[1];
      const listingTitle = listings.find(listing => listing.id.uuid === listingId).attributes.title;
      return {
        code: 'line-item/item',
        actualCode: item.code,
        title: `${listingTitle}`,
        quantity: item.quantity,
        unitPriceAmount: item.unitPrice.amount / 100,
        unitPriceCurrency: item.unitPrice.currency,
        lineTotalAmount: (item.unitPrice.amount / 100) * item.quantity,
        lineTotalCurrency: item.unitPrice.currency,
        includeFor: item.includeFor,
      };
    } else {
      return {
        code: item.code,
        title: item.code,
        ...(isPercentage ? { percentage: item.percentage } : { quantity: item.quantity }),
        unitPriceAmount: item.unitPrice.amount / 100,
        unitPriceCurrency: item.unitPrice.currency,
        includeFor: item.includeFor,
        lineTotalAmount:
          (item.unitPrice.amount / 100) * (isPercentage ? item.percentage / 100 : item.quantity),
        lineTotalCurrency: item.unitPrice.currency,
      };
    }
  });
  return formattedLineItems;
};
