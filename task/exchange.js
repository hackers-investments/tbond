require('../utils.js').imports();

const domain = (ex) => ({
  name: 'TBOND Exchange',
  version: '1.0',
  chainId: ethers.provider._network.chainId,
  verifyingContract: ex.address,
});

const type = {
  Order: [
    { name: 'owner', type: 'address' },
    { name: 'bond', type: 'uint256' },
    { name: 'bondAmount', type: 'uint256' },
    { name: 'wtonAmount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

task('exchange').setAction(async () => {
  const admin = await getUser('admin');
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
    const bond = await getBond(args.bond);
    const maker = await getUser(args.user);
    const exchange = await run('exchange');
    await bond.approve(exchange.address, args.bondAmount);

    order = {
      owner: maker.address,
      bond: args.bond,
      bondAmount: args.bondAmount,
      wtonAmount: args.wtonAmount,
      nonce: (await exchange.nonces(maker.address)).toNumber(),
      deadline: args.deadline,
    };

    const sign = getSign(
      await maker._signTypedData(domain(exchange), type, order)
    );

    log({ order: order, sign: sign });

    let tradeData = await get('tradeData');
    if (tradeData) tradeData = JSON.parse(tradeData);
    else tradeData = {};
  });

task('buy')
  .addPositionalParam('bond')
  .addPositionalParam('user')
  .setAction(async (args) => {
    const maker = await getUser(args.user);
    const exchange = await run('exchange');
  });
