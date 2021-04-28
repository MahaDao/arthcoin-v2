require('dotenv').config();
const HDWalletProvider = require("truffle-hdwallet-provider");


const providerFactory = () => {
  return new HDWalletProvider(
    process.env.METAMASK_WALLET_SECRET,
    process.env.NETWORK_ENDPOINT,
  );
};


module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545, // 7545
      network_id: "*",
    },
    mainnet: {
      // provider: providerFactory(),
      network_id: 1,
      gas: 8000000,
      gasPrice: 115000000000,  // 115 gwei,
    },
    ropsten: {
      provider: providerFactory(),
      network_id: 3,
      // gas: 8000000,  // Make sure this gas allocation isn't over 4M, which is the max
      // gasPrice: 30000000000,  // 30 gwei,
      skipDryRun: true
    },
    kovan: {
      provider: providerFactory(),
      network_id: 42,
      gas: 8000000,  // Make sure this gas allocation isn't over 4M, which is the max
      gasPrice: 30000000000,  // 30 gwei,
      skipDryRun: true
    },
    rinkeby: {
      provider: providerFactory(),
      network_id: 4,
      // gas: 8000000,
      skipDryRun: true  //  Sure this gas allocation isn't over 4M, which is the max
    }
  },
  compilers: {
    solc: {
      version: '0.8.0+commit.c7dfd78e',
      settings: {
        optimizer: {
          enabled: true,
          runs: 100000
        }
      }
    }
  },
  mocha: { useColors: true },
  plugins: ["truffle-contract-size", 'truffle-plugin-verify'],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  }
};
