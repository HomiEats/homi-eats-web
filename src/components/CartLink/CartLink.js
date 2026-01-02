import React from 'react';
import { IconCart, NamedLink } from '../../components';
import css from './CartLink.module.css';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { getCartCount } from '../../util/cart';

const PAGE_HAS_FIXED_ACTION_BAR = ['ListingPage', 'OrderDetailsPage', 'SaleDetailsPage'];

const CartLink = ({ resolvedCurrentPage, className }) => {
  const { cart } = useSelector(state => state.cart);
  const cartCount = getCartCount(cart);
  const notificationDot = cartCount > 0 ? <div className={css.cartBadge}>{cartCount}</div> : null;
  const cartLinkClassName = classNames(css.cartLink, className, {
    [css.cartLinkFixedActionBar]: PAGE_HAS_FIXED_ACTION_BAR.includes(resolvedCurrentPage),
  });

  return (
    <NamedLink className={cartLinkClassName} name="CartPage">
      <span className={css.cartLinkLabel}>
        <IconCart className={css.cartIcon} />
        {notificationDot}
      </span>
    </NamedLink>
  );
};

export default CartLink;
