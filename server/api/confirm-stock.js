const { handleError, getTrustedSdk, serialize } = require('../api-util/sdk');
const { updateStockReservationTransactions } = require('../api-util/transactionHelpers');
const { denormalisedResponseEntities } = require('../api-util/format');

module.exports = async (req, res) => {
  try {
    const { txId } = req.body;
    const sdk = await getTrustedSdk(req);
    const tx = await sdk.transactions.show({ id: txId, include: ['listing'] });
    const confirmedTx = await updateStockReservationTransactions({
      tx: denormalisedResponseEntities(tx)[0],
      sdk,
    });
    res
      .status(200)
      .set('Content-Type', 'application/transit+json')
      .send(
        serialize({
          status: 200,
          statusText: 'Stock confirmed',
          data: confirmedTx,
        })
      )
      .end();
  } catch (error) {
    handleError(res, error);
  }
};
