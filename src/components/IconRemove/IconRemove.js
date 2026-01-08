import React from 'react';
import classNames from 'classnames';

import css from './IconRemove.module.css';

/**
 * Remove icon
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @param {string?} props.rootClassName overwrite components own root class
 * @returns {JSX.Element} "remove" icon
 */
const IconRemove = props => {
  const { className, rootClassName, ...rest } = props;
  const classes = classNames(rootClassName || css.root, className);

  return (
    <svg {...rest} className={classes} width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"></path>
    </svg>
  );
};

export default IconRemove;
