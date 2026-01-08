import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { addOrUpdateToCart, removeAuthorWithDeliveryMethodFromCart } from '../ducks/cart.duck';

const useAddOrUpdateToCart = () => {
  const dispatch = useDispatch();
  const addOrUpdateToCartInProgressIds = useSelector(
    state => state.cart.addOrUpdateToCartInProgressIds,
    shallowEqual
  );
  const addOrUpdateToCartError = useSelector(
    state => state.cart.addOrUpdateToCartError,
    shallowEqual
  );

  const removeAuthorWithDeliveryMethodFromCartInProgressIds = useSelector(
    state => state.cart.removeAuthorWithDeliveryMethodFromCartInProgressIds,
    shallowEqual
  );
  const removeAuthorWithDeliveryMethodFromCartError = useSelector(
    state => state.cart.removeAuthorWithDeliveryMethodFromCartError,
    shallowEqual
  );

  const cart = useSelector(state => state.cart.cart, shallowEqual);

  const addOrUpdateToCartFunction = (
    authorId,
    listingId,
    deliveryMethod,
    quantity,
    deliveryDetails,
    shouldSaveDefaultDeliveryAddress
  ) =>
    dispatch(
      addOrUpdateToCart(
        authorId,
        listingId,
        deliveryMethod,
        quantity,
        deliveryDetails,
        shouldSaveDefaultDeliveryAddress
      )
    );

  const removeAuthorWithDeliveryMethodFromCartFunction = (authorId, deliveryMethod) =>
    dispatch(removeAuthorWithDeliveryMethodFromCart(authorId, deliveryMethod));

  return {
    addOrUpdateToCart: addOrUpdateToCartFunction,
    addOrUpdateToCartInProgress: addOrUpdateToCartInProgressIds.length > 0,
    addOrUpdateToCartError,
    addOrUpdateToCartInProgressIds,
    cart,
    removeAuthorWithDeliveryMethodFromCart: removeAuthorWithDeliveryMethodFromCartFunction,
    removeAuthorWithDeliveryMethodFromCartInProgress:
      removeAuthorWithDeliveryMethodFromCartInProgressIds.length > 0,
    removeAuthorWithDeliveryMethodFromCartError,
    removeAuthorWithDeliveryMethodFromCartInProgressIds,
  };
};

export default useAddOrUpdateToCart;
