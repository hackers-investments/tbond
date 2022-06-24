const { task } = require('hardhat/config.js');

require('./utils.js').imports();

extendEnvironment((hre) => {
  hre.names = ['admin', 'user1', 'user2', 'user3', 'user4'];
});

task('setup').setAction(async () => {
  const accounts = await ethers.getSigners();
  start_impersonate(WTON);
  start_impersonate(SeigManager);
  for (const addr of accounts.map((x) => x.address).concat([WTON, SeigManager]))
    await setBalance(addr, 1000000);
  const ton = new ethers.Contract(TON, ABI, await ethers.getSigner(WTON));
  const wton = new ethers.Contract(
    WTON,
    ABI,
    await ethers.getSigner(SeigManager)
  );
  for (const addr of accounts.map((x) => x.address)) {
    await ton.mint(addr, parseTon(1000000));
    await wton.mint(addr, parsewTon(1000000));
  }
});

task('balance').setAction(async () => {
  const accounts = await ethers.getSigners();
  const ton = new ethers.Contract(TON, ABI, await ethers.getSigner(WTON));
  const wton = new ethers.Contract(
    WTON,
    ABI,
    await ethers.getSigner(SeigManager)
  );
  log('Account List');
  for (let i = 0; i < 5; i++) {
    let address = accounts[i].address;
    log(`[${hre.names[i]}]`);
    log(`ETH Balance:${fromEth(await getBalance(address))}`);
    log(`TON Balance:${fromTon(await ton.balanceOf(address))}`);
    log(`WTON Balance:${fromwTon(await wton.balanceOf(address))}`);
  }
});

task('deploy').setAction(async () => {
  const accounts = await ethers.getSigners();
  const factory = await (
    await ethers.getContractFactory('TBondFactory', accounts[0])
  ).deploy();
  await factory.deployed();
  log(factory.address);
  // set('factory', factory.address);
  // await factory.create(StakeRegistry);
  // set('manager', await factory.bonds(1));
  // const manager = await ethers.getContractAt(
  //   'TBondManager',
  //   get('manager'),
  //   admin
  // );
  // await ton.connect(admin).approve(get('manager'), parseTon(10000));
  // await manager.setup(100, 100, parseTon(10000));
  // log(`[2] Setup Service`);
  // log(`TBondFactory : ${get('factory')}`);
  // log(`TBond-1 : ${get('manager')}`);
  // log();
});

task('all').setAction(async () => {
  // step 1 setup accounts
  start_impersonate(WTON);
  start_impersonate(SeigManager);
  const [admin, user1, user2] = await ethers.getSigners();
  await network.provider.send('hardhat_setBalance', [
    WTON,
    hex(parseEth(10000)),
  ]);
  await network.provider.send('hardhat_setBalance', [
    SeigManager,
    hex(parseEth(10000)),
  ]);
  const ton = new ethers.Contract(TON, ABI, await ethers.getSigner(WTON));
  const wton = new ethers.Contract(
    WTON,
    ABI,
    await ethers.getSigner(SeigManager)
  );
  await ton.mint(admin.address, parseTon(1000000));
  await ton.mint(user1.address, parseTon(1000000));
  await ton.mint(user2.address, parseTon(1000000));
  await wton.mint(admin.address, parsewTon(1000000));
  await wton.mint(user1.address, parsewTon(1000000));
  await wton.mint(user2.address, parsewTon(1000000));
  log(`[1] Setup Accounts`);
  log(`admin`);
  log(`ton balance:${fromTon(await ton.balanceOf(admin.address))}`);
  log(`wton balance:${fromwTon(await wton.balanceOf(admin.address))}`);
  log(`user1`);
  log(`ton balance:${fromTon(await ton.balanceOf(user1.address))}`);
  log(`wton balance:${fromwTon(await wton.balanceOf(user1.address))}`);
  log(`user2`);
  log(`ton balance:${fromTon(await ton.balanceOf(user2.address))}`);
  log(`wton balance:${fromwTon(await wton.balanceOf(user2.address))}`);
  log();

  // // step 2 setup service
  const factory = await (
    await ethers.getContractFactory('TBondFactory', admin)
  ).deploy();
  await factory.deployed();
  set('factory', factory.address);
  await factory.create(StakeRegistry);
  set('manager', await factory.bonds(1));
  const manager = await ethers.getContractAt(
    'TBondManager',
    get('manager'),
    admin
  );
  await ton.connect(admin).approve(get('manager'), parseTon(10000));
  await manager.setup(100, 100, parseTon(10000), admin.address);
  log(`[2] Setup Service`);
  log(`TBondFactory : ${get('factory')}`);
  log(`TBond-1 : ${get('manager')}`);
  log();

  // // step 3 buy bond
  log(`[3] Buy Bond-1`);
  await ton.connect(user1).approve(get('manager'), parseTon(5000));
  await wton.connect(user1).approve(get('manager'), parsewTon(5000));
  await manager.connect(user1).depositBoth(parseTon(5000), parsewTon(5000));
  log(`user1 depositBoth(5000 ton, 5000 wton)`);
  await ton.connect(user2).approve(get('manager'), parseTon(2000));
  await wton.connect(user2).approve(get('manager'), parsewTon(2000));
  await manager.connect(user2).depositTON(parseTon(2000));
  await manager.connect(user2).depositWTON(parsewTon(2000));
  log(`user2 depositTON(2000 ton)`);
  log(`user2 depositWTON(2000 wton)`);
  log(`user1`);
  log(`ton balance:${fromTon(await ton.balanceOf(user1.address))}`);
  log(`wton balance:${fromwTon(await wton.balanceOf(user1.address))}`);
  log(`user2`);
  log(`ton balance:${fromTon(await ton.balanceOf(user2.address))}`);
  log(`wton balance:${fromwTon(await wton.balanceOf(user2.address))}`);
  let tonBalance = fromTon(await ton.balanceOf(get('manager')));
  let wtonBalance = fromwTon(await wton.balanceOf(get('manager')));
  log(`TBOND-1 balance:${sum(tonBalance, wtonBalance)}`);
  log();

  // // step 4 stake
  log(`[4] Stake TBOND-1`);
  mining(100);
  await manager.stake((overrides = { gasLimit: 10000000 }));
  tonBalance = fromTon(await ton.balanceOf(get('manager')));
  wtonBalance = fromwTon(await wton.balanceOf(get('manager')));
  log(`TBOND-1 balance:${sum(tonBalance, wtonBalance)}`);
  log();

  // // step 5 unstake
  log(`[5] Unstake & Withraw TBOND-1`);
  mining(100);
  await manager.unstake();
  mining(0x16b76);
  await manager.withdraw();
  tonBalance = fromTon(await ton.balanceOf(get('manager')));
  wtonBalance = fromwTon(await wton.balanceOf(get('manager')));
  log(`TBOND-1 balance:${sum(tonBalance, wtonBalance)}`);
  log();
  log(`incentive:${fromTon(await manager.incentive())}`);
  log(`exchangeRate:${fromTon(await manager.exchangeRate())}`);
});