// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '../ERC20/IERC20.sol';
import {Math} from '../utils/math/Math.sol';
import {SafeERC20} from '../ERC20/SafeERC20.sol';
import {IPoolToken} from '../ERC20/IPoolToken.sol';
import {SafeMath} from '../utils/math/SafeMath.sol';
import {IBasicStaking} from './IBasicStaking.sol';
import {ReentrancyGuard} from '../utils/ReentrancyGuard.sol';
import {
    BasicRewardsDistributionRecipient
} from './BasicRewardsDistributionRecipient.sol';

// forked from https://github.com/SetProtocol/index-coop-contracts/blob/master/contracts/staking/StakingRewardsV2.sol
// NOTE: V2 allows setting of rewardsDuration in constructor
contract BasicStaking is
    IBasicStaking,
    BasicRewardsDistributionRecipient,
    ReentrancyGuard
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IPoolToken;

    /* ========== STATE VARIABLES ========== */

    IPoolToken public rewardsToken;
    IERC20 public stakingToken;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration
    ) {
        rewardsToken = IPoolToken(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        rewardsDistribution = _rewardsDistribution;
        rewardsDuration = _rewardsDuration;
    }

    function initializeDefault() external onlyRewardsDistribution {
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);

        rewardRate = rewardsToken.balanceOf(address(this)).div(rewardsDuration);

        emit DefaultInitialization();
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account)
        external
        view
        override
        returns (uint256)
    {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view override returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view override returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(_totalSupply)
            );
    }

    function earned(address account) public view override returns (uint256) {
        return
            _balances[account]
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    function getRewardForDuration() external view override returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount)
        external
        override
        nonReentrant
        updateReward(msg.sender)
    {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        override
        nonReentrant
        updateReward(msg.sender)
    {
        require(amount > 0, 'Cannot withdraw 0');
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function getRewardAndDistribute()
        public
        override
        nonReentrant
        updateReward(msg.sender)
    {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, 'BoostedStaking: rewards = 0');

        rewards[msg.sender] = 0;
        emit RewardPaid(msg.sender, reward);

        rewardsToken.withdrawTo(reward, msg.sender);
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getRewardAndDistribute();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward)
        external
        override
        onlyRewardsDistribution
        updateReward(address(0))
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = rewardsToken.balanceOf(address(this));
        require(
            rewardRate <= balance.div(rewardsDuration),
            'Provided reward too high'
        );

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(
        address tokenAddress,
        address to,
        uint256 tokenAmount
    ) external onlyRewardsDistribution {
        require(
            tokenAddress != address(stakingToken),
            'Cannot withdraw the staking token'
        );
        require(
            tokenAddress != address(rewardsToken),
            'Cannot withdraw the rewards token'
        );

        IERC20(tokenAddress).safeTransfer(to, tokenAmount);
        emit Recovered(tokenAddress, to, tokenAmount);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */
    event DefaultInitialization();
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event Recovered(
        address indexed tokenAddress,
        address indexed to,
        uint256 amount
    );
}
