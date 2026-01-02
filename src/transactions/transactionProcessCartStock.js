/**
 * Transaction process graph for product order cart items:
 *   - cart-stock-process
 */

/**
 * Transitions
 *
 * These strings must sync with values defined in Marketplace API,
 * since transaction objects given by API contain info about last transitions.
 * All the actions in API side happen in transitions,
 * so we need to understand what those strings mean.
 */

export const transitions = {
  CART_TRANSITION_RESERVE_STOCK: 'transition/reserve-stock',
  CART_TRANSITION_CONFIRM_STOCK: 'transition/confirm-stock',
  CART_TRANSITION_AUTO_EXPIRE_STOCK: 'transition/auto-expire-stock',
  CART_TRANSITION_CANCEL_STOCK: 'transition/cancel-stock',
  CART_TRANSITION_COMPLETE_STOCK: 'transition/complete-stock',
  CART_TRANSITION_AUTO_COMPLETE_STOCK: 'transition/auto-complete-stock',
};

/**
 * States
 *
 * These constants are only for making it clear how transitions work together.
 * You should not use these constants outside of this file.
 *
 * Note: these states are not in sync with states used transaction process definitions
 *       in Marketplace API. Only last transitions are passed along transaction object.
 */

export const states = {
  INITIAL: 'initial',
  PENDING_STOCK: 'pending-stock',
  PURCHASED: 'purchased',
  CANCELED: 'canceled',
  COMPLETED: 'completed',
};

/**
 * Description of transaction process graph
 *
 * You should keep this in sync with transaction process defined in Marketplace API
 *
 * Note: we don't use yet any state machine library,
 *       but this description format is following Xstate (FSM library)
 *       https://xstate.js.org/docs/
 */
export const graph = {
  // id is defined only to support Xstate format.
  // However if you have multiple transaction processes defined,
  // it is best to keep them in sync with transaction process aliases.
  id: 'cart-stock-process/release-1',

  // This 'initial' state is a starting point for new transaction
  initial: states.INITIAL,

  // States
  states: {
    [states.INITIAL]: {
      on: {
        [transitions.CART_TRANSITION_RESERVE_STOCK]: states.PENDING_STOCK,
      },
    },
    [states.PENDING_STOCK]: {
      on: {
        [transitions.CART_TRANSITION_CONFIRM_STOCK]: states.PURCHASED,
        [transitions.CART_TRANSITION_AUTO_EXPIRE_STOCK]: states.CANCELED,
      },
    },
    [states.PURCHASED]: {
      on: {
        [transitions.CART_TRANSITION_CANCEL_STOCK]: states.CANCELED,
        [transitions.CART_TRANSITION_COMPLETE_STOCK]: states.COMPLETED,
        [transitions.CART_TRANSITION_AUTO_COMPLETE_STOCK]: states.COMPLETED,
      },
    },
    [states.CANCELED]: { type: 'final' },
    [states.COMPLETED]: { type: 'final' },
  },
};
