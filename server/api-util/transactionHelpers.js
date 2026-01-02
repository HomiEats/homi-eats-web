const { getIntegrationSdk } = require('./sdk');

const CART_TRANSITIONS = {
  CART_TRANSITION_RESERVE_STOCK: 'transition/reserve-stock',
  CART_TRANSITION_CONFIRM_STOCK: 'transition/confirm-stock',
  CART_TRANSITION_AUTO_EXPIRE_STOCK: 'transition/auto-expire-stock',
  CART_TRANSITION_CANCEL_STOCK: 'transition/cancel-stock',
  CART_TRANSITION_COMPLETE_STOCK: 'transition/complete-stock',
  CART_TRANSITION_AUTO_COMPLETE_STOCK: 'transition/auto-complete-stock',
};

const DEFAULT_PURCHASE_TRANSITIONS = {
  UPDATE_CHILD_TRANSACTIONS: 'transition/update-child-transactions',
};

const createStockReservationTransactions = async ({ tx, sdk, queryParams }) => {
  const orderedProducts = { ...tx.attributes.protectedData.orderedProducts };
  // Create transactions with the cart item process to update stock reservations
  if (Object.keys(orderedProducts?.listings).length === 0) {
    return tx;
  } else {
    const additionalTransactionFns = Object.keys(orderedProducts?.listings).map(listingId => {
      const quantity = orderedProducts?.listings[listingId].quantity;
      // initiate
      const bodyParams = {
        processAlias: 'cart-stock-process/release-1',
        transition: CART_TRANSITIONS.CART_TRANSITION_RESERVE_STOCK,
        params: {
          listingId: listingId,
          stockReservationQuantity: quantity,
          protectedData: {
            parentTransactionId: tx.id.uuid,
          },
        },
      };

      return sdk.transactions.initiate(bodyParams, { expand: true }).then(res => {
        return {
          listingId: listingId,
          stockTransactionId: res.data.data.id.uuid,
        };
      });
    });

    const childTransactions = (await Promise.all(additionalTransactionFns)).reduce(
      (children, child) => {
        return {
          ...children,
          [child.listingId]: child.stockTransactionId,
        };
      },
      {}
    );

    const parentProtectedData = {
      ...tx.attributes.protectedData,
      childTransactions,
    };

    // Update child transaction ids
    const parentBodyParams = {
      id: tx.id,
      transition: DEFAULT_PURCHASE_TRANSITIONS.UPDATE_CHILD_TRANSACTIONS,
      params: {
        protectedData: parentProtectedData,
      },
    };

    return sdk.transactions.transition(parentBodyParams, queryParams);
  }
};

/**
 * Updates the specified transaction's child transactions using the specified transition
 * @param {*} tx Main transaction – expects protectedData.childTransactions
 * @param {*} transitionName Transition to apply to protectedData.childTransactions array
 * @returns 'tx', i.e. the main transaction
 */
const updateStockReservationTransactions = async ({ tx, sdk }) => {
  const childTransactions = Object.values(tx.attributes.protectedData.childTransactions);

  await Promise.all(
    childTransactions.map(childTx => {
      return sdk.transactions.transition({
        id: childTx,
        transition: CART_TRANSITIONS.CART_TRANSITION_CONFIRM_STOCK,
        params: {},
      });
    })
  );
  const integrationSdk = getIntegrationSdk();
  await integrationSdk.transactions.updateMetadata({
    id: tx.id.uuid,
    metadata: {
      childrenTransactionStockConfirmed: true,
    },
  });
  return tx;
};

module.exports = {
  createStockReservationTransactions,
  updateStockReservationTransactions,
};
