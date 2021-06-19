// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../utils/math/SafeMath.sol';
import {IOracle} from './IOracle.sol';
import {IChainlinkOracle} from './IChainlinkOracle.sol';
import {AggregatorV3Interface} from './AggregatorV3Interface.sol';

contract ChainlinkETHUSDPriceConsumer is IChainlinkOracle {
    using SafeMath for uint256;

    /**
     * State variables.
     */

    IOracle public gmuOracle;
    AggregatorV3Interface public priceFeed;

    uint256 public priceFeedDecimals = 8;

    /**
     * Constructor.
     */
    constructor(address priceFeed_, IOracle gmuOracle_) {
        priceFeed = AggregatorV3Interface(priceFeed_);
        gmuOracle = gmuOracle_;
        priceFeedDecimals = priceFeed.decimals();
    }

    /**
     * Publics.
     */

    function getGmuPrice() public view override returns (uint256) {
        // Scale back gmuOracle to 8 deciamls precision(the same we expect from normal chainlink oracle).
        // NOTE: assuming gmuOracle returns price in e6 format.
        return gmuOracle.getPrice().mul(100);
    }

    function getLatestUSDPrice() public view override returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();

        return uint256(price);
    }

    function getLatestPrice() public view override returns (uint256) {
        return
            getLatestUSDPrice().mul(getGmuPrice()).div(10**priceFeedDecimals);
    }

    function getDecimals() public view override returns (uint8) {
        return priceFeed.decimals();
    }
}
