/// BTCUSD Protocol
///
/// A Bitcoin-backed stablecoin protocol on Starknet.
///
/// ## Architecture
///
/// ```
/// User → wBTC → BTCUSDVault → BTCUSD
///                    ↓
///              YieldManager → Vesu (Stage 3)
///                    ↓
///              Liquidator (Stage 2)
/// ```
///
/// ## Modules
///
/// - `interfaces`: Contract interfaces and types
/// - `core`: Main protocol contracts
/// - `oracles`: Price feed implementations
/// - `liquidation`: Liquidation contracts (Stage 2)
/// - `mocks`: Test contracts

pub mod interfaces;
pub mod core;
pub mod oracles;
pub mod liquidation;
pub mod mocks;
