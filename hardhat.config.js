require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-solhint');
require('hardhat-gas-reporter');
require('dotenv').config();
require('./task/bond');
require('./task/exchange');

module.exports = {
  networks: {
    hardhat: {
      accounts: {
        count: 5,
      },
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
        blockNumber: 15000000,
      },
	  chainId: 0x1337,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.15',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};
