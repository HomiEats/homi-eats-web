import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import css from './FieldQuantity.module.css';

/**
 * Standalone quantity selector component for use in cart and other places
 *
 * @param {Object} props
 * @param {number} props.quantity - Current quantity value
 * @param {function} props.onQuantityChange - Callback when quantity changes
 * @param {number} props.maxQuantity - Maximum allowed quantity
 * @param {boolean} props.disabled - Whether the selector is disabled
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element}
 */
const QuantitySelector = ({
  quantity: quantityProp,
  onQuantityChange,
  maxQuantity,
  disabled = false,
  className,
}) => {
  const quantity = Number(quantityProp) || 0;
  const [localQuantity, setLocalQuantity] = useState(quantity);

  useEffect(() => {
    setLocalQuantity(quantityProp);
  }, [quantityProp]);

  const handleIncrement = () => {
    if (!disabled && (maxQuantity === undefined || localQuantity < maxQuantity)) {
      setLocalQuantity(localQuantity + 1);
      onQuantityChange(localQuantity + 1);
    }
  };

  const handleDecrement = () => {
    if (!disabled && localQuantity > 0) {
      setLocalQuantity(localQuantity - 1);
      onQuantityChange(localQuantity - 1);
    }
  };

  const handleInputChange = e => {
    const newValue = parseInt(e.target.value, 10) || 0;
    const clampedValue = Math.max(0, Math.min(newValue, maxQuantity || 999));
    setLocalQuantity(clampedValue);
    onQuantityChange(clampedValue);
  };

  const isIncrementDisabled =
    disabled || (maxQuantity !== undefined && localQuantity >= maxQuantity);
  const isDecrementDisabled = disabled || localQuantity <= 0;

  return (
    <div className={classNames(css.quantitySection, className)}>
      <button
        type="button"
        className={classNames(css.quantityButton, css.decrementButton, {
          [css.disabled]: isDecrementDisabled,
        })}
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
      >
        <span className={css.buttonText}>−</span>
      </button>

      <input
        id={`quantity`}
        name={`quantity`}
        type="text"
        value={localQuantity}
        onChange={handleInputChange}
        min={0}
        max={maxQuantity}
        className={css.quantityDisplay}
        disabled={disabled}
        aria-label={`Quantity`}
      />

      <button
        type="button"
        className={classNames(css.quantityButton, css.incrementButton, {
          [css.disabled]: isIncrementDisabled,
        })}
        onClick={handleIncrement}
        disabled={isIncrementDisabled}
        aria-label={`Increase quantity`}
      >
        <span className={css.buttonText}>+</span>
      </button>
    </div>
  );
};

export default QuantitySelector;
