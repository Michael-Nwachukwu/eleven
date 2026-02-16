// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentSplitter
 * @notice Splits ERC-20 payments between a recipient and a platform fee treasury.
 *         Users approve this contract to spend their tokens, then call splitPayment().
 *         The contract transfers the base amount to the recipient and the fee to the treasury
 *         in a single atomic transaction.
 *
 * @dev Fee is specified in basis points (bps). 250 bps = 2.5%, 50 bps = 0.5%.
 *      Maximum fee is capped at 1000 bps (10%) to prevent abuse.
 */
contract PaymentSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Address that receives platform fees
    address public treasury;

    /// @notice Maximum allowed fee in basis points (10%)
    uint256 public constant MAX_FEE_BPS = 1000;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    // =========================================================================
    // Events
    // =========================================================================

    event PaymentSplit(
        address indexed payer,
        address indexed recipient,
        address indexed token,
        uint256 baseAmount,
        uint256 feeAmount,
        uint256 feeBps
    );

    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // =========================================================================
    // Errors
    // =========================================================================

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh(uint256 feeBps, uint256 maxBps);
    error InsufficientAllowance(uint256 required, uint256 actual);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _treasury  Address to receive platform fees
     */
    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    // =========================================================================
    // Core Function
    // =========================================================================

    /**
     * @notice Split a token payment between a recipient and the platform treasury.
     * @param token     ERC-20 token address (e.g. USDC)
     * @param recipient Address to receive the base payment
     * @param amount    Base payment amount (before fee) in token's smallest unit
     * @param feeBps    Fee in basis points (e.g. 250 = 2.5%)
     *
     * @dev The caller must have approved this contract for at least (amount + fee).
     *      Fee is calculated as: fee = amount * feeBps / 10000
     *      Total pulled from caller = amount + fee
     */
    function splitPayment(
        address token,
        address recipient,
        uint256 amount,
        uint256 feeBps
    ) external nonReentrant {
        // --- Validation ---
        if (token == address(0)) revert ZeroAddress();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh(feeBps, MAX_FEE_BPS);

        // --- Calculate fee ---
        uint256 feeAmount = (amount * feeBps) / BPS_DENOMINATOR;
        uint256 totalRequired = amount + feeAmount;

        // --- Check allowance ---
        IERC20 erc20 = IERC20(token);
        uint256 allowance = erc20.allowance(msg.sender, address(this));
        if (allowance < totalRequired) {
            revert InsufficientAllowance(totalRequired, allowance);
        }

        // --- Transfer base amount to recipient ---
        erc20.safeTransferFrom(msg.sender, recipient, amount);

        // --- Transfer fee to treasury (skip if zero) ---
        if (feeAmount > 0) {
            erc20.safeTransferFrom(msg.sender, treasury, feeAmount);
        }

        emit PaymentSplit(msg.sender, recipient, token, amount, feeAmount, feeBps);
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Update the treasury address. Only callable by the contract owner.
     * @param _newTreasury New treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(old, _newTreasury);
    }

    /**
     * @notice Emergency rescue for tokens accidentally sent to this contract.
     * @param token  ERC-20 token to rescue
     * @param to     Address to send rescued tokens to
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }
}
