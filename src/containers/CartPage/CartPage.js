import React from 'react';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { initializeCardPaymentData } from '../../ducks/stripe.duck.js';

import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { FormattedMessage } from '../../util/reactIntl';

import { H3, LayoutSingleColumn, NamedLink, Page, UserNav } from '../../components';

import CartCard from './CartCard/CartCard';

import css from './CartPage.module.css';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import { fetchAllCartLineItems, fetchTransactionLineItems } from './CartPage.duck';
import { transformCartList } from './CartPage.helper.js';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck.js';
import useAddOrUpdateToCart from '../../hooks/useAddOrUpdateToCart.js';
import { handleSubmit } from '../ListingPage/ListingPage.shared.js';
import Spinner from '../../components/IconSpinner/IconSpinner.js';

const CartPage = props => {
  const routeConfiguration = useRouteConfiguration();
  const {
    listings,
    callSetInitialValues,
    scrollingDisabled,
    onInitializeCardPaymentData,
    fetchAllCartLineItemsInProgress,
    lineItemsMap,
    currentUser,
    onFetchTransactionLineItems,
    queryListingsInProgress,
    fetchLineItemsRequestIds,
  } = props;

  const history = useHistory();
  const {
    cart,
    addOrUpdateToCart,
    addOrUpdateToCartInProgressIds,
    removeAuthorWithDeliveryMethodFromCart,
    removeAuthorWithDeliveryMethodFromCartInProgressIds,
  } = useAddOrUpdateToCart();
  /**
   * Change the author whose cart is displayed
   */
  const cartList = transformCartList(cart, listings, lineItemsMap);
  const onAddOrUpdateToCart = (authorId, listingId, deliveryMethod, quantity) => {
    const authorCart = cart[authorId][deliveryMethod];
    const shippingAddressMaybe =
      deliveryMethod === 'shipping'
        ? {
            shippingAddress: {
              address: authorCart.deliveryDetails.shippingAddress.address,
              origin: {
                lat: authorCart.deliveryDetails.shippingAddress.origin.lat,
                lng: authorCart.deliveryDetails.shippingAddress.origin.lng,
              },
            },
          }
        : {};

    addOrUpdateToCart(authorId, listingId, deliveryMethod, quantity, authorCart.deliveryDetails);
    if (quantity > 0) {
      onFetchTransactionLineItems({
        orderData: {
          orderedProducts: {
            authorId,
            deliveryMethod,
            listings: {
              [listingId]: { quantity },
            },
            ...shippingAddressMaybe,
          },
        },
      });
    }
  };

  const onProceedToCheckout = cartData => () => {
    const { listings, deliveryMethod, deliveryDetails } = cartData;
    const [firstListing] = listings;
    handleSubmit({
      params: { id: firstListing.id.uuid },
      history,
      currentUser,
      callSetInitialValues,
      getListing: () => firstListing,
      onInitializeCardPaymentData,
      routes: routeConfiguration,
    })({
      fromCart: true,
      orderedProducts: {
        authorId: firstListing.author.id.uuid,
        deliveryMethod: deliveryMethod,
        listings: Object.values(listings).reduce((acc, l) => {
          acc[l.id.uuid] = {
            quantity: l.quantity,
          };
          return acc;
        }, {}),
        ...(deliveryDetails ? { ...deliveryDetails } : {}),
      },
    });
  };

  return (
    <Page title="Shopping cart" scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <>
            <TopbarContainer currentPage="CartPage" />
            <UserNav currentPage="CartPage" />
          </>
        }
        footer={<FooterContainer />}
      >
        <div className={css.listingPanel}>
          {!!(queryListingsInProgress || fetchAllCartLineItemsInProgress) ? (
            <div className={css.loading}>
              <Spinner />
            </div>
          ) : (
            <div className={css.listingCards}>
              {cartList.length === 0 ? (
                <div className={css.emptyCart}>
                  <H3>
                    <FormattedMessage id="CartPage.emptyCart" />
                  </H3>
                  <NamedLink className={css.emptyCartLink} name="SearchPage" params={{}}>
                    <FormattedMessage id="CartPage.continueShopping" />
                  </NamedLink>
                </div>
              ) : (
                cartList.map(c => {
                  const { authorId, deliveryMethod } = c;
                  const originCart = cart[authorId][deliveryMethod];

                  return (
                    <CartCard
                      key={`${authorId}-${deliveryMethod}`}
                      originCart={originCart}
                      cart={c}
                      currentUser={props.currentUser}
                      addOrUpdateToCart={onAddOrUpdateToCart}
                      addOrUpdateToCartInProgressIds={addOrUpdateToCartInProgressIds}
                      removeAuthorWithDeliveryMethodFromCart={
                        removeAuthorWithDeliveryMethodFromCart
                      }
                      removeAuthorWithDeliveryMethodFromCartInProgressIds={
                        removeAuthorWithDeliveryMethodFromCartInProgressIds
                      }
                      onProceedToCheckout={onProceedToCheckout(c)}
                      fetchLineItemsRequestIds={fetchLineItemsRequestIds}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const {
    currentPageResultIds,
    toggleDeliveryInProgress,
    fetchAllCartLineItemsInProgress,
    lineItemsMap,
    queryInProgress: queryListingsInProgress,
    fetchLineItemsRequestIds,
  } = state.CartPage;
  const { currentUser } = state.user;

  const getListing = id => {
    const ref = { id, type: 'listing' };
    const listings = getMarketplaceEntities(state, [ref]);
    return listings.length === 1 ? listings[0] : null;
  };
  const listings = currentPageResultIds.map(id => getListing(id));
  return {
    currentUser,
    listings,
    scrollingDisabled: isScrollingDisabled(state),
    toggleDeliveryInProgress,
    fetchAllCartLineItemsInProgress,
    lineItemsMap,
    getListing,
    queryListingsInProgress,
    fetchLineItemsRequestIds,
  };
};

const mapDispatchToProps = dispatch => ({
  callSetInitialValues: (setInitialValues, initialValues, saveToSessionStorage) =>
    dispatch(setInitialValues(initialValues, saveToSessionStorage)),
  onInitializeCardPaymentData: () => dispatch(initializeCardPaymentData()),
  onFetchAllCartLineItems: params => dispatch(fetchAllCartLineItems(params)),
  onFetchTransactionLineItems: params => dispatch(fetchTransactionLineItems(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CartPage);
