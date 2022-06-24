require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-solhint');
require('hardhat-gas-reporter');
// require('hardhat-contract-sizer')
const { task } = require('hardhat/config');
require('dotenv').config();
require('./tasks/tasks');

module.exports = {
  networks: {
    hardhat: {
      accounts: {
        count: 5,
      },
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
        blockNumber: 14997900,
      },
    },
  },
  contractSizer: {
    runOnCompile: true,
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
