require('../utils.js').imports();

task('exchange').setAction(async () => {
  const admin = getUser('admin');
  let exchange = await get('exchange');
  if (exchange)
    exchange = await ethers.getContractAt('Exchange2', exchange, admin);
  else {
    exchange = await (
      await ethers.getContractFactory('Exchange2', admin)
    ).deploy(await get('factory'), WTON);
    await exchange.deployed();
    await set('exchange', exchange.address);
    log(`Exchange Deployed @ ${exchange.address}`);
  }
  return exchange;
});

task('sell')
  .addPositionalParam('bond')
  .addPositionalParam('bondAmount')
  .addPositionalParam('wtonAmount')
  .addPositionalParam('deadline')
  .addPositionalParam('user')
  .setAction(async (args) => {
    const maker = getUser(args.user);
    // address owner; // 주문 소유자
    // uint256 bond; // TBOND 번호
    // uint256 bondAmount; // 매도 TBOND 수량
    // uint256 wtonAmount; // 매수 TON 토큰 수량
    // uint256 nonce; // 재사용 방지 nonce
    // uint256 deadline; // 주문 만료 기준
    Order = {
      owner: maker.address,
      bond: args.bond,
      bondAmount: args.bondAmount,
      wtonAmount: args.wtonAmount,
      nonce: (await exchange.nonces(maker.address)).toNumber(),
      deadline: args.deadline,
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
  .addPositionalParam('user')
  .setAction(async () => {
    //
  });
