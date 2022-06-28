require('../utils.js').imports();

task('sell')
  .addPositionalParam('bond')
  .addPositionalParam('bondAmount')
  .addPositionalParam('wtonAmount')
  .addPositionalParam('user')
  .setAction(async () => {
    Order = {
      owner: maker.address,
      key: key,
      amountSellToken: 1000,
      amountBuyToken: 1000,
      nonce: (await exchange.nonces(maker.address)).toNumber(),
    };

    signature = await maker._signTypedData(domain, types, makerOrder);
    const sig = parseSig(signature);
    makerSign = abiCoder.encode(
      ['uint8', 'bytes32', 'bytes32'],
      [sig.v, sig.r, sig.s]
    );
  });

task('buy')
  .addPositionalParam('bond')
  .addPositionalParam('bondAmount')
  .addPositionalParam('wtonAmount')
  .addPositionalParam('user')
  .setAction(async () => {
    //
  });
