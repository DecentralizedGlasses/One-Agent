// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  AggregatorV3Interface
 * @notice Standard Chainlink price feed interface.
 *         Any Chainlink data feed (e.g. ETH/USD, USDC/USD) implements this.
 *         Aave v3 uses these feeds internally to compute health factors.
 *
 * Chainlink docs: https://docs.chain.link/data-feeds/api-reference
 */
interface AggregatorV3Interface {

    /**
     * @notice Returns how many decimal places the feed's answer uses.
     *         Most USD price feeds use 8 decimals (e.g. $1.00 = 100_000_000).
     */
    function decimals() external view returns (uint8);

    /**
     * @notice Returns the most recent price data from the feed.
     *         Use `answer` for the current price and `updatedAt` to verify
     *         the data is fresh (compare against block.timestamp).
     *
     * @return roundId         Unique ID for this price update
     * @return answer          The price — divide by 10**decimals() to get the human value
     * @return startedAt       Timestamp when this round started (rarely needed)
     * @return updatedAt       Timestamp when this round was last updated — use this for staleness checks
     * @return answeredInRound The round in which the answer was computed (should equal roundId)
     */
    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        );
}
