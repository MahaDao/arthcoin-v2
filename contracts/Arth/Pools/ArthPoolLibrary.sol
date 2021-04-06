// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../../Math/SafeMath.sol';

library ArthPoolLibrary {
    using SafeMath for uint256;

    // Constants for various precisions
    uint256 private constant PRICE_PRECISION = 1e6;

    // ================ Structs ================
    // Needed to lower stack size
    struct MintFF_Params {
        uint256 arthxPrice_usd;
        uint256 col_price_usd;
        uint256 arthxAmount;
        uint256 collateralAmount;
        uint256 col_ratio;
    }

    struct BuybackARTHX_Params {
        uint256 excess_collateral_dollar_value_d18;
        uint256 arthxPrice_usd;
        uint256 col_price_usd;
        uint256 arthxAmount;
    }

    // ================ Functions ================

    function calcMint1t1ARTH(uint256 col_price, uint256 collateralAmount_d18)
        public
        pure
        returns (uint256)
    {
        return (collateralAmount_d18.mul(col_price)).div(1e6);
    }

    function calcMintAlgorithmicARTH(
        uint256 arthxPrice_usd,
        uint256 arthxAmount_d18
    ) public pure returns (uint256) {
        return arthxAmount_d18.mul(arthxPrice_usd).div(1e6);
    }

    // Must be internal because of the struct
    function calcMintFractionalARTH(MintFF_Params memory params)
        internal
        pure
        returns (uint256, uint256)
    {
        // Since solidity truncates division, every division operation must be the last operation in the equation to ensure minimum error
        // The contract must check the proper ratio was sent to mint ARTH. We do this by seeing the minimum mintable ARTH based on each amount
        uint256 arthx_dollar_value_d18;
        uint256 c_dollar_value_d18;

        // Scoping for stack concerns
        {
            // USD amounts of the collateral and the ARTHX
            arthx_dollar_value_d18 = params
                .arthxAmount
                .mul(params.arthxPrice_usd)
                .div(1e6);
            c_dollar_value_d18 = params
                .collateralAmount
                .mul(params.col_price_usd)
                .div(1e6);
        }
        uint256 calculated_arthx_dollar_value_d18 =
            (c_dollar_value_d18.mul(1e6).div(params.col_ratio)).sub(
                c_dollar_value_d18
            );

        uint256 calculated_arthx_needed =
            calculated_arthx_dollar_value_d18.mul(1e6).div(
                params.arthxPrice_usd
            );

        return (
            c_dollar_value_d18.add(calculated_arthx_dollar_value_d18),
            calculated_arthx_needed
        );
    }

    function calcRedeem1t1ARTH(uint256 col_price_usd, uint256 ARTH_amount)
        public
        pure
        returns (uint256)
    {
        return ARTH_amount.mul(1e6).div(col_price_usd);
    }

    // Must be internal because of the struct
    function calcBuyBackARTHX(BuybackARTHX_Params memory params)
        internal
        pure
        returns (uint256)
    {
        // If the total collateral value is higher than the amount required at the current collateral ratio then buy back up to the possible ARTHX with the desired collateral
        require(
            params.excess_collateral_dollar_value_d18 > 0,
            'No excess collateral to buy back!'
        );

        // Make sure not to take more than is available
        uint256 arthx_dollar_value_d18 =
            params.arthxAmount.mul(params.arthxPrice_usd).div(1e6);
        require(
            arthx_dollar_value_d18 <= params.excess_collateral_dollar_value_d18,
            'You are trying to buy back more than the excess!'
        );

        // Get the equivalent amount of collateral based on the market value of ARTHX provided
        uint256 collateral_equivalent_d18 =
            arthx_dollar_value_d18.mul(1e6).div(params.col_price_usd);
        //collateral_equivalent_d18 = collateral_equivalent_d18.sub((collateral_equivalent_d18.mul(params.buybackFee)).div(1e6));

        return (collateral_equivalent_d18);
    }

    // Returns value of collateral that must increase to reach recollateralization target (if 0 means no recollateralization)
    function recollateralizeAmount(
        uint256 total_supply,
        uint256 globalCollateralRatio,
        uint256 globalCollatValue
    ) public pure returns (uint256) {
        uint256 target_collat_value =
            total_supply.mul(globalCollateralRatio).div(1e6); // We want 18 decimals of precision so divide by 1e6; total_supply is 1e18 and globalCollateralRatio is 1e6
        // Subtract the current value of collateral from the target value needed, if higher than 0 then system needs to recollateralize
        return target_collat_value.sub(globalCollatValue); // If recollateralization is not needed, throws a subtraction underflow
        // return(recollateralization_left);
    }

    function calcRecollateralizeARTHInner(
        uint256 collateralAmount,
        uint256 col_price,
        uint256 globalCollatValue,
        uint256 arth_total_supply,
        uint256 globalCollateralRatio
    ) public pure returns (uint256, uint256) {
        uint256 collat_value_attempted =
            collateralAmount.mul(col_price).div(1e6);
        uint256 effective_collateral_ratio =
            globalCollatValue.mul(1e6).div(arth_total_supply); //returns it in 1e6
        uint256 recollat_possible =
            (
                globalCollateralRatio.mul(arth_total_supply).sub(
                    arth_total_supply.mul(effective_collateral_ratio)
                )
            )
                .div(1e6);

        uint256 amount_to_recollat;
        if (collat_value_attempted <= recollat_possible) {
            amount_to_recollat = collat_value_attempted;
        } else {
            amount_to_recollat = recollat_possible;
        }

        return (amount_to_recollat.mul(1e6).div(col_price), amount_to_recollat);
    }
}
