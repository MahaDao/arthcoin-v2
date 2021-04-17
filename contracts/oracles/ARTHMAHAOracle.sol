// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SimpleOracle} from './core/SimpleOracle.sol';

contract ARTHMAHAOracle is SimpleOracle {
    constructor(string memory _name, uint256 _price)
        SimpleOracle(_name, _price)
    {}
}