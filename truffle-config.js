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
    rinkeby: {
      provider: function () {
        return new HDWalletProvider(
          [process.env.METAMASK_WALLET_SECRET],
          'https://bitter-twilight-moon.quiknode.io/a7bc771b-a15c-49a6-9e23-a1106f86b2db/g9PahkWuM3pjJMRqNA39cUyZpov8PMSH5MbcKSJs4zrqyGwEsuUajCGSpWmFbvVU7HboSbF6lauR38Y0Zyr8NQ==/'
        )
      },
      network_id: 4,
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
