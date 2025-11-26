/// BTCUSD Protocol Interfaces
///
/// All contract interfaces are defined here to avoid circular dependencies.
/// Import interfaces from this module in contract implementations.

pub mod i_btcusd_token;
pub mod i_btcusd_vault;
pub mod i_yield_manager;
pub mod i_price_oracle;
pub mod i_liquidator;
pub mod i_vesu;

// Re-export for convenience
pub use i_btcusd_token::{IBTCUSDToken, IBTCUSDTokenDispatcher, IBTCUSDTokenDispatcherTrait};
pub use i_btcusd_vault::{IBTCUSDVault, IBTCUSDVaultDispatcher, IBTCUSDVaultDispatcherTrait, Position};
pub use i_yield_manager::{IYieldManager, IYieldManagerDispatcher, IYieldManagerDispatcherTrait};
pub use i_price_oracle::{
    IPriceOracle, IPriceOracleDispatcher, IPriceOracleDispatcherTrait, IMockOracle,
    IMockOracleDispatcher, IMockOracleDispatcherTrait,
};
pub use i_liquidator::{
    ILiquidator, ILiquidatorDispatcher, ILiquidatorDispatcherTrait, ILiquidatorAdmin,
    ILiquidatorAdminDispatcher, ILiquidatorAdminDispatcherTrait, LiquidationResult,
};

// Re-export mock interfaces for testing
pub use crate::mocks::mock_wbtc::{IMockWBTC, IMockWBTCDispatcher, IMockWBTCDispatcherTrait};

// Re-export Vesu interfaces
pub use i_vesu::{
    IVesuSingleton, IVesuSingletonDispatcher, IVesuSingletonDispatcherTrait,
    Amount, AmountType, AmountDenomination, ModifyPositionParams, UpdatePositionResponse,
    VesuPosition, AssetConfig,
};
