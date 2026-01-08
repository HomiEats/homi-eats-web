import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Form as FinalForm } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import {
  autocompletePlaceSelected,
  autocompleteSearchRequired,
  composeValidators,
  required,
} from '../../../util/validators';
import { PURCHASE_PROCESS_NAME } from '../../../transactions/transaction';
import { types as sdkTypes } from '../../../util/sdkLoader';

const { Money, LatLng } = sdkTypes;

import {
  Form,
  FieldSelect,
  InlineTextButton,
  PrimaryButton,
  H6,
  SecondaryButton,
  FieldQuantity,
  IconCart,
  FieldLocationAutocompleteInput,
  FieldTextInput,
} from '../../../components';

import EstimatedCustomerBreakdownMaybe from '../EstimatedCustomerBreakdownMaybe';

import FetchLineItemsError from '../FetchLineItemsError/FetchLineItemsError.js';

import css from './ProductOrderForm.module.css';
import Spinner from '../../IconSpinner/IconSpinner.js';
import debounce from 'lodash/debounce';
import { isListingInCart as isListingInCartFn } from '../../../util/cart';
import { isEmpty, isEqual } from 'lodash';
import { formatMoney } from '../../../util/currency.js';
import classNames from 'classnames';

const handleFetchLineItems = ({
  quantity,
  deliveryMethod,
  listingId,
  fetchLineItemsInProgress,
  onFetchTransactionLineItems,
  shippingAddress,
}) => {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser && !fetchLineItemsInProgress) {
    const orderData = {
      orderedProducts: {
        deliveryMethod,
        shippingAddress,
        listings: {
          [listingId.uuid]: { quantity },
        },
      },
    };
    onFetchTransactionLineItems({
      listingId,
      orderData,
    });
  }
};

const DeliveryMethodMaybe = props => {
  const { hasStock, formId, intl, shippingEnabled, pickupEnabled } = props;
  return !hasStock ? null : shippingEnabled && pickupEnabled ? (
    <FieldSelect
      id={`${formId}.deliveryMethod`}
      className={css.deliveryField}
      name="deliveryMethod"
      label={intl.formatMessage({ id: 'ProductOrderForm.deliveryMethodLabel' })}
      validate={required(intl.formatMessage({ id: 'ProductOrderForm.deliveryMethodRequired' }))}
    >
      <option disabled value="">
        {intl.formatMessage({
          id: 'ProductOrderForm.selectDeliveryMethodOption',
        })}
      </option>
      <option value={'pickup'}>
        {intl.formatMessage({ id: 'ProductOrderForm.pickupOption' })}
      </option>
      <option value={'shipping'}>
        {intl.formatMessage({ id: 'ProductOrderForm.shippingOption' })}
      </option>
    </FieldSelect>
  ) : shippingEnabled ? (
    <H6 as="h3" className={css.deliveryMethodHeading}>
      {intl.formatMessage({ id: 'ProductOrderForm.deliveryMethodLabel' })}:{' '}
      {intl.formatMessage({ id: 'ProductOrderForm.shippingOption' })}
    </H6>
  ) : pickupEnabled ? (
    <H6 as="h3" className={css.deliveryMethodHeading}>
      {intl.formatMessage({ id: 'ProductOrderForm.deliveryMethodLabel' })}
      {': '}
      {intl.formatMessage({ id: 'ProductOrderForm.pickupOption' })}
    </H6>
  ) : null;
};

const DEBOUNCE_TIME = 500;
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

export const ProductOrderFormButtons = props => {
  const {
    fetchLineItemsInProgress,
    fetchLineItemsError,
    values,
    hideButtons,
    hasStock,
    addOrUpdateToCartInProgress,
    isListingInCart,
    isAddToCartReady,
    handleAddOrUpdateToCart,
    intl,
    lineItems,
    price,
  } = props;
  const shouldShowButtons =
    !fetchLineItemsInProgress &&
    !fetchLineItemsError &&
    values.deliveryMethod &&
    lineItems &&
    Object.keys(lineItems).length > 0 &&
    !hideButtons;

  return fetchLineItemsInProgress ? (
    <div className={css.productOrderFormButtons}>
      <div className={css.loadingSpinner}>
        <Spinner />
      </div>
    </div>
  ) : (
    shouldShowButtons && (
      <div className={css.productOrderFormButtons}>
        <div className={css.submitButton}>
          {hasStock && (
            <PrimaryButton
              inProgress={addOrUpdateToCartInProgress}
              className={css.addToCartButton}
              disabled={
                addOrUpdateToCartInProgress ||
                !values.deliveryMethod ||
                (!isListingInCart && values.quantity === 0)
              }
              type="button"
              ready={isAddToCartReady}
              onClick={handleAddOrUpdateToCart}
            >
              <IconCart className={css.addToCartIcon} />
              {isListingInCart ? (
                values.quantity > 0 ? (
                  intl.formatMessage({ id: 'ProductOrderForm.updateCart' })
                ) : (
                  intl.formatMessage({
                    id: 'ProductOrderForm.removeFromCart',
                  })
                )
              ) : (
                <FormattedMessage id="ProductOrderForm.addToCart" />
              )}
              {values.quantity > 0 && (
                <span className={css.quantity}>
                  {formatMoney(intl, new Money(values.quantity * price.amount, price.currency))}
                </span>
              )}
            </PrimaryButton>
          )}
          <SecondaryButton
            className={classNames(css.buyNowButton, {
              [css.buyNowButtonDisabled]: !hasStock,
            })}
            type="submit"
            disabled={!hasStock}
          >
            {hasStock ? (
              <FormattedMessage id="ProductOrderForm.ctaButton" />
            ) : (
              <FormattedMessage id="ProductOrderForm.ctaButtonNoStock" />
            )}
          </SecondaryButton>
        </div>
      </div>
    )
  );
};

const renderForm = formRenderProps => {
  const [mounted, setMounted] = useState(false);
  const {
    // FormRenderProps from final-form
    handleSubmit,
    form: formApi,

    // Custom props passed to the form component
    intl,
    formId,
    currentStock,
    listingId,
    isOwnListing,
    onFetchTransactionLineItems,
    onContactUser,
    lineItems,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    price,
    payoutDetailsWarning,
    marketplaceName,
    values,
    addOrUpdateToCartInProgress,
    addOrUpdateToCartError,
    onAddOrUpdateToCart,
    cart,
    authorId,
    shippingEnabled,
    pickupEnabled,
    hideButtons,
    formRef,
  } = formRenderProps;
  useImperativeHandle(formRef, () => ({
    submit: () => {
      formApi.submit();
    },
  }));

  // Note: don't add custom logic before useEffect
  useEffect(() => {
    setMounted(true);

    // Side-effect: fetch line-items after mounting if possible
    const { quantity, deliveryMethod } = values;
    if (quantity && deliveryMethod) {
      handleFetchLineItems({
        quantity,
        deliveryMethod,
        listingId,
        fetchLineItemsInProgress,
        onFetchTransactionLineItems,
      });
    }
  }, []);

  const debounceFetchLineItems = useCallback(debounce(handleFetchLineItems, DEBOUNCE_TIME), []);

  // If form values change, update line-items for the order breakdown
  const handleOnChange = formValues => {
    const { quantity, deliveryMethod } = formValues.values;
    if (mounted && quantity && deliveryMethod) {
      debounceFetchLineItems({
        quantity,
        deliveryMethod,
        listingId,
        isOwnListing,
        fetchLineItemsInProgress,
        onFetchTransactionLineItems,
      });
    }
  };

  // In case quantity and deliveryMethod are missing focus on that select-input.
  // Otherwise continue with the default handleSubmit function.
  const handleFormSubmit = e => {
    const { quantity, deliveryMethod } = values || {};
    if (!quantity || quantity < 1) {
      e.preventDefault();
      // Blur event will show validator message
      formApi.blur('quantity');
      formApi.focus('quantity');
    } else if (!deliveryMethod) {
      e.preventDefault();
      // Blur event will show validator message
      formApi.blur('deliveryMethod');
      formApi.focus('deliveryMethod');
    } else {
      handleSubmit(e);
    }
  };

  const breakdownData = {};
  const showBreakdown =
    breakdownData &&
    lineItems &&
    !fetchLineItemsError &&
    !fetchLineItemsInProgress &&
    values.quantity &&
    values.deliveryMethod;

  const showContactUser = typeof onContactUser === 'function';

  const onClickContactUser = e => {
    e.preventDefault();
    onContactUser();
  };

  const contactSellerLink = (
    <InlineTextButton onClick={onClickContactUser}>
      <FormattedMessage id="ProductOrderForm.finePrintNoStockLinkText" />
    </InlineTextButton>
  );

  // Listing is out of stock if currentStock is zero.
  // Undefined/null stock means that stock has never been set.
  const hasStock = !!(currentStock && currentStock > 0);

  const isListingInCart = isListingInCartFn(cart, listingId.uuid, authorId.uuid);

  const [lastAddToCartValues, setLastAddToCartValues] = useState({});

  useEffect(() => {
    handleOnChange({ values });
  }, [
    values.quantity,
    values.deliveryMethod,
    values.shippingAddress?.selectedPlace?.origin?.lat,
    values.shippingAddress?.selectedPlace?.origin?.lng,
  ]);

  const handleAddOrUpdateToCart = async () => {
    const response = await onAddOrUpdateToCart(values);
    if (response) {
      setLastAddToCartValues(values);
    }
  };

  const submittedOnce = Object.keys(lastAddToCartValues).length > 0;

  const pristineSinceLastAddToCart = isEqual(lastAddToCartValues, values);

  const isAddToCartReady = submittedOnce && pristineSinceLastAddToCart;

  return (
    <Form onSubmit={handleFormSubmit} className={css.form}>
      {hasStock && (
        <FieldQuantity
          className={css.quantityField}
          id={`${formId}.quantity`}
          name="quantity"
          label={intl.formatMessage({ id: 'ProductOrderForm.quantity' })}
          maxQuantity={currentStock}
        />
      )}

      <DeliveryMethodMaybe
        hasStock={hasStock}
        formId={formId}
        intl={intl}
        shippingEnabled={shippingEnabled}
        pickupEnabled={pickupEnabled}
      />

      <FetchLineItemsError error={fetchLineItemsError} />

      {showBreakdown ? (
        <div className={css.breakdownWrapper}>
          <H6 as="h3" className={css.bookingBreakdownTitle}>
            <FormattedMessage id="ProductOrderForm.breakdownTitle" />
          </H6>
          <hr className={css.totalDivider} />
          <EstimatedCustomerBreakdownMaybe
            breakdownData={breakdownData}
            lineItems={lineItems}
            currency={price.currency}
            marketplaceName={marketplaceName}
            processName={PURCHASE_PROCESS_NAME}
          />
        </div>
      ) : null}

      {addOrUpdateToCartError && (
        <div className={css.error}>
          <FormattedMessage id="ProductOrderForm.addToCartError" />
        </div>
      )}

      <ProductOrderFormButtons
        fetchLineItemsInProgress={fetchLineItemsInProgress}
        fetchLineItemsError={fetchLineItemsError}
        values={values}
        hideButtons={hideButtons}
        hasStock={hasStock}
        addOrUpdateToCartInProgress={addOrUpdateToCartInProgress}
        isListingInCart={isListingInCart}
        isAddToCartReady={isAddToCartReady}
        handleAddOrUpdateToCart={handleAddOrUpdateToCart}
        intl={intl}
        lineItems={lineItems}
        price={price}
      />

      <p className={css.finePrint}>
        {payoutDetailsWarning ? (
          payoutDetailsWarning
        ) : hasStock && isOwnListing ? (
          <FormattedMessage id="ProductOrderForm.ownListing" />
        ) : hasStock ? (
          <FormattedMessage id="ProductOrderForm.finePrint" />
        ) : showContactUser ? (
          <FormattedMessage id="ProductOrderForm.finePrintNoStock" values={{ contactSellerLink }} />
        ) : null}
      </p>
    </Form>
  );
};

/**
 * A form for ordering a product.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} props.marketplaceName - The name of the marketplace
 * @param {string} props.formId - The ID of the form
 * @param {Function} props.onSubmit - The function to handle the form submission
 * @param {propTypes.uuid} props.listingId - The ID of the listing
 * @param {propTypes.money} props.price - The price of the listing
 * @param {number} props.currentStock - The current stock of the listing
 * @param {boolean} props.isOwnListing - Whether the listing is owned by the current user
 * @param {boolean} props.pickupEnabled - Whether pickup is enabled
 * @param {boolean} props.shippingEnabled - Whether shipping is enabled
 * @param {boolean} props.displayDeliveryMethod - Whether the delivery method is displayed
 * @param {Object} props.lineItems - The line items
 * @param {Function} props.onFetchTransactionLineItems - The function to fetch the transaction line items
 * @param {boolean} props.fetchLineItemsInProgress - Whether the line items are being fetched
 * @param {propTypes.error} props.fetchLineItemsError - The error for fetching the line items
 * @param {Function} props.onContactUser - The function to contact the user
 * @param {Object} props.cart - The cart object
 * @param {boolean} props.addOrUpdateToCartInProgress - Whether the add or update to cart is in progress
 * @param {propTypes.error} props.addOrUpdateToCartError - The error for adding or updating to cart
 * @param {Function} props.onAddOrUpdateToCart - The function to add or update to cart
 * @returns {JSX.Element}
 */

const createInitialValues = (
  cart,
  authorId,
  listingId,
  timeZone,
  defaultDeliveryAddress,
  shippingEnabled,
  pickupEnabled,
  currentStock
) => {
  let initialValues = {};

  if (currentStock === 0) {
    return {};
  }
  const authorCart = cart[authorId];
  if (defaultDeliveryAddress) {
    initialValues.shippingAddress = {
      search: defaultDeliveryAddress?.address,
      selectedPlace: {
        address: defaultDeliveryAddress?.address,
        origin: new LatLng(
          defaultDeliveryAddress?.origin?.lat,
          defaultDeliveryAddress?.origin?.lng
        ),
      },
    };
  }

  Object.entries(authorCart || {}).forEach(([deliveryMethod, cartListing]) => {
    if (cartListing.listings[listingId]) {
      initialValues.quantity = cartListing.listings[listingId].quantity;
      initialValues.deliveryMethod = deliveryMethod;
    }

    const hasDeliveryDetails = !isEmpty(cartListing.deliveryDetails);
    if (hasDeliveryDetails) {
      initialValues = {
        ...initialValues,
        ...cartListing.deliveryDetails,
        shippingAddress: {
          search: cartListing.deliveryDetails.shippingAddress.address,
          selectedPlace: {
            address: cartListing.deliveryDetails.shippingAddress.address,
            origin: new LatLng(
              cartListing.deliveryDetails.shippingAddress.origin.lat,
              cartListing.deliveryDetails.shippingAddress.origin.lng
            ),
          },
        },
      };
    }
  });

  initialValues = {
    ...initialValues,
    ...(shippingEnabled && !pickupEnabled ? { deliveryMethod: 'shipping' } : {}),
    ...(pickupEnabled && !shippingEnabled ? { deliveryMethod: 'pickup' } : {}),
  };
  return initialValues;
};

const ProductOrderForm = props => {
  const intl = useIntl();
  const {
    cart,
    authorId,
    listingId,
    storeTimeZone,
    defaultDeliveryAddress,
    shippingEnabled,
    pickupEnabled,
    currentStock,
  } = props;

  const initialValuesWithDefaultDeliveryAddress = createInitialValues(
    cart,
    authorId.uuid,
    listingId.uuid,
    storeTimeZone,
    defaultDeliveryAddress,
    shippingEnabled,
    pickupEnabled,
    currentStock
  );

  const initialValues = useMemo(() => {
    return {
      quantity: currentStock > 0 ? 1 : 0,
      ...initialValuesWithDefaultDeliveryAddress,
    };
  }, [JSON.stringify(initialValuesWithDefaultDeliveryAddress), currentStock]);

  return (
    <FinalForm
      initialValues={initialValues}
      keepDirtyOnReinitialize
      {...props}
      intl={intl}
      render={renderForm}
    />
  );
};

export default ProductOrderForm;
