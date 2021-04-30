const chalk = require('chalk');
const BigNumber = require('bignumber.js');

require('dotenv').config();
const helpers = require('./helpers');

const ARTHShares = artifacts.require("ARTHX/ARTHShares");
const Timelock = artifacts.require("Governance/Timelock");
const ARTHStablecoin = artifacts.require("Arth/ARTHStablecoin");
const ARTHController = artifacts.require("Arth/ArthController");
const StakingRewards_ARTH_WETH = artifacts.require("Staking/Variants/Stake_ARTH_WETH.sol");
const StakingRewards_ARTH_USDC = artifacts.require("Staking/Variants/Stake_ARTH_USDC.sol");
const StakingRewards_ARTH_ARTHX = artifacts.require("Staking/Variants/Stake_ARTH_ARTHX.sol");
const StakingRewards_ARTHX_WETH = artifacts.require("Staking/Variants/Stake_ARTHX_WETH.sol");
const StakingRewards_ARTHX = artifacts.require("Staking/Variants/Stake_ARTHX.sol");
const StakingRewards_ARTH_MAHA = artifacts.require("Staking/Variants/Stake_ARTH_MAHA.sol");
const StakingRewards_MAHA_WETH = artifacts.require("Staking/Variants/Stake_MAHA_WETH.sol");
//const StakingRewards_ARTHX_WETH = artifacts.require("Staking/Variants/Stake_ARTHX_WETH.sol");


module.exports = async function (deployer, network, accounts) {
  const DEPLOYER_ADDRESS = accounts[0];
  const ONE_HUNDRED_MILLION = new BigNumber("100000000e6");

  const arthxInstance = await ARTHShares.deployed();
  const timelockInstance = await Timelock.deployed();
  const arthInstance = await ARTHStablecoin.deployed();
  const arthControllerInstance = await ARTHController.deployed();
  const uniswapFactoryInstance = await helpers.getUniswapFactory(network, deployer, artifacts);
  const wethInstance = await helpers.getWETH(network, deployer, artifacts, DEPLOYER_ADDRESS);
  const col_instance_USDC = await helpers.getUSDC(network, deployer, artifacts, DEPLOYER_ADDRESS, ONE_HUNDRED_MILLION, 'USDC', 6);
  const col_instance_MAHA = await helpers.getMahaToken(network, deployer, artifacts, DEPLOYER_ADDRESS, ONE_HUNDRED_MILLION, 'MAHA', 6);

  console.log(chalk.yellow('\nGetting created uniswap pair addresses...'));
  const pair_addr_ARTH_WETH = await uniswapFactoryInstance.getPair(arthInstance.address, wethInstance.address, { from: DEPLOYER_ADDRESS });
  const pair_addr_ARTH_ARTHX = await uniswapFactoryInstance.getPair(arthInstance.address, arthxInstance.address, { from: DEPLOYER_ADDRESS });
  const pair_addr_ARTHX_WETH = await uniswapFactoryInstance.getPair(arthxInstance.address, wethInstance.address, { from: DEPLOYER_ADDRESS });
  const pair_addr_ARTH_USDC = await uniswapFactoryInstance.getPair(arthInstance.address, col_instance_USDC.address, { from: DEPLOYER_ADDRESS });
  const pair_addr_ARTH_MAHA = await uniswapFactoryInstance.getPair(arthInstance.address, col_instance_MAHA.address, { from: DEPLOYER_ADDRESS });
  //const pair_addr_ARTHX = await uniswapFactoryInstance.getPair(arthInstance.address, col_instance_USDC.address, { from: DEPLOYER_ADDRESS });
  const pair_addr_MAHA_WETH = await uniswapFactoryInstance.getPair(col_instance_MAHA.address, wethInstance.address, { from: DEPLOYER_ADDRESS });

  console.log(chalk.yellow('\nDeploying staking contracts...'));
  await Promise.all([
    deployer.deploy(
      StakingRewards_ARTH_WETH,
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS,
      col_instance_MAHA.address,
      pair_addr_ARTH_WETH,
      arthControllerInstance.address,
      timelockInstance.address,
      500000
    ),
    deployer.deploy(
      StakingRewards_ARTH_ARTHX,
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS,
      col_instance_MAHA.address,
      pair_addr_ARTH_ARTHX,
      arthControllerInstance.address,
      timelockInstance.address,
      0
    ),
    deployer.deploy(
      StakingRewards_ARTHX_WETH,
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS,
      col_instance_MAHA.address,
      pair_addr_ARTHX_WETH,
      arthControllerInstance.address,
      timelockInstance.address,
      0
    ),
    deployer.deploy(
      StakingRewards_MAHA_WETH,
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS,
      col_instance_MAHA.address,
      pair_addr_MAHA_WETH,
      arthControllerInstance.address,
      timelockInstance.address,
      0
    ),
    deployer.deploy(
      StakingRewards_ARTH_MAHA,
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS,
      col_instance_MAHA.address,
      pair_addr_ARTH_MAHA,
      arthControllerInstance.address,
      timelockInstance.address,
      0
    ),
    deployer.deploy(
      StakingRewards_ARTHX,
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS,
      col_instance_MAHA.address,
      arthxInstance.address,
      arthControllerInstance.address,
      timelockInstance.address,
      0
    )
  ]);

  const stakingInstance_ARTH_WETH = await StakingRewards_ARTH_WETH.deployed();
  //const stakingInstance_ARTH_USDC = await StakingRewards_ARTH_USDC.deployed();
  const stakingInstance_ARTH_ARTHX = await StakingRewards_ARTH_ARTHX.deployed();
  const stakingInstance_ARTHX_WETH = await StakingRewards_ARTHX_WETH.deployed();
  const stakingInstance_ARTHX = await StakingRewards_ARTHX_WETH.deployed();
  const stakingInstance_ARTH_MAHA = await StakingRewards_ARTHX_WETH.deployed();
  const stakingInstance_MAHA_WETH = await StakingRewards_ARTHX_WETH.deployed();


  console.log(chalk.yellow('\nTransfering ARTHX to staking contracts...'));
  await Promise.all([
    col_instance_MAHA.transfer(stakingInstance_ARTH_WETH.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS }),
    //arthxInstance.transfer(stakingInstance_ARTH_USDC.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS }),
    col_instance_MAHA.transfer(stakingInstance_ARTH_ARTHX.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS }),
    col_instance_MAHA.transfer(stakingInstance_ARTHX_WETH.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS }),
    col_instance_MAHA.transfer(stakingInstance_ARTHX.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS }),
    col_instance_MAHA.transfer(stakingInstance_ARTH_MAHA.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS }),
    col_instance_MAHA.transfer(stakingInstance_MAHA_WETH.address, ONE_HUNDRED_MILLION, { from: DEPLOYER_ADDRESS })
  ]);
};
