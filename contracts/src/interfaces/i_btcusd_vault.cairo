use starknet::ContractAddress;

/// User position data structure.
/// Stores collateral and debt amounts for a single user.
#[derive(Drop, Copy, Serde, starknet::Store, PartialEq)]
pub struct Position {
    /// Amount of wBTC collateral deposited (8 decimals)
    pub collateral: u256,
    /// Amount of BTCUSD debt owed (18 decimals)
    pub debt: u256,
    /// Timestamp of last position update
    pub last_update: u64,
}

/// Interface for the BTCUSD Vault contract.
/// Manages user positions, collateral deposits, and BTCUSD minting/burning.
#[starknet::interface]
pub trait IBTCUSDVault<TContractState> {
    // ============ Core User Operations ============

    /// Deposits wBTC collateral into the vault.
    /// Does NOT automatically mint BTCUSD - user must call mint_btcusd separately.
    ///
    /// # Arguments
    /// * `amount` - Amount of wBTC to deposit (8 decimals)
    ///
    /// # Requirements
    /// * `amount` must be >= MIN_DEPOSIT
    /// * Caller must have approved vault to spend wBTC
    fn deposit_collateral(ref self: TContractState, amount: u256);

    /// Withdraws wBTC collateral from the vault.
    /// Position must remain healthy after withdrawal (ratio >= MIN_COLLATERAL_RATIO).
    ///
    /// # Arguments
    /// * `amount` - Amount of wBTC to withdraw (8 decimals)
    ///
    /// # Requirements
    /// * Position must remain healthy after withdrawal OR debt must be 0
    fn withdraw_collateral(ref self: TContractState, amount: u256);

    /// Mints BTCUSD against deposited collateral.
    /// Position must remain healthy after minting.
    ///
    /// # Arguments
    /// * `amount` - Amount of BTCUSD to mint (18 decimals)
    ///
    /// # Requirements
    /// * Position must remain healthy after minting (ratio >= MIN_COLLATERAL_RATIO)
    fn mint_btcusd(ref self: TContractState, amount: u256);

    /// Burns BTCUSD to reduce debt.
    ///
    /// # Arguments
    /// * `amount` - Amount of BTCUSD to burn (18 decimals)
    ///
    /// # Requirements
    /// * `amount` must be <= user's debt
    /// * Caller must have approved vault to spend BTCUSD (or have balance)
    fn burn_btcusd(ref self: TContractState, amount: u256);

    /// Convenience function: deposits collateral AND mints max BTCUSD in one transaction.
    ///
    /// # Arguments
    /// * `collateral_amount` - Amount of wBTC to deposit (8 decimals)
    ///
    /// # Returns
    /// The amount of BTCUSD minted
    fn deposit_and_mint(ref self: TContractState, collateral_amount: u256) -> u256;

    /// Convenience function: burns BTCUSD AND withdraws proportional collateral.
    ///
    /// # Arguments
    /// * `btcusd_amount` - Amount of BTCUSD to burn (18 decimals)
    ///
    /// # Returns
    /// The amount of wBTC withdrawn
    fn repay_and_withdraw(ref self: TContractState, btcusd_amount: u256) -> u256;

    // ============ View Functions ============

    /// Returns the position data for a user.
    fn get_position(self: @TContractState, user: ContractAddress) -> Position;

    /// Returns the current collateral ratio for a user (basis points).
    /// Returns 0 if user has no debt.
    /// Example: 15000 = 150%
    fn get_collateral_ratio(self: @TContractState, user: ContractAddress) -> u256;

    /// Returns the health factor for a user (basis points).
    /// health_factor = collateral_value / debt_value * PRECISION
    fn get_health_factor(self: @TContractState, user: ContractAddress) -> u256;

    /// Returns whether a position can be liquidated.
    fn is_liquidatable(self: @TContractState, user: ContractAddress) -> bool;

    /// Returns the maximum BTCUSD that can be minted with current collateral.
    fn get_max_mintable(self: @TContractState, user: ContractAddress) -> u256;

    /// Returns the maximum collateral that can be withdrawn while staying healthy.
    fn get_max_withdrawable(self: @TContractState, user: ContractAddress) -> u256;

    /// Returns global protocol statistics.
    fn get_protocol_stats(self: @TContractState) -> (u256, u256); // (total_collateral, total_debt)

    /// Returns the current BTC price from the oracle (8 decimals).
    fn get_btc_price(self: @TContractState) -> u256;

    // ============ Admin Functions ============

    /// Sets the price oracle address. Only owner.
    fn set_oracle(ref self: TContractState, oracle: ContractAddress);

    /// Sets the yield manager address. Only owner.
    fn set_yield_manager(ref self: TContractState, yield_manager: ContractAddress);

    /// Sets the minimum deposit amount. Only owner.
    fn set_min_deposit(ref self: TContractState, min_deposit: u256);

    /// Pauses all vault operations. Only owner.
    fn pause(ref self: TContractState);

    /// Unpauses vault operations. Only owner.
    fn unpause(ref self: TContractState);

    /// Returns the contract addresses used by the vault.
    fn get_addresses(self: @TContractState) -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress);
    // Returns: (wbtc_token, btcusd_token, oracle, yield_manager)

    // ============ Liquidation Functions (Stage 2) ============

    /// Liquidates an undercollateralized position.
    /// Can only be called by the authorized liquidator contract.
    ///
    /// # Arguments
    /// * `user` - Address of the position owner to liquidate
    /// * `debt_to_repay` - Amount of BTCUSD debt being repaid by liquidator
    /// * `collateral_to_seize` - Amount of wBTC collateral to seize
    ///
    /// # Requirements
    /// * Position must be liquidatable (health factor < LIQUIDATION_THRESHOLD)
    /// * Caller must be the authorized liquidator contract
    fn liquidate(
        ref self: TContractState,
        user: ContractAddress,
        debt_to_repay: u256,
        collateral_to_seize: u256,
    );

    /// Sets the authorized liquidator contract address. Only owner.
    fn set_liquidator(ref self: TContractState, liquidator: ContractAddress);

    /// Returns the authorized liquidator contract address.
    fn get_liquidator(self: @TContractState) -> ContractAddress;
}
