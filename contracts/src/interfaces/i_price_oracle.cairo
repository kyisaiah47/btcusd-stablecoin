/// Interface for price oracles.
/// Provides BTC/USD price data for collateral valuation.
#[starknet::interface]
pub trait IPriceOracle<TContractState> {
    /// Returns the current BTC/USD price.
    ///
    /// # Returns
    /// * `price` - The price with 8 decimals (e.g., 65000_00000000 = $65,000)
    /// * `timestamp` - Unix timestamp of the price update
    fn get_btc_price(self: @TContractState) -> (u256, u64);

    /// Returns whether the price is stale (older than max_age).
    fn is_price_stale(self: @TContractState) -> bool;

    /// Returns the maximum allowed price age in seconds.
    fn get_max_price_age(self: @TContractState) -> u64;
}

/// Interface for mock oracle (testing/development).
/// Extends IPriceOracle with price setting capability.
#[starknet::interface]
pub trait IMockOracle<TContractState> {
    /// Sets the BTC price. Only owner.
    fn set_btc_price(ref self: TContractState, price: u256);

    /// Sets the maximum allowed price age. Only owner.
    fn set_max_price_age(ref self: TContractState, max_age: u64);
}
