import React, { useCallback } from 'react';
import {
  Avatar,
  Button,
  H3,
  H5,
  IconDeliveryCar,
  IconLocation,
  IconRemove,
  InlineTextButton,
  NamedLink,
  ResponsiveImage,
} from '../../../components';

import css from '../CartCard/CartCard.module.css';
import { useConfiguration } from '../../../context/configurationContext';
import { FormattedMessage, useIntl } from 'react-intl';
import { PriceMaybe } from '../../../components/OrderPanel/OrderPanel';
import QuantitySelector from '../../../components/FieldQuantity/QuantitySelector';
import { debounce } from 'lodash';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { createSlug } from '../../../util/urlHelpers';
import EstimatedCustomerBreakdownMaybe from '../../../components/OrderPanel/EstimatedCustomerBreakdownMaybe';
import { PURCHASE_PROCESS_NAME } from '../../../transactions/transaction';
import Spinner from '../../../components/IconSpinner/IconSpinner';

const { Money } = sdkTypes;

const DEBOUNCE_TIME = 500;

const getCategoryLabel = (categoryConfiguration, categoryLevel1) => {
  const category = categoryConfiguration.categories.find(c => c.id === categoryLevel1);
  return category?.name ?? categoryLevel1;
};

const CartCard = props => {
  const {
    cart,
    addOrUpdateToCart,
    addOrUpdateToCartInProgressIds,
    removeAuthorWithDeliveryMethodFromCart,
    removeAuthorWithDeliveryMethodFromCartInProgressIds,
    onProceedToCheckout,
    fetchLineItemsRequestIds,
  } = props;

  const config = useConfiguration();
  const intl = useIntl();

  const {
    authorId,
    storeName,
    address,
    deliveryMethod,
    listings,
    lineItems,
    deliveryDetails = {},
  } = cart;

  const { shippingAddress: deliveryShippingAddress, streetNo } = deliveryDetails;

  const isShipping = deliveryMethod === 'shipping';

  const shippingAddress = isShipping
    ? streetNo
      ? `${streetNo}, ${deliveryShippingAddress?.address}`
      : deliveryShippingAddress?.address
    : address;

  const author = listings[0]?.author;
  const title =
    storeName + ' - ' + deliveryMethod.charAt(0).toUpperCase() + deliveryMethod.slice(1);

  const debouncedRemoveAuthorWithDeliveryMethodFromCart = useCallback(
    debounce(removeAuthorWithDeliveryMethodFromCart, DEBOUNCE_TIME),
    [removeAuthorWithDeliveryMethodFromCart]
  );

  const onRemoveCartAuthor = () =>
    debouncedRemoveAuthorWithDeliveryMethodFromCart(authorId, deliveryMethod);
  const categoryConfiguration = config.categoryConfiguration;

  const debouncedAddOrUpdateToCart = useCallback(debounce(addOrUpdateToCart, DEBOUNCE_TIME), [
    addOrUpdateToCart,
  ]);

  const isRemoveAuthorWithDeliveryMethodFromCartInProgress = removeAuthorWithDeliveryMethodFromCartInProgressIds.includes(
    `${authorId}-${deliveryMethod}`
  );

  const invalidQuantity = listings?.some(listing => {
    const { currentStock, quantity } = listing;
    return (currentStock?.attributes?.quantity ?? 0) < quantity;
  });

  return (
    <div className={css.cardLayout}>
      <div className={css.cardHeader}>
        <div className={css.cardTitle}>
          <Avatar className={css.avatar} user={author} />
          <H3>{title}</H3>
          <InlineTextButton onClick={onRemoveCartAuthor}>
            {isRemoveAuthorWithDeliveryMethodFromCartInProgress ? (
              <Spinner />
            ) : (
              <IconRemove className={css.removeIcon} />
            )}
          </InlineTextButton>
        </div>
        <div className={css.storeInfo}>
          {shippingAddress && (
            <div className={css.storeInfoItem}>
              <div className={css.storeInfoItemIcon}>
                {isShipping ? (
                  <IconDeliveryCar className={css.deliveryCarIcon} />
                ) : (
                  <IconLocation className={css.iconLocation} />
                )}
              </div>
              <p>{shippingAddress}</p>
            </div>
          )}
        </div>
      </div>

      <div className={css.cartBody}>
        {listings.map(listing => {
          const { attributes, images, quantity, currentStock, id } = listing;
          const currentStockQuantity = currentStock?.attributes.quantity;
          const { title, price, publicData } = attributes;
          const { categoryLevel1 } = publicData;
          const firstImage = images[0];
          const variants = firstImage
            ? Object.keys(firstImage?.attributes?.variants).filter(k =>
                k.startsWith('listing-card')
              )
            : [];

          const onQuantityChange = value => {
            const listingId = id?.uuid;
            const authorId = author?.id?.uuid;

            debouncedAddOrUpdateToCart(authorId, listingId, deliveryMethod, Number(value));
          };
          const loadingId = `${authorId}-${deliveryMethod}-${id.uuid}`;
          const isLoading = addOrUpdateToCartInProgressIds.includes(loadingId);
          const isOutOfStock = currentStockQuantity === 0;
          const isInvalidQuantity = !!currentStockQuantity && currentStockQuantity < quantity;
          const categoryLabel = getCategoryLabel(categoryConfiguration, categoryLevel1);
          return (
            <div className={css.cartListing} key={id?.uuid}>
              <div className={css.sectionListingDetails}>
                <ResponsiveImage
                  rootClassName={css.listingImage}
                  alt={title}
                  image={firstImage}
                  variants={variants}
                />
                <div className={css.listingInfo}>
                  {categoryLabel && <span className={css.category}>{categoryLabel}</span>}
                  <NamedLink
                    name="ListingPage"
                    params={{ id: id.uuid, slug: createSlug(title) }}
                    className={css.listingTitle}
                  >
                    <H5>{title}</H5>
                  </NamedLink>
                  <div className={css.price}>
                    <PriceMaybe
                      price={price}
                      publicData={publicData}
                      validListingTypes={config.listing.listingTypes}
                      intl={intl}
                      marketplaceCurrency={config.currency}
                      additionalText={'each'}
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className={css.sectionListingPrice}>
                  {!isOutOfStock && (
                    <>
                      <QuantitySelector
                        onQuantityChange={onQuantityChange}
                        quantity={quantity}
                        maxQuantity={currentStockQuantity}
                        className={css.quantityField}
                      />
                      <PriceMaybe
                        price={new Money(price.amount * quantity, config.currency)}
                        publicData={publicData}
                        validListingTypes={config.listing.listingTypes}
                        intl={intl}
                        marketplaceCurrency={config.currency}
                      />
                    </>
                  )}
                  <InlineTextButton onClick={() => onQuantityChange(0)}>
                    {isLoading ? <Spinner /> : <IconRemove className={css.removeIcon} />}
                  </InlineTextButton>
                </div>
                {isOutOfStock || isInvalidQuantity ? (
                  <div className={css.errorMessage}>
                    {intl.formatMessage(
                      {
                        id: isInvalidQuantity ? 'CartCard.invalidQuantity' : 'CartCard.outOfStock',
                      },
                      {
                        quantity: currentStockQuantity,
                      }
                    )}
                  </div>
                ) : (
                  <></>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {fetchLineItemsRequestIds.includes(`${authorId}_${deliveryMethod}`) ? (
        <div className={css.loading}>
          <Spinner />
        </div>
      ) : (
        <EstimatedCustomerBreakdownMaybe
          hideUnitLineItem
          lineItems={lineItems}
          currency={config.currency}
          marketplaceName={config.marketplaceName}
          processName={PURCHASE_PROCESS_NAME}
        />
      )}
      <Button
        disabled={invalidQuantity}
        className={css.proceedCheckoutButton}
        onClick={onProceedToCheckout}
      >
        {intl.formatMessage({ id: 'CartCard.proceedCheckout' })}
      </Button>
    </div>
  );
};

export default CartCard;
