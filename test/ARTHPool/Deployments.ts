import { ethers } from 'hardhat';
import { Contract, ContractFactory, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

export default async () => {
  const { provider } = ethers;
  const ETH = utils.parseEther('1');

  let owner: SignerWithAddress;
  let timelock: SignerWithAddress;
  let attacker: SignerWithAddress;

  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let ARTHX: ContractFactory;
  let Oracle: ContractFactory;
  let ARTHPool: ContractFactory;
  let BondingCurve: ContractFactory;
  let SimpleOracle: ContractFactory;
  let SimpleERCFund: ContractFactory;
  let MockCollateral: ContractFactory;
  let ARTHController: ContractFactory;
  let ARTHPoolLibrary: ContractFactory;
  let MockUniswapOracle: ContractFactory;
  let RecollateralizationCurve: ContractFactory;
  let MockChainlinkAggregatorV3: ContractFactory;

  let dai: Contract;
  let arth: Contract;
  let maha: Contract;
  let arthx: Contract;
  let oracle: Contract;
  let arthPool: Contract;
  let gmuOracle: Contract;
  let bondingCurve: Contract;
  let simpleERCFund: Contract;
  let arthController: Contract;
  let arthPoolLibrary: Contract;
  let daiETHUniswapOracle: Contract;
  let mahaARTHUniswapOracle: Contract;
  let arthxARTHUniswapOracle: Contract;
  let recollaterizationCurve: Contract;
  let ethUSDMockChainlinkAggregatorV3: Contract;
  let daiUSDMockChainlinkAggregatorV3: Contract;

  [owner, timelock, attacker] = await ethers.getSigners();

  ARTHPoolLibrary = await ethers.getContractFactory('ArthPoolLibrary');
  arthPoolLibrary = await ARTHPoolLibrary.deploy();

  MAHA = await ethers.getContractFactory('MahaToken');
  ARTHX = await ethers.getContractFactory('ARTHShares');
  ARTH = await ethers.getContractFactory('ARTHStablecoin');
  MockCollateral = await ethers.getContractFactory('MockCollateral');

  ARTHPool = await ethers.getContractFactory('ArthPool', {
    libraries: {
      ArthPoolLibrary: arthPoolLibrary.address,
    },
  });

  SimpleOracle = await ethers.getContractFactory('SimpleOracle');
  Oracle = await ethers.getContractFactory('UniversalGMUOracle');
  ARTHController = await ethers.getContractFactory('ArthController');

  BondingCurve = await ethers.getContractFactory(
    'BondingCurve'
  );
  MockUniswapOracle = await ethers.getContractFactory(
    'MockUniswapPairOracle'
  );
  RecollateralizationCurve = await ethers.getContractFactory(
    'RecollateralDiscountCurve'
  );
  MockChainlinkAggregatorV3 = await ethers.getContractFactory(
    'MockChainlinkAggregatorV3'
  );
  SimpleERCFund = await ethers.getContractFactory(
    'SimpleERCFund'
  );

  arth = await ARTH.deploy();
  maha = await MAHA.deploy();
  arthx = await ARTHX.deploy();
  simpleERCFund = await SimpleERCFund.deploy();
  dai = await MockCollateral.deploy(owner.address, ETH.mul(1000000000), 'DAI', 18);

  bondingCurve = await BondingCurve.deploy(1e6);
  gmuOracle = await SimpleOracle.deploy('GMU/USD', ETH.div(1e12));  // 1e6.
  daiETHUniswapOracle = await MockUniswapOracle.deploy();
  mahaARTHUniswapOracle = await MockUniswapOracle.deploy();
  arthxARTHUniswapOracle = await MockUniswapOracle.deploy();
  ethUSDMockChainlinkAggregatorV3 = await MockChainlinkAggregatorV3.deploy();
  daiUSDMockChainlinkAggregatorV3 = await MockChainlinkAggregatorV3.deploy();

  arthController = await ARTHController.deploy(
    arth.address,
    arthx.address,
    maha.address,
    owner.address,
    timelock.address
  );
  arthController.setBondingCurve(bondingCurve.address);

  arthPool = await ARTHPool.deploy(
    arth.address,
    arthx.address,
    dai.address,
    owner.address,
    timelock.address,
    maha.address,
    arthController.address,
    ETH.mul(90000)
  );

  oracle = await Oracle.deploy(
    dai.address,
    owner.address, // Temp address for weth in mock oracles.
    daiETHUniswapOracle.address,
    daiUSDMockChainlinkAggregatorV3.address,
    gmuOracle.address
  );

  recollaterizationCurve = await RecollateralizationCurve.deploy();

  await arthx.setARTHAddress(arth.address);
  await arthController.addPool(arthPool.address);
  await arthx.setArthController(arthController.address);
  await arth.setArthController(arthController.address);

  await arthPool.setCollatGMUOracle(oracle.address);
  await arthPool.setFund(simpleERCFund.address);

  await arthController.setARTHXGMUOracle(arthxARTHUniswapOracle.address);
  await arthController.setMAHAGMUOracle(mahaARTHUniswapOracle.address);
  await arthController.setRecollateralizationCurve(recollaterizationCurve.address);
  await arthController.setFeesParameters(
    1000,
    1000,
    1000
  );

  await arthPool.setPoolParameters(ETH.mul(2), 1);
  await ethUSDMockChainlinkAggregatorV3.setLatestPrice(ETH.div(1e10));
  await daiUSDMockChainlinkAggregatorV3.setLatestPrice(ETH.div(1e10));

  return {
    provider,
    ETH,
    owner,
    timelock,
    attacker,
    dai,
    arth,
    maha,
    arthx,
    oracle,
    arthPool,
    gmuOracle,
    bondingCurve,
    simpleERCFund,
    arthController,
    arthPoolLibrary,
    daiETHUniswapOracle,
    mahaARTHUniswapOracle,
    arthxARTHUniswapOracle,
    recollaterizationCurve,
    ethUSDMockChainlinkAggregatorV3,
    daiUSDMockChainlinkAggregatorV3,
  };
}
