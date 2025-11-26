/// Core Protocol Contracts
///
/// Contains the main protocol logic:
/// - BTCUSDToken: The stablecoin token
/// - BTCUSDVault: Position management and collateralization
/// - MockYieldManager: Virtual yield tracking (Stage 1)
/// - VesuYieldManager: Real Vesu integration (Stage 3)

pub mod btcusd_token;
pub mod btcusd_vault;
pub mod mock_yield_manager;
pub mod vesu_yield_manager;
