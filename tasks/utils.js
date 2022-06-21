const utils = {
	ABI:[
		'function transfer(address, uint) returns (bool)',
		'function balanceOf(address) view returns (uint)',
		'function owner() view returns (address)',
		'function transferOwnership(address)',
		'function isMinter(address) view returns (bool)',
		'function mint(address, uint256) returns (bool)',
		'function swapFromTON(uint256 tonAmount) public returns (bool)',
		'function swapFromTONAndTransfer(address, uint256) returns (bool)',
		'function approve(address, uint256) returns (bool)'
	],
	TON:'0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
	WTON:'0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2',
	MGR:'0x710936500ac59e8551331871cbad3d33d5e0d909',
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
	}
}

const imports = () => Object.keys(utils).forEach(id => global[id] = utils[id])
module.exports = { imports }