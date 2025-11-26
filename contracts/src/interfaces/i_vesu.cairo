use starknet::ContractAddress;
use alexandria_math::i257::i257;

/// Vesu data types

/// Amount type for position modifications
#[derive(PartialEq, Copy, Drop, Serde, Default)]
pub enum AmountType {
    #[default]
    Delta,
    Target,
}

/// Amount denomination
#[derive(PartialEq, Copy, Drop, Serde, Default)]
pub enum AmountDenomination {
    #[default]
    Native,
    Assets,
}

/// Amount struct for specifying collateral/debt changes
#[derive(PartialEq, Copy, Drop, Serde, Default)]
pub struct Amount {
    pub amount_type: AmountType,
    pub denomination: AmountDenomination,
    pub value: i257,
}

/// Position state
#[derive(PartialEq, Copy, Drop, Serde)]
pub struct VesuPosition {
    pub collateral_shares: u256,
    pub nominal_debt: u256,
}

/// Asset configuration
#[derive(PartialEq, Copy, Drop, Serde)]
pub struct AssetConfig {
    pub total_collateral_shares: u256,
    pub total_nominal_debt: u256,
    pub reserve: u256,
    pub max_utilization: u256,
    pub floor: u256,
    pub scale: u256,
    pub is_legacy: bool,
    pub last_updated: u64,
    pub last_rate_accumulator: u256,
    pub last_full_utilization_rate: u256,
    pub fee_rate: u256,
}

/// Parameters for modify_position
#[derive(PartialEq, Copy, Drop, Serde)]
pub struct ModifyPositionParams {
    pub pool_id: felt252,
    pub collateral_asset: ContractAddress,
    pub debt_asset: ContractAddress,
    pub user: ContractAddress,
    pub collateral: Amount,
    pub debt: Amount,
    pub data: Span<felt252>,
}

/// Response from position modifications
#[derive(PartialEq, Copy, Drop, Serde)]
pub struct UpdatePositionResponse {
    pub collateral_delta: i257,
    pub collateral_shares_delta: i257,
    pub debt_delta: i257,
    pub nominal_debt_delta: i257,
    pub bad_debt: u256,
}

/// Vesu Singleton interface
/// Minimal interface for yield operations (supply-only, no borrowing)
#[starknet::interface]
pub trait IVesuSingleton<TContractState> {
    /// Get position for a user
    fn position(
        ref self: TContractState,
        pool_id: felt252,
        collateral_asset: ContractAddress,
        debt_asset: ContractAddress,
        user: ContractAddress
    ) -> (VesuPosition, u256, u256);

    /// Get position without state updates (view)
    fn position_unsafe(
        self: @TContractState,
        pool_id: felt252,
        collateral_asset: ContractAddress,
        debt_asset: ContractAddress,
        user: ContractAddress
    ) -> (VesuPosition, u256, u256);

    /// Get asset configuration
    fn asset_config(
        ref self: TContractState,
        pool_id: felt252,
        asset: ContractAddress
    ) -> (AssetConfig, u256);

    /// Get asset configuration without state updates (view)
    fn asset_config_unsafe(
        self: @TContractState,
        pool_id: felt252,
        asset: ContractAddress
    ) -> (AssetConfig, u256);

    /// Get rate accumulator for yield calculation
    fn rate_accumulator(
        ref self: TContractState,
        pool_id: felt252,
        asset: ContractAddress
    ) -> u256;

    /// Get rate accumulator without state updates (view)
    fn rate_accumulator_unsafe(
        self: @TContractState,
        pool_id: felt252,
        asset: ContractAddress
    ) -> u256;

    /// Modify position (deposit/withdraw collateral)
    fn modify_position(
        ref self: TContractState,
        params: ModifyPositionParams
    ) -> UpdatePositionResponse;

    /// Get current utilization
    fn utilization_unsafe(
        self: @TContractState,
        pool_id: felt252,
        asset: ContractAddress
    ) -> u256;

    /// Calculate collateral from shares
    fn calculate_collateral_unsafe(
        self: @TContractState,
        pool_id: felt252,
        asset: ContractAddress,
        collateral_shares: i257
    ) -> u256;
}
