use starknet::ContractAddress;

/// Interface for the YieldManager contract.
/// Manages yield generation from deposited collateral.
/// In Stage 1, this is a mock that tracks "virtual" yield.
/// In Stage 3, this integrates with Vesu for real yield.
#[starknet::interface]
pub trait IYieldManager<TContractState> {
    // ============ Vault-Only Functions ============

    /// Deposits collateral to start earning yield. Only callable by vault.
    /// In mock version: just tracks the deposit.
    /// In real version: deposits to Vesu.
    ///
    /// # Arguments
    /// * `user` - The user who owns this collateral
    /// * `amount` - Amount of wBTC to deposit (8 decimals)
    fn deposit(ref self: TContractState, user: ContractAddress, amount: u256);

    /// Withdraws collateral. Only callable by vault.
    ///
    /// # Arguments
    /// * `user` - The user who owns this collateral
    /// * `amount` - Amount of wBTC to withdraw (8 decimals)
    fn withdraw(ref self: TContractState, user: ContractAddress, amount: u256);

    // ============ Yield Operations ============

    /// Harvests accumulated yield for a user.
    /// Sends yield to user after protocol fee deduction.
    ///
    /// # Returns
    /// Amount of yield claimed (after fees)
    fn harvest_yield(ref self: TContractState, user: ContractAddress) -> u256;

    /// Harvests yield for all users (called by keeper).
    /// Typically called periodically to compound or distribute.
    fn harvest_all(ref self: TContractState);

    // ============ View Functions ============

    /// Returns total collateral deposited by a user.
    fn get_user_deposit(self: @TContractState, user: ContractAddress) -> u256;

    /// Returns accumulated yield for a user (before fees).
    fn get_user_yield(self: @TContractState, user: ContractAddress) -> u256;

    /// Returns total collateral managed by this contract.
    fn get_total_deposits(self: @TContractState) -> u256;

    /// Returns total accumulated yield (before distribution).
    fn get_total_yield(self: @TContractState) -> u256;

    /// Returns the current yield rate (basis points per year).
    /// Example: 800 = 8% APY
    fn get_yield_rate(self: @TContractState) -> u256;

    /// Returns fee configuration (user_share, protocol_share) in basis points.
    fn get_fee_config(self: @TContractState) -> (u256, u256);

    // ============ Admin Functions ============

    /// Sets the vault address. Only owner.
    fn set_vault(ref self: TContractState, vault: ContractAddress);

    /// Sets the yield rate (mock only). Only owner.
    fn set_yield_rate(ref self: TContractState, rate: u256);

    /// Sets fee distribution. Only owner.
    /// user_share + protocol_share must equal 10000.
    fn set_fee_config(ref self: TContractState, user_share: u256, protocol_share: u256);

    /// Emergency withdraw all funds back to vault. Only owner.
    fn emergency_withdraw(ref self: TContractState);
}
