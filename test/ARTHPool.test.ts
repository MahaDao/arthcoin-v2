import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

chai.use(solidity);


describe('ARTHPool', () => {
  const ZERO = BigNumber.from(0);
  const ETH = utils.parseEther('1');

  let owner: SignerWithAddress;
  let whale: SignerWithAddress;

  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let ARTHX: ContractFactory;
  let ARTHPool: ContractFactory;
  let SimpleOracle: ContractFactory;
  let MockCollateral: ContractFactory;
  let ARTHController: ContractFactory;
  let ARTHPoolLibrary: ContractFactory;
  let MockUniswapOracle: ContractFactory;
  let ChainlinkETHGMUOracle: ContractFactory;
  let MockChainlinkAggregatorV3: ContractFactory;

  let dai: Contract;
  let arth: Contract;
  let maha: Contract;
  let arthx: Contract;
  let arthPool: Contract;
  let gmuOracle: Contract;
  let arthMahaOracle: Contract;
  let arthController: Contract;
  let arthPoolLibrary: Contract;
  let daiETHUniswapOracle: Contract;
  let arthETHUniswapOracle: Contract;
  let chainlinkETHGMUOracle: Contract;
  let arthxETHUniswapOracle: Contract;
  let mockChainlinkAggregatorV3: Contract;

  before(' - Setup accounts & deploy libraries', async () => {
    [owner, whale] = await ethers.getSigners();

    ARTHPoolLibrary = await ethers.getContractFactory('ArthPoolLibrary');
    arthPoolLibrary = await ARTHPoolLibrary.deploy();
  });

  beforeEach(' - Fetch contract factories', async () => {
    MAHA = await ethers.getContractFactory('MahaToken');
    ARTHX = await ethers.getContractFactory('ARTHShares');
    ARTH = await ethers.getContractFactory('ARTHStablecoin');
    MockCollateral = await ethers.getContractFactory('MockCollateral');

    ARTHPool = await ethers.getContractFactory('ArthPool', {
      libraries: {
        ArthPoolLibrary: arthPoolLibrary.address
      }
    });

    SimpleOracle = await ethers.getContractFactory('SimpleOracle');
    ARTHController = await ethers.getContractFactory('ArthController');
    MockUniswapOracle = await ethers.getContractFactory('MockUniswapPairOracle');
    ChainlinkETHGMUOracle = await ethers.getContractFactory('ChainlinkETHUSDPriceConsumer');
    MockChainlinkAggregatorV3 = await ethers.getContractFactory('MockChainlinkAggregatorV3');
  });

  beforeEach(' - Deploy contracts', async () => {
    arth = await ARTH.deploy();
    maha = await MAHA.deploy();
    dai = await MockCollateral.deploy(owner.address, ETH.mul(10000), 'DAI', 18);

    gmuOracle = await SimpleOracle.deploy('GMU/USD', ETH);
    daiETHUniswapOracle = await MockUniswapOracle.deploy();
    arthETHUniswapOracle = await MockUniswapOracle.deploy();
    arthxETHUniswapOracle = await MockUniswapOracle.deploy();
    arthMahaOracle = await SimpleOracle.deploy('ARTH/MAHA', ETH);
    mockChainlinkAggregatorV3 = await MockChainlinkAggregatorV3.deploy();
    chainlinkETHGMUOracle = await ChainlinkETHGMUOracle.deploy(
      mockChainlinkAggregatorV3.address,
      gmuOracle.address
    );

    arthx = await ARTHX.deploy('ARTHX', 'ARTHX', arthxETHUniswapOracle.address, owner.address, owner.address);

    arthPoolLibrary = await ARTHPoolLibrary.deploy();
    arthController = await ARTHController.deploy(owner.address, owner.address);

    arthPool = await ARTHPool.deploy(
      arth.address,
      arthx.address,
      dai.address,
      owner.address,
      owner.address,
      maha.address,
      arthMahaOracle.address,
      arthController.address,
      ETH.mul(90000)
    );
  });

  beforeEach(' - Set some contract variables', async () => {
    arthController.setETHGMUOracle(chainlinkETHGMUOracle.address);
    await arth.addPool(arthPool.address);
    await arthController.addPool(arthPool.address);
    await arthPool.setPoolParameters(
      ETH.mul(2),
      1500,
      1000,
      1000,
      1000,
      1000
    );
    await arthController.setGlobalCollateralRatio(0);
    await arthx.setArthController(arthController.address);
    await arthPool.setCollatETHOracle(daiETHUniswapOracle.address, owner.address);
    await arthController.setARTHXETHOracle(arthxETHUniswapOracle.address, owner.address);
  })

  describe('- Mint 1:1 ARTH', async () => {
    beforeEach('Approve collateral', async () => {
      dai.approve(arthPool.address, ETH);
    })

    it('Should not mint when CR is less than 1', async () => {
      await arthController.setGlobalCollateralRatio(100);

      await expect(arthPool.mint1t1ARTH(ETH, 0)).to.revertedWith(
        'ARHTPool: Collateral ratio < 1'
      );
    })

    it('Should not mint while collateral is greater then celing', async () => {
      await arthController.setGlobalCollateralRatio(1e6);

      await expect(arthPool.mint1t1ARTH((ETH).mul(3), 0)).to.revertedWith(
        'ARTHPool: ceiling reached'
      );
    })

    it('Should not mint while arthAmountD18 is greater then arthOutMin', async () => {
      await arthController.setGlobalCollateralRatio(1e6);

      await expect(arthPool.mint1t1ARTH(ETH, ETH.mul(10))).to.revertedWith(
        'ARTHPool: Slippage limit reached'
      );
    })
  })

  describe('- Mint Algorithmic ARTH', async () => {
    beforeEach('Approve Arthx', async () => {
      arthx.approve(arthPool.address, ETH);
    })

    it('Should not mint when CR is not equal to 0', async () => {
      await arthController.setGlobalCollateralRatio(100);

      await expect(arthPool.mintAlgorithmicARTH(ETH, 0)).to.revertedWith(
        'ARTHPool: Collateral ratio != 0'
      );
    })

    it('Should not mint while arthxAmountD18 is greater then arthOutMin', async () => {
      await arthController.setGlobalCollateralRatio(0);
      //await

      await expect(arthPool.mintAlgorithmicARTH(ETH, ETH.sub(100))).to.revertedWith(
        'Slippage limit reached'
      );
    })
  })

  describe('- Mint Fractional ARTH', async () => {
    beforeEach('Approve Arthx', async () => {
      dai.approve(arthPool.address, ETH);
      arthx.approve(arthPool.address, ETH);
    })

    it('Should not mint when CR is not equal to 0', async () => {
      await arthPool.toggleUseGlobalCRForRecollateralize(false);
      await arthPool.setMintCollateralRatio(1e7);

      await expect(arthPool.mintFractionalARTH(ETH, ETH, 0)).to.revertedWith(
        'ARTHPool: fails (.000001 <= Collateral ratio <= .999999)'
      )
    })
  })
});
