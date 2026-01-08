import React from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { createSlug } from '../../util/urlHelpers';
import { formatMoney } from '../../util/currency';

import { AvatarMedium, H4, H6, NamedLink, ResponsiveImage } from '../../components';

import css from './CheckoutPage.module.css';
import classNames from 'classnames';

const ListingCard = ({ listing, intl, quantity }) => {
  const { price, title } = listing?.attributes || {};
  const firstImage = listing?.images[0];
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k =>
        ['default', 'scaled-small', 'listing-card'].includes(k)
      )
    : [];
  return (
    <div className={css.listingDetailsWrapper} key={`${listing?.id?.uuid}`}>
      <div className={css.listingDetails}>
        <ResponsiveImage
          rootClassName={css.listingImage}
          alt={title}
          image={firstImage}
          variants={variants}
        />
        <div className={css.listingDetailsText}>
          <NamedLink
            className={css.listingDetailsTextTitle}
            name="ListingPage"
            params={{ id: listing?.id?.uuid, slug: createSlug(title) }}
          >
            <H4 as="h5">{title}</H4>
          </NamedLink>
          <p className={css.listingDetailsTextQuantity}>x{quantity}</p>
        </div>
      </div>
      <div className={css.priceContainer}>
        <p className={css.price}>{formatMoney(intl, price)}</p>
      </div>
    </div>
  );
};

const RenderListings = ({ listings, intl, orderedProducts }) => {
  const ordererListings = orderedProducts.listings;
  return (
    <div className={css.listingsContainer}>
      {listings.map(listing => (
        <ListingCard
          listing={listing}
          quantity={ordererListings?.[listing.id.uuid]?.quantity || 0}
          key={`${listing?.id?.uuid}`}
          intl={intl}
        />
      ))}
    </div>
  );
};

const CartDetailsSideCard = props => {
  const {
    listings,
    author,
    speculateTransactionErrorMessage,
    processName,
    breakdown,
    className,
    intl,
    orderedProducts,
  } = props;

  return (
    <div className={classNames(css.detailsContainer, className)}>
      <h4 className={css.detailsHeading}>
        <FormattedMessage id="CheckoutPage.orderSummary" />
      </h4>
      <div className={css.authorDetailsWrapper}>
        <div className={classNames(css.avatarWrapper)}>
          <AvatarMedium user={author} disableProfileLink />
          <p className={css.authorName}>
            <FormattedMessage id="CheckoutPage.orderFrom" />
            <NamedLink name="ProfilePage" params={{ id: author?.id?.uuid }}>
              {author?.attributes?.profile?.displayName}
            </NamedLink>
          </p>
        </div>

        {speculateTransactionErrorMessage}
      </div>
      {orderedProducts && (
        <RenderListings listings={listings} intl={intl} orderedProducts={orderedProducts} />
      )}

      {!!breakdown ? (
        <div className={css.orderBreakdownHeader}>
          <H6 as="h3" className={css.orderBreakdownTitle}>
            <FormattedMessage id={`CheckoutPage.${processName}.orderBreakdown`} />
          </H6>
          <hr className={css.totalDivider} />
        </div>
      ) : null}
      {breakdown}
    </div>
  );
};

export default CartDetailsSideCard;
