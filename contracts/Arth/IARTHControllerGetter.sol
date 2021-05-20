// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IARTHControllerGetter {
    function getARTHSupply() external view returns (uint256);

    function getARTHInfo()
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );

    function getRefreshCooldown() external view returns (uint256);

    function getARTHPrice() external view returns (uint256);

    function getARTHXPrice() external view returns (uint256);

    function getMintingFee() external view returns (uint256);

    function getMAHAPrice() external view returns (uint256);

    function getBuybackFee() external view returns (uint256);

    function getRedemptionFee() external view returns (uint256);

    function getETHGMUPrice() external view returns (uint256);

    function getGlobalCollateralRatio() external view returns (uint256);

    function getGlobalCollateralValue() external view returns (uint256);

    function arthPools(address pool) external view returns (bool);

    function getCRForMint() external view returns (uint256);

    function getCRForRedeem() external view returns (uint256);

    function isRedeemPaused() external view returns (bool);

    function isMintPaused() external view returns (bool);

    function isBuybackPaused() external view returns (bool);

    function isRecollaterlizePaused() external view returns (bool);

    function getCRForRecollateralize() external view returns (uint256);

    function getStabilityFee() external view returns (uint256);

    function getPercentCollateralized() external view returns (uint256);

    function getTargetCollateralValue() external view returns (uint256);

    function getRecollateralizationDiscount() external view returns (uint256);
}
