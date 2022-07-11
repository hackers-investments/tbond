require('../utils.js').imports();

const domain = (exchange) => ({
  name: 'TBond Exchange',
  version: '1.0',
  chainId: ethers.provider._network.chainId,
  verifyingContract: exchange.address,
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
      exchange = await ethers.getContractAt('Exchange', exchange, user);
    else {
      exchange = await (
        await ethers.getContractFactory('Exchange', user)
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
    // 채권 밸런스 체크 같은 것은 프론트에서 제대로 구현하자!
    const maker = await getUser(args.user);
    const bond = await getBond(args.bond, maker);
    const exchange = await run('exchange', { user: args.user });
    await bond.increaseAllowance(exchange.address, parseTon(args.bondAmount));
    order = {
      owner: maker.address,
      bond: args.bond,
      bondAmount: parseTon(args.bondAmount).toString(),
      wtonAmount: parsewTon(args.wtonAmount).toString(),
      nonce: await nonce(maker.address),
      deadline: parseInt(args.deadline) + new Date().getTime(),
    };
    const sign = getSign(
      await maker._signTypedData(domain(exchange), type, order)
    );
    let tradeData = await get('tradeData');
    if (tradeData) tradeData = JSON.parse(tradeData);
    else tradeData = [];
    tradeData.push({ order: order, sign: sign, user: args.user });
    await set('tradeData', JSON.stringify(tradeData));
    await run('auction');
  });

task('auction').setAction(async () => {
  let tradeData = await get('tradeData');
  if (tradeData) tradeData = JSON.parse(tradeData);
  else tradeData = [];
  for (let i in tradeData) {
    log(`Order Number ${i}`);
    log(`Maker : ${tradeData[i].order.owner}`);
    log(`Bond : TBOND-${tradeData[i].order.bond}`);
    log(`Amount : ${fromTon(tradeData[i].order.bondAmount)}`);
    log(`Price : ${fromwTon(tradeData[i].order.wtonAmount)}`);
    log(`End : ${tradeData[i].order.deadline}`);
    log(`Sign : ${tradeData[i].sign}`);
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
    const data = tradeData[parseInt(args.order)];
    if (!data) return log('Order not found!');
    const order = data.order;
    const proof = keccak256()(
      abiCoder().encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [
          taker.address,
          order.bond,
          order.bondAmount,
          order.wtonAmount,
          order.deadline,
          order.nonce,
        ]
      )
    );
    const wton = await getContract(WTON, taker);
    await wton.increaseAllowance(exchange.address, order.wtonAmount);
    await exchange.executeOrder(order, data.sign, proof);
    await set(
      'tradeData',
      JSON.stringify(tradeData.filter((x) => x.sign != data.sign))
    );
  });

task('cancel')
  .addPositionalParam('order')
  .setAction(async (args) => {
    // 거래 데이터 유무 등 검증은 프론트에서 하자!
    let tradeData = await get('tradeData');
    if (tradeData) tradeData = JSON.parse(tradeData);
    else tradeData = [];
    const data = tradeData[parseInt(args.order)];
    if (!data) return log('Order not found!');
    const order = data.order;
    const exchange = await run('exchange', { user: data.user });
    const maker = await getUser(data.user);
    const bond = await getBond(order.bond, maker);
    await bond.decreaseAllowance(exchange.address, order.bondAmount);
    await nonce(order.owner);
    await exchange.cancelOrder(order, data.sign);
    await set(
      'tradeData',
      JSON.stringify(tradeData.filter((x) => x.sign != data.sign))
    );
    log(`Cancel order #${args.order}!`);
    await run('auction');
  });
