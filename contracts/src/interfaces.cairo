/// BTCUSD Protocol Interfaces
///
/// All contract interfaces are defined here to avoid circular dependencies.
/// Import interfaces from this module in contract implementations.

pub mod i_btcusd_token;
pub mod i_btcusd_vault;
pub mod i_yield_manager;
pub mod i_price_oracle;

// Re-export for convenience
pub use i_btcusd_token::{IBTCUSDToken, IBTCUSDTokenDispatcher, IBTCUSDTokenDispatcherTrait};
pub use i_btcusd_vault::{IBTCUSDVault, IBTCUSDVaultDispatcher, IBTCUSDVaultDispatcherTrait, Position};
pub use i_yield_manager::{IYieldManager, IYieldManagerDispatcher, IYieldManagerDispatcherTrait};
pub use i_price_oracle::{
    IPriceOracle, IPriceOracleDispatcher, IPriceOracleDispatcherTrait, IMockOracle,
    IMockOracleDispatcher, IMockOracleDispatcherTrait,
};

// Re-export mock interfaces for testing
pub use crate::mocks::mock_wbtc::{IMockWBTC, IMockWBTCDispatcher, IMockWBTCDispatcherTrait};
