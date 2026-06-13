// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  IAavePool
 * @notice Minimal interface for the Aave v3 Pool contract.
 *         PolicyVault uses getUserAccountData() to read the owner's health factor
 *         before allowing any agent action. Aave computes the health factor
 *         internally using Chainlink price feeds.
 *
 * Full Aave v3 pool docs: https://docs.aave.com/developers/core-contracts/pool
 */
interface IAavePool {

    /**
     * @notice Supplies `amount` of `asset` into Aave on behalf of `onBehalfOf`.
     *         The supplied tokens start earning yield immediately.
     *
     * @param asset         ERC-20 token address to supply (e.g. USDC)
     * @param amount        Amount to supply in the token's native decimals
     * @param onBehalfOf    Address that will receive the aToken (usually msg.sender)
     * @param referralCode  Referral code for Aave's referral program (use 0)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16  referralCode
    ) external;

    /**
     * @notice Withdraws `amount` of `asset` from Aave and sends it to `to`.
     *         Burns the corresponding aTokens from `onBehalfOf`.
     *
     * @param asset   ERC-20 token address to withdraw
     * @param amount  Amount to withdraw; use type(uint256).max to withdraw everything
     * @param to      Address that receives the withdrawn tokens
     * @return        The actual amount withdrawn (may differ if max was passed)
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice Borrows `amount` of `asset` from Aave.
     *         Requires sufficient collateral already supplied.
     *
     * @param asset            ERC-20 token address to borrow
     * @param amount           Amount to borrow in the token's native decimals
     * @param interestRateMode 1 = stable rate, 2 = variable rate
     * @param referralCode     Referral code (use 0)
     * @param onBehalfOf       Address that incurs the debt (usually msg.sender)
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16  referralCode,
        address onBehalfOf
    ) external;

    /**
     * @notice Repays a previously borrowed amount.
     *
     * @param asset            ERC-20 token address to repay
     * @param amount           Amount to repay; use type(uint256).max to repay everything
     * @param interestRateMode 1 = stable, 2 = variable — must match how it was borrowed
     * @param onBehalfOf       Address whose debt is being repaid
     * @return                 Actual amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /**
     * @notice Returns a summary of a user's position across all Aave markets.
     *         This is the key function PolicyVault calls — healthFactor is used
     *         to enforce the health-factor floor rule before any agent action.
     *
     * @param user  Address to query
     * @return totalCollateralBase        Total collateral in USD, 8 decimals
     * @return totalDebtBase              Total debt in USD, 8 decimals
     * @return availableBorrowsBase       How much more can be borrowed, 8 decimals
     * @return currentLiquidationThreshold Weighted avg liquidation threshold, 4 decimals
     * @return ltv                        Weighted avg loan-to-value ratio, 4 decimals
     * @return healthFactor               Collateral / debt ratio — below 1e18 means liquidatable
     *                                   Computed from Chainlink price feeds internally
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}
