require('@nomiclabs/hardhat-waffle')
require('hardhat-gas-reporter')
// require('hardhat-contract-sizer')
const { task } = require('hardhat/config')
require('dotenv').config()
require('./tasks/TBONDManager')

module.exports = {
  networks : {
    hardhat:{
      accounts:[
        {
          // admin
          privateKey:'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
          balance:'10000000000000000000000000'
        },
        {
          // user1
          privateKey:'0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // 0x70997970c51812dc3a010c7d01b50e0d17dc79c8
          balance:'10000000000000000000000000'
        },
        {
          // user2
          privateKey:'0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc
          balance:'10000000000000000000000000'
        }
      ],
      forking:{
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
        blocknumber: 14997900,
      }
    },
  },
  contractSizer:{
    runOnCompile: true
  },
  solidity: {
    compilers:[
      {
        version: '0.8.15',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
  },
}
