// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './MockCollateral.sol';

contract MockUSDT is MockCollateral {
    constructor() MockCollateral(msg.sender, 500000000e6, 'USDT', 6) {}
}
