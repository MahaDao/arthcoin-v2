import Web3 from 'web3';
import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceBlock, latestBlocktime, encodeParameters, advanceTimeAndBlock} from './utilities';


chai.use(solidity);


describe('Staking Reward', () => {
  const { provider } = ethers;

  const ETH = utils.parseEther('1');
  const HALF_ETH = ETH.mul(50).div(100);

  let owner: SignerWithAddress;
  let whale: SignerWithAddress;
  let whale2: SignerWithAddress;
  let timelock: SignerWithAddress;

  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let ARTHX: ContractFactory;
  let SimpleOracle: ContractFactory;
  let MockCollateral: ContractFactory;
  let ARTHController: ContractFactory;
  let BoostedStaking: ContractFactory;
  let MockUniswapOracle: ContractFactory;
  let ChainlinkETHGMUOracle: ContractFactory;
  let MockChainlinkAggregatorV3: ContractFactory;

  let dai: Contract;
  let arth: Contract;
  let maha: Contract;
  let arthx: Contract;
  let gmuOracle: Contract;
  let boostedStaking: Contract;
  let arthMahaOracle: Contract;
  let arthController: Contract;
  let daiETHUniswapOracle: Contract;
  let arthETHUniswapOracle: Contract;
  let chainlinkETHGMUOracle: Contract;
  let arthxETHUniswapOracle: Contract;
  let mockChainlinkAggregatorV3: Contract;

  before(' - Setup accounts', async () => {
    [owner, whale, whale2, timelock] = await ethers.getSigners();
  });

  before(' - Fetch contract factories', async () => {
    MAHA = await ethers.getContractFactory('MahaToken');
    ARTHX = await ethers.getContractFactory('ARTHShares');
    ARTH = await ethers.getContractFactory('ARTHStablecoin');
    MockCollateral = await ethers.getContractFactory('MockCollateral');
    SimpleOracle = await ethers.getContractFactory('SimpleOracle');
    ARTHController = await ethers.getContractFactory('ArthController');
    BoostedStaking = await ethers.getContractFactory('BoostedStaking');
    MockUniswapOracle = await ethers.getContractFactory('MockUniswapPairOracle');
    ChainlinkETHGMUOracle = await ethers.getContractFactory('ChainlinkETHUSDPriceConsumer');
    MockChainlinkAggregatorV3 = await ethers.getContractFactory('MockChainlinkAggregatorV3');
  });

  beforeEach(' - Deploy contracts', async () => {
    arth = await ARTH.deploy();
    maha = await MAHA.deploy();
    dai = await MockCollateral.deploy(owner.address, ETH.mul(10000), 'DAI', 18);

    gmuOracle = await SimpleOracle.deploy('GMU/USD', ETH.div(1e12)); // Keep the price of gmuOracle as 1e6 for simplicity sake.
    daiETHUniswapOracle = await MockUniswapOracle.deploy();
    arthETHUniswapOracle = await MockUniswapOracle.deploy();
    arthxETHUniswapOracle = await MockUniswapOracle.deploy();
    arthMahaOracle = await SimpleOracle.deploy('ARTH/MAHA', ETH.div(1e12)); // Keep the price of gmuOracle as 1e6 for simplicity sake.
    mockChainlinkAggregatorV3 = await MockChainlinkAggregatorV3.deploy();

    chainlinkETHGMUOracle = await ChainlinkETHGMUOracle.deploy(
      mockChainlinkAggregatorV3.address,
      gmuOracle.address
    );

    arthx = await ARTHX.deploy(
      arthxETHUniswapOracle.address,
      owner.address,
      owner.address
    );
    arthController = await ARTHController.deploy(
      arth.address,
      owner.address,
      owner.address
    );

    boostedStaking = await BoostedStaking.deploy(
      owner.address,
      owner.address,
      maha.address,
      arth.address,
      arthController.address,
      timelock.address,
      1000
    );
  });

  beforeEach(' - Set some contract variables', async () => {
    arthController.setETHGMUOracle(chainlinkETHGMUOracle.address);
    await arthx.setARTHAddress(arth.address);
    await arthController.setGlobalCollateralRatio(0);
    await arthx.setArthController(arthController.address);
    await arthController.setARTHXETHOracle(arthxETHUniswapOracle.address, owner.address);
    await boostedStaking.setArthController(arthController.address);

    await arth.transfer(whale.address, ETH.mul(1000));
    await arth.transfer(whale2.address, ETH.mul(1000));

    await mockChainlinkAggregatorV3.setLatestPrice(ETH.div(1e10));  // Keep the price of mock chainlink oracle as 1e8 for simplicity sake.

    await maha.transfer(boostedStaking.address, ETH.mul(1000000));
    await boostedStaking.initializeDefault();
  });

  describe('- Access restricted functions', async() => {
    it(' - Should not work if not (owner || governance)', async() => {
      await expect(boostedStaking.connect(whale).setArthController(owner.address))
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).setRewardsDuration(ETH))
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).setMultipliers(ETH, ETH))
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).setLockedStakeTimeForMinAndMaxMultiplier(ETH, ETH))
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).initializeDefault())
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).greylistAddress(owner.address))
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).unlockStakes())
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).setRewardRate(1))
        .to
        .revertedWith('You are not the owner or the governance timelock');

      await expect(boostedStaking.connect(whale).setOwnerAndTimelock(whale.address, whale.address))
        .to
        .revertedWith('You are not the owner or the governance timelock');
    });

    it(' - Should work if (owner || governance)', async () => {
      await expect(boostedStaking.connect(owner).setArthController(owner.address))
        .to.not.reverted;
      await expect(boostedStaking.connect(timelock).setArthController(owner.address))
        .to.not.reverted;

      await advanceTimeAndBlock(provider, 7 * 24 * 60 * 61);
      boostedStaking.connect(owner).setRewardsDuration(10);
      expect(await boostedStaking.rewardsDuration())
        .to
        .eq(10);
      boostedStaking.connect(timelock).setRewardsDuration(7);
      expect(await boostedStaking.rewardsDuration())
        .to
        .eq(7);

      await boostedStaking.connect(owner).setMultipliers(ETH, ETH);
      expect(await boostedStaking.lockedStakeMaxMultiplier())
        .to
        .eq(ETH);
      expect(await boostedStaking.crBoostMaxMultiplier())
        .to
        .eq(ETH);
      await boostedStaking.connect(timelock).setMultipliers(1, 1);
      expect(await boostedStaking.lockedStakeMaxMultiplier())
        .to
        .eq(1);
      expect(await boostedStaking.crBoostMaxMultiplier())
        .to
        .eq(1);

      // await boostedStaking.connect(owner).setLockedStakeTimeForMinAndMaxMultiplier(1, 1);
      // expect(await boostedStaking.lockedStakeTimeGorMaxMultiplier())
      //   .to
      //   .eq(1);
      // expect(await boostedStaking.lockedStakeMinTime())
      //   .to
      //   .eq(1);
      // await boostedStaking.connect(timelock).setLockedStakeTimeForMinAndMaxMultiplier(2, 2);
      // expect(await boostedStaking.lockedStakeTimeGorMaxMultiplier())
      //   .to
      //   .eq(2);
      // expect(await boostedStaking.lockedStakeMinTime())
      //   .to
      //   .eq(2);

      await expect(boostedStaking.connect(owner).initializeDefault())
        .to
        .emit(boostedStaking, 'DefaultInitialization');
      await expect(boostedStaking.connect(timelock).initializeDefault())
        .to
        .emit(boostedStaking,  'DefaultInitialization');

      await boostedStaking.connect(owner).greylistAddress(owner.address)
      expect(await boostedStaking.greylist(owner.address))
        .to
        .eq(true);
      await boostedStaking.connect(timelock).greylistAddress(owner.address)
      expect(await boostedStaking.greylist(owner.address))
        .to
        .eq(false);

      await boostedStaking.connect(owner).unlockStakes();
      expect(await boostedStaking.isLockedStakes())
        .to
        .eq(true);
      await boostedStaking.connect(timelock).unlockStakes();
      expect(await boostedStaking.isLockedStakes())
        .to
        .eq(false);

      await boostedStaking.connect(owner).setRewardRate(1);
      expect(await boostedStaking.rewardRate())
        .to
        .eq(1);
      await boostedStaking.connect(timelock).setRewardRate(10);
      expect(await boostedStaking.rewardRate())
        .to
        .eq(10);

      await boostedStaking.connect(owner).setOwnerAndTimelock(whale.address, whale2.address);
      expect(await boostedStaking.ownerAddress())
        .to
        .eq(whale.address);
      expect(await boostedStaking.timelockAddress())
        .to
        .eq(whale2.address);
      await boostedStaking.connect(whale2).setOwnerAndTimelock(owner.address, timelock.address);
      expect(await boostedStaking.ownerAddress())
        .to
        .eq(owner.address);
      expect(await boostedStaking.timelockAddress())
        .to
        .eq(timelock.address);
    });
  });

  describe('- Stake', async () => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(2));
    });

    it(' - Should work for 1 account', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.stake(ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(owner.address, ETH);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );

      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );

      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);

      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(ETH);

      // Stake once again.
      await expect(boostedStaking.stake(ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(owner.address, ETH);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH).sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.add(ETH));
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(ETH.add(ETH));
    });

    it(' - Should work for 2 accounts with same amounts', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.stake(ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(owner.address, ETH);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBefore);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(0);

      await expect(boostedStaking.connect(whale).stake(ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        )
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.add(ETH)
        );
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(ETH);
    });

    it(' - Should work for 2 accounts with different amounts', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.stake(ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(owner.address, ETH);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBefore);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(0);

      await expect(boostedStaking.connect(whale).stake(ETH.mul(2)))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH.mul(2));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH).sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.add(ETH).add(ETH)
        );
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(
          ETH.add(ETH)
        );
    });

    it(' - Should fail for grey listed addresses', async () => {
      await boostedStaking.greylistAddress(owner.address);
      await expect(boostedStaking.stake(ETH))
        .to
        .revertedWith('address has been greylisted');

      await boostedStaking.greylistAddress(whale.address);
      await expect(boostedStaking.connect(whale).stake(ETH))
        .to
        .revertedWith('address has been greylisted');
    });
  });

  describe('- Stake for', async () => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale2).approve(boostedStaking.address, ETH.mul(2));
    });

     it(' - Should fail if called by non pool address', async () => {
      await expect(boostedStaking.connect(whale).stakeFor(whale2.address, whale2.address, ETH))
        .to
        .revertedWith('Staking: FORBIDDEN');
       await expect(boostedStaking.connect(whale).stakeFor(whale2.address, whale.address, ETH))
         .to
         .revertedWith('Staking: FORBIDDEN');
       await expect(boostedStaking.connect(whale).stakeFor(whale2.address, owner.address, ETH))
         .to
         .revertedWith('Staking: FORBIDDEN');

      await expect(boostedStaking.connect(timelock).stakeFor(whale2.address, whale2.address, ETH))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(timelock).stakeFor(whale2.address, whale.address, ETH))
         .to
         .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(timelock).stakeFor(whale2.address, owner.address, ETH))
        .to
        .revertedWith('Staking: FORBIDDEN');

      await expect(boostedStaking.connect(whale2).stakeFor(whale2.address, whale2.address, ETH))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(whale2).stakeFor(whale2.address, whale.address, ETH))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(whale2).stakeFor(whale2.address, owner.address, ETH))
        .to
        .revertedWith('Staking: FORBIDDEN');
    });

    it(' - Should fail for grey listed addresses', async () => {
      await boostedStaking.greylistAddress(whale.address);
      await expect(boostedStaking.stakeFor(whale.address, whale.address, ETH))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.stakeFor(whale.address, owner.address, ETH))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.stakeFor(whale.address, whale2.address, ETH))
        .to
        .revertedWith('address has been greylisted');

      await boostedStaking.greylistAddress(whale2.address);
      await expect(boostedStaking.stakeFor(whale2.address, whale.address, ETH))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.stakeFor(whale2.address, whale2.address, ETH))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.stakeFor(whale2.address, owner.address, ETH))
        .to
        .revertedWith('address has been greylisted');
    });

    it(' - Should work for 1 account, where staker is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeFor(whale.address, whale.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH)

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH
        );
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(
          ETH
        );
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(
          0
        );
    });

    it(' - Should work for 1 account, where another user is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeFor(whale.address, whale2.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH)

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore
        );
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH
        );
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(
          ETH
        );
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(
          0
        );
      expect(await boostedStaking.unlockedBalanceOf(whale2.address))
        .to
        .eq(
          0
        );
    });

    it(' - Should work for 2 accounts with same amounts, where stakers are spenders', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeFor(whale.address, whale.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH)
      await expect(boostedStaking.connect(owner).stakeFor(whale2.address, whale2.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale2.address, ETH)

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        );

      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore);
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.mul(2)
        );
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale2.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with same amounts, where other users are spenders', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH);
      await expect(boostedStaking.connect(owner).stakeFor(whale2.address, whale.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale2.address, ETH);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        );

      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore.sub(ETH));
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(whale2ARTHBalanceBefore);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.mul(2)
        );
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale2.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with different amounts where stakers are spenders', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeFor(whale.address, whale.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH)
      await expect(boostedStaking.connect(owner).stakeFor(whale2.address, whale2.address, ETH.mul(2)))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale2.address, ETH.mul(2))

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH.mul(2))
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(3));
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale2.address))
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with different amounts where other users are spenders', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale.address, ETH)
      await expect(boostedStaking.connect(owner).stakeFor(whale2.address, whale.address, ETH.mul(2)))
        .to
        .emit(boostedStaking, 'Staked')
        .withArgs(whale2.address, ETH.mul(2))

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH).sub(ETH)
        );
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(3));
      expect(await boostedStaking.unlockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.unlockedBalanceOf(whale2.address))
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.unlockedBalanceOf(owner.address))
        .to
        .eq(0);
    });
  });

  describe('- Stake locked', async () => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale2).approve(boostedStaking.address, ETH.mul(2));
    });

    it(' - Should fail for grey listed addresses', async () => {
      await boostedStaking.greylistAddress(owner.address);
      await expect(boostedStaking.stakeLocked(ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');

      await boostedStaking.greylistAddress(whale.address);
      await expect(boostedStaking.connect(whale).stakeLocked(ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');
    });

    it(' - Should not work lockTime = 0', async () => {
      await expect(boostedStaking.stakeLocked(ETH, 0))
        .to
        .revertedWith('Cannot wait for a negative number');
    });

    it(' - Should not work for lockTime < 7 days', async () => {
      await arth.connect(owner).approve(boostedStaking.address, ETH);
      await expect(boostedStaking.stakeLocked(ETH, 604700))
        .to
        .revertedWith('Minimum stake time not met (' + 604800 + ')');
    });

    it(' - Should not work for lockTime > 3Y', async () => {
      await arth.connect(owner).approve(boostedStaking.address, ETH);
      await expect(boostedStaking.stakeLocked(ETH, 94608001))
        .to
        .revertedWith('You are trying to stake for too long');
    });

    it(' - Should work for 1 account', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.stakeLocked(ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(owner.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );

      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );

      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);

      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(ETH);

      // Stake once again.
      await expect(boostedStaking.stakeLocked(ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(owner.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH).sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.add(ETH));
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(ETH.add(ETH));
    });

    it(' - Should work for 2 accounts with same amount', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.stakeLocked(ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(owner.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBefore);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(0);

      await expect(await boostedStaking.connect(whale).stakeLocked(ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        )
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.add(ETH)
        );
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
    });

    it(' - Should work for 2 accounts with different amounts', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(await boostedStaking.stakeLocked(ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(owner.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBefore);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(0);

      await expect(await boostedStaking.connect(whale).stakeLocked(ETH.mul(2), 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH.mul(2), 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH).sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.add(ETH).add(ETH)
        );
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(
          ETH.add(ETH)
        );
    });
  });

  describe('- Stake locked for', async () => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale2).approve(boostedStaking.address, ETH.mul(2));
    });

    it(' - Should fail if called by non pool address', async () => {
      await expect(boostedStaking.connect(whale).stakeLockedFor(whale.address, whale.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(whale).stakeLockedFor(whale.address, whale2.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(whale).stakeLockedFor(whale.address, owner.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');

      await expect(boostedStaking.connect(timelock).stakeLockedFor(whale.address, whale.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(timelock).stakeLockedFor(whale.address, whale2.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(timelock).stakeLockedFor(whale.address, owner.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');

      await expect(boostedStaking.connect(whale2).stakeLockedFor(whale2.address, whale.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(whale2).stakeLockedFor(whale2.address, whale2.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
      await expect(boostedStaking.connect(whale2).stakeLockedFor(whale2.address, owner.address, ETH, 41472000))
        .to
        .revertedWith('Staking: FORBIDDEN');
    });

    it(' - Should fail for grey listed addresses', async () => {
      await boostedStaking.greylistAddress(whale.address);
      await expect(boostedStaking.stakeLockedFor(whale.address, whale.address, ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.stakeLockedFor(whale.address, whale2.address, ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.stakeLockedFor(whale.address, owner.address, ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');

      await boostedStaking.greylistAddress(whale2.address);
      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, whale2.address, ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, whale.address, ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');
      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH, 41472000))
        .to
        .revertedWith('address has been greylisted');
    });

    it(' - Should not work lockTime = 0', async () => {
      await expect(boostedStaking.stakeLockedFor(whale.address, whale.address, ETH, 0))
        .to
        .revertedWith('Cannot wait for a negative number');
      await expect(boostedStaking.stakeLockedFor(whale.address, whale2.address, ETH, 0))
        .to
        .revertedWith('Cannot wait for a negative number');
      await expect(boostedStaking.stakeLockedFor(whale.address, owner.address, ETH, 0))
        .to
        .revertedWith('Cannot wait for a negative number');
    });

    it(' - Should not work for lockTime < 7 days.', async () => {
      await expect(boostedStaking.stakeLockedFor(whale.address, whale.address, ETH, 604700))
        .to
        .revertedWith('Minimum stake time not met (' + 604800 + ')');
      await expect(boostedStaking.stakeLockedFor(whale.address, owner.address, ETH, 604700))
        .to
        .revertedWith('Minimum stake time not met (' + 604800 + ')');
      await expect(boostedStaking.stakeLockedFor(whale.address, whale2.address, ETH, 604700))
        .to
        .revertedWith('Minimum stake time not met (' + 604800 + ')');
    });

    it(' - Should not work for lockTime > 3Y', async () => {
      await arth.connect(owner).approve(boostedStaking.address, ETH);
      await expect(boostedStaking.stakeLockedFor(whale.address, whale.address, ETH, 94608001))
        .to
        .revertedWith('You are trying to stake for too long');
      await expect(boostedStaking.stakeLockedFor(whale.address, whale2.address, ETH, 94608001))
        .to
        .revertedWith('You are trying to stake for too long');
      await expect(boostedStaking.stakeLockedFor(whale.address, owner.address, ETH, 94608001))
        .to
        .revertedWith('You are trying to stake for too long');
    });

    it(' - Should work for 1 account where staker is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale.address, whale.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 1 account where another user is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale.address, owner.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH)
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore.sub(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with same amount where staker is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale.address, whale.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, whale2.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale2.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        );

      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore);
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(
          ETH.mul(2)
        );
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale2.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with same amount where another user is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale.address, whale2.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale2.address, ETH, 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add(ETH).add(ETH)
        );

      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBefore);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore.sub(ETH));
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH)
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale2.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with different amounts', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale.address, whale.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);
      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, whale2.address, ETH.mul(2), 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale2.address, ETH.mul(2), 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add((ETH).mul(3))
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH.mul(2))
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(3));
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale2.address))
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(0);
    });

    it(' - Should work for 2 accounts with different amounts where another user is spender', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await expect(boostedStaking.connect(owner).stakeLockedFor(whale.address, whale2.address, ETH, 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale.address, ETH, 41472000);
      await expect(boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH.mul(2), 41472000))
        .to
        .emit(boostedStaking, 'StakeLocked')
        .withArgs(whale2.address, ETH.mul(2), 41472000);

      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(
          contractARTHBalanceBefore.add((ETH).mul(3))
        );
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(
          whaleARTHBalanceBefore
        );
      expect(await arth.balanceOf(whale2.address))
        .to
        .eq(
          whale2ARTHBalanceBefore.sub(ETH)
        );
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(
          ownerARTHBalanceBefore.sub(ETH.mul(2))
        );
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(3));
      expect(await boostedStaking.lockedBalanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.lockedBalanceOf(whale2.address))
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.lockedBalanceOf(owner.address))
        .to
        .eq(0);
    });
  });

  describe('- Withdraw', async() => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale2).approve(boostedStaking.address, ETH.mul(2));
    });

    it(' - Should fail for amount = 0', async () => {
      await expect(boostedStaking.withdraw(0))
        .to
        .revertedWith('Cannot withdraw 0');
    });

    it(' - Should not withdraw for non staker', async() => {
      await expect(boostedStaking.connect(owner).withdraw(ETH))
        .to
        .revertedWith('');

      await expect(boostedStaking.connect(whale).withdraw(ETH))
        .to
        .revertedWith('');
    });

    it(' - Should not work if withdrawing > staked', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stake(ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);

      await expect(boostedStaking.connect(owner).withdraw(ETH.mul(105).div(100)))
        .to
        .revertedWith('');

      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
    });

    it(' - Should work for 1 account', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stake(ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);

      await boostedStaking.connect(owner).withdraw(ETH);

      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });

    it(' - Should work properly for 1 account if withdrawing < staked', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stake(ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);

      await boostedStaking.connect(owner).withdraw(HALF_ETH);

      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(HALF_ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(HALF_ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(HALF_ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(HALF_ETH));
    });

    it(' - Should work properly if non staker tries withdraw after someone has staked', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stake(ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);

      await expect(boostedStaking.connect(whale).withdraw(HALF_ETH))
        .to
        .revertedWith('');
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);

      await boostedStaking.connect(owner).withdraw(HALF_ETH);

      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(HALF_ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(HALF_ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(HALF_ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(HALF_ETH));
    });

    it(' - Should work for 2 accounts with same amount', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBeforeStaking = await arth.balanceOf(whale.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.connect(owner).stake(ETH);
      await boostedStaking.connect(whale).stake(ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH.mul(2)));

      await boostedStaking.connect(owner).withdraw(ETH)
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));

      await boostedStaking.connect(whale).withdraw(ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });

    it(' - Should work if someone has staked on my behalf', async() => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBefore.add(ETH));

      await boostedStaking.connect(whale).withdraw(ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore.sub(ETH));
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBefore.add(ETH));
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(0);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBefore);
    });

    it(' - Should work for 2 accounts with different amount', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBeforeStaking = await arth.balanceOf(whale.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.connect(owner).stake(ETH);
      await boostedStaking.connect(whale).stake(ETH.mul(2));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(3));
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH.mul(2));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH.mul(3)));

      await boostedStaking.connect(owner).withdraw(ETH)
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.mul(2));
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking.sub(ETH.mul(2)));
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH.mul(2));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH).add(ETH));

      await boostedStaking.connect(whale).withdraw(ETH.mul(2));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });
  });

  describe('- Withdraw locked', async() => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(2));
      await arth.connect(whale2).approve(boostedStaking.address, ETH.mul(2));
    });

    it(' - Should not withdraw if non staker', async () => {
      const latestBlockTime = await latestBlocktime(provider);
      const kekId = encodeParameters(
        ['address', 'uint256', 'uint256'],
        [owner.address, latestBlockTime, ETH]
      );
      const kedIDSha3 = Web3.utils.sha3(kekId);

      await expect(boostedStaking.connect(owner).withdrawLocked(kedIDSha3))
        .to
        .revertedWith('Stake not found');

      await expect(boostedStaking.connect(whale).withdrawLocked(kedIDSha3))
        .to
        .revertedWith('Stake not found');
    });

    it(' - Should not withdraw if staker but invalid kekId', async () => {
      let latestBlockTime = await latestBlocktime(provider);
      await boostedStaking.stake(ETH);
      await boostedStaking.connect(whale).stake(ETH);

      const kekId = encodeParameters(
        ['address', 'uint256', 'uint256'],
        [owner.address, latestBlockTime, ETH]
      );
      const kedIDSha3 = Web3.utils.sha3(kekId);

      await expect(boostedStaking.connect(owner).withdrawLocked(kedIDSha3))
        .to
        .revertedWith('Stake not found');

      await expect(boostedStaking.connect(whale).withdrawLocked(kedIDSha3))
        .to
        .revertedWith('Stake not found');
    });

    it(' - Should work for 1 account', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stakeLocked(ETH, 604800);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);

      const lockedStake = await boostedStaking._lockedStakesOf(owner.address);
      await advanceTimeAndBlock(provider, 604800);
      await boostedStaking.connect(owner).withdrawLocked(lockedStake[0].kekId);

      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });

    it(' - Should work for some who locks stake on my behalf', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBeforeStaking = await arth.balanceOf(whale.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stakeLockedFor(whale.address, owner.address, ETH, 604800);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH);

      const lockedStake = await boostedStaking._lockedStakesOf(whale.address);
      await advanceTimeAndBlock(provider, 604800);
      await boostedStaking.connect(whale).withdrawLocked(lockedStake[0].kekId);

      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking.add(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });

    it(' - Should work for 2 account with same amount', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBeforeStaking = await arth.balanceOf(whale.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stakeLocked(ETH, 604800);
      await boostedStaking.connect(whale).stakeLocked(ETH, 604800);

      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH).add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.add(ETH));
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH);

      const lockedStakeOwner = await boostedStaking._lockedStakesOf(owner.address);
      const lockedStakeWhale = await boostedStaking._lockedStakesOf(whale.address);
      await advanceTimeAndBlock(provider, 604800);
      await boostedStaking.connect(owner).withdrawLocked(lockedStakeOwner[0].kekId);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH));

      await boostedStaking.connect(whale).withdrawLocked(lockedStakeWhale[0].kekId);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(0);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });

    it(' - Should work for 2 account with different amount', async () => {
      const ownerARTHBalanceBeforeStaking = await arth.balanceOf(owner.address);
      const whaleARTHBalanceBeforeStaking = await arth.balanceOf(whale.address);
      const contractARTHBalanceBeforeStaking = await arth.balanceOf(boostedStaking.address);

      await boostedStaking.stakeLocked(ETH, 604800);
      await boostedStaking.connect(whale).stakeLocked(ETH.mul(2), 604800);

      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking.sub(ETH));
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking.sub(ETH).sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH).add(ETH).add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.add(ETH).add(ETH));
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(ETH);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH.add(ETH));

      const lockedStakeOwner = await boostedStaking._lockedStakesOf(owner.address);
      const lockedStakeWhale = await boostedStaking._lockedStakesOf(whale.address);
      await advanceTimeAndBlock(provider, 604800);
      await boostedStaking.connect(owner).withdrawLocked(lockedStakeOwner[0].kekId);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(ETH.add(ETH));
      expect(await boostedStaking.totalSupply())
        .to
        .eq(ETH.add(ETH));
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking.sub(ETH).sub(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking.add(ETH).add(ETH));

      await boostedStaking.connect(whale).withdrawLocked(lockedStakeWhale[0].kekId);
      expect(await boostedStaking.balanceOf(owner.address))
        .to
        .eq(0);
      expect(await boostedStaking.balanceOf(whale.address))
        .to
        .eq(0);
      expect(await boostedStaking.totalSupply())
        .to
        .eq(0);
      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(whale.address))
        .to
        .eq(whaleARTHBalanceBeforeStaking);
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBeforeStaking);
    });
  });

  describe('- Recover token', async() => {
    it('- Should not recover staking token', async () => {
      await arth.approve(boostedStaking.address, ETH);

      await boostedStaking.stake(ETH);
      await expect(boostedStaking.recoverERC20(arth.address, ETH))
        .to
        .revertedWith('');
    });

    it('- Should recover staking token', async() => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
      const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);

      await arth.approve(boostedStaking.address, ETH);

      await expect(boostedStaking.recoverERC20(maha.address, ETH))
        .to
        .emit(boostedStaking, 'Recovered')
        .withArgs(maha.address, ETH);

      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore);
      expect(await maha.balanceOf(owner.address))
        .to
        .eq(ownerMAHABalanceBefore.add(ETH));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBefore);
      expect(await maha.balanceOf(boostedStaking.address))
        .to
        .eq(contractMAHABalanceBefore.sub(ETH));
    });

    it('- Should recover staking token', async () => {
      const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
      const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
      const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
      const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);

      await arth.approve(boostedStaking.address, ETH);
      await expect(boostedStaking.recoverERC20(maha.address, ETH.div(2)))
        .to
        .emit(boostedStaking, 'Recovered')
        .withArgs(maha.address, ETH.div(2));

      expect(await arth.balanceOf(owner.address))
        .to
        .eq(ownerARTHBalanceBefore);
      expect(await maha.balanceOf(owner.address))
        .to
        .eq(ownerMAHABalanceBefore.add(ETH.div(2)));
      expect(await arth.balanceOf(boostedStaking.address))
        .to
        .eq(contractARTHBalanceBefore);
      expect(await maha.balanceOf(boostedStaking.address))
        .to
        .eq(contractMAHABalanceBefore.sub(ETH.div(2)));
    });
  });

  describe('- Get rewards', async() => {
    beforeEach(' - Approve staking token', async () => {
      await arth.approve(boostedStaking.address, ETH.mul(4));
      await arth.connect(whale).approve(boostedStaking.address, ETH.mul(4));
      await arth.connect(whale2).approve(boostedStaking.address, ETH.mul(4));
    });

    describe(' - Without proper amount for people using Stake', async() => {
      it('  - Should not work if not staked', async () => {
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);

        await expect(boostedStaking.connect(owner).getReward())
          .to
          .revertedWith('BoostedStaking: rewards = 0');

        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
      });

      it('  - Should work for 1 account', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);

        await boostedStaking.stake(ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stake(ETH);
        await boostedStaking.connect(whale).stake(ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at different time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stake(ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(whale).stake(ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stake(ETH);
        await boostedStaking.connect(whale).stake(ETH.mul(2));
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stake(ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(whale).stake(ETH.mul(2));
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });
    });

    describe(' - Without proper amount for people using Stake For', async () => {
      it('  - Should not work if not staked', async () => {
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);

        await expect(boostedStaking.connect(owner).getReward())
          .to
          .revertedWith('BoostedStaking: rewards = 0');

        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
      });

      it('  - Should work for 1 account', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);

        await boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH));
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH);
        await boostedStaking.connect(owner).stakeFor(whale2.address, owner.address, ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at different time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(owner).stakeFor(whale2.address, owner.address, ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH);
        await boostedStaking.connect(owner).stakeFor(whale2.address, owner.address, ETH.mul(2));
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeFor(whale.address, owner.address, ETH);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(owner).stakeFor(whale2.address, owner.address, ETH.mul(2));
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });
    });

    describe(' - Without proper amount for people using Stake locked', async () => {
      it('  - Should not work if not staked', async () => {
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);

        await expect(boostedStaking.connect(owner).getReward())
          .to
          .revertedWith('BoostedStaking: rewards = 0');

        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
      });

      it('  - Should work for 1 account', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);

        await boostedStaking.stakeLocked(ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stakeLocked(ETH, 604801);
        await boostedStaking.connect(whale).stakeLocked(ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at different time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stakeLocked(ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(whale).stakeLocked(ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stakeLocked(ETH, 604801);
        await boostedStaking.connect(whale).stakeLocked(ETH.mul(2), 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);

        await boostedStaking.stakeLocked(ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(whale).stakeLocked(ETH.mul(2), 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .eq(whaleMAHABalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .gt(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });
    });

    describe(' - Without proper amount for people using Stake Locked For', async () => {
      it('  - Should not work if not staked', async () => {
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);

        await expect(boostedStaking.connect(owner).getReward())
          .to
          .revertedWith('BoostedStaking: rewards = 0');

        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
      });

      it('  - Should work for 1 account', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);

        await boostedStaking.connect(owner).stakeLockedFor(whale.address, owner.address, ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH));
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH));
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeLockedFor(whale.address, owner.address, ETH, 604801);
        await boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with same amount and claim at different time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeLockedFor(whale.address, owner.address, ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeLockedFor(whale.address, owner.address, ETH, 604801);
        await boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH.mul(2), 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });

      it('  - Should work for 2 account, that stake with different amount and claim at same time', async () => {
        const ownerARTHBalanceBefore = await arth.balanceOf(owner.address);
        const ownerMAHABalanceBefore = await maha.balanceOf(owner.address);
        const contractARTHBalanceBefore = await arth.balanceOf(boostedStaking.address);
        const contractMAHABalanceBefore = await maha.balanceOf(boostedStaking.address);
        const whaleARTHBalanceBefore = await arth.balanceOf(whale.address);
        const whaleMAHABalanceBefore = await maha.balanceOf(whale.address);
        const whale2ARTHBalanceBefore = await arth.balanceOf(whale2.address);
        const whale2MAHABalanceBefore = await maha.balanceOf(whale2.address);

        await boostedStaking.connect(owner).stakeLockedFor(whale.address, owner.address, ETH, 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);
        await boostedStaking.connect(owner).stakeLockedFor(whale2.address, owner.address, ETH.mul(2), 604801);
        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale).getReward();
        let newMahaBalanceOfContract = await maha.balanceOf(boostedStaking.address);
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .eq(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);

        await advanceTimeAndBlock(provider, 2 * 24 * 60 * 60);

        await boostedStaking.connect(whale2).getReward();
        expect(await arth.balanceOf(owner.address))
          .to
          .eq(ownerARTHBalanceBefore.sub(ETH).sub(ETH).sub(ETH));
        expect(await arth.balanceOf(whale.address))
          .to
          .eq(whaleARTHBalanceBefore);
        expect(await arth.balanceOf(whale2.address))
          .to
          .eq(whale2ARTHBalanceBefore);
        expect(await arth.balanceOf(boostedStaking.address))
          .to
          .eq(contractARTHBalanceBefore.add(ETH).add(ETH).add(ETH));
        expect(await maha.balanceOf(owner.address))
          .to
          .eq(ownerMAHABalanceBefore);
        expect(await maha.balanceOf(whale.address))
          .to
          .gt(whaleMAHABalanceBefore);
        expect(await maha.balanceOf(whale2.address))
          .to
          .gt(whale2MAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(contractMAHABalanceBefore);
        expect(await maha.balanceOf(boostedStaking.address))
          .to
          .lt(newMahaBalanceOfContract);
      });
    });
  });
});
