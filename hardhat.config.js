require("@nomiclabs/hardhat-waffle");
// require('hardhat-contract-sizer');
const { task } = require("hardhat/config");

require('dotenv').config()
const path = require("path")

const INFURA_KEY = "";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  networks : {
    hardhat:{
      // accounts : account_balance_list,
      forking:{
        url: `https://mainnet.infura.io/v3/${INFURA_KEY}`
      }
    },
  },
  contractSizer:{
    runOnCompile: true
  },
  solidity: {
    compilers:[
      {
        version : "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
    ],
  },
  paths : {
    sources : path.join(__dirname,"./contracts")
  },
  mocha: {
    timeout : 50000
  }
};