const TON = '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5'
const tonOwn = '0xDD9f0cCc044B0781289Ee318e5971b0139602C26'
const WTON = '0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2'
const wtonOwn = '0xe2bf5fda522f11b23db0eb0e871bbba78cf02f3a'
const ABI = [
  'function transfer(address, uint) returns (bool)',
  'function balanceOf(address) view returns (uint)',
  'function owner() public view returns (address)',
  'function transferOwnership(address)'
]
task('sehan', 'fuck').setAction(async () => {
  // const [admin, user1, user2] = await Promise.all(hre.config.networks.hardhat.addresses.map(x => ethers.getSigner(x)))
  const [admin, user1, user2] = await ethers.getSigners()
  // var tx = await admin.sendTransaction({to: TON, value: ethers.utils.parseEther('1')})
  // await admin.sendTransaction({to: tonOwn, value: ethers.utils.parseEther('100')})
  // await admin.sendTransaction({to: wtonOwn, value: ethers.utils.parseEther('100')})
  await network.provider.send('hardhat_setBalance', [tonOwn, '0x100000000000000000'])
  // await hre.network.provider.request({
  //   method: 'hardhat_impersonateAccount',
  //   params: [tonOwn],
  // })
  tonAcc = await ethers.getSigner(tonOwn)
  // console.log(await tonAcc.getBalance())
  var tonContract = new ethers.Contract(TON, ABI, tonAcc)
  await tonContract.transferOwnership(admin.address)
  var tonContract = new ethers.Contract(TON, ABI, admin)
  console.log(await tonContract.owner())
  // console.log(await tonContract.balanceOf(TON))
  // await hre.network.provider.request({
  //   method: 'hardhat_stopImpersonatingAccount',
  // })
  // wtonAcc = await ethers.getSigner(WTON)
})