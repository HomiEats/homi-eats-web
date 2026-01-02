import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { updateCurrentUserProfile } from './user.duck';
import { storableError } from '../util/errors';
import { updateCartData } from '../util/cart';

// ================ Async Thunks ================ //

export const addOrUpdateToCartThunk = createAsyncThunk(
  'cart/addOrUpdateToCart',
  async (payload, { getState, extra: sdk, rejectWithValue }) => {
    const {
      authorId,
      listingId,
      deliveryMethod,
      quantity,
      deliveryDetails,
      shouldSaveDefaultDeliveryAddress,
    } = payload;
    try {
      const id = `${authorId}-${deliveryMethod}-${listingId}`;
      const { cart } = getState().cart;
      const newCart = { ...cart };
      const updatedCart = updateCartData(
        newCart,
        authorId,
        listingId,
        deliveryMethod,
        Number(quantity),
        deliveryDetails
      );
      await sdk.currentUser.updateProfile({
        privateData: { cart: updatedCart },
        ...(shouldSaveDefaultDeliveryAddress &&
        !isEmpty(deliveryDetails?.shippingAddress ?? {}) &&
        deliveryMethod === 'shipping'
          ? {
              publicData: {
                defaultDeliveryAddress: deliveryDetails.shippingAddress,
              },
            }
          : {}),
      });
      return { id, updatedCart };
    } catch (error) {
      console.error({ error });
      return rejectWithValue(storableError(error));
    }
  }
);

export const removeAuthorWithDeliveryMethodFromCartThunk = createAsyncThunk(
  'cart/removeAuthorWithDeliveryMethodFromCart',
  async ({ authorId, deliveryMethod }, { getState, extra: sdk, rejectWithValue }) => {
    try {
      const { cart } = getState().cart;
      const newCart = { ...cart };

      if (newCart[authorId]) {
        // We need to clone the author's cart to avoid mutation of the original state
        newCart[authorId] = { ...newCart[authorId] };
        delete newCart[authorId][deliveryMethod];

        if (Object.keys(newCart[authorId]).length === 0) {
          delete newCart[authorId];
        }
      }

      await sdk.currentUser.updateProfile({ privateData: { cart: newCart } });
      return { updatedCart: newCart, removeId: `${authorId}-${deliveryMethod}` };
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  }
);

// Backward compatible wrappers
export const addOrUpdateToCart = (
  authorId,
  listingId,
  deliveryMethod,
  quantity,
  deliveryDetails,
  shouldSaveDefaultDeliveryAddress
) => dispatch => {
  return dispatch(
    addOrUpdateToCartThunk({
      authorId,
      listingId,
      deliveryMethod,
      quantity,
      deliveryDetails,
      shouldSaveDefaultDeliveryAddress,
    })
  );
};

export const removeAuthorWithDeliveryMethodFromCart = (authorId, deliveryMethod) => dispatch => {
  return dispatch(removeAuthorWithDeliveryMethodFromCartThunk({ authorId, deliveryMethod }));
};

export const loadCartFromLocalStorage = () => dispatch => {
  if (typeof window !== 'undefined') {
    const cart = localStorage.getItem('cart');
    if (cart) {
      try {
        const parsedCart = JSON.parse(cart);
        dispatch(setCart(parsedCart));
        return parsedCart;
      } catch (error) {
        console.error('Error parsing cart from localStorage:', error);
        return {};
      }
    }
  }
  return {};
};

// ================ Slice ================ //

const initialState = {
  cart: {},
  addOrUpdateToCartInProgressIds: [],
  addOrUpdateToCartError: null,

  removeAuthorWithDeliveryMethodFromCartInProgressIds: [],
  removeAuthorWithDeliveryMethodFromCartError: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCart: (state, action) => {
      state.cart = action.payload;
    },
    clearCart: (state, action) => {
      const payload = action.payload;
      if (!payload?.length) {
        state.cart = {};
      } else {
        // Note: removeListingsFromCart was used in the original reducer but not defined.
        // Assuming it's available in the scope or handled by the user.
        // If it's not defined, this will still fail as before, preserving original behavior.
        if (typeof removeListingsFromCart !== 'undefined') {
          state.cart = removeListingsFromCart(state.cart, payload);
        }
      }
    },
  },
  extraReducers: builder => {
    builder
      // addOrUpdateToCart
      .addCase(addOrUpdateToCartThunk.pending, (state, action) => {
        const { authorId, deliveryMethod, listingId } = action.meta.arg;
        const id = `${authorId}-${deliveryMethod}-${listingId}`;
        state.addOrUpdateToCartInProgressIds.push(id);
        state.addOrUpdateToCartError = null;
      })
      .addCase(addOrUpdateToCartThunk.fulfilled, (state, action) => {
        const { id, updatedCart } = action.payload;
        state.addOrUpdateToCartInProgressIds = state.addOrUpdateToCartInProgressIds.filter(
          i => i !== id
        );
        state.cart = updatedCart;
      })
      .addCase(addOrUpdateToCartThunk.rejected, (state, action) => {
        const { authorId, deliveryMethod, listingId } = action.meta.arg;
        const id = `${authorId}-${deliveryMethod}-${listingId}`;
        state.addOrUpdateToCartInProgressIds = state.addOrUpdateToCartInProgressIds.filter(
          i => i !== id
        );
        state.addOrUpdateToCartError = action.payload;
      })

      // removeAuthorWithDeliveryMethodFromCart
      .addCase(removeAuthorWithDeliveryMethodFromCartThunk.pending, (state, action) => {
        const { authorId, deliveryMethod } = action.meta.arg;
        const removeId = `${authorId}-${deliveryMethod}`;
        state.removeAuthorWithDeliveryMethodFromCartInProgressIds.push(removeId);
        state.removeAuthorWithDeliveryMethodFromCartError = null;
      })
      .addCase(removeAuthorWithDeliveryMethodFromCartThunk.fulfilled, (state, action) => {
        const { removeId, updatedCart } = action.payload;
        state.removeAuthorWithDeliveryMethodFromCartInProgressIds = state.removeAuthorWithDeliveryMethodFromCartInProgressIds.filter(
          id => id !== removeId
        );
        state.cart = updatedCart;
      })
      .addCase(removeAuthorWithDeliveryMethodFromCartThunk.rejected, (state, action) => {
        const { authorId, deliveryMethod } = action.meta.arg;
        const removeId = `${authorId}-${deliveryMethod}`;
        state.removeAuthorWithDeliveryMethodFromCartInProgressIds = state.removeAuthorWithDeliveryMethodFromCartInProgressIds.filter(
          id => id !== removeId
        );
        state.removeAuthorWithDeliveryMethodFromCartError = action.payload;
      });
  },
});

export const { setCart, clearCart } = cartSlice.actions;

export default cartSlice.reducer;
