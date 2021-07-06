import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber, Contract, ContractFactory, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import deploy from './Deployments';
import { advanceBlock, advanceTimeAndBlock } from '../utilities';

chai.use(solidity);

describe('ARTHPool General', () => {
  let attacker: SignerWithAddress;
  let timelock: SignerWithAddress;
  let owner: SignerWithAddress;
  let ETH: BigNumber;
  let provider: JsonRpcProvider;
  let dai: Contract;
  let arthPool: Contract;
  let oracle: Contract;
  let arthController: Contract;
  let gmuOracle: Contract;
  let mahaARTHUniswapOracle: Contract;
  let daiUSDMockChainlinkAggregatorV3: Contract;

  beforeEach(' - Get deployment', async() => {
    const deployments = await deploy();

    dai = deployments.dai;
    provider = deployments.provider;
    ETH = deployments.ETH;
    arthPool = deployments.arthPool;
    oracle = deployments.oracle;
    attacker = deployments.attacker;
    timelock = deployments.timelock;
    owner = deployments.owner;
    arthController = deployments.arthController;
    gmuOracle = deployments.gmuOracle;
    mahaARTHUniswapOracle = deployments.mahaARTHUniswapOracle;
    daiUSDMockChainlinkAggregatorV3 = deployments.daiUSDMockChainlinkAggregatorV3;
  });

  describe('- Some access restricted functions', async () => {
    it(' - Should not work if not (owner || governance)', async () => {
      await expect(arthPool.connect(attacker).setCollatGMUOracle(oracle.address))
        .to.revertedWith('ArthPool: You are not the owner or the governance timelock');

      await expect(arthPool.connect(attacker).setTimelock(timelock.address))
        .to.revertedWith('ArthPool: You are not the owner or the governance timelock');

      await expect(arthPool.connect(attacker).setOwner(owner.address))
        .to.revertedWith('ArthPool: You are not the owner or the governance timelock');

      await expect(arthPool.connect(attacker).setPoolParameters(ETH.mul(2), 1))
        .to.revertedWith('ArthPool: You are not the owner or the governance timelock');
    });

    it(' - Should work if (owner || governance)', async () => {
      await expect(arthPool.connect(owner).setCollatGMUOracle(oracle.address))
        .to.not.reverted;

      await expect(arthPool.connect(timelock).setCollatGMUOracle(oracle.address))
        .to.not.reverted;

      await expect(arthPool.connect(owner).setTimelock(timelock.address))
        .to.not.reverted;

      await expect(arthPool.connect(owner).setOwner(owner.address))
        .to.not.reverted;

      await expect(arthPool.connect(owner).setPoolParameters(ETH.mul(2), 1))
        .to.not.reverted;

      await expect(arthPool.connect(timelock).setTimelock(timelock.address))
        .to.not.reverted;

      await expect(arthPool.connect(timelock).setOwner(owner.address))
        .to.not.reverted;

      await expect(arthPool.connect(timelock).setPoolParameters(ETH.mul(2), 1))
        .to.not.reverted;
    });

    it(' - Should not work if not (owner || admin || governance)', async () => {
      await expect(arthPool.connect(attacker).setBuyBackCollateralBuffer(10))
        .to.revertedWith('ArthPool: forbidden');

      await expect(arthPool.connect(attacker).setARTHController(arthController.address))
        .to.revertedWith('ArthPool: forbidden');
    });

    it(' - Should work if not (owner || admin || governance)', async () => {
      await expect(arthPool.connect(owner).setBuyBackCollateralBuffer(10))
        .to.not.reverted

      await expect(arthPool.connect(owner).setARTHController(arthController.address))
        .to.not.reverted

      await expect(arthPool.connect(timelock).setBuyBackCollateralBuffer(10))
        .to.not.reverted

      await expect(arthPool.connect(timelock).setARTHController(arthController.address))
        .to.not.reverted
    });
  });

  describe('- Getters', async () => {
    it(' - Should get global collateral ratio properly', async () => {
      await arthController.setGlobalCollateralRatio(1e6);
      expect(await arthPool.getGlobalCR())
        .to.eq(1e6);

      await arthController.setGlobalCollateralRatio(1e3);
      expect(await arthPool.getGlobalCR())
        .to.eq(1e3);
    });

    it(' - Should get collateral price properly using chainlink oracle', async () => {
      expect(await arthPool.getCollateralPrice())
        .to.eq(1e6);

      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralPrice())
        .to.eq(1063829);

      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralPrice())
        .to.eq(943396);

      await gmuOracle.setPrice(1e6);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralPrice())
        .to.eq(1063829);

      await gmuOracle.setPrice(1e6);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralPrice())
        .to.eq(943396);

      await gmuOracle.setPrice(1e3);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralPrice())
        .to.eq(BigNumber.from(1063829000));

      await gmuOracle.setPrice(1e3);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralPrice())
        .to.eq(943396000);

      await gmuOracle.setPrice(3e3);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralPrice())
        .to.eq(BigNumber.from(354609666));

      await gmuOracle.setPrice(3e3);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralPrice())
        .to.eq(314465333);

      await gmuOracle.setPrice(1e7);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralPrice())
        .to.eq(106382);

      await gmuOracle.setPrice(1e7);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralPrice())
        .to.eq(94339);
    });

    it(' - Should get collateral balance properly using chainlink oracle', async () => {
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(0);

      await dai.transfer(arthPool.address, ETH);

      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(BigNumber.from('1063829000000000000'));

      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(BigNumber.from('943396000000000000'));

      await gmuOracle.setPrice(3e3);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(BigNumber.from('354609666000000000000'));

      await gmuOracle.setPrice(3e3);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(BigNumber.from('314465333000000000000'));

      await gmuOracle.setPrice(4e7);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(106382900);
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(BigNumber.from('26595000000000000'));

      await gmuOracle.setPrice(4e7);
      await daiUSDMockChainlinkAggregatorV3.setLatestPrice(94339600);
      expect(await arthPool.getCollateralGMUBalance())
        .to.eq(BigNumber.from('23584000000000000'));
    });

    it(' - Should estimate MAHA stability fee properly', async () => {
      expect(await arthPool.estimateStabilityFeeInMAHA(ETH))
        .to.eq(BigNumber.from('0'));

      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 60);

      expect(await arthPool.estimateStabilityFeeInMAHA(ETH))
        .to.eq(BigNumber.from('0'));

      await arthController.setStabilityFee(1e4);

      expect(await arthPool.estimateStabilityFeeInMAHA(ETH))
        .to.eq(BigNumber.from('10000000000000000'));

      await mahaARTHUniswapOracle.setPrice(ETH.mul(106).div(100));
      expect(await arthPool.estimateStabilityFeeInMAHA(ETH))
        .to.eq(BigNumber.from('9433962264150943'));

      await mahaARTHUniswapOracle.setPrice(ETH.mul(94).div(100));
      expect(await arthPool.estimateStabilityFeeInMAHA(ETH))
        .to.eq(BigNumber.from('10638297872340425'));
    });

    it(' - Should return Target collateral value properly', async () => {
      await arthController.connect(owner).setGlobalCollateralRatio(11e5)
      expect(await arthPool.getTargetCollateralValue())
        .to.eq(BigNumber.from('27500000000000000000000000'));

      await arthController.connect(owner).setGlobalCollateralRatio(12e5)
      expect(await arthPool.getTargetCollateralValue())
        .to.eq(BigNumber.from('30000000000000000000000000'));
    });
  });
});
