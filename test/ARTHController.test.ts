import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber, Contract, ContractFactory, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock } from './utilities';

chai.use(solidity);

describe('ARTHController', () => {
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
  let MockCollateral: ContractFactory;
  let ARTHController: ContractFactory;
  let ARTHPoolLibrary: ContractFactory;
  let MockUniswapOracle: ContractFactory;
  let RecollateralizationCurve: ContractFactory;
  let MockChainlinkAggregatorV3: ContractFactory;

  let dai: Contract;
  let usdc: Contract;
  let arth: Contract;
  let maha: Contract;
  let arthx: Contract;
  let gmuOracle: Contract;
  let daiARTHPool: Contract;
  let usdcARTHPool: Contract;
  let bondingCurve: Contract;
  let daiPoolOracle: Contract;
  let usdcPoolOracle: Contract;
  let arthController: Contract;
  let arthPoolLibrary: Contract;
  let daiETHUniswapOracle: Contract;
  let usdcETHUniswapOracle: Contract;
  let arthARTHXUniswapOracle: Contract;
  let arthMAHAUniswapOracle: Contract;
  let recollaterizationCurve: Contract;

  let mockETHUSDAggregatorV3: Contract;
  let mockDAIUSDAggregatorV3: Contract;
  let mockUSDCUSDAggregatorV3: Contract;

  before(' - Setup accounts & deploy libraries', async () => {
    [owner, timelock, attacker] = await ethers.getSigners();

    ARTHPoolLibrary = await ethers.getContractFactory('ArthPoolLibrary');
    arthPoolLibrary = await ARTHPoolLibrary.deploy();
  });

  before(' - Fetch contract factories', async () => {
    MAHA = await ethers.getContractFactory('MahaToken');
    ARTHX = await ethers.getContractFactory('ARTHShares');
    ARTH = await ethers.getContractFactory('ARTHStablecoin');
    MockCollateral = await ethers.getContractFactory('MockCollateral');
    ARTHController = await ethers.getContractFactory('ArthController');
    RecollateralizationCurve = await ethers.getContractFactory(
      'RecollateralDiscountCurve'
    );

    ARTHPool = await ethers.getContractFactory('ArthPool', {
      libraries: {
        ArthPoolLibrary: arthPoolLibrary.address,
      },
    });

    SimpleOracle = await ethers.getContractFactory('SimpleOracle');
    BondingCurve = await ethers.getContractFactory('BondingCurve');
    Oracle = await ethers.getContractFactory('UniversalGMUOracle');

    MockUniswapOracle = await ethers.getContractFactory(
      'MockUniswapPairOracle'
    );
    MockChainlinkAggregatorV3 = await ethers.getContractFactory(
      'MockChainlinkAggregatorV3'
    );
  });

  beforeEach(' - Deploy contracts', async () => {
    arth = await ARTH.deploy();
    maha = await MAHA.deploy();
    arthx = await ARTHX.deploy();
    dai = await MockCollateral.deploy(
      owner.address,
      ETH.mul(10000),
      'DAI',
      18
    );
    usdc = await MockCollateral.deploy(
      owner.address,
      ETH.mul(10000),
      'USDC',
      18
    );

    arthController = await ARTHController.deploy(
      arth.address,
      arthx.address,
      maha.address,
      owner.address,
      timelock.address
    );

    bondingCurve = await BondingCurve.deploy(1300e6);

    daiETHUniswapOracle = await MockUniswapOracle.deploy();
    usdcETHUniswapOracle = await MockUniswapOracle.deploy();
    arthMAHAUniswapOracle = await MockUniswapOracle.deploy();
    arthARTHXUniswapOracle = await MockUniswapOracle.deploy();

    gmuOracle = await SimpleOracle.deploy('GMU/USD', ETH.div(1e12));
    mockETHUSDAggregatorV3 = await MockChainlinkAggregatorV3.deploy();
    mockDAIUSDAggregatorV3 = await MockChainlinkAggregatorV3.deploy();
    mockUSDCUSDAggregatorV3 = await MockChainlinkAggregatorV3.deploy();

    daiARTHPool = await ARTHPool.deploy(
      arth.address,
      arthx.address,
      dai.address,
      owner.address,
      owner.address,
      maha.address,
      arthController.address,
      ETH.mul(90000)
    );
    usdcARTHPool = await ARTHPool.deploy(
      arth.address,
      arthx.address,
      usdc.address,
      owner.address,
      owner.address,
      maha.address,
      arthController.address,
      ETH.mul(90000)
    );

    daiPoolOracle = await Oracle.deploy(
      dai.address,
      owner.address, // Temp address for weth in mock oracles.
      daiETHUniswapOracle.address,
      mockDAIUSDAggregatorV3.address,
      gmuOracle.address
    );

    usdcPoolOracle = await Oracle.deploy(
      usdc.address,
      owner.address, // Temp address for weth in mock oracles.
      usdcETHUniswapOracle.address,
      mockUSDCUSDAggregatorV3.address,
      gmuOracle.address
    );

    recollaterizationCurve = await RecollateralizationCurve.deploy();
  });

  beforeEach(' - Set some contract variables', async () => {
    await arthx.setARTHAddress(arth.address);
    await arthx.setArthController(arthController.address);

    await arthController.addPool(daiARTHPool.address);
    await arthController.addPool(usdcARTHPool.address);

    await daiARTHPool.setCollatGMUOracle(daiPoolOracle.address);
    await usdcARTHPool.setCollatGMUOracle(usdcPoolOracle.address);

    await arthController.setARTHXGMUOracle(arthARTHXUniswapOracle.address);
    await arthController.setMAHAGMUOracle(arthMAHAUniswapOracle.address);

    await arthController.setFeesParameters(1000, 1000, 1000);
    await daiARTHPool.setPoolParameters(ETH.mul(2), 1);
    await usdcARTHPool.setPoolParameters(ETH.mul(2), 1);

    await arthController.setRecollateralizationCurve(recollaterizationCurve.address);
    await arthController.setBondingCurve(bondingCurve.address);

    await mockETHUSDAggregatorV3.setLatestPrice(ETH.div(1e10));
    await mockDAIUSDAggregatorV3.setLatestPrice(ETH.div(1e10));
    await mockUSDCUSDAggregatorV3.setLatestPrice(ETH.div(1e10));
  });

  describe('- Access restricted functions', async () => {
    it(' - Should not work if not COLLATERAL_RATIO_PAUSER', async () => {
      await expect(arthController.connect(attacker).toggleCollateralRatio())
        .to.revertedWith('ARTHController: FORBIDDEN');

      await expect(arthController.connect(owner).toggleCollateralRatio())
        .to.revertedWith('ARTHController: FORBIDDEN');
    });

    it(' - Should work if COLLATERAL_RATIO_PAUSER', async () => {
      await expect(arthController.connect(timelock).toggleCollateralRatio())
        .to.not.reverted;

      expect(await arthController.isColalteralRatioPaused()).to.eq(true);

      await expect(arthController.connect(timelock).toggleCollateralRatio())
        .to.not.reverted;

      expect(await arthController.isColalteralRatioPaused()).to.eq(false);
    });

    it(' - Should not work if not DEFAULT_ADMIN_ROLE', async () => {
      await expect(arthController.connect(attacker).setGlobalCollateralRatio(1e5))
        .to.revertedWith('ARTHController: FORBIDDEN');

      await expect(arthController.connect(timelock).setGlobalCollateralRatio(1e5))
        .to.revertedWith('ARTHController: FORBIDDEN');
    });

    it(' - Should work if DEFAULT_ADMIN_ROLE', async () => {
      await expect(arthController.connect(owner).setGlobalCollateralRatio(1e5))
        .to.not.reverted;

      expect(await arthController.globalCollateralRatio()).to.eq(1e5);
    });

    it(' - Should not work if not appropriate role', async () => {
      await expect(arthController.toggleMinting()).to.revertedWith('');

      await expect(arthController.connect(attacker).toggleMinting()).to.revertedWith('');

      await expect(arthController.toggleRedeeming()).to.revertedWith('');
      await expect(arthController.connect(attacker).toggleRedeeming()).to.revertedWith('');

      await expect(arthController.toggleRecollateralize()).to.revertedWith('');
      await expect(arthController.connect(attacker).toggleRecollateralize()).to.revertedWith('');

      await expect(arthController.toggleBuyBack()).to.revertedWith('');
      await expect(arthController.connect(attacker).toggleBuyBack()).to.revertedWith('');
    });

    it(' - Should work if appropriate role', async () => {
      await expect(arthController.connect(timelock).toggleMinting())
        .to.not.reverted;

      expect(await arthController.isMintPaused()).to.eq(true);
      expect(await arthController.mintPaused()).to.eq(true);

      await expect(arthController.connect(timelock).toggleRedeeming())
        .to.not.reverted;

      expect(await arthController.isRedeemPaused()).to.eq(true);
      expect(await arthController.redeemPaused()).to.eq(true);

      await expect(arthController.connect(timelock).toggleRecollateralize())
        .to.not.reverted;

      expect(await arthController.isRecollaterlizePaused()).to.eq(false);

      await expect(arthController.connect(timelock).toggleBuyBack())
        .to.not.reverted;

      expect(await arthController.isBuybackPaused()).to.eq(false);

      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 61);

      await expect(arthController.connect(timelock).toggleBuyBack())
        .to.not.reverted;

      await expect(arthController.connect(timelock).toggleRecollateralize())
        .to.not.reverted;

      expect(await arthController.isMintPaused()).to.eq(true);
      expect(await arthController.isRedeemPaused()).to.eq(true);
      expect(await arthController.isBuybackPaused()).to.eq(true);
      expect(await arthController.isRecollaterlizePaused()).to.eq(true);
    });
  });

  describe('- Simpler Getters', async () => {
    it(' - Should get global CR correctly', async () => {
      expect(await arthController.getGlobalCollateralRatio()).to.eq(11e5);

      await arthController.setGlobalCollateralRatio(1e3);
      expect(await arthController.connect(owner).getGlobalCollateralRatio())
        .to.eq(1e3);

      await arthController.setGlobalCollateralRatio(1e6);
      expect(await arthController.connect(owner).getGlobalCollateralRatio())
        .to.eq(1e6);
    });

    it(' - Should get fees correctly', async () => {
      expect(await arthController.stabilityFee()).to.eq(0);

      await arthController.setStabilityFee(9);
      expect(await arthController.stabilityFee()).to.eq(9);

      await arthController.setFeesParameters(1e6, 1e6, 1e6);
      expect(await arthController.mintingFee()).to.eq(1e6);

      expect(await arthController.redemptionFee()).to.eq(1e6);

      expect(await arthController.buybackFee()).to.eq(1e6);
    });

    it(' - Should get paused or not correctly', async () => {
      expect(await arthController.isMintPaused()).to.eq(true);

      expect(await arthController.isRedeemPaused()).to.eq(true);

      expect(await arthController.isRecollaterlizePaused()).to.eq(true);

      expect(await arthController.isBuybackPaused()).to.eq(true);

      await arthController.connect(owner).deactivateGenesis();

      expect(await arthController.isMintPaused()).to.eq(false);

      expect(await arthController.isRedeemPaused()).to.eq(false);

      expect(await arthController.isRecollaterlizePaused()).to.eq(true);

      expect(await arthController.isBuybackPaused()).to.eq(true);
    });

    it(' - Should get ARTH info correctly during genesis', async () => {
      await arthController.setFeesParameters(1e6, 1e6, 1e6);

      const arthInfo = await arthController.getARTHInfo();

      expect(arthInfo[0]).to.eq(0);
      expect(arthInfo[1]).to.eq(1e4);
      expect(arthInfo[2]).to.eq(ETH.mul(25000000));
      expect(arthInfo[3]).to.eq(11e5);
      expect(arthInfo[4]).to.eq(0);
      expect(arthInfo[5]).to.eq(1e6);
      expect(arthInfo[6]).to.eq(1e6);
      expect(arthInfo[7]).to.eq(1e6);
    });

    it(' - Should get ARTH info correctly after genesis', async () => {
      await arthController.setFeesParameters(1e6, 1e6, 1e6);
      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 60);

      const arthInfo = await arthController.getARTHInfo();

      expect(arthInfo[0]).to.eq(0);
      expect(arthInfo[1]).to.eq(1e6);
      expect(arthInfo[2]).to.eq(ETH.mul(25000000));
      expect(arthInfo[3]).to.eq(11e5);
      expect(arthInfo[4]).to.eq(0);
      expect(arthInfo[5]).to.eq(1e6);
      expect(arthInfo[6]).to.eq(1e6);
      expect(arthInfo[7]).to.eq(1e6);
    });
  });

  describe('- Prices', async () => {
    it(' - Should work correctly for ARTHX price', async () => {
      expect(await arthController.getARTHXPrice()).to.eq(1e4);

      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 60);

      expect(await arthController.getARTHXPrice()).to.eq(1e6);

      await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
      expect(await arthController.getARTHXPrice()).to.eq(1060000);

      await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
      expect(await arthController.getARTHXPrice()).to.eq(0.94e6);
    });

    it(' - Should work correctly for MAHA price', async () => {
      expect(await arthController.getMAHAPrice()).to.eq(1e6);

      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 60);

      expect(await arthController.getMAHAPrice()).to.eq(1e6);

      await arthMAHAUniswapOracle.setPrice(ETH.mul(106).div(100));
      expect(await arthController.getMAHAPrice()).to.eq(1060000);

      await arthMAHAUniswapOracle.setPrice(ETH.mul(94).div(100));
      expect(await arthController.getMAHAPrice()).to.eq(0.94e6);
    });
  });

  describe('- Collateral value', async () => {
    beforeEach(' - Transfer tokens to pools', async () => {
      await dai.transfer(daiARTHPool.address, ETH.mul(2));
      await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
    });

    describe(' - Chainlink based collateral oracles', async () => {
      it('  - Should work correctly when (DAI/USD = 1) && (USDC/USD = 1) && (GMU/USD = 1)', async () => {
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7));
      });

      it('  - Should work correctly when (DAI/USD = 1) && (USDC/USD = 1) && (GMU/USD > 1)', async () => {
        await gmuOracle.setPrice(1063829);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(940000).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(940000).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(940000).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD = 1) && (USDC/USD = 1) && (GMU/USD < 1)', async () => {
        await gmuOracle.setPrice(943396);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(1060000).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(1060000).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1060000).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD > 1) && (USDC/USD > 1) && (GMU/USD = 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(106382900);
        await mockUSDCUSDAggregatorV3.setLatestPrice(106382900);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(1063829).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(1063829).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1063829).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD > 1) && (USDC/USD > 1) && (GMU/USD > 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(106382900);
        await mockUSDCUSDAggregatorV3.setLatestPrice(106382900);

        await gmuOracle.setPrice(1063829);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(1000000).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(1000000).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1000000).div(1e6));

        await gmuOracle.setPrice(1093829);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(972573).div(1e6));

        await gmuOracle.setPrice(2e6);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(531914).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD > 1) && (USDC/USD > 1) && (GMU/USD < 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(106382900);
        await mockUSDCUSDAggregatorV3.setLatestPrice(106382900);
        await gmuOracle.setPrice(943396);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(1127659).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(1127659).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1127659).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD < 1) && (USDC/USD < 1) && (GMU/USD = 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(94339600);
        await mockUSDCUSDAggregatorV3.setLatestPrice(94339600);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(943396).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(943396).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(943396).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD < 1) && (USDC/USD < 1) && (GMU/USD > 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(94339600);
        await mockUSDCUSDAggregatorV3.setLatestPrice(94339600);
        await gmuOracle.setPrice(1063829);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(886792).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(886792).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(886792).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD < 1) && (USDC/USD < 1) && (GMU/USD < 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(94339600);
        await mockUSDCUSDAggregatorV3.setLatestPrice(94339600);

        await gmuOracle.setPrice(943396);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(4).mul(1000000).div(1e6));

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(5).mul(1000000).div(1e6));

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1000000).div(1e6));

        await gmuOracle.setPrice(893396);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1055966).div(1e6));

        await gmuOracle.setPrice(5e5);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(ETH.mul(7).mul(1886792).div(1e6));
      });

      it('  - Should work correctly when (DAI/USD > 1) && (USDC/USD < 1) && (GMU/USD = 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(106382900);
        await mockUSDCUSDAggregatorV3.setLatestPrice(94339600);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(2).mul(1063829).div(1e6).add(ETH.mul(2).mul(943396).div(1e6))
          );

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1063829).div(1e6).add(ETH.mul(2).mul(943396).div(1e6))
          );

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1063829).div(1e6).add(ETH.mul(4).mul(943396).div(1e6))
          );
      });

      it('  - Should work correctly when (DAI/USD > 1) && (USDC/USD < 1) && (GMU/USD < 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(106382900);
        await mockUSDCUSDAggregatorV3.setLatestPrice(94339600);

        await gmuOracle.setPrice(943396);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(2).mul(1127659).div(1e6).add(ETH.mul(2).mul(1000000).div(1e6))
          );

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1127659).div(1e6).add(ETH.mul(2).mul(1000000).div(1e6))
          );

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1127659).div(1e6).add(ETH.mul(4).mul(1000000).div(1e6))
          );

        await gmuOracle.setPrice(893396);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1190769).div(1e6).add(ETH.mul(4).mul(1055966).div(1e6))
          );

        await gmuOracle.setPrice(5e5);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(2127658).div(1e6).add(ETH.mul(4).mul(1886792).div(1e6))
          );
      });

      it('  - Should work correctly when (DAI/USD > 1) && (USDC/USD < 1) && (GMU/USD > 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(106382900);
        await mockUSDCUSDAggregatorV3.setLatestPrice(94339600);

        await gmuOracle.setPrice(1063829);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(2).mul(1000000).div(1e6).add(ETH.mul(2).mul(886792).div(1e6))
          );

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1000000).div(1e6).add(ETH.mul(2).mul(886792).div(1e6))
          );

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(1000000).div(1e6).add(ETH.mul(4).mul(886792).div(1e6))
          );

        await gmuOracle.setPrice(1093829);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(972573).div(1e6).add(ETH.mul(4).mul(862471).div(1e6))
          );

        await gmuOracle.setPrice(1293829);
        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(3).mul(822233).div(1e6).add(ETH.mul(4).mul(729150).div(1e6))
          );
      });

      it('  - Should work correctly when (DAI/USD < 1) && (USDC/USD > 1) && (GMU/USD = 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(94339600);
        await mockUSDCUSDAggregatorV3.setLatestPrice(106382900);

        expect(await arthController.getGlobalCollateralValue())
          .to.eq(
            ETH.mul(2).mul(1063829).div(1e6).add(ETH.mul(2).mul(943396).div(1e6))
          );

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(2).mul(1063829).div(1e6).add(ETH.mul(3).mul(943396).div(1e6))
        );

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(4).mul(1063829).div(1e6).add(ETH.mul(3).mul(943396).div(1e6))
        );
      });

      it('  - Should work correctly when (DAI/USD < 1) && (USDC/USD > 1) && (GMU/USD < 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(94339600);
        await mockUSDCUSDAggregatorV3.setLatestPrice(106382900);

        await gmuOracle.setPrice(943396);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(2).mul(1000000).div(1e6).add(ETH.mul(2).mul(1127659).div(1e6))
        );

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(1000000).div(1e6).add(ETH.mul(2).mul(1127659).div(1e6))
        );

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(1000000).div(1e6).add(ETH.mul(4).mul(1127659).div(1e6))
        );

        await gmuOracle.setPrice(893396);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(1055966).div(1e6).add(ETH.mul(4).mul(1190769).div(1e6))
        );

        await gmuOracle.setPrice(973396);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(969180).div(1e6).add(ETH.mul(4).mul(1092904).div(1e6))
        );
      });

      it('  - Should work correctly when (DAI/USD < 1) && (USDC/USD > 1) && (GMU/USD > 1)', async () => {
        await mockDAIUSDAggregatorV3.setLatestPrice(94339600);
        await mockUSDCUSDAggregatorV3.setLatestPrice(106382900);

        await gmuOracle.setPrice(1063829);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(2).mul(886792).div(1e6).add(ETH.mul(2).mul(1000000).div(1e6))
        );

        await dai.transfer(daiARTHPool.address, ETH);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(886792).div(1e6).add(ETH.mul(2).mul(1000000).div(1e6))
        );

        await usdc.transfer(usdcARTHPool.address, ETH.mul(2));
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(886792).div(1e6).add(ETH.mul(4).mul(1000000).div(1e6))
        );

        await gmuOracle.setPrice(1093829);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(862471).div(1e6).add(ETH.mul(4).mul(972573).div(1e6))
        );

        await gmuOracle.setPrice(1293829);
        expect(await arthController.getGlobalCollateralValue()).to.eq(
          ETH.mul(3).mul(729150).div(1e6).add(ETH.mul(4).mul(822233).div(1e6))
        );
      });
    });
  });
});
