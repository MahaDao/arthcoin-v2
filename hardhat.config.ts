import 'solidity-coverage';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-web3';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';

require('dotenv').config();

export default {
  default: 'mainnet',
  networks: {
    hardhat: {},
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.METAMASK_WALLET_SECRET],
      gasMultiplier: 1.2,
      gasPrice: 100000000000,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.METAMASK_WALLET_SECRET],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.METAMASK_WALLET_SECRET],
    },
    matic: {
      url:
        'https://apis.ankr.com/0aa7b5a6761f4b87ae97c6b718d900ff/0a39ba8bf2c40d99b20fea4372ebaa68/polygon/full/main',
      accounts: [process.env.METAMASK_WALLET_SECRET],
      gasPrice: 50 * 1000000000, // 5.1 gwei
    },
    maticMumbai: {
      url: 'https://matic-mumbai.chainstacklabs.com',
      accounts: [process.env.METAMASK_WALLET_SECRET],
    },
    development: {
      url: 'http://localhost:8545',
      accounts: [process.env.METAMASK_WALLET_SECRET],
    },
  },
  solidity: {
    version: '0.8.0',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './build/cache',
    artifacts: './build/artifacts',
  },
  gasReporter: {
    currency: 'USD',
    enabled: true,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
