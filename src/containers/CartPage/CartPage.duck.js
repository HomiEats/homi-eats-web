import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { updatedEntities, denormalisedEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { createImageVariantConfig } from '../../util/sdkLoader';
import { transactionLineItems } from '../../util/api';
import { fetchCurrentUser } from '../../ducks/user.duck';
import * as log from '../../util/log';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { setCart as setGlobalCart } from '../../ducks/cart.duck';

const RESULT_PAGE_SIZE = 8;

// ================ Async Thunks ================ //

export const queryCartListings = createAsyncThunk(
  'CartPage/queryCartListings',
  async ({ queryParams, config }, { dispatch, extra: sdk, rejectWithValue }) => {
    const { aspectWidth = 1, aspectHeight = 1 } = config.layout.listingImage;
    const variantPrefix = 'cart-card';
    const listingVariantPrefix = 'listing-card';
    const aspectRatio = aspectHeight / aspectWidth;

    const includeParams = {
      perPage: RESULT_PAGE_SIZE,
      include: ['images', 'author', 'currentStock', 'author.profileImage'],
      'fields.image': [
        `variants.${variantPrefix}`,
        `variants.${listingVariantPrefix}`,
        `variants.${listingVariantPrefix}-2x`,
        `variants.${listingVariantPrefix}-4x`,
        `variants.${listingVariantPrefix}-6x`,
        `variants.square-small`,
      ],
      ...createImageVariantConfig(`${variantPrefix}`, 100, aspectRatio),
      ...createImageVariantConfig(`${listingVariantPrefix}`, 400, aspectRatio),
      ...createImageVariantConfig(`${listingVariantPrefix}-2x`, 800, aspectRatio),
      ...createImageVariantConfig(`${listingVariantPrefix}-4x`, 1600, aspectRatio),
      ...createImageVariantConfig(`${listingVariantPrefix}-6x`, 2400, aspectRatio),
    };

    const { perPage, ...rest } = { ...queryParams, ...includeParams };
    const params = { ...rest, per_page: perPage };

    try {
      const listingsResponse = await sdk.listings.query(params);
      dispatch(addMarketplaceEntities(listingsResponse));

      return {
        listingsResponse,
      };
    } catch (error) {
      console.error(error);
      return rejectWithValue(storableError(error));
    }
  }
);

export const fetchTransactionLineItems = createAsyncThunk(
  'CartPage/fetchTransactionLineItems',
  async ({ orderData }, { getState, rejectWithValue }) => {
    const { authorId, deliveryMethod } = orderData.orderedProducts;
    const id = `${authorId}_${deliveryMethod}`;

    try {
      const response = await transactionLineItems({ orderData });
      const currentLineItemsMap = getState().CartPage.lineItemsMap;

      const lineItemsMap = {
        ...currentLineItemsMap,
        [id]: response.data,
      };

      return { id, lineItemsMap };
    } catch (e) {
      log.error(e, 'fetching-line-items-failed', {
        orderData,
        statusText: e.statusText,
      });
      return rejectWithValue({ id, error: storableError(e) });
    }
  }
);

export const fetchAllCartLineItems = createAsyncThunk(
  'CartPage/fetchAllCartLineItems',
  async (cart = {}, { rejectWithValue }) => {
    try {
      let orderData = {};
      Object.keys(cart).forEach(authorId => {
        const authorCart = cart[authorId];
        Object.keys(authorCart).forEach(deliveryMethod => {
          orderData[`${authorId}_${deliveryMethod}`] = {
            deliveryMethod,
            listings: authorCart[deliveryMethod].listings,
          };
        });
      });

      const lineItemsMap = {};
      await Promise.allSettled(
        Object.keys(orderData).map(async key => {
          const response = await transactionLineItems({
            orderData: {
              orderedProducts: orderData[key],
            },
          });
          lineItemsMap[key] = response.data;
        })
      );
      return { lineItemsMap };
    } catch (error) {
      console.log({ error });
      return rejectWithValue(storableError(error));
    }
  }
);

export const loadData = (params, search, config) => async (dispatch, getState, sdk) => {
  try {
    const response = await dispatch(fetchCurrentUser({ enforce: true }));
    const cart = response?.attributes?.profile?.privateData?.cart || {};
    dispatch(setGlobalCart(cart));

    const cartListingIds = Object.keys(cart)
      .map(authorId => {
        return Object.keys(cart[authorId])
          .map(deliveryMethod => {
            const listingIds = Object.keys(cart[authorId][deliveryMethod].listings);
            return listingIds;
          })
          .flat();
      })
      .flat();

    await dispatch(fetchAllCartLineItems(cart));

    const listingsResponse = await dispatch(
      queryCartListings({ queryParams: { ids: cartListingIds }, config })
    ).unwrap();
    return { listingsResponse };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// ================ Slice ================ //

const initialState = {
  cart: {},
  cartEntities: {},
  lineItemsMap: {},
  currentPageResultIds: [],
  currentAuthor: null,
  currentAuthorDelivery: null,
  pagination: null,
  queryParams: null,
  queryInProgress: false,
  queryListingsError: null,
  fetchLineItemsInProgress: false,
  fetchLineItemsError: null,
  toggleCartInProgress: false,
  toggleCartError: null,
  toggleDeliveryInProgress: false,
  toggleDeliveryError: null,
  authorListingIds: [],
  fetchLineItemsRequestIds: [],
  fetchAllCartLineItemsInProgress: false,
  fetchAllCartLineItemsError: null,
};

const resultIds = data => data.data.map(l => l.id);

const cartPageSlice = createSlice({
  name: 'CartPage',
  initialState,
  reducers: {
    addCartEntities: (state, action) => {
      state.cartEntities = updatedEntities(state.cartEntities, action.payload.data);
    },
    setCurrentAuthor: (state, action) => {
      state.currentAuthor = action.payload;
      state.currentAuthorDelivery = null;
    },
    setCurrentAuthorDelivery: (state, action) => {
      state.currentAuthorDelivery = action.payload;
    },
    updateCartData: (state, action) => {
      state.cart = action.payload;
    },
    setAuthorListingIds: (state, action) => {
      state.authorListingIds = resultIds(action.payload);
    },
  },
  extraReducers: builder => {
    builder
      // queryCartListings
      .addCase(queryCartListings.pending, (state, action) => {
        state.queryParams = action.meta.arg.queryParams;
        state.queryInProgress = true;
        state.queryListingsError = null;
        state.currentPageResultIds = [];
      })
      .addCase(queryCartListings.fulfilled, (state, action) => {
        const { listingsResponse, authorListingsResponse } = action.payload;
        state.currentPageResultIds = resultIds(listingsResponse.data);
        state.pagination = listingsResponse.data.meta;
        if (authorListingsResponse?.data) {
          state.authorListingIds = resultIds(authorListingsResponse.data);
        }
        state.queryInProgress = false;
      })
      .addCase(queryCartListings.rejected, (state, action) => {
        state.queryInProgress = false;
        state.queryListingsError = action.payload;
      })

      // fetchTransactionLineItems
      .addCase(fetchTransactionLineItems.pending, (state, action) => {
        const { authorId, deliveryMethod } = action.meta.arg.orderData.orderedProducts;
        const id = `${authorId}_${deliveryMethod}`;
        state.fetchLineItemsInProgress = true;
        state.fetchLineItemsError = null;
        state.fetchLineItemsRequestIds.push(id);
      })
      .addCase(fetchTransactionLineItems.fulfilled, (state, action) => {
        const { id, lineItemsMap } = action.payload;
        state.fetchLineItemsInProgress = false;
        state.lineItemsMap = lineItemsMap;
        state.fetchLineItemsRequestIds = state.fetchLineItemsRequestIds.filter(
          reqId => reqId !== id
        );
      })
      .addCase(fetchTransactionLineItems.rejected, (state, action) => {
        const { id, error } = action.payload;
        state.fetchLineItemsInProgress = false;
        state.fetchLineItemsError = error;
        state.fetchLineItemsRequestIds = state.fetchLineItemsRequestIds.filter(
          reqId => reqId !== id
        );
      })

      // fetchAllCartLineItems
      .addCase(fetchAllCartLineItems.pending, state => {
        state.fetchAllCartLineItemsInProgress = true;
        state.fetchAllCartLineItemsError = null;
      })
      .addCase(fetchAllCartLineItems.fulfilled, (state, action) => {
        state.fetchAllCartLineItemsInProgress = false;
        state.lineItemsMap = action.payload.lineItemsMap;
      })
      .addCase(fetchAllCartLineItems.rejected, (state, action) => {
        state.fetchAllCartLineItemsInProgress = false;
        state.fetchAllCartLineItemsError = action.payload;
      });
  },
});

export const {
  addCartEntities,
  setCurrentAuthor,
  setCurrentAuthorDelivery,
  updateCartData,
  setAuthorListingIds,
} = cartPageSlice.actions;

export default cartPageSlice.reducer;

// ================ Selectors ================ //

/**
 * Get the denormalised cart listing entities with the given IDs
 *
 * @param {Object} state the full Redux store
 * @param {Array<UUID>} listingIds listing IDs to select from the store
 */
export const getCartListingsById = (state, listingIds) => {
  const { cartEntities } = state.CartPage;
  const resources = listingIds.map(id => ({
    id,
    type: 'listing',
  }));
  const throwIfNotFound = false;
  return denormalisedEntities(cartEntities, resources, throwIfNotFound);
};

/**
 * Return the listing ids of an author specific cart
 * @param {*} cart
 * @returns array of listing ids
 */
export const getCartListingIds = cart => {
  return Object.keys(cart).filter(key => key !== 'deliveryMethod');
};

// ================ Backward Compatible Thunks ================ //

// Note: loadData, queryCartListings, fetchTransactionLineItems, fetchAllCartLineItems
// are already exported as thunks above.
