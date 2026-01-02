const sharetribeSdk = require('sharetribe-flex-sdk');
const { transactionLineItems, formatLineItems } = require('../api-util/lineItems');
const { isIntentionToMakeOffer } = require('../api-util/negotiation');
const { getSdk, getTrustedSdk, handleError, serialize } = require('../api-util/sdk');
const { fetchListingsAndCommission } = require('../api-util/orderHelpers');
const { createStockReservationTransactions } = require('../api-util/transactionHelpers');
const { denormalisedResponseEntities } = require('../api-util/format');
const { ShippingServices } = require('../services');

const { Money } = sharetribeSdk.types;

const getFullOrderData = (orderData, bodyParams, currency) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams.transition;

  return isIntentionToMakeOffer(offerInSubunits, transitionName)
    ? {
        ...orderData,
        ...bodyParams.params,
        currency,
        offer: new Money(offerInSubunits, currency),
      }
    : { ...orderData, ...bodyParams.params };
};

const getMetadata = (orderData, transition) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for now, the actor is always "provider".
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  return isIntentionToMakeOffer(offerInSubunits, transition)
    ? {
        metadata: {
          offers: [
            {
              offerInSubunits,
              by,
              transition,
            },
          ],
        },
      }
    : {};
};

module.exports = async (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body;
  const transitionName = bodyParams.transition;
  const sdk = getSdk(req, res);
  let lineItems = null;
  let metadataMaybe = {};

  try {
    const { listings, commissionAsset } = await fetchListingsAndCommission(
      sdk,
      orderData,
      bodyParams
    );
    const listing = listings?.[0];
    const currency = listing.attributes.price?.currency || orderData.currency;
    const { providerCommission, customerCommission } =
      commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

    const shippingRate = orderData.shippingRateId
      ? await ShippingServices.rates.get(orderData.shippingRateId)
      : null;

    lineItems = transactionLineItems(
      listings,
      getFullOrderData(orderData, bodyParams, currency),
      providerCommission,
      customerCommission,
      shippingRate
    );

    metadataMaybe = getMetadata(orderData, transitionName);

    const trustedSdk = await getTrustedSdk(req);
    const { params } = bodyParams;

    // Add lineItems to the body params
    const body = {
      ...bodyParams,
      params: {
        ...params,
        lineItems,
        ...metadataMaybe,
        protectedData: {
          ...params.protectedData,
          formattedLineItems: formatLineItems(lineItems, listings),
          ...(shippingRate ? { shippingRate } : {}),
        },
      },
    };

    let apiResponse = isSpeculative
      ? await trustedSdk.transactions.initiateSpeculative(body, queryParams)
      : await trustedSdk.transactions.initiate(body, queryParams);

    if (orderData.orderedProducts && !isSpeculative) {
      apiResponse = await createStockReservationTransactions({
        tx: denormalisedResponseEntities(apiResponse)[0],
        sdk: trustedSdk,
        queryParams,
      });
    }

    const { status, statusText, data } = apiResponse;
    res
      .status(status)
      .set('Content-Type', 'application/transit+json')
      .send(
        serialize({
          status,
          statusText,
          data,
        })
      )
      .end();
  } catch (e) {
    handleError(res, e);
  }
};
