const utils = {
	ABI:[
		'function transfer(address, uint) returns (bool)',
		'function balanceOf(address) view returns (uint)',
		'function approve(address, uint256) returns (bool)',
		'function owner() view returns (address)',
		'function transferOwnership(address)',
		'function isMinter(address) view returns (bool)',
		'function mint(address, uint256) returns (bool)',
		'function swapFromTON(uint256 tonAmount) public returns (bool)',
		'function swapFromTONAndTransfer(address, uint256) returns (bool)',
		'function depositBoth(uint256, uint256)',
		'function depositWTON(uint256)',
		'function depositTON(uint256)'
	],
	TON:'0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
	WTON:'0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2',
	LAYER2:'0x42ccf0769e87cb2952634f607df1c7d62e0bbc52',
	SeigManager:'0x710936500ac59e8551331871cbad3d33d5e0d909',
	StakeRegistry:'0x4Fa71D6964a97c043CA3103407e1B3CD6b5Ab367',
  start_impersonate:async addr => {
		await hre.network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [addr]
		})
	},
	stop_impersonate:async addr => {
		await hre.network.provider.request({
			method: 'hardhat_stopImpersonatingAccount',
			params: [addr]
		})
	},
	set:(k, v) => {
		if (hre.config.tbond == undefined) hre.config.tbond = {}
		hre.config.tbond[k] = v
	},
	get:k => hre.config.tbond[k],
	log:msg => console.log(msg ? msg : ''),
	key:n => ethers.utils.id(`TBOND-${n}`),
	parseTon:v => ethers.utils.parseEther(typeof(v) == 'string' ? v : BigInt(v).toString()),
	fromTon:v => ethers.utils.formatEther(typeof(v) == 'string' ? v : BigInt(v).toString())
}

const imports = () => Object.keys(utils).forEach(id => global[id] = utils[id])
module.exports = { imports }