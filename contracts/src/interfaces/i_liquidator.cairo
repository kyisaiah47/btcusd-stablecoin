/// Liquidator Contract Interface
///
/// Handles liquidation of undercollateralized positions.
/// Anyone can call liquidate() on positions with health factor < LIQUIDATION_THRESHOLD.

use starknet::ContractAddress;

/// Liquidation result containing details of the liquidation
#[derive(Drop, Serde)]
pub struct LiquidationResult {
    /// Amount of collateral seized from the position
    pub collateral_seized: u256,
    /// Amount of debt repaid
    pub debt_repaid: u256,
    /// Bonus collateral received by liquidator
    pub liquidator_bonus: u256,
}

/// Main liquidator interface
#[starknet::interface]
pub trait ILiquidator<TContractState> {
    /// Liquidate an unhealthy position
    /// @param user The address of the position owner to liquidate
    /// @param btcusd_amount Amount of BTCUSD debt to repay
    /// @return LiquidationResult with details of the liquidation
    fn liquidate(
        ref self: TContractState, user: ContractAddress, btcusd_amount: u256
    ) -> LiquidationResult;

    /// Check if a position can be liquidated
    /// @param user The address to check
    /// @return True if position is liquidatable
    fn is_liquidatable(self: @TContractState, user: ContractAddress) -> bool;

    /// Calculate liquidation amounts without executing
    /// @param user The address of the position
    /// @param btcusd_amount Amount of debt to repay
    /// @return (collateral_seized, debt_repaid, liquidator_bonus)
    fn calculate_liquidation(
        self: @TContractState, user: ContractAddress, btcusd_amount: u256
    ) -> (u256, u256, u256);

    /// Get the liquidation penalty (basis points)
    /// @return Penalty percentage, e.g., 1000 = 10%
    fn get_liquidation_penalty(self: @TContractState) -> u256;

    /// Get the liquidator reward (basis points)
    /// @return Reward percentage, e.g., 500 = 5%
    fn get_liquidator_reward(self: @TContractState) -> u256;

    /// Get the maximum percentage of position that can be liquidated at once
    /// @return Close factor in basis points, e.g., 5000 = 50%
    fn get_close_factor(self: @TContractState) -> u256;

    /// Get the vault contract address
    fn get_vault(self: @TContractState) -> ContractAddress;

    /// Get the BTCUSD token contract address
    fn get_btcusd_token(self: @TContractState) -> ContractAddress;
}

/// Admin functions for liquidator configuration
#[starknet::interface]
pub trait ILiquidatorAdmin<TContractState> {
    /// Set the liquidation penalty
    fn set_liquidation_penalty(ref self: TContractState, penalty_bps: u256);

    /// Set the liquidator reward
    fn set_liquidator_reward(ref self: TContractState, reward_bps: u256);

    /// Set the close factor (max % of position liquidatable at once)
    fn set_close_factor(ref self: TContractState, close_factor_bps: u256);

    /// Pause liquidations (emergency only)
    fn pause(ref self: TContractState);

    /// Unpause liquidations
    fn unpause(ref self: TContractState);
}
