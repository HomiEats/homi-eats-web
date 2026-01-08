import classNames from 'classnames';
import { FormattedMessage } from '../../util/reactIntl';
import css from './ProductAvailabilityBadge.module.css';

const ProductAvailabilityBadge = ({ isNotAvailable, preparationHours, className }) => {
  return (
    <div className={classNames(css.root, className)}>
      {isNotAvailable ? (
        <FormattedMessage id="OrderPanel.notAvailableForSale" values={{ preparationHours }} />
      ) : (
        <FormattedMessage id="OrderPanel.availableForSale" />
      )}
    </div>
  );
};

export default ProductAvailabilityBadge;
