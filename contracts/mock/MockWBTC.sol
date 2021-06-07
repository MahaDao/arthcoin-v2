// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './MockCollateral.sol';

contract MockWBTC is MockCollateral {
    constructor() MockCollateral(msg.sender, 10000000e8, 'WBTC', 8) {}
}
