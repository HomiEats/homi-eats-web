import { Field } from 'react-final-form';
import QuantitySelector from './QuantitySelector';
import classNames from 'classnames';
import css from './FieldQuantity.module.css';

const FieldQuantityComponent = ({
  input,
  label,
  id,
  showLabelAsDisabled,
  className,
  selectorClassName,
  ...rest
}) => {
  const classes = classNames(css.root, className);
  return (
    <div className={classes}>
      {label ? (
        <label
          htmlFor={id}
          className={classNames(css.label, {
            [css.labelDisabled]: showLabelAsDisabled,
          })}
        >
          {label}
        </label>
      ) : null}

      <QuantitySelector
        onQuantityChange={input.onChange}
        quantity={input.value}
        className={selectorClassName}
        {...rest}
      />
    </div>
  );
};

const FieldQuantity = props => {
  return <Field {...props} component={FieldQuantityComponent} />;
};

export default FieldQuantity;
