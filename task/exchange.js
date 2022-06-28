require('../utils.js').imports();

task('exchange').setAction(async () => {
  const accounts = await ethers.getSigners();
  let factory = await get('factory');
  if (factory)
    factory = await ethers.getContractAt('Factory', factory, accounts[0]);
  else {
    factory = await (
      await ethers.getContractFactory('Factory', accounts[0])
    ).deploy();
    await factory.deployed();
    await set('factory', factory.address);
    log(`Factory Deployed @ ${factory.address}`);
  }
  return factory;
});

task('sell')
  .addPositionalParam('bond')
  .addPositionalParam('bondAmount')
  .addPositionalParam('wtonAmount')
  .addPositionalParam('user')
  .setAction(async (args) => {
    const maker = getUser(args.user);
    // address owner; // 주문 소유자
    //     uint256 bond; // TBOND 번호
    //     uint256 bondAmount; // 매도 TBOND 수량
    //     uint256 wtonAmount; // 매수 TON 토큰 수량
    //     uint256 nonce; // 재사용 방지 nonce
    //     uint256 deadline; // 주문 만료 기준
    Order = {
      owner: maker.address,
      bond: args.bond,
      bondAmount: args.bondAmount,
      wtonAmount: args.wtonAmount,
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
