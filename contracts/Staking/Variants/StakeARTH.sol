// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../BasicStaking.sol';

contract StakeARTH is BasicStaking {
    constructor(
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    )
        BasicStaking(
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken,
            3 * 30 days
        )
    {}
}
