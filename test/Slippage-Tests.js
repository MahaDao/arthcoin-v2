const BigNumber = require('bignumber.js');
const util = require('util');
const chalk = require('chalk');
const Contract = require('web3-eth-contract');
const { expectRevert, time } = require('@openzeppelin/test-helpers');

// Set provider for all later instances to use
Contract.setProvider('http://127.0.0.1:7545');

global.artifacts = artifacts;
global.web3 = web3;

const Address = artifacts.require("Utils/Address");
const BlockMiner = artifacts.require("Utils/BlockMiner");
const Math = artifacts.require("Math/Math");
const SafeMath = artifacts.require("Math/SafeMath");
const Babylonian = artifacts.require("Math/Babylonian");
const FixedPoint = artifacts.require("Math/FixedPoint");
const UQ112x112 = artifacts.require("Math/UQ112x112");
const Owned = artifacts.require("Staking/Owned");
const ERC20 = artifacts.require("ERC20/ERC20");
const ERC20Custom = artifacts.require("ERC20/ERC20Custom");
const SafeERC20 = artifacts.require("ERC20/SafeERC20");

// Uniswap related
const TransferHelper = artifacts.require("Uniswap/TransferHelper");
const SwapToPrice = artifacts.require("Uniswap/SwapToPrice");
const UniswapV2ERC20 = artifacts.require("Uniswap/UniswapV2ERC20");
const UniswapV2Factory = artifacts.require("Uniswap/UniswapV2Factory");
const UniswapV2Library = artifacts.require("Uniswap/UniswapV2Library");
const UniswapV2OracleLibrary = artifacts.require("Uniswap/UniswapV2OracleLibrary");
const UniswapV2Pair = artifacts.require("Uniswap/UniswapV2Pair");
const UniswapV2Router02_Modified = artifacts.require("Uniswap/UniswapV2Router02_Modified");
const TestSwap = artifacts.require("Uniswap/TestSwap");

// Collateral
const WETH = artifacts.require("ERC20/WETH");
const FakeCollateral_USDC = artifacts.require("FakeCollateral/FakeCollateral_USDC");
const FakeCollateral_USDT = artifacts.require("FakeCollateral/FakeCollateral_USDT");
// const FakeCollateral_yUSD = artifacts.require("FakeCollateral/FakeCollateral_yUSD");

// Collateral Pools
const Pool_USDC = artifacts.require("Arth/Pools/Pool_USDC");
const Pool_USDT = artifacts.require("Arth/Pools/Pool_USDT");
// const Pool_yUSD = artifacts.require("Arth/Pools/Pool_yUSD");

// Oracles
const UniswapPairOracle_ARTH_WETH = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTH_WETH");
const UniswapPairOracle_ARTH_USDT = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTH_USDT");
const UniswapPairOracle_ARTH_USDC = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTH_USDC");
// const UniswapPairOracle_ARTH_yUSD = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTH_yUSD");
const UniswapPairOracle_ARTHS_WETH = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTHS_WETH");
const UniswapPairOracle_ARTHS_USDT = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTHS_USDT");
const UniswapPairOracle_ARTHS_USDC = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTHS_USDC");
// const UniswapPairOracle_ARTHS_yUSD = artifacts.require("Oracle/Variants/UniswapPairOracle_ARTHS_yUSD");
const UniswapPairOracle_USDT_WETH = artifacts.require("Oracle/Variants/UniswapPairOracle_USDT_WETH");
const UniswapPairOracle_USDC_WETH = artifacts.require("Oracle/Variants/UniswapPairOracle_USDC_WETH");

// Chainlink Price Consumer
//const ChainlinkETHUSDPriceConsumer = artifacts.require("Oracle/ChainlinkETHUSDPriceConsumer");
const ChainlinkETHUSDPriceConsumerTest = artifacts.require("Oracle/ChainlinkETHUSDPriceConsumerTest");

// ARTH core
const ARTHStablecoin = artifacts.require("Arth/ARTHStablecoin");
const ARTHShares = artifacts.require("ARTHX/ARTHShares");
const StakingRewards_ARTH_WETH = artifacts.require("Staking/Variants/Stake_ARTH_WETH.sol");
const StakingRewards_ARTH_USDC = artifacts.require("Staking/Variants/Stake_ARTH_USDC.sol");
const StakingRewards_ARTH_USDT = artifacts.require("Staking/Variants/Stake_ARTH_USDT.sol");
// const StakingRewards_ARTH_yUSD = artifacts.require("Staking/Variants/Stake_ARTH_yUSD.sol");
const StakingRewards_ARTHS_WETH = artifacts.require("Staking/Variants/Stake_ARTHS_WETH.sol");
const StakingRewards_ARTHS_USDC = artifacts.require("Staking/Variants/Stake_ARTHS_USDC.sol");
const StakingRewards_ARTHS_USDT = artifacts.require("Staking/Variants/Stake_ARTHS_USDT.sol");
// const StakingRewards_ARTHS_yUSD = artifacts.require("Staking/Variants/Stake_ARTHS_yUSD.sol");

// Governance related
const GovernorAlpha = artifacts.require("Governance/GovernorAlpha");
const Timelock = artifacts.require("Governance/Timelock");

const ONE_MILLION_DEC18 = new BigNumber(1000000e18);
const COLLATERAL_SEED_DEC18 = new BigNumber(508500e18);
const ONE_THOUSAND_DEC18 = new BigNumber(1000e18);
const THREE_THOUSAND_DEC18 = new BigNumber(3000e18);
const BIG6 = new BigNumber("1e6");
const BIG18 = new BigNumber("1e18");
const TIMELOCK_DELAY = 86400 * 2; // 2 days
const DUMP_ADDRESS = "0x6666666666666666666666666666666666666666";
const METAMASK_ADDRESS = "0x6A24A4EcA5Ed225CeaE6895e071a74344E2853F5";

const REWARDS_DURATION = 7 * 86400; // 7 days

let totalSupplyARTH;
let totalSupplyARTHS;
let globalCollateralRatio;
let globalCollateralValue;

contract('ARTH', async (accounts) => {
  // Constants
  let COLLATERAL_ARTH_AND_ARTHS_OWNER;
  let ORACLE_ADDRESS;
  let POOL_CREATOR;
  let TIMELOCK_ADMIN;
  let GOVERNOR_GUARDIAN_ADDRESS;
  let STAKING_OWNER;
  let STAKING_REWARDS_DISTRIBUTOR;
  // let COLLATERAL_ARTH_AND_ARTHS_OWNER;

  // Initialize core contract instances
  let arthInstance;
  let arthxInstance;

  // Initialize collateral instances
  let wethInstance;
  let col_instance_USDC;
  let col_instance_USDT;
  // let col_instance_yUSD;

  let TestSwap_instance;

  // Initialize the Uniswap Router Instance
  let routerInstance;

  // Initialize the Uniswap Factory Instance
  let factoryInstance;

  // Initialize the Uniswap Libraries
  let uniswapLibraryInstance;
  let uniswapOracleLibraryInstance;

  // Initialize the Timelock instance
  let timelockInstance;

  // Initialize the swap to price contract
  let swapToPriceInstance;

  // Initialize oracle instances
  let oracle_instance_ARTH_WETH;
  let oracle_instance_ARTH_USDC;
  let oracle_instance_ARTH_USDT;
  // let oracle_instance_ARTH_yUSD;
  let oracle_instance_ARTHS_WETH;
  let oracle_instance_ARTHS_USDC;
  let oracle_instance_ARTHS_USDT;
  // let oracle_instance_ARTHS_yUSD;

  // Initialize ETH-USD Chainlink Oracle too
  let oracle_chainlink_ETH_USD;

  // Initialize the governance contract
  let governanceInstance;

  // Initialize pool instances
  let pool_instance_USDC;
  let pool_instance_USDT;
  // let pool_instance_yUSD;

  // Initialize pair addresses
  let pair_addr_ARTH_WETH;
  let pair_addr_ARTH_USDC;
  let pair_addr_ARTH_USDT;
  // let pair_addr_ARTH_yUSD;
  let pair_addr_ARTHS_WETH;
  let pair_addr_ARTHS_USDC;
  let pair_addr_ARTHS_USDT;
  // let pair_addr_ARTHS_yUSD;

  // Initialize pair contracts
  let pair_instance_ARTH_WETH;
  let pair_instance_ARTH_USDC;
  let pair_instance_ARTH_USDT;
  // let pair_instance_ARTH_yUSD;
  let pair_instance_ARTHS_WETH;
  let pair_instance_ARTHS_USDC;
  let pair_instance_ARTHS_USDT;
  // let pair_instance_ARTHS_yUSD;

  // Initialize pair orders
  let artharthx_first_ARTH_WETH;
  let artharthx_first_ARTH_USDC;
  let artharthx_first_ARTH_USDT;
  // let artharthx_first_ARTH_yUSD;
  let artharthx_first_ARTHS_WETH;
  let artharthx_first_ARTHS_USDC;
  let artharthx_first_ARTHS_USDT;
  // let artharthx_first_ARTHS_yUSD;

  // Initialize staking instances
  let stakingInstance_ARTH_WETH;
  let stakingInstance_ARTH_USDC;
  let stakingInstance_ARTH_USDT;
  // let stakingInstance_ARTH_yUSD;
  let stakingInstance_ARTHS_WETH;
  let stakingInstance_ARTHS_USDC;
  let stakingInstance_ARTHS_USDT;
  // let stakingInstance_ARTHS_yUSD;

  // Initialize running balances
  let bal_arth = 0;
  let bal_arthx = 0;
  let col_bal_usdc = 0;
  let col_rat = 1;
  let pool_bal_usdc = 0;
  let global_collateral_value = 0;

  beforeEach(async () => {
    // Constants
    COLLATERAL_ARTH_AND_ARTHS_OWNER = accounts[1];
    ORACLE_ADDRESS = accounts[2];
    POOL_CREATOR = accounts[3];
    TIMELOCK_ADMIN = accounts[4];
    GOVERNOR_GUARDIAN_ADDRESS = accounts[5];
    STAKING_OWNER = accounts[6];
    STAKING_REWARDS_DISTRIBUTOR = accounts[7];
    // COLLATERAL_ARTH_AND_ARTHS_OWNER = accounts[8];

    // Fill core contract instances
    arthInstance = await ARTHStablecoin.deployed();
    arthxInstance = await ARTHShares.deployed();

    // Fill collateral instances
    wethInstance = await WETH.deployed();
    col_instance_USDC = await FakeCollateral_USDC.deployed();
    col_instance_USDT = await FakeCollateral_USDT.deployed();
    // col_instance_yUSD = await FakeCollateral_yUSD.deployed();

    TestSwap_instance = await TestSwap.deployed();

    // Fill the Uniswap Router Instance
    routerInstance = await UniswapV2Router02_Modified.deployed();

    // Fill the Timelock instance
    timelockInstance = await Timelock.deployed();

    // Fill oracle instances
    oracle_instance_ARTH_WETH = await UniswapPairOracle_ARTH_WETH.deployed();
    oracle_instance_ARTH_USDC = await UniswapPairOracle_ARTH_USDC.deployed();
    oracle_instance_ARTH_USDT = await UniswapPairOracle_ARTH_USDT.deployed();
    // oracle_instance_ARTH_yUSD = await UniswapPairOracle_ARTH_yUSD.deployed();
    oracle_instance_ARTHS_WETH = await UniswapPairOracle_ARTHS_WETH.deployed();
    oracle_instance_ARTHS_USDC = await UniswapPairOracle_ARTHS_USDC.deployed();
    oracle_instance_ARTHS_USDT = await UniswapPairOracle_ARTHS_USDT.deployed();
    // oracle_instance_ARTHS_yUSD = await UniswapPairOracle_ARTHS_yUSD.deployed();
    oracle_instance_USDT_WETH = await UniswapPairOracle_USDT_WETH.deployed();
    oracle_instance_USDC_WETH = await UniswapPairOracle_USDC_WETH.deployed();

    // Initialize ETH-USD Chainlink Oracle too
    //oracle_chainlink_ETH_USD = await ChainlinkETHUSDPriceConsumer.deployed();
    oracle_chainlink_ETH_USD = await ChainlinkETHUSDPriceConsumerTest.deployed();

    // Initialize the governance contract
    governanceInstance = await GovernorAlpha.deployed();

    // Fill pool instances
    pool_instance_USDC = await Pool_USDC.deployed();
    pool_instance_USDT = await Pool_USDT.deployed();
    // pool_instance_yUSD = await Pool_yUSD.deployed();

    // Initialize the Uniswap Factory Instance
    uniswapFactoryInstance = await UniswapV2Factory.deployed();

    // Initialize the Uniswap Libraries
    uniswapLibraryInstance = await UniswapV2OracleLibrary.deployed();
    uniswapOracleLibraryInstance = await UniswapV2Library.deployed();

    // Initialize the swap to price contract
    swapToPriceInstance = await SwapToPrice.deployed();

    // Get the addresses of the pairs
    pair_addr_ARTH_WETH = await uniswapFactoryInstance.getPair(arthInstance.address, WETH.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_ARTH_USDC = await uniswapFactoryInstance.getPair(arthInstance.address, FakeCollateral_USDC.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_ARTH_USDT = await uniswapFactoryInstance.getPair(arthInstance.address, FakeCollateral_USDT.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // pair_addr_ARTH_yUSD = await uniswapFactoryInstance.getPair(arthInstance.address, FakeCollateral_yUSD.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_ARTHS_WETH = await uniswapFactoryInstance.getPair(arthxInstance.address, WETH.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_ARTHS_USDC = await uniswapFactoryInstance.getPair(arthxInstance.address, FakeCollateral_USDC.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_ARTHS_USDT = await uniswapFactoryInstance.getPair(arthxInstance.address, FakeCollateral_USDT.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // pair_addr_ARTHS_yUSD = await uniswapFactoryInstance.getPair(arthxInstance.address, FakeCollateral_yUSD.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_USDT_WETH = await uniswapFactoryInstance.getPair(FakeCollateral_USDT.address, WETH.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    pair_addr_USDC_WETH = await uniswapFactoryInstance.getPair(FakeCollateral_USDC.address, WETH.address, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Get instances of the pairs
    pair_instance_ARTH_WETH = await UniswapV2Pair.at(pair_addr_ARTH_WETH);
    pair_instance_ARTH_USDC = await UniswapV2Pair.at(pair_addr_ARTH_USDC);
    pair_instance_ARTH_USDT = await UniswapV2Pair.at(pair_addr_ARTH_USDT);
    // pair_instance_ARTH_yUSD = await UniswapV2Pair.at(pair_addr_ARTH_yUSD);
    pair_instance_ARTHS_WETH = await UniswapV2Pair.at(pair_addr_ARTHS_WETH);
    pair_instance_ARTHS_USDC = await UniswapV2Pair.at(pair_addr_ARTHS_USDC);
    pair_instance_ARTHS_USDT = await UniswapV2Pair.at(pair_addr_ARTHS_USDT);
    // pair_instance_ARTHS_yUSD = await UniswapV2Pair.at(pair_addr_ARTHS_yUSD);
    pair_instance_USDT_WETH = await UniswapV2Pair.at(pair_addr_USDT_WETH);
    pair_instance_USDC_WETH = await UniswapV2Pair.at(pair_addr_USDC_WETH);

    // Get the pair order results
    artharthx_first_ARTH_WETH = await oracle_instance_ARTH_WETH.token0();
    artharthx_first_ARTH_USDC = await oracle_instance_ARTH_USDC.token0();
    artharthx_first_ARTH_USDT = await oracle_instance_ARTH_USDT.token0();
    // artharthx_first_ARTH_yUSD = await oracle_instance_ARTH_yUSD.token0();
    artharthx_first_ARTHS_WETH = await oracle_instance_ARTHS_WETH.token0();
    artharthx_first_ARTHS_USDC = await oracle_instance_ARTHS_USDC.token0();
    artharthx_first_ARTHS_USDT = await oracle_instance_ARTHS_USDT.token0();
    // artharthx_first_ARTHS_yUSD = await oracle_instance_ARTHS_yUSD.token0();

    artharthx_first_ARTH_WETH = arthInstance.address == artharthx_first_ARTH_WETH;
    artharthx_first_ARTH_USDC = arthInstance.address == artharthx_first_ARTH_USDC;
    artharthx_first_ARTH_USDT = arthInstance.address == artharthx_first_ARTH_USDT;
    // artharthx_first_ARTH_yUSD = arthInstance.address == artharthx_first_ARTH_yUSD;
    artharthx_first_ARTHS_WETH = arthxInstance.address == artharthx_first_ARTHS_WETH;
    artharthx_first_ARTHS_USDC = arthxInstance.address == artharthx_first_ARTHS_USDC;
    artharthx_first_ARTHS_USDT = arthxInstance.address == artharthx_first_ARTHS_USDT;
    // artharthx_first_ARTHS_yUSD = arthxInstance.address == artharthx_first_ARTHS_yUSD;

    // Fill the staking rewards instances
    stakingInstance_ARTH_WETH = await StakingRewards_ARTH_WETH.deployed();
    stakingInstance_ARTH_USDC = await StakingRewards_ARTH_USDC.deployed();
    stakingInstance_ARTH_USDT = await StakingRewards_ARTH_USDT.deployed();
    // stakingInstance_ARTH_yUSD = await StakingRewards_ARTH_yUSD.deployed();
    stakingInstance_ARTHS_WETH = await StakingRewards_ARTHS_WETH.deployed();
    stakingInstance_ARTHS_USDC = await StakingRewards_ARTHS_USDC.deployed();
    stakingInstance_ARTHS_USDT = await StakingRewards_ARTHS_USDT.deployed();
    // stakingInstance_ARTHS_yUSD = await StakingRewards_ARTHS_yUSD.deployed();
  });

  // INITIALIZATION
  // ================================================================
  it('Check up on the oracles and make sure the prices are set', async () => {
    // Advance 24 hrs so the period can be computed
    await time.increase(86400 + 1);
    await time.advanceBlock();

    // Make sure the prices are updated
    await oracle_instance_ARTH_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await oracle_instance_ARTH_USDC.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await oracle_instance_ARTH_USDT.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTH_yUSD.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await oracle_instance_ARTHS_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await oracle_instance_ARTHS_USDC.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await oracle_instance_ARTHS_USDT.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTHS_yUSD.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    await oracle_instance_USDT_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await oracle_instance_USDC_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Get the prices
    // Price is in collateral needed for 1 ARTH
    let arth_price_from_ARTH_WETH = (new BigNumber(await oracle_instance_ARTH_WETH.consult.call(wethInstance.address, 1e6))).div(BIG6).toNumber();
    let arth_price_from_ARTH_USDC = (new BigNumber(await oracle_instance_ARTH_USDC.consult.call(FakeCollateral_USDC.address, 1e6))).div(BIG6).toNumber();
    let arth_price_from_ARTH_USDT = (new BigNumber(await oracle_instance_ARTH_USDT.consult.call(FakeCollateral_USDT.address, 1e6))).div(BIG6).toNumber();
    // let arth_price_from_ARTH_yUSD = (new BigNumber(await oracle_instance_ARTH_yUSD.consult.call(FakeCollateral_yUSD.address, 1e6))).div(BIG6).toNumber();
    let arthx_price_from_ARTHS_WETH = (new BigNumber(await oracle_instance_ARTHS_WETH.consult.call(wethInstance.address, 1e6))).div(BIG6).toNumber();
    let arthx_price_from_ARTHS_USDC = (new BigNumber(await oracle_instance_ARTHS_USDC.consult.call(FakeCollateral_USDC.address, 1e6))).div(BIG6).toNumber();
    let arthx_price_from_ARTHS_USDT = (new BigNumber(await oracle_instance_ARTHS_USDT.consult.call(FakeCollateral_USDT.address, 1e6))).div(BIG6).toNumber();
    // let arthx_price_from_ARTHS_yUSD = (new BigNumber(await oracle_instance_ARTHS_yUSD.consult.call(FakeCollateral_yUSD.address, 1e6))).div(BIG6).toNumber();
    let USDT_price_from_USDT_WETH = (new BigNumber(await oracle_instance_USDT_WETH.consult.call(WETH.address, 1e6))).div(1e6).toNumber();
    let USDC_price_from_USDC_WETH = (new BigNumber(await oracle_instance_USDC_WETH.consult.call(WETH.address, 1e6))).div(1e6).toNumber();

    // Print the prices
    console.log("arth_price_from_ARTH_WETH: ", arth_price_from_ARTH_WETH.toString(), " ARTH = 1 WETH");
    console.log("arth_price_from_ARTH_USDC: ", arth_price_from_ARTH_USDC.toString(), " ARTH = 1 USDC");
    console.log("arth_price_from_ARTH_USDT: ", arth_price_from_ARTH_USDT.toString(), " ARTH = 1 USDT");
    // console.log("arth_price_from_ARTH_yUSD: ", arth_price_from_ARTH_yUSD.toString(), " ARTH = 1 yUSD");
    console.log("arthx_price_from_ARTHS_WETH: ", arthx_price_from_ARTHS_WETH.toString(), " ARTHX = 1 WETH");
    console.log("arthx_price_from_ARTHS_USDC: ", arthx_price_from_ARTHS_USDC.toString(), " ARTHX = 1 USDC");
    console.log("arthx_price_from_ARTHS_USDT: ", arthx_price_from_ARTHS_USDT.toString(), " ARTHX = 1 USDT");
    // console.log("arthx_price_from_ARTHS_yUSD: ", arthx_price_from_ARTHS_yUSD.toString(), " ARTHX = 1 yUSD");
    console.log("USDT_price_from_USDT_WETH: ", USDT_price_from_USDT_WETH.toString(), " USDT = 1 WETH");
    console.log("USDC_price_from_USDC_WETH: ", USDC_price_from_USDC_WETH.toString(), " USDC = 1 WETH");

    // Add allowances to the Uniswap Router
    await wethInstance.approve(routerInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await col_instance_USDC.approve(routerInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await col_instance_USDT.approve(routerInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await col_instance_yUSD.approve(routerInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await arthInstance.approve(routerInstance.address, new BigNumber(1000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await arthxInstance.approve(routerInstance.address, new BigNumber(5000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Add allowances to the swapToPrice contract
    await wethInstance.approve(swapToPriceInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await col_instance_USDC.approve(swapToPriceInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await col_instance_USDT.approve(swapToPriceInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await col_instance_yUSD.approve(swapToPriceInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await arthInstance.approve(swapToPriceInstance.address, new BigNumber(1000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await arthxInstance.approve(swapToPriceInstance.address, new BigNumber(5000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });


    // console.log("===============FIRST SWAPS===============");

    // //--- ARTH

    // // Handle ARTH / WETH
    // // Targeting 390.6 ARTH / 1 WETH
    // await swapToPriceInstance.swapToPrice(
    // 	arthInstance.address,
    // 	wethInstance.address,
    // 	new BigNumber(3906e5),
    // 	new BigNumber(1e6),
    // 	new BigNumber(100e18),
    // 	new BigNumber(100e18),
    // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // 	new BigNumber(2105300114),
    // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // )

    // // Handle ARTH / USDC
    // // Targeting 1.003 ARTH / 1 USDC
    // await swapToPriceInstance.swapToPrice(
    // 	arthInstance.address,
    // 	col_instance_USDC.address,
    // 	new BigNumber(1003e3),
    // 	new BigNumber(997e3),
    // 	new BigNumber(100e18),
    // 	new BigNumber(100e18),
    // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // 	new BigNumber(2105300114),
    // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // )

    // // Handle ARTH / USDT
    // // Targeting 0.995 ARTH / 1 USDT
    // await swapToPriceInstance.swapToPrice(
    // 	arthInstance.address,
    // 	col_instance_USDT.address,
    // 	new BigNumber(995e3),
    // 	new BigNumber(1005e3),
    // 	new BigNumber(100e18),
    // 	new BigNumber(100e18),
    // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // 	new BigNumber(2105300114),
    // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // )

    // // Handle ARTH / yUSD
    // // Targeting 0.998 ARTH / 1 yUSD
    // // await swapToPriceInstance.swapToPrice(
    // // 	arthInstance.address,
    // // 	col_instance_yUSD.address,
    // // 	new BigNumber(998e3),
    // // 	new BigNumber(1002e3),
    // // 	new BigNumber(100e18),
    // // 	new BigNumber(100e18),
    // // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // // 	new BigNumber(2105300114),
    // // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // // )

    // //--- ARTHS

    // // Handle ARTHX / WETH
    // // Targeting 1955 ARTHX / 1 WETH
    // await swapToPriceInstance.swapToPrice(
    // 	arthxInstance.address,
    // 	wethInstance.address,
    // 	new BigNumber(1955e6),
    // 	new BigNumber(1e6),
    // 	new BigNumber(100e18),
    // 	new BigNumber(100e18),
    // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // 	new BigNumber(2105300114),
    // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // )

    // // Handle ARTHX / USDC
    // // Targeting 5.2 ARTHX / 1 USDC
    // await swapToPriceInstance.swapToPrice(
    // 	arthxInstance.address,
    // 	col_instance_USDC.address,
    // 	new BigNumber(52e5),
    // 	new BigNumber(1e6),
    // 	new BigNumber(100e18),
    // 	new BigNumber(100e18),
    // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // 	new BigNumber(2105300114),
    // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // )


    // // Handle ARTHX / USDT
    // // Targeting 5.1 ARTHX / 1 USDT
    // await swapToPriceInstance.swapToPrice(
    // 	arthxInstance.address,
    // 	col_instance_USDT.address,
    // 	new BigNumber(51e5),
    // 	new BigNumber(1e6),
    // 	new BigNumber(100e18),
    // 	new BigNumber(100e18),
    // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // 	new BigNumber(2105300114),
    // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // )

    // // Handle ARTHX / yUSD
    // // Targeting 4.9 ARTHX / 1 yUSD
    // // await swapToPriceInstance.swapToPrice(
    // // 	arthxInstance.address,
    // // 	col_instance_yUSD.address,
    // // 	new BigNumber(49e5),
    // // 	new BigNumber(1e6),
    // // 	new BigNumber(100e18),
    // // 	new BigNumber(100e18),
    // // 	COLLATERAL_ARTH_AND_ARTHS_OWNER,
    // // 	new BigNumber(2105300114),
    // // 	{ from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    // // )

    // // Advance 24 hrs so the period can be computed
    // await time.increase(86400 + 1);
    // await time.advanceBlock();

    // // Make sure the prices are updated
    // await oracle_instance_ARTH_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTH_USDC.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTH_USDT.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // // await oracle_instance_ARTH_yUSD.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTHS_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTHS_USDC.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_ARTHS_USDT.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // // await oracle_instance_ARTHS_yUSD.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_USDT_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // await oracle_instance_USDC_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // // Advance 24 hrs so the period can be computed
    // await time.increase(86400 + 1);
    // await time.advanceBlock();

    // Get the prices
    arth_price_from_ARTH_WETH = (new BigNumber(await oracle_instance_ARTH_WETH.consult.call(wethInstance.address, 1e6))).div(BIG6).toNumber();
    arth_price_from_ARTH_USDC = (new BigNumber(await oracle_instance_ARTH_USDC.consult.call(FakeCollateral_USDC.address, 1e6))).div(BIG6).toNumber();
    arth_price_from_ARTH_USDT = (new BigNumber(await oracle_instance_ARTH_USDT.consult.call(FakeCollateral_USDT.address, 1e6))).div(BIG6).toNumber();
    // arth_price_from_ARTH_yUSD = (new BigNumber(await oracle_instance_ARTH_yUSD.consult.call(FakeCollateral_yUSD.address, 1e6))).div(BIG6).toNumber();
    arthx_price_from_ARTHS_WETH = (new BigNumber(await oracle_instance_ARTHS_WETH.consult.call(wethInstance.address, 1e6))).div(BIG6).toNumber();
    arthx_price_from_ARTHS_USDC = (new BigNumber(await oracle_instance_ARTHS_USDC.consult.call(FakeCollateral_USDC.address, 1e6))).div(BIG6).toNumber();
    arthx_price_from_ARTHS_USDT = (new BigNumber(await oracle_instance_ARTHS_USDT.consult.call(FakeCollateral_USDT.address, 1e6))).div(BIG6).toNumber();
    // arthx_price_from_ARTHS_yUSD = (new BigNumber(await oracle_instance_ARTHS_yUSD.consult.call(FakeCollateral_yUSD.address, 1e6))).div(BIG6).toNumber();
    USDT_price_from_USDT_WETH = (new BigNumber(await oracle_instance_USDT_WETH.consult.call(WETH.address, 1e6))).div(1e6).toNumber();
    USDC_price_from_USDC_WETH = (new BigNumber(await oracle_instance_USDC_WETH.consult.call(WETH.address, 1e6))).div(1e6).toNumber();

    console.log(chalk.blue("==================PRICES=================="));
    // Print the new prices
    console.log("ETH-USD price from Chainlink:", (new BigNumber((await arthInstance.arth_info.call())['7'])).div(1e6).toString(), "USD = 1 ETH");
    console.log("arth_price_from_ARTH_WETH: ", arth_price_from_ARTH_WETH.toString(), " ARTH = 1 WETH");
    console.log("ARTH-USD price from Chainlink, Uniswap:", (new BigNumber(await arthInstance.arth_price.call())).div(1e6).toString(), "ARTH = 1 USD");
    //console.log("arth_price_from_ARTH_USDC: ", arth_price_from_ARTH_USDC.toString(), " ARTH = 1 USDC");
    //console.log("arth_price_from_ARTH_USDT: ", arth_price_from_ARTH_USDT.toString(), " ARTH = 1 USDT");
    //console.log("arth_price_from_ARTH_yUSD: ", arth_price_from_ARTH_yUSD.toString(), " ARTH = 1 yUSD");
    console.log("arthx_price_from_ARTHS_WETH: ", arthx_price_from_ARTHS_WETH.toString(), " ARTHX = 1 WETH");
    //console.log("arthx_price_from_ARTHS_USDC: ", arthx_price_from_ARTHS_USDC.toString(), " ARTHX = 1 USDC");
    //console.log("arthx_price_from_ARTHS_USDT: ", arthx_price_from_ARTHS_USDT.toString(), " ARTHX = 1 USDT");
    //console.log("arthx_price_from_ARTHS_yUSD: ", arthx_price_from_ARTHS_yUSD.toString(), " ARTHX = 1 yUSD");
    console.log("USDT_price_from_USDT_WETH: ", USDT_price_from_USDT_WETH.toString(), " USDT = 1 WETH");
    console.log("USDC_price_from_USDC_WETH: ", USDC_price_from_USDC_WETH.toString(), " USDC = 1 WETH");
    console.log("USDT_price_from_pool: ", (new BigNumber(await pool_instance_USDT.getCollateralPrice.call())).div(1e6).toString(), " USDT = 1 USD");
    console.log("USDC_price_from_pool: ", (new BigNumber(await pool_instance_USDC.getCollateralPrice.call())).div(1e6).toString(), " USDC = 1 USD");


  });
  /* IGNORE THIS
    it("Changes the price of USDT through swapping on the USDT-ETH Uniswap pair", async () => {
      console.log("=========================Uniswapv2Router.swapExactETHForTokens=========================");
      const amountIn = 1000;
      const amountOutMin = 1;
      await col_instance_USDT.approve.call(TestSwap.address, amountIn, {from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      console.log("approved TestSwap for", amountIn, "USDT");
      //const path = await TestSwap_instance.getPath.call();
      //console.log("test6");
      const result = await TestSwap_instance.swapUSDTforETH.call(amountIn, amountOutMin, {from: COLLATERAL_ARTH_AND_ARTHS_OWNER});
      console.log("swapped");
      console.log(result);
    });
  */
  /* 0x01
    // GOVERNANCE TEST [PART 1]
    // ================================================================
    it('Propose changing the minting fee', async () => {
      console.log("======== Minting fee 0.03% -> 0.1% ========");

      // Temporarily set the voting period to 10 blocks
      await governanceInstance.__setVotingPeriod(10, { from: GOVERNOR_GUARDIAN_ADDRESS });

      // Determine the latest block
      const latestBlock = (new BigNumber(await time.latestBlock())).toNumber();
      console.log("Latest block: ", latestBlock);

      // Print the minting fee beforehand
      let minting_fee_before = (new BigNumber(await arthInstance.minting_fee.call())).div(BIG6).toNumber();
      console.log("minting_fee_before: ", minting_fee_before);

      // https://github.com/compound-finance/compound-protocol/blob/master/tests/Governance/GovernorAlpha/ProposeTest.js
      await governanceInstance.propose(
        [arthInstance.address],
        [0],
        ['setMintingFee(uint256)'],
        [web3.eth.abi.encodeParameters(['uint256'], [1000])], // 0.1%
        "Minting fee change",
        "I hereby propose to increase the minting fee from 0.03% to 0.1%",
        { from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
      );

      // Advance one block so the voting can begin
      await time.increase(15);
      await time.advanceBlock();

      // Print the proposal count
      let proposal_id = await governanceInstance.latestProposalIds.call(COLLATERAL_ARTH_AND_ARTHS_OWNER);

      // Print the proposal before
      let proposal_details = await governanceInstance.proposals.call(proposal_id);
      // console.log(util.inspect(proposal_details, false, null, true));
      console.log("id: ", proposal_details.id.toNumber());
      console.log("forVotes: ", new BigNumber(proposal_details.forVotes).div(BIG18).toNumber());
      console.log("againstVotes: ", new BigNumber(proposal_details.againstVotes).div(BIG18).toNumber());
      console.log("startBlock: ", proposal_details.startBlock.toString());
      console.log("endBlock: ", proposal_details.endBlock.toString());

      // Have at least 4% of ARTHX holders vote (so the quorum is reached)
      await governanceInstance.castVote(proposal_id, true, { from: POOL_CREATOR });
      await governanceInstance.castVote(proposal_id, true, { from: TIMELOCK_ADMIN });
      await governanceInstance.castVote(proposal_id, true, { from: GOVERNOR_GUARDIAN_ADDRESS });
      await governanceInstance.castVote(proposal_id, true, { from: STAKING_OWNER });
      await governanceInstance.castVote(proposal_id, true, { from: STAKING_REWARDS_DISTRIBUTOR });

      // Print the proposal after votes
      proposal_details = await governanceInstance.proposals.call(proposal_id);
      // console.log(util.inspect(proposal_details, false, null, true));
      console.log("id: ", proposal_details.id.toString());
      console.log("forVotes: ", new BigNumber(proposal_details.forVotes).div(BIG18).toNumber());
      console.log("againstVotes: ", new BigNumber(proposal_details.againstVotes).div(BIG18).toNumber());
      console.log("startBlock: ", proposal_details.startBlock.toString());
      console.log("endBlock: ", proposal_details.endBlock.toString());

      // Print the proposal state
      let proposal_state_before = await governanceInstance.state.call(proposal_id);
      console.log("proposal_state_before: ", new BigNumber(proposal_state_before).toNumber());

      // Advance 10 blocks so the voting ends
      await time.increase(10 * 15); // ~15 sec per block
      await time.advanceBlockTo(latestBlock + 10 + 5);

      // Print the proposal state
      let proposal_state_after = await governanceInstance.state.call(proposal_id);
      console.log("proposal_state_after: ", new BigNumber(proposal_state_after).toNumber());

      // Give control from TIMELOCK_ADMIN to GovernerAlpha
      await timelockInstance.setPendingAdmin.call(governanceInstance.address, { from: timelockInstance.address });
      await timelockInstance.acceptAdmin.call({ from: governanceInstance.address });

      // Queue the execution
      await governanceInstance.queue.call(proposal_id, { from: TIMELOCK_ADMIN });

      // Advance two days to the timelock is done
      await time.increase((86400 * 2) + 1);
      await time.advanceBlock();

      // Execute the proposal
      await governanceInstance.execute.call(proposal_id, { from: TIMELOCK_ADMIN });

      // Print the minting fee afterwards
      let minting_fee_after = (new BigNumber(await arthInstance.minting_fee.call())).div(BIG6).toNumber();
      console.log("minting_fee_after: ", minting_fee_after);

      // Set the voting period back to 17280 blocks
      await governanceInstance.__setVotingPeriod.call(17280, { from: GOVERNOR_GUARDIAN_ADDRESS });

    });


    // GOVERNANCE TEST [PART 2]
    // ================================================================
    it('Change the minting fee back to 0.03%', async () => {
      console.log("======== Minting fee 0.1% -> 0.03% ========");
      // Temporarily set the voting period to 10 blocks
      await governanceInstance.__setVotingPeriod.call(10, { from: GOVERNOR_GUARDIAN_ADDRESS });

      // Determine the latest block
      const latestBlock = (new BigNumber(await time.latestBlock())).toNumber();
      console.log("Latest block: ", latestBlock);

      // Print the minting fee beforehand
      let minting_fee_before = (new BigNumber(await arthInstance.minting_fee.call())).div(BIG6).toNumber();
      console.log("minting_fee_before: ", minting_fee_before);

      // https://github.com/compound-finance/compound-protocol/blob/master/tests/Governance/GovernorAlpha/ProposeTest.js
      await governanceInstance.propose.call(
        [arthInstance.address],
        [0],
        ['setMintingFee(uint256)'],
        [web3.eth.abi.encodeParameters(['uint256'], [300])], // 0.03%
        "Minting fee revert back to old value",
        "I hereby propose to decrease the minting fee back to 0.03% from 0.1%",
        { from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
      );

      // Advance one block so the voting can begin
      await time.increase(15);
      await time.advanceBlock();

      // Print the proposal count
      let proposal_id = await governanceInstance.latestProposalIds.call(COLLATERAL_ARTH_AND_ARTHS_OWNER);

      // Print the proposal before
      let proposal_details = await governanceInstance.proposals.call(proposal_id);
      // console.log(util.inspect(proposal_details, false, null, true));
      console.log("id: ", proposal_details.id.toNumber());
      console.log("forVotes: ", new BigNumber(proposal_details.forVotes).div(BIG18).toNumber());
      console.log("againstVotes: ", new BigNumber(proposal_details.againstVotes).div(BIG18).toNumber());
      console.log("startBlock: ", proposal_details.startBlock.toString());
      console.log("endBlock: ", proposal_details.endBlock.toString());

      // Have at least 4% of ARTHX holders vote (so the quorum is reached)
      await governanceInstance.castVote.call(proposal_id, true, { from: POOL_CREATOR });
      await governanceInstance.castVote.call(proposal_id, true, { from: TIMELOCK_ADMIN });
      await governanceInstance.castVote.call(proposal_id, true, { from: GOVERNOR_GUARDIAN_ADDRESS });
      await governanceInstance.castVote.call(proposal_id, true, { from: STAKING_OWNER });
      await governanceInstance.castVote.call(proposal_id, true, { from: STAKING_REWARDS_DISTRIBUTOR });

      // Print the proposal after votes
      proposal_details = await governanceInstance.proposals.call(proposal_id);
      // console.log(util.inspect(proposal_details, false, null, true));
      console.log("id: ", proposal_details.id.toString());
      console.log("forVotes: ", new BigNumber(proposal_details.forVotes).div(BIG18).toNumber());
      console.log("againstVotes: ", new BigNumber(proposal_details.againstVotes).div(BIG18).toNumber());
      console.log("startBlock: ", proposal_details.startBlock.toString());
      console.log("endBlock: ", proposal_details.endBlock.toString());

      // Print the proposal state
      let proposal_state_before = await governanceInstance.state.call(proposal_id);
      console.log("proposal_state_before: ", new BigNumber(proposal_state_before).toNumber());

      // Advance 10 blocks so the voting ends
      await time.increase(10 * 15); // ~15 sec per block
      await time.advanceBlockTo(latestBlock + 10 + 5);

      // Print the proposal state
      let proposal_state_after = await governanceInstance.state.call(proposal_id);
      console.log("proposal_state_after: ", new BigNumber(proposal_state_after).toNumber());

      // Queue the execution
      await governanceInstance.queue.call(proposal_id, { from: TIMELOCK_ADMIN });

      // Advance two days to the timelock is done
      await time.increase((86400 * 2) + 1);
      await time.advanceBlock();

      // Execute the proposal
      await governanceInstance.execute.call(proposal_id, { from: TIMELOCK_ADMIN });

      // Print the minting fee afterwards
      let minting_fee_after = (new BigNumber(await arthInstance.minting_fee.call())).div(BIG6).toNumber();
      console.log("minting_fee_after: ", minting_fee_after);

      // Set the voting period back to 17280 blocks
      await governanceInstance.__setVotingPeriod.call(17280, { from: GOVERNOR_GUARDIAN_ADDRESS });

    });
  0x01 */

  // [DEPRECATED] SEEDED IN THE MIGRATION FLOW
  // it('Seed the collateral pools some collateral to start off with', async () => {
  // 	console.log("========================Collateral Seed========================");

  // 	// Link the FAKE collateral pool to the ARTH contract
  // 	await col_instance_USDC.transfer(pool_instance_USDC.address, COLLATERAL_SEED_DEC18, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
  // 	await col_instance_USDT.transfer(pool_instance_USDT.address, COLLATERAL_SEED_DEC18, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
  // 	// await col_instance_yUSD.transfer(pool_instance_yUSD.address, COLLATERAL_SEED_DEC18, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

  // 	// Refresh the collateral ratio
  // 	const totalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18);
  // 	console.log("totalCollateralValue: ", totalCollateralValue.toNumber());

  // 	/*
  // 	// Advance 1 hr so the collateral ratio can be recalculated
  // 	await time.increase(3600 + 1);
  // 	await time.advanceBlock();
  // 	await arthInstance.refreshCollateralRatio();

  // 	// Advance 1 hr so the collateral ratio can be recalculated
  // 	await time.increase(3600 + 1);
  // 	await time.advanceBlock();
  // 	await arthInstance.refreshCollateralRatio();
  // 	*/

  // 	const collateral_ratio_refreshed = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
  // 	console.log("collateral_ratio_refreshed: ", collateral_ratio_refreshed.toNumber());
  // 	col_rat = collateral_ratio_refreshed;
  // });
  /*
    it('Mint some ARTH using USDC as collateral (collateral ratio = 1) [mint1t1ARTH]', async () => {
      console.log("=========================mint1t1ARTH=========================");
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the collateral and ARTH amounts before minting
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);

      bal_arth = arth_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      console.log("bal_arth: ", bal_arth.toNumber());
      console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
      console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

      // Need to approve first so the pool contract can use transferFrom
      const collateral_amount = new BigNumber("100e18");
      await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      // Mint some ARTH
      console.log("accounts[0] mint1t1ARTH() with 100 USDC; slippage limit of 1%");
      const collateral_price = (new BigNumber(await pool_instance_USDC.getCollateralPrice.call()).div(BIG6)).toNumber()
      const ARTH_out_min = new BigNumber(collateral_amount.times(collateral_price).times(0.99)); // 1% slippage
      await pool_instance_USDC.mint1t1ARTH(collateral_amount, ARTH_out_min, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the collateral and ARTH amounts after minting
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      // assert.equal(arth_after, 103.9584);
      // assert.equal(collateral_after, 8999900);
      // assert.equal(pool_collateral_after, 1000100);
      console.log("accounts[0] arth change: ", arth_after.toNumber() - arth_before.toNumber());
      console.log("accounts[0] collateral change: ", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("ARTH_pool_USDC collateral change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

    });

    it('SHOULD FAIL: Mint some ARTH using USDC as collateral, sets too high of an expectation for ARTH output [mint1t1ARTH]', async () => {
      console.log("=========================mint1t1ARTH=========================");
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the collateral and ARTH amounts before minting
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);

      bal_arth = arth_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      console.log("bal_arth: ", bal_arth.toNumber());
      console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
      console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

      // Need to approve first so the pool contract can use transferFrom
      const collateral_amount = new BigNumber("100e18");
      await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      // Mint some ARTH
      console.log("accounts[0] mint1t1ARTH() with 100 USDC; slippage limit of 1%");
      const collateral_price = (new BigNumber(await pool_instance_USDC.getCollateralPrice.call()).div(BIG6)).toNumber()
      const ARTH_out_min = new BigNumber(collateral_amount.times(collateral_price).times(1.01)); // Expects more ARTH than current price levels
      await pool_instance_USDC.mint1t1ARTH(collateral_amount, ARTH_out_min, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the collateral and ARTH amounts after minting
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      // assert.equal(arth_after, 103.9584);
      // assert.equal(collateral_after, 8999900);
      // assert.equal(pool_collateral_after, 1000100);
      console.log("accounts[0] arth change: ", arth_after.toNumber() - arth_before.toNumber());
      console.log("accounts[0] collateral change: ", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("ARTH_pool_USDC collateral change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

    });

    it('Redeem some ARTH for USDC (collateral ratio >= 1) [redeem1t1ARTH]', async () => {
      console.log("=========================redeem1t1ARTH=========================");
      // Advance 1 hr so the collateral ratio can be recalculated
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Deposit some collateral to move the collateral ratio above 1
      await col_instance_USDC.transfer(pool_instance_USDC.address, THREE_THOUSAND_DEC18, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await col_instance_USDT.transfer(pool_instance_USDT.address, THREE_THOUSAND_DEC18, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      // await col_instance_yUSD.transfer(pool_instance_yUSD.address, THREE_THOUSAND_DEC18, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the collateral and ARTH amounts before redeeming
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      bal_arth = arth_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      console.log("bal_arth: ", bal_arth.toNumber());
      console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
      console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());
      console.log("ARTH price (USD): " , new BigNumber(await arthInstance.arth_price.call()).div(BIG6).toNumber());

      // Need to approve first so the pool contract can use transfer
      const arth_amount = new BigNumber("100e18");
      await arthInstance.approve(pool_instance_USDC.address, arth_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Redeem some ARTH
      await pool_instance_USDC.redeem1t1ARTH(arth_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER }); // Get at least 10 USDC out, roughly 90% slippage limit (testing purposes)
      console.log("accounts[0] redeem1t1() with 100 ARTH");
      // Collect redemption
      await time.advanceBlock();
      await pool_instance_USDC.collectRedemption({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the collateral and ARTH amounts after redeeming
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      console.log("accounts[0] ARTH change: ", arth_after.toNumber() - arth_before.toNumber());
      console.log("accounts[0] USDC change: ", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("ARTH_pool_USDC change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());
    });


  */
  // REDUCE COLLATERAL RATIO
  it("Reduces the collateral ratio: 1-to-1 Phase => Fractional Phase", async () => {
    console.log("=========================Reducing the collateral ratio=========================")
    // const tokensToMint = new BigNumber(1000000e18);
    // await arthInstance.mint(tokensToMint, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    // totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    // console.log("totalSupplyARTH: ", totalSupplyARTH);


    // Add allowances to the swapToPrice contract
    await wethInstance.approve(swapToPriceInstance.address, new BigNumber(2000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    await arthInstance.approve(swapToPriceInstance.address, new BigNumber(1000000e18), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Print the current ARTH price
    arth_price_from_ARTH_WETH = (new BigNumber(await oracle_instance_ARTH_WETH.consult.call(wethInstance.address, 1e6))).div(BIG6).toNumber();
    console.log("arth_price_from_ARTH_WETH (before): ", arth_price_from_ARTH_WETH.toString(), " ARTH = 1 WETH");

    // Swap the ARTH price upwards
    // Targeting 350 ARTH / 1 WETH
    await swapToPriceInstance.swapToPrice(
      arthInstance.address,
      wethInstance.address,
      new BigNumber(350e6),
      new BigNumber(1e6),
      new BigNumber(100e18),
      new BigNumber(100e18),
      COLLATERAL_ARTH_AND_ARTHS_OWNER,
      new BigNumber(2105300114),
      { from: COLLATERAL_ARTH_AND_ARTHS_OWNER }
    )

    // Advance 24 hrs so the period can be computed
    await time.increase(86400 + 1);
    await time.advanceBlock();

    // Make sure the price is updated
    await oracle_instance_ARTH_WETH.update({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Print the new ARTH price
    arth_price_from_ARTH_WETH = (new BigNumber(await oracle_instance_ARTH_WETH.consult.call(wethInstance.address, 1e6))).div(BIG6).toNumber();
    console.log("arth_price_from_ARTH_WETH (after): ", arth_price_from_ARTH_WETH.toString(), " ARTH = 1 WETH");

    for (let i = 0; i < 13; i++) { // Drop the collateral ratio by 13 * 0.25%
      await time.increase(3600 + 1);
      await time.advanceBlock();
      await arthInstance.refreshCollateralRatio();
      console.log("global_collateral_ratio:", (new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6)).toNumber());
    }

  });
  /*

    // MINTING PART 2
    // ================================================================

    it('Mint some ARTH using ARTHX and USDC (collateral ratio between .000001 and .999999) [mintFractionalARTH]', async () => {
      console.log("=========================mintFractionalARTH=========================");
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the ARTHS, ARTH, and FAKE amounts before minting
      const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      bal_arthx = arthx_before;
      bal_arth = arth_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      console.log("bal_arthx: ", bal_arthx.toNumber());
      console.log("bal_arth: ", bal_arth.toNumber());
      console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
      console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

      // Need to approve first so the pool contract can use transferFrom
      const arthx_amount = new BigNumber("500e18");
      await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      const collateral_amount = new BigNumber("100e18");
      await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      await pool_instance_USDC.mintFractionalARTH(collateral_amount, arthx_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      console.log("accounts[0] mintFractionalARTH() with 100 USDC and 500 ARTHS");

      // Note the ARTHS, ARTH, and FAKE amounts after minting
      const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      console.log("accounts[0] USDC balance change: ", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("accounts[0] ARTHX balance change: ", arthx_after.toNumber() - arthx_before.toNumber());
      console.log("accounts[0] ARTH balance change: ", arth_after.toNumber() - arth_before.toNumber());
      console.log("ARTH_pool_USDC balance change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

    });



    it('SHOULD FAIL: Mint some ARTH using ARTHX and USDC, but doesn\'t send in enough ARTHX [mintFractionalARTH]', async () => {
      console.log("=========================mintFractionalARTH=========================");

      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the ARTHS, ARTH, and FAKE amounts before minting
      const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      bal_arthx = arthx_before;
      bal_arth = arth_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      console.log("bal_arthx: ", bal_arthx.toNumber());
      console.log("bal_arth: ", bal_arth.toNumber());
      console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
      console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

      // Need to approve first so the pool contract can use transferFrom
      const arthx_amount = new BigNumber("5e18");
      await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      const collateral_amount = new BigNumber("100e18");
      await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      await pool_instance_USDC.mintFractionalARTH(collateral_amount, arthx_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      console.log("accounts[0] mintFractionalARTH() with 100 USDC and 5 ARTHS");

      // Note the ARTHS, ARTH, and FAKE amounts after minting
      const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      console.log("accounts[0] USDC balance change: ", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("accounts[0] ARTHX balance change: ", arthx_after.toNumber() - arthx_before.toNumber());
      console.log("accounts[0] ARTH balance change: ", arth_after.toNumber() - arth_before.toNumber());
      console.log("ARTH_pool_USDC balance change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

    });
  */

  it('redeemFractionalARTH() - Testing slippage, ARTHX amountOut passing && USDC amountOut passing', async () => {
    console.log("=========================redeemFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before redeeming
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("accounts[0] ARTHX balance:", bal_arth.toNumber());
    console.log("accounts[0] ARTH balance:", bal_arth.toNumber());
    console.log("accounts[0] USDC balance", col_bal_usdc.toNumber());
    console.log("ARTH_pool_USDC balance:", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transfer
    const arth_amount = new BigNumber("135242531948024e6");
    await arthInstance.approve(pool_instance_USDC.address, arth_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    const arthx_out = new BigNumber("21e18");
    const usdc_out = new BigNumber("131e18");

    // Redeem some ARTH
    await pool_instance_USDC.redeemFractionalARTH(arth_amount, arthx_out, usdc_out, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    console.log("accounts[0] redeemFractionalARTH() with 135.24253 ARTH");
    // Collect redemption
    await time.advanceBlock();
    await pool_instance_USDC.collectRedemption({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after redeeming
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] ARTHX balance change:", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change:", arth_after.toNumber() - arth_before.toNumber());
    console.log("accounts[0] USDC balance change:", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("ARTH_pool_USDC balance change:", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

  });

  it('redeemFractionalARTH() - Testing slippage, ARTHX amountOut failing && USDC amountOut passing', async () => {
    console.log("=========================redeemFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before redeeming
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("accounts[0] ARTHX balance:", bal_arth.toNumber());
    console.log("accounts[0] ARTH balance:", bal_arth.toNumber());
    console.log("accounts[0] USDC balance", col_bal_usdc.toNumber());
    console.log("ARTH_pool_USDC balance:", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transfer
    const arth_amount = new BigNumber("135242531948024e6");
    await arthInstance.approve(pool_instance_USDC.address, arth_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    const arthx_out = new BigNumber("22e18");
    const usdc_out = new BigNumber("131e18");

    // Redeem some ARTH
    await pool_instance_USDC.redeemFractionalARTH(arth_amount, arthx_out, usdc_out, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    console.log("accounts[0] redeemFractionalARTH() with 135.24253 ARTH");
    // Collect redemption
    await time.advanceBlock();
    await pool_instance_USDC.collectRedemption({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after redeeming
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] ARTHX balance change:", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change:", arth_after.toNumber() - arth_before.toNumber());
    console.log("accounts[0] USDC balance change:", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("ARTH_pool_USDC balance change:", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

  });


  it('redeemFractionalARTH() - Testing slippage, ARTHX amountOut passing && USDC amountOut failing', async () => {
    console.log("=========================redeemFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before redeeming
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("accounts[0] ARTHX balance:", bal_arth.toNumber());
    console.log("accounts[0] ARTH balance:", bal_arth.toNumber());
    console.log("accounts[0] USDC balance", col_bal_usdc.toNumber());
    console.log("ARTH_pool_USDC balance:", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transfer
    const arth_amount = new BigNumber("135242531948024e6");
    await arthInstance.approve(pool_instance_USDC.address, arth_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    const arthx_out = new BigNumber("21e18");
    const usdc_out = new BigNumber("132e18");

    // Redeem some ARTH
    await pool_instance_USDC.redeemFractionalARTH(arth_amount, arthx_out, usdc_out, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    console.log("accounts[0] redeemFractionalARTH() with 135.24253 ARTH");
    // Collect redemption
    await time.advanceBlock();
    await pool_instance_USDC.collectRedemption({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after redeeming
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] ARTHX balance change:", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change:", arth_after.toNumber() - arth_before.toNumber());
    console.log("accounts[0] USDC balance change:", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("ARTH_pool_USDC balance change:", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

  });


  it('redeemFractionalARTH() - Testing slippage, ARTHX amountOut failing && USDC amountOut failing', async () => {
    console.log("=========================redeemFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before redeeming
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("accounts[0] ARTHX balance:", bal_arth.toNumber());
    console.log("accounts[0] ARTH balance:", bal_arth.toNumber());
    console.log("accounts[0] USDC balance", col_bal_usdc.toNumber());
    console.log("ARTH_pool_USDC balance:", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transfer
    const arth_amount = new BigNumber("135242531948024e6");
    await arthInstance.approve(pool_instance_USDC.address, arth_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    const arthx_out = new BigNumber("22e18");
    const usdc_out = new BigNumber("132e18");

    // Redeem some ARTH
    await pool_instance_USDC.redeemFractionalARTH(arth_amount, arthx_out, usdc_out, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    console.log("accounts[0] redeemFractionalARTH() with 135.24253 ARTH");
    // Collect redemption
    await time.advanceBlock();
    await pool_instance_USDC.collectRedemption({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after redeeming
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] ARTHX balance change:", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change:", arth_after.toNumber() - arth_before.toNumber());
    console.log("accounts[0] USDC balance change:", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("ARTH_pool_USDC balance change:", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());

  });

  it('mintFractionalARTH, ARTH amountOut trivially passes', async () => {
    console.log("=========================mintFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before minting
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("bal_arthx: ", bal_arthx.toNumber());
    console.log("bal_arth: ", bal_arth.toNumber());
    console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
    console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transferFrom
    const arthx_amount = new BigNumber("50000e18");
    await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    const collateral_amount = new BigNumber("10000e18");
    await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    const ARTH_out_min = new BigNumber("10e18");

    console.log("accounts[0] mintFractionalARTH() with 10,000 USDC and 50,000 ARTHS; ARTH_out_min: ", ARTH_out_min.div(BIG18).toNumber());
    await pool_instance_USDC.mintFractionalARTH(collateral_amount, arthx_amount, ARTH_out_min, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after minting
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] USDC balance change: ", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("accounts[0] ARTHX balance change: ", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change: ", arth_after.toNumber() - arth_before.toNumber());
    console.log("ARTH_pool_USDC balance change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());
  });

  it('mintFractionalARTH, ARTH amountOut passes', async () => {
    console.log("=========================mintFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before minting
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("bal_arthx: ", bal_arthx.toNumber());
    console.log("bal_arth: ", bal_arth.toNumber());
    console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
    console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transferFrom
    const arthx_amount = new BigNumber("50000e18");
    await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    const collateral_amount = new BigNumber("10000e18");
    await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    const ARTH_out_min = new BigNumber(collateral_amount.times(await pool_instance_USDC.getCollateralPrice()).div(globalCollateralRatio)).idiv(BIG6).idiv(BIG6).idiv(BIG6).plus(20);
    const ARTH_out_min_2 = new BigNumber("10306e18");

    console.log("accounts[0] mintFractionalARTH() with 10,000 USDC and 50,000 ARTHS; ARTH_out_min_2: ", ARTH_out_min_2.toNumber());
    await pool_instance_USDC.mintFractionalARTH(collateral_amount, arthx_amount, ARTH_out_min_2, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after minting
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] USDC balance change: ", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("accounts[0] ARTHX balance change: ", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change: ", arth_after.toNumber() - arth_before.toNumber());
    console.log("ARTH_pool_USDC balance change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());
  });


  it('mintFractionalARTH, ARTH amountOut fails', async () => {
    console.log("=========================mintFractionalARTH=========================");
    totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
    totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
    globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
    globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
    console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
    console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
    console.log("totalSupplyARTH: ", totalSupplyARTH);
    console.log("totalSupplyARTHS: ", totalSupplyARTHS);
    console.log("globalCollateralRatio: ", globalCollateralRatio);
    console.log("globalCollateralValue: ", globalCollateralValue);
    console.log("");

    // Note the collateral ratio
    const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

    // Note the ARTHS, ARTH, and FAKE amounts before minting
    const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    bal_arthx = arthx_before;
    bal_arth = arth_before;
    col_bal_usdc = collateral_before;
    pool_bal_usdc = pool_collateral_before;
    console.log("bal_arthx: ", bal_arthx.toNumber());
    console.log("bal_arth: ", bal_arth.toNumber());
    console.log("col_bal_usdc: ", col_bal_usdc.toNumber());
    console.log("pool_bal_usdc: ", pool_bal_usdc.toNumber());

    // Need to approve first so the pool contract can use transferFrom
    const arthx_amount = new BigNumber("50000e18");
    await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    const collateral_amount = new BigNumber("10000e18");
    await col_instance_USDC.approve(pool_instance_USDC.address, collateral_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
    const ARTH_out_min = new BigNumber(collateral_amount.times(await pool_instance_USDC.getCollateralPrice()).div(globalCollateralRatio)).idiv(BIG6).idiv(BIG6).idiv(BIG6).plus(20);
    const ARTH_out_min_3 = new BigNumber("10307e18");

    console.log("accounts[0] mintFractionalARTH() with 10,000 USDC and 50,000 ARTHS; ARTH_out_min_3: ", ARTH_out_min_3.toNumber());
    await pool_instance_USDC.mintFractionalARTH(collateral_amount, arthx_amount, ARTH_out_min_3, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

    // Note the ARTHS, ARTH, and FAKE amounts after minting
    const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
    const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
    console.log("accounts[0] USDC balance change: ", collateral_after.toNumber() - collateral_before.toNumber());
    console.log("accounts[0] ARTHX balance change: ", arthx_after.toNumber() - arthx_before.toNumber());
    console.log("accounts[0] ARTH balance change: ", arth_after.toNumber() - arth_before.toNumber());
    console.log("ARTH_pool_USDC balance change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

    // Note the new collateral ratio
    const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
    console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());
  });
  /*


    it('Recollateralizes the system using recollateralizeARTH()', async () => {
      console.log("=========================recollateralizeARTH=========================");
      let totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      let totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      let globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      let globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Note the new collateral ratio
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();

      console.log("effective collateral ratio before:", globalCollateralValue / totalSupplyARTH);

      // Note the ARTHS, ARTH, and FAKE amounts before redeeming
      const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      bal_arthx = arthx_before;
      bal_arth = arth_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      console.log("accounts[0] ARTHX balance:", bal_arth.toNumber());
      console.log("accounts[0] ARTH balance:", bal_arth.toNumber());
      console.log("accounts[0] USDC balance", col_bal_usdc.toNumber());
      console.log("ARTH_pool_USDC balance:", pool_bal_usdc.toNumber());

      console.log("pool_USDC getCollateralPrice() (divided by 1e6):", (new BigNumber(await pool_instance_USDC.getCollateralPrice.call()).div(BIG6)).toNumber());


      // Need to approve first so the pool contract can use transfer
      const USDC_amount = new BigNumber("10000e18");
      await col_instance_USDC.approve(pool_instance_USDC.address, USDC_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Redeem some ARTH
      await pool_instance_USDC.recollateralizeARTH(USDC_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      console.log("accounts[0] recollateralizeARTH() with 10,000 USDC");

      // Note the ARTHS, ARTH, and FAKE amounts after redeeming
      const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      console.log("accounts[0] ARTHX balance change:", arthx_after.toNumber() - arthx_before.toNumber());
      console.log("accounts[0] ARTH balance change:", arth_after.toNumber() - arth_before.toNumber());
      console.log("accounts[0] USDC balance change:", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("ARTH_pool_USDC balance change:", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());

      // Note the new collateral ratio
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();

      console.log("effective collateral ratio after:", globalCollateralValue / totalSupplyARTH);

    });


    // MINTING AND REDEMPTION [CR = 0]
    // ================================================================

    it('Mint some ARTH using ARTHX (collateral ratio = 0) [mintAlgorithmicARTH]', async () => {
      console.log("=========================mintAlgorithmicARTH=========================");
      for(let i = 0; i < 4*96; i++){ //drop by 96%
        await time.increase(3600 + 1);
        await time.advanceBlock();
        await arthInstance.refreshCollateralRatio();
        if (i % 20 == 0) {
          console.log("global_collateral_ratio:", (new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6)).toNumber());
        }
      }

      // drop it 3 more times
      await time.increase(3600 + 1);
      await time.advanceBlock();
      await arthInstance.refreshCollateralRatio();
      await time.increase(3600 + 1);
      await time.advanceBlock();
      await arthInstance.refreshCollateralRatio();
      await time.increase(3600 + 1);
      await time.advanceBlock();
      await arthInstance.refreshCollateralRatio();

      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // IF YOU ARE RUNNING TESTS, YOU NEED TO COMMENT OUT THE RELEVANT PART IN THE DEPLOY SCRIPT!
      // IF YOU ARE RUNNING TESTS, YOU NEED TO COMMENT OUT THE RELEVANT PART IN THE DEPLOY SCRIPT!
      // IF YOU ARE RUNNING TESTS, YOU NEED TO COMMENT OUT THE RELEVANT PART IN THE DEPLOY SCRIPT!
      //console.log(chalk.red("IF YOU ARE RUNNING TESTS, YOU NEED TO COMMENT OUT THE RELEVANT PART IN THE DEPLOY SCRIPT!"));

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the ARTHX and ARTH amounts before minting
      const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      bal_arthx = arthx_before;
      bal_arth = arth_before;
      console.log("accounts[0] ARTHX balance before:", arthx_before.toNumber());
      console.log("accounts[0] ARTH balance before:", arth_before.toNumber());

      // Need to approve first so the pool contract can use transferFrom
      const arthx_amount = new BigNumber("10000e18");
      await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Mint some ARTH
      await pool_instance_USDC.mintAlgorithmicARTH(arthx_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      console.log("accounts[0] mintAlgorithmicARTH() using 10,000 ARTHS");

      // Note the ARTHX and ARTH amounts after minting
      const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      console.log("accounts[0] ARTHX balance after:", arthx_after.toNumber() - arthx_before.toNumber());
      console.log("accounts[0] ARTH balance after:", arth_after.toNumber() - arth_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());
    });

    // MINTING AND REDEMPTION [Other CRs]
    // ================================================================

    it('Redeem some ARTH for ARTHX (collateral ratio = 0) [redeemAlgorithmicARTH]', async () => {
      console.log("=========================redeemAlgorithmicARTH=========================");
      // Advance 1 hr so the collateral ratio can be recalculated
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the ARTHS, ARTH, and FAKE amounts before minting
      const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_before = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      console.log("accounts[0] ARTHX balance before:", arthx_before.toNumber());
      console.log("accounts[0] ARTH balance before:", arth_before.toNumber());

      // Need to approve first so the pool contract can use transfer
      const arth_amount = new BigNumber("1000e18");
      await arthInstance.approve(pool_instance_USDC.address, arth_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Redeem some ARTH
      await pool_instance_USDC.redeemAlgorithmicARTH(arth_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      console.log("accounts[0] redeemAlgorithmicARTH() using 1,000 ARTH");

      // Collect redemption
      await time.advanceBlock();
      await pool_instance_USDC.collectRedemption({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the ARTHS, ARTH, and FAKE amounts after minting
      const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arth_after = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      //const arthx_unclaimed = new BigNumber(await pool_instance_USDC.getRedeemARTHSBalance.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      //console.log("bal_arthx change: ", arthx_after.toNumber() - bal_arthx);
      //console.log("bal_arthx sitting inside Pool_USDC waiting to be claimed by COLLATERAL_ARTH_AND_ARTHS_OWNER: ", arthx_unclaimed);
      //console.log("bal_arth change: ", arth_after.toNumber() - bal_arth);
      console.log("accounts[0] ARTHX change:", arthx_after.toNumber() - arthx_before.toNumber());
      console.log("accounts[0] ARTH change:", arth_after.toNumber() - arth_before.toNumber());
    });


    it("Buys back collateral using ARTHS", async () => {
      console.log("=========================buyBackARTHX=========================");
      // Advance 1 hr so the collateral ratio can be recalculated
      totalSupplyARTH = new BigNumber(await arthInstance.totalSupply.call()).div(BIG18).toNumber();
      totalSupplyARTHX = new BigNumber(await arthxInstance.totalSupply.call()).div(BIG18).toNumber();
      globalCollateralRatio = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6).toNumber();
      globalCollateralValue = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18).toNumber();
      console.log("ARTH price (USD): ", (new BigNumber(await arthInstance.arth_price.call()).div(BIG6)).toNumber());
      console.log("ARTHX price (USD): ", (new BigNumber(await arthInstance.arthx_price.call()).div(BIG6)).toNumber());
      console.log("totalSupplyARTH: ", totalSupplyARTH);
      console.log("totalSupplyARTHS: ", totalSupplyARTHS);
      console.log("globalCollateralRatio: ", globalCollateralRatio);
      console.log("globalCollateralValue: ", globalCollateralValue);
      console.log("");

      // This will push the collateral ratio below 1
      // Note the collateral ratio
      const collateral_ratio_before = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_before: ", collateral_ratio_before.toNumber());

      // Note the ARTHX and FAKE amounts before buying back
      const arthx_before = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_before = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      const global_pool_collateral_before = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18);
      bal_arthx = arthx_before;
      col_bal_usdc = collateral_before;
      pool_bal_usdc = pool_collateral_before;
      global_collateral_value = global_pool_collateral_before;
      console.log("accounts[0] ARTHX balance: ", bal_arthx.toNumber());
      console.log("accounts[0] USDC balance: ", col_bal_usdc.toNumber());
      console.log("ARTH_pool_USDC balance: ", pool_bal_usdc.toNumber());
      console.log("global_collateral_value: ", global_collateral_value.toNumber());

      // Available to buyback
      const buyback_available = new BigNumber(await pool_instance_USDC.availableExcessCollatDV.call()).div(BIG18);
      // const buyback_available_in_arthx = new BigNumber(await pool_instance_USDC.availableExcessCollatDVInARTHS.call()).div(BIG18);
      console.log("buyback_available: $", buyback_available.toNumber());
      // console.log("buyback_available_in_arthx: ", buyback_available_in_arthx.toNumber(), " ARTHS");

      // Need to approve first so the pool contract can use transfer
      const arthx_amount = new BigNumber("40000e18");
      await arthxInstance.approve(pool_instance_USDC.address, arthx_amount, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // ARTHX price
      const arthx_price = new BigNumber(await arthInstance.arthx_price()).div(BIG6);
      console.log("arthx_price: $", arthx_price.toNumber());

      // Buy back some ARTH
      console.log("accounts[0] buyBackARTHX() using 40,000 ARTHS");
      await pool_instance_USDC.buyBackARTHX(arthx_amount, new BigNumber("10e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });


      // Note the ARTHX and FAKE amounts after buying back
      const arthx_after = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const pool_collateral_after = new BigNumber(await col_instance_USDC.balanceOf.call(pool_instance_USDC.address)).div(BIG18);
      const global_pool_collateral_after = new BigNumber(await arthInstance.globalCollateralValue.call()).div(BIG18);
      console.log("accounts[0] ARTHX balance change: ", arthx_after.toNumber() - arthx_before.toNumber());
      console.log("accounts[0] USDC balance change: ", collateral_after.toNumber() - collateral_before.toNumber());
      console.log("ARTH_pool_USDC balance change: ", pool_collateral_after.toNumber() - pool_collateral_before.toNumber());
      console.log("global_collateral_value change: ", global_pool_collateral_after.toNumber() - global_pool_collateral_before.toNumber());

      // Note the new collateral ratio
      const collateral_ratio_after = new BigNumber(await arthInstance.global_collateral_ratio.call()).div(BIG6);
      console.log("collateral_ratio_after: ", collateral_ratio_after.toNumber());
      console.log("getCollateralPrice() from ARTH_pool_USDC: ", (new BigNumber(await pool_instance_USDC.getCollateralPrice.call()).div(BIG6)).toNumber());
    });


    // STAKING
    // ================================================================

    it('Make sure the StakingRewards (ARTH/USDC) are initialized', async () => {
      let rewards_contract_lastUpdateTime = new BigNumber(await stakingInstance_ARTH_USDC.lastUpdateTime.call()).toNumber();
      let rewards_contract_periodFinish = new BigNumber(await stakingInstance_ARTH_USDC.periodFinish.call()).toNumber();
      assert.equal(rewards_contract_periodFinish - rewards_contract_lastUpdateTime, REWARDS_DURATION);
    });

    it('PART 1: Normal stakes', async () => {
      console.log("=========================Normal Stakes=========================");
      // Give some Uniswap Pool tokens to another user so they can stake too
      await pair_instance_ARTH_USDC.transfer(accounts[9], new BigNumber("250e18"), { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      const cr_boost_multiplier = new BigNumber(await stakingInstance_ARTH_USDC.crBoostMultiplier()).div(BIG6);
      console.log("cr_boost_multiplier: ", cr_boost_multiplier.toNumber());

      // Need to approve first so the staking can use transfer
      let uni_pool_tokens_1 = new BigNumber("75e18");
      let uni_pool_tokens_9 = new BigNumber("25e18");
      await pair_instance_ARTH_USDC.approve(stakingInstance_ARTH_USDC.address, uni_pool_tokens_1, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await pair_instance_ARTH_USDC.approve(stakingInstance_ARTH_USDC.address, uni_pool_tokens_9, { from: accounts[9] });

      // Note the ARTH amounts before
      const uni_pool_tokens_before_1 = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const uni_pool_tokens_before_9 = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(accounts[9])).div(BIG18);
      console.log("ARTH_USDC Uniswap Liquidity Tokens BEFORE [1]: ", uni_pool_tokens_before_1.toString());
      console.log("ARTH_USDC Uniswap Liquidity Tokens BEFORE [9]: ", uni_pool_tokens_before_9.toString());

      // Stake
      await stakingInstance_ARTH_USDC.stake(uni_pool_tokens_1, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await stakingInstance_ARTH_USDC.stake(uni_pool_tokens_9, { from: accounts[9] });
      await time.advanceBlock();

      // Note the Uniswap Pool Token and ARTHX amounts after staking
      const uni_pool_1st_stake_1 = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const uni_pool_1st_stake_9 = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(accounts[9])).div(BIG18);
      const arthx_1st_stake_1 = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arthx_1st_stake_9 = new BigNumber(await arthxInstance.balanceOf.call(accounts[9])).div(BIG18);
      const rewards_balance_1st_stake_1 = new BigNumber(await stakingInstance_ARTH_USDC.rewards.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const rewards_balance_1st_stake_9 = new BigNumber(await stakingInstance_ARTH_USDC.rewards.call(accounts[9])).div(BIG18);
      console.log("UNI POOL AFTER 1ST STAKE [1]: ", uni_pool_1st_stake_1.toString());
      console.log("UNI POOL AFTER 1ST STAKE [9]: ", uni_pool_1st_stake_9.toString());
      console.log("ARTHX AFTER 1ST STAKE [1]: ", arthx_1st_stake_1.toString());
      console.log("ARTHX AFTER 1ST STAKE [9]: ", arthx_1st_stake_9.toString());
      console.log("REWARDS BALANCE BEFORE [1]: ", rewards_balance_1st_stake_1.toString());
      console.log("REWARDS BALANCE BEFORE [9]: ", rewards_balance_1st_stake_9.toString());

      // Note the last update time
      const block_time_before = (await time.latest()).toNumber();
      console.log("BLOCK TIME AT STAKING: ", block_time_before);

      // Note the total lastUpdateTime
      let rewards_contract_lastUpdateTime = new BigNumber(await stakingInstance_ARTH_USDC.lastUpdateTime.call());
      console.log("REWARDS CONTRACT lastUpdateTime: ", rewards_contract_lastUpdateTime.toString());

      // Note the total periodFinish
      let rewards_contract_periodFinish = new BigNumber(await stakingInstance_ARTH_USDC.periodFinish.call());
      console.log("REWARDS CONTRACT periodFinish: ", rewards_contract_periodFinish.toString());

      // Note the total lastTimeRewardApplicable
      let rewards_contract_lastTimeRewardApplicable = new BigNumber(await stakingInstance_ARTH_USDC.lastTimeRewardApplicable.call());
      console.log("REWARDS CONTRACT lastTimeRewardApplicable: ", rewards_contract_lastTimeRewardApplicable.toString());

      console.log("====================================================================");
      // Advance 7 days so the reward can be claimed
      await time.increase((7 * 86400) + 1);
      await time.advanceBlock();
      //await arthInstance.refreshCollateralRatio();

      // Note the last update time
      let block_time_after = (await time.latest()).toNumber();
      console.log("BLOCK TIME AFTER WAITING: ", block_time_after);

      // Make sure there is a valid period for the contract
      await stakingInstance_ARTH_USDC.renewIfApplicable({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the total lastUpdateTime
      rewards_contract_lastUpdateTime = new BigNumber(await stakingInstance_ARTH_USDC.lastUpdateTime.call());
      console.log("REWARDS CONTRACT lastUpdateTime: ", rewards_contract_lastUpdateTime.toString());

      // Note the total periodFinish
      rewards_contract_periodFinish = new BigNumber(await stakingInstance_ARTH_USDC.periodFinish.call());
      console.log("REWARDS CONTRACT periodFinish: ", rewards_contract_periodFinish.toString());

      // Note the total lastTimeRewardApplicable
      rewards_contract_lastTimeRewardApplicable = new BigNumber(await stakingInstance_ARTH_USDC.lastTimeRewardApplicable.call());
      console.log("REWARDS CONTRACT lastTimeRewardApplicable: ", rewards_contract_lastTimeRewardApplicable.toString());

      // Note the total ARTH supply
      const rewards_contract_stored_uni_pool = new BigNumber(await stakingInstance_ARTH_USDC.totalSupply.call()).div(BIG18);
      console.log("REWARDS CONTRACT STORED UNI POOL: ", rewards_contract_stored_uni_pool.toString());

      // Note the reward per token
      let rewards_per_token = new BigNumber(await stakingInstance_ARTH_USDC.rewardPerToken.call()).div(BIG18);
      console.log("REWARDS PER TOKEN (SINCE DEPOSIT): ", rewards_per_token.toString());

      // Print the decimals
      const staking_token_decimal = new BigNumber(await stakingInstance_ARTH_USDC.stakingDecimals.call())
      console.log("STAKING TOKEN DECIMALS: ", staking_token_decimal.toString());

      // Show the reward
      const staking_arthx_earned_1 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const staking_arthx_contract_bal_1 = new BigNumber(await stakingInstance_ARTH_USDC.rewardsFor.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const staking_arthx_earned_9 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(accounts[9])).div(BIG18);
      const staking_arthx_contract_bal_9 = new BigNumber(await stakingInstance_ARTH_USDC.rewardsFor.call(accounts[9])).div(BIG18);
      console.log("STAKING ARTHX EARNED [1]: ", staking_arthx_earned_1.toString());
      // console.log("STAKING ARTHX BALANCE IN CONTRACT [1]: ", staking_arthx_contract_bal_1.toString());
      console.log("STAKING ARTHX EARNED [9]: ", staking_arthx_earned_9.toString());
      // console.log("STAKING ARTHX BALANCE IN CONTRACT [9]: ", staking_arthx_contract_bal_9.toString());

      // await stakingInstance_ARTH_USDC.getReward({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the UNI POOL and ARTHX amounts after the reward
      const uni_pool_post_reward_1 = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arthx_post_reward_1 = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const rewards_balance_1_after = new BigNumber(await stakingInstance_ARTH_USDC.rewards.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      console.log("UNI POOL POST REWARD [1]: ", uni_pool_post_reward_1.toString());
      console.log("ARTHX POST REWARD [1]: ", arthx_post_reward_1.toString());
      console.log("REWARDS BALANCE AFTER [1]: ", rewards_balance_1_after.toString());

      console.log("====================================================================");
      console.log("USER 1 DOES AN EARLY UNI POOL WITHDRAWAL, SO STOPS ACCUMULATING REWARDS");
      await stakingInstance_ARTH_USDC.withdraw(uni_pool_tokens_1, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await time.advanceBlock();
      const uni_pool_balance_1 = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const staking_arthx_ew_earned_1 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      console.log("UNI POOL BALANCE IN CONTRACT [1]: ", uni_pool_balance_1.toString());
      console.log("STAKING ARTHX EARNED [1]: ", staking_arthx_ew_earned_1.toString());

      console.log("CLAIMING THE REWARD [1]...");
      await stakingInstance_ARTH_USDC.getReward({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await time.advanceBlock();

      const staking_arthx_ew_contract_bal_1 = new BigNumber(await stakingInstance_ARTH_USDC.rewardsFor.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      console.log("STAKING ARTHX BALANCE IN CONTRACT [1]: ", staking_arthx_ew_contract_bal_1.toString());
      console.log("WAIT A FEW DAYS FOR USER 9 TO EARN SOME MORE");
      console.log("====================================================================");

      // Advance a few days
      await time.increase((3 * 86400) + 1);
      await time.advanceBlock();

      // Make sure there is a valid period for the contract
      await stakingInstance_ARTH_USDC.renewIfApplicable({ from: COLLATERAL_ARTH_AND_ARTHS_OWNER });

      // Note the last update time
      block_time_after = (await time.latest()).toNumber();
      console.log("BLOCK TIME: ", block_time_after);

      // Note the total lastUpdateTime
      rewards_contract_lastUpdateTime = new BigNumber(await stakingInstance_ARTH_USDC.lastUpdateTime.call());
      console.log("REWARDS CONTRACT lastUpdateTime: ", rewards_contract_lastUpdateTime.toString());

      // Note the total periodFinish
      rewards_contract_periodFinish = new BigNumber(await stakingInstance_ARTH_USDC.periodFinish.call()).toNumber();
      console.log("REWARDS CONTRACT periodFinish: ", rewards_contract_periodFinish.toString());

      // Note the total lastTimeRewardApplicable
      rewards_contract_lastTimeRewardApplicable = new BigNumber(await stakingInstance_ARTH_USDC.lastTimeRewardApplicable.call()).toNumber();
      console.log("REWARDS CONTRACT lastTimeRewardApplicable: ", rewards_contract_lastTimeRewardApplicable.toString());

      rewards_per_token = new BigNumber(await stakingInstance_ARTH_USDC.rewardPerToken.call()).div(BIG18);
      console.log(`REWARDS PER TOKEN (SINCE DEPOSIT): `, rewards_per_token.toString());

      // Show the reward
      const staking_arthx_part2_earned_1 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const staking_arthx_part2_contract_bal_1 = new BigNumber(await stakingInstance_ARTH_USDC.rewardsFor.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const staking_arthx_part2_earned_9 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(accounts[9])).div(BIG18);
      // const staking_arthx_part2_contract_bal_9 = new BigNumber(await stakingInstance_ARTH_USDC.rewardsFor.call(accounts[9])).div(BIG18);
      console.log("STAKING ARTHX EARNED [1]: ", staking_arthx_part2_earned_1.toString());
      console.log("STAKING ARTHX BALANCE IN CONTRACT [1]: ", staking_arthx_part2_contract_bal_1.toString());
      console.log("STAKING ARTHX EARNED [9]: ", staking_arthx_part2_earned_9.toString());
      // console.log("STAKING ARTHX BALANCE IN CONTRACT [9]: ", staking_arthx_part2_contract_bal_9.toString());

      const uni_pool_2nd_time_balance = new BigNumber(await pair_instance_ARTH_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const arthx_2nd_time_balance = new BigNumber(await arthxInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const rewards_earned_2nd_time = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      console.log("UNI POOL 2nd_time BALANCE [1]: ", uni_pool_2nd_time_balance.toString());
      console.log("ARTHX 2nd_time BALANCE [1]: ", arthx_2nd_time_balance.toString());
      console.log("REWARDS earned 2nd_time [1]: ", rewards_earned_2nd_time.toString());

      await stakingInstance_ARTH_USDC.withdraw(uni_pool_tokens_9, { from: accounts[9] });
      await stakingInstance_ARTH_USDC.getReward({ from: accounts[9] });
      await time.advanceBlock();
    });


    it('PART 2: Locked stakes', async () => {
      console.log("====================================================================");
      console.log("NOW TRY TESTS WITH LOCKED STAKES.");
      console.log("[1] AND [9] HAVE WITHDRAWN EVERYTHING AND ARE NOW AT 0");

      // Need to approve first so the staking can use transfer
      const uni_pool_normal_1 = new BigNumber("15e18");
      const uni_pool_normal_9 = new BigNumber("5e18");
      await pair_instance_ARTH_USDC.approve(stakingInstance_ARTH_USDC.address, uni_pool_normal_1, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await pair_instance_ARTH_USDC.approve(stakingInstance_ARTH_USDC.address, uni_pool_normal_9, { from: accounts[9] });

      // Stake Normal
      await stakingInstance_ARTH_USDC.stake(uni_pool_normal_1, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await stakingInstance_ARTH_USDC.stake(uni_pool_normal_9, { from: accounts[9] });
      await time.advanceBlock();

      // Need to approve first so the staking can use transfer
      const uni_pool_locked_1 = new BigNumber("75e18");
      const uni_pool_locked_9 = new BigNumber("25e18");
      await pair_instance_ARTH_USDC.approve(stakingInstance_ARTH_USDC.address, uni_pool_locked_1, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await pair_instance_ARTH_USDC.approve(stakingInstance_ARTH_USDC.address, uni_pool_locked_9, { from: accounts[9] });

      // // Note the ARTH amounts before
      // const arth_before_1_locked = new BigNumber(await arthInstance.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      // const arth_before_9_locked = new BigNumber(await arthInstance.balanceOf.call(accounts[9])).div(BIG18);
      // console.log("ARTH_USDC Uniswap Liquidity Tokens BEFORE [1]: ", arth_before_1_locked.toString());
      // console.log("ARTH_USDC Uniswap Liquidity Tokens BEFORE [9]: ", arth_before_9_locked.toString());

      // Stake Locked
      await stakingInstance_ARTH_USDC.stakeLocked(uni_pool_locked_1, 30 * 86400, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER }); // 1 month
      await stakingInstance_ARTH_USDC.stakeLocked(uni_pool_locked_9, 180 * 86400, { from: accounts[9] }); // 6 months
      await time.advanceBlock();

      // Show the stake structs
      const locked_stake_structs_1 = await stakingInstance_ARTH_USDC.lockedStakesOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER);
      const locked_stake_structs_9 = await stakingInstance_ARTH_USDC.lockedStakesOf.call(accounts[9]);
      console.log("LOCKED STAKES [1]: ", locked_stake_structs_1);
      console.log("LOCKED STAKES [9]: ", locked_stake_structs_9);

      // Note the UNI POOL and ARTHX amount after staking
      const regular_balance_1 = new BigNumber(await stakingInstance_ARTH_USDC.balanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const boosted_balance_1 = new BigNumber(await stakingInstance_ARTH_USDC.boostedBalanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const unlocked_balance_1 = new BigNumber(await stakingInstance_ARTH_USDC.unlockedBalanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const locked_balance_1 = new BigNumber(await stakingInstance_ARTH_USDC.lockedBalanceOf.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const regular_balance_9 = new BigNumber(await stakingInstance_ARTH_USDC.balanceOf.call(accounts[9])).div(BIG18);
      const boosted_balance_9 = new BigNumber(await stakingInstance_ARTH_USDC.boostedBalanceOf.call(accounts[9])).div(BIG18);
      const unlocked_balance_9 = new BigNumber(await stakingInstance_ARTH_USDC.unlockedBalanceOf.call(accounts[9])).div(BIG18);
      const locked_balance_9 = new BigNumber(await stakingInstance_ARTH_USDC.lockedBalanceOf.call(accounts[9])).div(BIG18);
      console.log("REGULAR BALANCE [1]: ", regular_balance_1.toString());
      console.log("BOOSTED BALANCE [1]: ", boosted_balance_1.toString());
      console.log("---- UNLOCKED [1]: ", unlocked_balance_1.toString());
      console.log("---- LOCKED [1]: ", locked_balance_1.toString());
      console.log("REGULAR BALANCE [9]: ", regular_balance_9.toString());
      console.log("BOOSTED BALANCE [9]: ", boosted_balance_9.toString());
      console.log("---- UNLOCKED [9]: ", unlocked_balance_9.toString());
      console.log("---- LOCKED [9]: ", locked_balance_9.toString());

      console.log("TRY AN EARLY WITHDRAWAL (SHOULD FAIL)");
      await expectRevert.unspecified(stakingInstance_ARTH_USDC.withdrawLocked(locked_stake_structs_1[0].kek_id, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER }));
      await expectRevert.unspecified(stakingInstance_ARTH_USDC.withdrawLocked(locked_stake_structs_9[0].kek_id, { from: accounts[9] }));
      await time.advanceBlock();

      console.log("====================================================================");
      console.log("TRY WITHDRAWING AGAIN AFTER WAITING 30 DAYS");
      console.log("[1] SHOULD SUCCEED, [9] SHOULD FAIL");

      // Advance 30 days
      await time.increase(30 * 86400);
      await time.advanceBlock();

      await stakingInstance_ARTH_USDC.withdrawLocked(locked_stake_structs_1[0].kek_id, { from: COLLATERAL_ARTH_AND_ARTHS_OWNER });
      await expectRevert.unspecified(stakingInstance_ARTH_USDC.withdrawLocked(locked_stake_structs_9[0].kek_id, { from: accounts[9] }));

      const staking_arthx_earned_1 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(COLLATERAL_ARTH_AND_ARTHS_OWNER)).div(BIG18);
      const staking_arthx_earned_9 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(accounts[9])).div(BIG18);
      console.log("STAKING ARTHX EARNED [1]: ", staking_arthx_earned_1.toString());
      console.log("STAKING ARTHX EARNED [9]: ", staking_arthx_earned_9.toString());

      console.log("====================================================================");
      console.log("ADVANCING 150 DAYS");

      // Advance 150 days
      await time.increase(150 * 86400);
      await time.advanceBlock();

      await stakingInstance_ARTH_USDC.withdrawLocked(locked_stake_structs_9[0].kek_id, { from: accounts[9] });

      const staking_arthx_earned_180_9 = new BigNumber(await stakingInstance_ARTH_USDC.earned.call(accounts[9])).div(BIG18);
      console.log("STAKING ARTHX EARNED [9]: ", staking_arthx_earned_180_9.toString());

    });
  */
});
