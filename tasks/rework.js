require('./utils.js').imports()

task('rework').setAction(async () => {
  // step 1 setup accounts
  start_impersonate(WTON)
  start_impersonate(SeigManager)
  const [admin, user1, user2] = await ethers.getSigners()
  await network.provider.send('hardhat_setBalance', [WTON, '0x100000000000000000'])
  await network.provider.send('hardhat_setBalance', [SeigManager, '0x100000000000000000'])
  const ton = new ethers.Contract(TON, ABI, await ethers.getSigner(WTON))
  const wton = new ethers.Contract(WTON, ABI, await ethers.getSigner(SeigManager))
  await ton.mint(admin.address, parseTon(1000000))
  await ton.mint(user1.address, parseTon(1000000))
  await ton.mint(user2.address, parseTon(1000000))
  await wton.mint(admin.address, parseTon(1000000))
  await wton.mint(user1.address, parseTon(1000000))
  await wton.mint(user2.address, parseTon(1000000))
  log(`[1] Setup Accounts`)
  log(`admin`)
  log(`ton balance:${fromTon(await ton.balanceOf(admin.address))}`)
  log(`wton balance:${fromTon(await wton.balanceOf(admin.address))}`)
  log(`user1`)
  log(`ton balance:${fromTon(await ton.balanceOf(user1.address))}`)
  log(`wton balance:${fromTon(await wton.balanceOf(user1.address))}`)
  log(`user2`)
  log(`ton balance:${fromTon(await ton.balanceOf(user2.address))}`)
  log(`wton balance:${fromTon(await wton.balanceOf(user2.address))}`)
  log()

  // step 2 setup service
  const factory = await (await ethers.getContractFactory('TBondFactory', admin)).deploy()
  await factory.deployed()
  set('factory', factory.address)
  await factory.create(StakeRegistry)
  set('manager', await factory.tokens(key('1')))
  const manager = await ethers.getContractAt('TBondFundManager', get('manager'), admin)
  await ton.connect(admin).approve(get('manager'), parseTon(10000))
  await manager.setup(LAYER2, 100, 100, parseTon(10000))
  log(`[2] Setup Service`)
  log(`TBondFactory : ${get('factory')}`)
  log(`TBond-1 : ${get('manager')}`)
  log()

  // step 3 buy bond
  log(`[3] Buy Bond-1`)
  await ton.connect(user1).approve(get('manager'), parseTon(1000))
  await wton.connect(user1).approve(get('manager'), parseTon(1000))
  await manager.connect(user1).depositBoth(parseTon(1000), parseTon(1000))
  log(`user1 depositBoth(1000ton, 1000wton)`)
  await ton.connect(user2).approve(get('manager'), parseTon(2000))
  await wton.connect(user2).approve(get('manager'), parseTon(2000))
  await manager.connect(user2).depositTON(parseTon(2000))
  await manager.connect(user2).depositWTON(parseTon(2000))
  log(`user2 depositTON(2000ton)`)
  log(`user2 depositWTON(2000wton)`)
  log(`user1`)
  log(`ton balance:${fromTon(await ton.balanceOf(user1.address))}`)
  log(`wton balance:${fromTon(await wton.balanceOf(user1.address))}`)
  log(`user2`)
  log(`ton balance:${fromTon(await ton.balanceOf(user2.address))}`)
  log(`wton balance:${fromTon(await wton.balanceOf(user2.address))}`)
  // crazy exponential notation
  // log(`TBOND-1 balance:${}`)
  // log(parseTon(BitInt(await ton.balanceOf(get('manager'))) + BitInt(await ton.balanceOf(get('manager')))))
  log()

  // step 4 stake

  // step 5 unstake

  // step 6 withraw
})