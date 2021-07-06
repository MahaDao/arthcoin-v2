// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {IERC20} from "../ERC20/IERC20.sol";
import {Ownable} from "../access/Ownable.sol";
import {SafeMath} from "../utils/math/SafeMath.sol";
import {
    IUniswapV2Router02
} from "../Uniswap/Interfaces/IUniswapV2Router02.sol";
import {IBoardroom} from "../boardroom/core/IBoardroom.sol";

contract FeeRouter is Ownable {
    using SafeMath for uint256;

    IERC20 public immutable USDC;
    IBoardroom public BoardroomARTH;
    IBoardroom public BoardroomARTHX;

    uint256 public totalSwapped = 0;

    event AllocateToBoardroom(address indexed boardroom, uint256 amount);

    constructor(
        IERC20 usdc,
        IBoardroom boardroomARTH,
        IBoardroom boardroomARTHX
    ) {
        USDC = usdc;
        BoardroomARTH = boardroomARTH;
        BoardroomARTHX = boardroomARTHX;
    }

    function setBoardrooms(IBoardroom boardroomARTH, IBoardroom boardroomARTHX)
        external
        onlyOwner
    {
        BoardroomARTH = boardroomARTH;
        BoardroomARTHX = boardroomARTHX;
    }

    function swap(
        IERC20 token,
        uint256 amount,
        IUniswapV2Router02 router
    )
        external
        payable
        onlyOwner
        returns (uint256) {
        // Swap intput tokens for output tokens.
        uint256 usdcRecievedAfterSwap = _swapForUSDC(
            token,
            amount,
            router
        );

        // Update the counter to keep track of swapped tokens.
        totalSwapped = totalSwapped.add(usdcRecievedAfterSwap);

        // Distribute the USDC to boardrooms.
        _distributeToBoardrooms(usdcRecievedAfterSwap);

        return usdcRecievedAfterSwap;
    }

    function _distributeToBoardrooms(
        uint256 amount
    )
        internal
    {
        uint256 amountToARTHBoardroom = amount.mul(50).div(100);
        uint256 amountToARTHXBoardroom = amount.sub(amountToARTHBoardroom);

        USDC.approve(address(BoardroomARTH), amountToARTHBoardroom);
        USDC.approve(address(BoardroomARTHX), amountToARTHXBoardroom);

        BoardroomARTH.allocateSeigniorage(amountToARTHBoardroom);
        BoardroomARTHX.allocateSeigniorage(amountToARTHXBoardroom);

        emit AllocateToBoardroom(
            address(BoardroomARTH),
            amountToARTHBoardroom
        );
        emit AllocateToBoardroom(
            address(BoardroomARTHX),
            amountToARTHXBoardroom
        );
    }

    function _swapForUSDC(
        IERC20 token,
        uint256 amountIn,
        IUniswapV2Router02 router
    )
        internal
        returns (uint256)
    {
        // Get the amount from the owner.
        token.transferFrom(msg.sender, address(this), amountIn);
        token.approve(address(router), amountIn);

        // Setup the input and output tokens.
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(USDC);

        // Find the minimum out tokens exepcted and then swap tokens.
        uint256[] memory amountsOut = router.getAmountsOut(amountIn, path);
        uint256[] memory swapAmountsOut = router.swapExactTokensForTokens(
            amountIn,
            amountsOut[1],
            path,
            address(this),
            block.timestamp
        );

        // Make sure we have recieved atleast the minimum no. of tokens
        // we expected.
        require(
            swapAmountsOut[1] >= amountsOut[1],
            "FeeRouter: INSUFFICIENT_OUT_AMOUNT"
        );

        // Return the amount recieved.
        return swapAmountsOut[1];
    }
}
