import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber, Contract, ContractFactory, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import deploy from './Deployments';
import { advanceBlock, advanceTimeAndBlock } from '../utilities';

chai.use(solidity);

describe('ARTHPool Mint', () => {
  let owner: SignerWithAddress;
  let ETH: BigNumber;
  let provider: JsonRpcProvider;
  let dai: Contract;
  let arth: Contract;
  let arthx: Contract;
  let maha: Contract;
  let arthPool: Contract;
  let oracle: Contract;;
  let arthController: Contract;
  let gmuOracle: Contract;
  let arthARTHXUniswapOracle: Contract;
  let daiETHUniswapOracle: Contract;
  let daiUSDMockChainlinkAggregatorV3: Contract;
  let simpleERCFund: Contract;

  beforeEach(' - Get deployment', async () => {
    const deployments = await deploy();

    dai = deployments.dai;
    arth = deployments.arth;
    arthx = deployments.arthx;
    maha = deployments.maha;
    provider = deployments.provider;
    ETH = deployments.ETH;
    arthPool = deployments.arthPool;
    oracle = deployments.oracle;
    owner = deployments.owner;
    arthController = deployments.arthController;
    gmuOracle = deployments.gmuOracle;
    arthARTHXUniswapOracle = deployments.arthxARTHUniswapOracle;
    daiETHUniswapOracle = deployments.daiETHUniswapOracle;
    daiUSDMockChainlinkAggregatorV3 = deployments.daiUSDMockChainlinkAggregatorV3;
    simpleERCFund = deployments.simpleERCFund;
  });

  describe('- Mint', async () => {
    beforeEach(' - Approve DAI', async () => {
      // Set higher approval for cases with different prices.
      await dai.approve(arthPool.address, ETH.mul(20));
      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 60);
    });

    it(' - Should not mint when CR = 0 || CR = 1', async () => {
      await arthController.setGlobalCollateralRatio(0);

      await expect(arthPool.mint(ETH, ETH, 0))
        .to.revertedWith('ARHTPool: Collateral ratio < MIN');

      await arthController.setGlobalCollateralRatio(2.1e6);
      await expect(arthPool.mint(ETH, ETH, 0))
        .to.revertedWith('ARHTPool: Collateral ratio > MAX');
    });

    it(' - Should not mint when collateral > ceiling', async () => {
      await dai.transfer(arthPool.address, ETH.mul(2));
      await arthController.setGlobalCollateralRatio(11e5);

      await expect(arthPool.mint(ETH, ETH, 0))
        .to.revertedWith('ARTHPool: ceiling reached');

      await expect(arthPool.mint(ETH, ETH, ETH))
        .to.revertedWith('ARTHPool: ceiling reached');
    });

    it(' - Should not mint when expected > minted', async () => {
      await arthController.setGlobalCollateralRatio(11e5);

      const arthxPrice = await arthController.getARTHXPrice();
      const expectedARTHXOutMin = ETH.mul(10).div(100).mul(1e6).div(arthxPrice);

      // Some portion of minted is taken as fee hence slippage.
      await expect(arthPool.mint(ETH, ETH.mul(90).div(100), ETH.mul(10).div(100)))
        .to.revertedWith('ARTHPool: ARTH Slippage limit reached');

      // Some portion of minted is taken as fee hence slippage.
      await expect(arthPool.mint(ETH, ETH, ETH.mul(10).div(100)))
        .to.revertedWith('ARTHPool: ARTH Slippage limit reached');

      await expect(arthPool.mint(ETH, ETH.mul(70).div(100), expectedARTHXOutMin.add(1)))
        .to.revertedWith('ARTHPool: ARTHX Slippage limit reached');

      await expect(arthPool.mint(ETH, ETH.mul(89).div(100), expectedARTHXOutMin.add(1)))
        .to.revertedWith('ARTHPool: ARTHX Slippage limit reached');
    });

    describe(' - Using collateral chainlink oracle', async () => {
      it('  - Should mint properly when DAI/USD > 1 & USD/GMU = 1 & ARTHX/GMU = 1', async () => {
        await arthController.setGlobalCollateralRatio(11e5);
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('953046000000000000');
        const expectedARTHXMint = BigNumber.from('105894000000000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU = 1 & ARTHX/GMU > 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('953046000000000000');
        const expectedARTHXMint = BigNumber.from('99900000000000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU = 1 & ARTHX/GMU < 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('953046000000000000');
        const expectedARTHXMint = BigNumber.from('112653191489361702');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU > 1 & ARTHX/GMU = 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await gmuOracle.setPrice(1.29e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('738794965500000000');
        const expectedARTHXMint = BigNumber.from('82088329500000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU > 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await gmuOracle.setPrice(1.29e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('738794965500000000');
        const expectedARTHXMint = BigNumber.from('77441820283018867');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU > 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await gmuOracle.setPrice(1.29e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('738794965500000000');
        const expectedARTHXMint = BigNumber.from('87328010106382978');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU < 1 & ARTHX/GMU = 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await gmuOracle.setPrice(0.94e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('1013878206900000000');
        const expectedARTHXMint = BigNumber.from('112653134100000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU < 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await gmuOracle.setPrice(0.94e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('1013878206900000000');
        const expectedARTHXMint = BigNumber.from('106276541603773584');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD > 1 & USD/GMU < 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(1.06e8);
        await gmuOracle.setPrice(0.94e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('1013878206900000000');
        const expectedARTHXMint = BigNumber.from('119843759680851063');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU = 1 & ARTHX/GMU = 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('845154000000000000');
        const expectedARTHXMint = BigNumber.from('93906000000000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU = 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('845154000000000000');
        const expectedARTHXMint = BigNumber.from('88590566037735849');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU = 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('845154000000000000');
        const expectedARTHXMint = BigNumber.from('99900000000000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU > 1 & ARTHX/GMU = 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);
        await gmuOracle.setPrice(1.06e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('797314687200000000');
        const expectedARTHXMint = BigNumber.from('88590520800000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU > 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);
        await gmuOracle.setPrice(1.06e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('797314687200000000');
        const expectedARTHXMint = BigNumber.from('83575963018867924');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU > 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);
        await gmuOracle.setPrice(1.06e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('797314687200000000');
        const expectedARTHXMint = BigNumber.from('94245234893617021');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU < 1 & ARTHX/GMU = 1', async () => {
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);
        await gmuOracle.setPrice(0.89e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('949610538900000000');
        const expectedARTHXMint = BigNumber.from('105512282100000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU < 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);
        await gmuOracle.setPrice(0.89e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('949610538900000000');
        const expectedARTHXMint = BigNumber.from('99539888773584905');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD < 1 & USD/GMU < 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await daiUSDMockChainlinkAggregatorV3.setLatestPrice(0.94e8);
        await gmuOracle.setPrice(0.89e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('949610538900000000');
        const expectedARTHXMint = BigNumber.from('112247108617021276');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU = 1 & ARTHX/GMU = 1', async () => {
        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('899100000000000000');
        const expectedARTHXMint = BigNumber.from('99900000000000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU = 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('899100000000000000');
        const expectedARTHXMint = BigNumber.from('94245283018867924');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU = 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('899100000000000000');
        const expectedARTHXMint = BigNumber.from('106276595744680851');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU > 1 & ARTHX/GMU = 1', async () => {
        await gmuOracle.setPrice(1.06e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('848207343600000000');
        const expectedARTHXMint = BigNumber.from('94245260400000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU > 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await gmuOracle.setPrice(1.06e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('848207343600000000');
        const expectedARTHXMint = BigNumber.from('88910623018867924');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU > 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await gmuOracle.setPrice(1.06e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('848207343600000000');
        const expectedARTHXMint = BigNumber.from('100260915319148936');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU < 1 & ARTHX/GMU = 1', async () => {
        await gmuOracle.setPrice(0.94e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('956488653900000000');
        const expectedARTHXMint = BigNumber.from('106276517100000000');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU < 1 & ARTHX/GMU > 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(106).div(100));
        await gmuOracle.setPrice(0.94e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('956488653900000000');
        const expectedARTHXMint = BigNumber.from('100260865188679245');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });

      it('  - Should mint properly when DAI/USD = 1 & USD/GMU < 1 & ARTHX/GMU < 1', async () => {
        await arthARTHXUniswapOracle.setPrice(ETH.mul(94).div(100));
        await gmuOracle.setPrice(0.94e6);

        const totalSupplyBefore = await arth.totalSupply();
        const arthBalanceBefore = await arth.balanceOf(owner.address);

        const arthxTotalSupply = await arthx.totalSupply();
        const arthxBalanceBefore = await arthx.balanceOf(owner.address);

        const collateralBalanceBefore = await dai.balanceOf(owner.address);
        const poolCollateralBalanceBefore = await dai.balanceOf(arthPool.address);

        const fee = ETH.sub(ETH.mul(BigNumber.from(1e6).sub(1000)).div(1e6));
        const expectedARTHMint = BigNumber.from('956488653900000000');
        const expectedARTHXMint = BigNumber.from('113060124574468085');

        await arthPool.mint(ETH, expectedARTHMint, expectedARTHXMint);

        expect(await arth.totalSupply()).to.eq(totalSupplyBefore.add(expectedARTHMint));
        expect(await arth.balanceOf(owner.address)).to.eq(arthBalanceBefore.add(expectedARTHMint));
        expect(await dai.balanceOf(owner.address)).to.eq(collateralBalanceBefore.sub(ETH));
        expect(await dai.balanceOf(arthPool.address)).to.eq(poolCollateralBalanceBefore.add(ETH).sub(fee));
        expect(await arthx.balanceOf(owner.address)).to.eq(arthxBalanceBefore.add(expectedARTHXMint));
        expect(await arthx.totalSupply()).to.eq(arthxTotalSupply.add(expectedARTHXMint));
        expect(await dai.balanceOf(simpleERCFund.address)).to.eq(fee);
      });
    });
  });
});
