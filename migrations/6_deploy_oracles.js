const BigNumber = require('bignumber.js');
const chalk = require('chalk');
const helpers = require('./helpers');

const Timelock = artifacts.require("Governance/Timelock");
const ARTHController = artifacts.require("ArthController");
const BondingCurve = artifacts.require("BondingCurve");
const UniswapPairOracle_ARTH_ARTHX = artifacts.require("UniswapPairOracle_ARTH_ARTHX");
const UniswapPairOracle_ARTH_USDC = artifacts.require("UniswapPairOracle_ARTH_USDC");
const UniswapPairOracle_ARTH_MAHA = artifacts.require("UniswapPairOracle_ARTH_MAHA");

module.exports = async function (deployer, network, accounts) {
  const DEPLOYER_ADDRESS = accounts[0];

  const arth = await helpers.getARTH(network, deployer, artifacts);
  const arthx = await helpers.getARTHX(network, deployer, artifacts);
  const maha = await helpers.getMahaToken(network, deployer, artifacts);
  const usdc = await helpers.getUSDC(network, deployer, artifacts);

  const timelockInstance = await Timelock.deployed();
  const uniswapFactoryInstance = await helpers.getUniswapFactory(network, deployer, artifacts);
  const arthController = await ARTHController.deployed();

  // todo: need to set this to use GMU oracles
  console.log(chalk.yellowBright('\nDeploying collateral oracles'));
  await helpers.getUSDCOracle(network, deployer, artifacts, DEPLOYER_ADDRESS);
  await helpers.getUSDTOracle(network, deployer, artifacts, DEPLOYER_ADDRESS);
  await helpers.getWBTCOracle(network, deployer, artifacts, DEPLOYER_ADDRESS);
  await helpers.getWMATICOracle(network, deployer, artifacts, DEPLOYER_ADDRESS);
  await helpers.getWETHOracle(network, deployer, artifacts, DEPLOYER_ADDRESS);

  console.log(chalk.yellow('- Deploying bonding curve'));
  await deployer.deploy(BondingCurve, new BigNumber('1300e6')); // Fixed price.

  console.log(chalk.yellow('- Linking genesis curve'));
  const bondingCurve = await BondingCurve.deployed();

  await arthController.setBondingCurve(bondingCurve.address);

  console.log(chalk.yellow('\nDeploying uniswap oracles...'));
  console.log(chalk.yellow(' - Deploying ARTH/MAHA oracle...'));
  await deployer.deploy(
    UniswapPairOracle_ARTH_MAHA,
    uniswapFactoryInstance.address,
    maha.address,
    arth.address,
    DEPLOYER_ADDRESS,
    timelockInstance.address
  );


  console.log(chalk.yellow('- Deploying ARTH/ARTHX oracles...'));
  await deployer.deploy(
    UniswapPairOracle_ARTH_ARTHX,
    uniswapFactoryInstance.address,
    arth.address,
    arthx.address,
    DEPLOYER_ADDRESS,
    timelockInstance.address
  );

  console.log(chalk.yellow('- Deploying ARTH/USDC oracles...'));
  await deployer.deploy(
    UniswapPairOracle_ARTH_USDC,
    uniswapFactoryInstance.address,
    arth.address,
    usdc.address,
    DEPLOYER_ADDRESS,
    timelockInstance.address
  );

  await helpers.getGMUOracle(network, deployer, artifacts);

  console.log(chalk.yellow('\nLinking ARTHX oracles...'));
  const oracleARTHXWETH = await UniswapPairOracle_ARTH_ARTHX.deployed();
  await arthController.setARTHXGMUOracle(oracleARTHXWETH.address, { from: DEPLOYER_ADDRESS });

  console.log(chalk.yellow('\nLinking MAHA oracles...'));
  const oracleMAHAARTH = await UniswapPairOracle_ARTH_MAHA.deployed();
  await arthController.setMAHAGMUOracle(oracleMAHAARTH.address, { from: DEPLOYER_ADDRESS });
};
