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

task('exchange')
  .addOptionalPositionalParam('user')
  .setAction(async (args) => {
    let user = await getUser('admin');
    if (args.user) user = await getUser(args.user);
    let exchange = await get('exchange');
    if (exchange)
      exchange = await ethers.getContractAt('Exchange2', exchange, user);
    else {
      exchange = await (
        await ethers.getContractFactory('Exchange2', user)
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
    const maker = await getUser(args.user);
    const bond = await getBond(args.bond, maker);
    const exchange = await run('exchange', { user: args.user });
    await bond.increaseAllowance(exchange.address, args.bondAmount);

    order = {
      owner: maker.address,
      bond: args.bond,
      bondAmount: args.bondAmount,
      wtonAmount: args.wtonAmount,
      nonce: (await exchange.nonces(maker.address)).toNumber(),
      deadline: args.deadline,
    };

    await exchange.updateNonce();

    const sign = getSign(
      await maker._signTypedData(domain(exchange), type, order)
    );
    let tradeData = await get('tradeData');
    if (tradeData) tradeData = JSON.parse(tradeData);
    else tradeData = [];
    tradeData.push({ order: order, sign: sign });
    await set('tradeData', JSON.stringify(tradeData));
    await run('acution');
  });

task('auction').setAction(async () => {
  let tradeData = await get('tradeData');
  if (tradeData) tradeData = JSON.parse(tradeData);
  else tradeData = [];
  for (let i in tradeData) {
    log(`Order Number ${i}`);
    log(`Maker : ${tradeData[i].order.owner}`);
    log(`Bond : TBOND-${tradeData[i].order.bond}`);
    log(`Amount : ${tradeData[i].order.bondAmount}`);
    log(`Price : ${tradeData[i].order.wtonAmount} wton`);
    log(`End : ${tradeData[i].order.deadline}`);
    if (i != tradeData) log('='.repeat(51));
  }
});

task('buy')
  .addPositionalParam('order')
  .addPositionalParam('user')
  .setAction(async (args) => {
    let tradeData = await get('tradeData');
    if (tradeData) tradeData = JSON.parse(tradeData);
    else tradeData = [];
    const taker = await getUser(args.user);
    const exchange = await run('exchange', { user: args.user });
    order = tradeData[parseInt(args.order)];
    if (!order) return log('Order not found!');
    const wton = await getContract(WTON, taker);
    log(order);
  });
