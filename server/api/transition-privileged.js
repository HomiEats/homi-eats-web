const sharetribeSdk = require('sharetribe-flex-sdk');
const { transactionLineItems, formatLineItems } = require('../api-util/lineItems');
const {
  addOfferToMetadata,
  getAmountFromPreviousOffer,
  isIntentionToMakeCounterOffer,
  isIntentionToMakeOffer,
  isIntentionToRevokeCounterOffer,
  throwErrorIfNegotiationOfferHasInvalidHistory,
} = require('../api-util/negotiation');
const {
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');
const { denormalisedResponseEntities } = require('../api-util/format');
const { ShippingServices } = require('../services');
const { createStockReservationTransactions } = require('../api-util/transactionHelpers');

const { Money } = sharetribeSdk.types;

const transactionPromise = (sdk, id) => sdk.transactions.show({ id, include: ['listing'] });

const getFullOrderData = (orderData, bodyParams, currency, offers) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams.transition;
  const orderDataAndParams = { ...orderData, ...bodyParams.params, currency };

  return isIntentionToMakeOffer(offerInSubunits, transitionName) ||
    isIntentionToMakeCounterOffer(offerInSubunits, transitionName)
    ? {
        ...orderDataAndParams,
        offer: new Money(offerInSubunits, currency),
      }
    : isIntentionToRevokeCounterOffer(transitionName)
    ? {
        ...orderDataAndParams,
        offer: new Money(getAmountFromPreviousOffer(offers), currency),
      }
    : orderDataAndParams;
};

const getUpdatedMetadata = (orderData, transition, existingMetadata) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for default-negotiation process, the actor is always "provider" when making an offer.
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  const isNewOffer =
    isIntentionToMakeOffer(offerInSubunits, transition) ||
    isIntentionToMakeCounterOffer(offerInSubunits, transition);

  return isNewOffer
    ? addOfferToMetadata(existingMetadata, {
        offerInSubunits,
        by,
        transition,
      })
    : isIntentionToRevokeCounterOffer(transition)
    ? addOfferToMetadata(existingMetadata, {
        offerInSubunits: getAmountFromPreviousOffer(existingMetadata.offers),
        by,
        transition,
      })
    : addOfferToMetadata(existingMetadata, null);
};

module.exports = async (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body;

  const sdk = getSdk(req, res);
  const transitionName = bodyParams.transition;
  let lineItems = null;
  let metadataMaybe = {};

  try {
    const [showTransactionResponse, fetchAssetsResponse] = await Promise.all([
      transactionPromise(sdk, bodyParams?.id),
      fetchCommission(sdk),
    ]);

    const transaction = denormalisedResponseEntities(showTransactionResponse)[0];
    const listing = transaction.listing;
    const commissionAsset = fetchAssetsResponse.data.data[0];

    const existingMetadata = transaction?.attributes?.metadata;
    const existingOffers = existingMetadata?.offers || [];
    const transitions = transaction.attributes.transitions;

    // Check if the transition is related to negotiation offers and if the offers are valid
    throwErrorIfNegotiationOfferHasInvalidHistory(transitionName, existingOffers, transitions);

    const currency =
      transaction.attributes.payinTotal?.currency ||
      listing.attributes.price?.currency ||
      orderData.currency;
    const { providerCommission, customerCommission } =
      commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

    lineItems = transactionLineItems(
      [listing],
      getFullOrderData(orderData, bodyParams, currency, existingOffers),
      providerCommission,
      customerCommission
    );

    metadataMaybe = getUpdatedMetadata(orderData, transitionName, existingMetadata);

    const trustedSdk = await getTrustedSdk(req);

    // Omit listingId from params (transition/request-payment-after-inquiry does not need it)
    const { listingId, ...restParams } = bodyParams?.params || {};

    // Add lineItems to the body params
    const body = {
      ...bodyParams,
      params: {
        ...restParams,
        lineItems,
        ...metadataMaybe,
        protectedData: {
          ...restParams.protectedData,
          formattedLineItems: formatLineItems(lineItems, [listing]),
        },
      },
    };

    let apiResponse = isSpeculative
      ? await trustedSdk.transactions.transitionSpeculative(body, queryParams)
      : await trustedSdk.transactions.transition(body, queryParams);

    if (orderData.orderedProducts && !isSpeculative) {
      const [tx] = denormalisedResponseEntities(apiResponse);
      apiResponse = await createStockReservationTransactions({
        tx,
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
