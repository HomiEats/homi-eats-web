import React from 'react';
import classNames from 'classnames';

import css from './IconCart.module.css';

/**
 * Banned icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @returns {JSX.Element} SVG icon
 */
const IconCart = props => {
  const { className } = props;
  const classes = classNames(css.root, className);
  return (
    <svg
      className={classes}
      width="24px"
      height="24px"
      viewBox="0 0 32 32"
      id="i-cart"
      fill="none"
      stroke="currentcolor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{ fill: 'none', stroke: 'rgb(74, 74, 74)' }}
    >
      <path d="M6 6 L30 6 27 19 9 19 M27 23 L10 23 5 2 2 2"></path>
      <circle cx="25" cy="27" r="2"></circle>
      <circle cx="12" cy="27" r="2"></circle>
    </svg>
  );
};

export default IconCart;
