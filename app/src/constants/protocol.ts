/**
 * Protocol constants matching Cairo contract definitions
 */

// Precision for basis point calculations (10000 = 100%)
export const PRECISION = 10000n;

// Collateralization parameters
export const MIN_COLLATERAL_RATIO = 15000n;    // 150%
export const LIQUIDATION_THRESHOLD = 12000n;   // 120%
export const MAX_LTV = 6667n;                  // 66.67%

// Liquidation parameters (Stage 2)
export const LIQUIDATION_PENALTY = 1000n;      // 10%
export const LIQUIDATOR_REWARD = 500n;         // 5%

// Yield parameters
export const USER_YIELD_SHARE = 7000n;         // 70%
export const PROTOCOL_YIELD_SHARE = 3000n;     // 30%

// Token decimals
export const WBTC_DECIMALS = 8;
export const BTCUSD_DECIMALS = 18;
export const PRICE_DECIMALS = 8;
export const ETH_DECIMALS = 18;

// Decimal multipliers
export const WBTC_MULTIPLIER = 10n ** BigInt(WBTC_DECIMALS);
export const BTCUSD_MULTIPLIER = 10n ** BigInt(BTCUSD_DECIMALS);
export const PRICE_MULTIPLIER = 10n ** BigInt(PRICE_DECIMALS);
export const ETH_MULTIPLIER = 10n ** BigInt(ETH_DECIMALS);

// Minimum deposit amount (0.001 wBTC = 100000 satoshis)
export const MIN_DEPOSIT = 100000n;

// Maximum price age (1 hour in seconds)
export const MAX_PRICE_AGE = 3600;

// Transaction timeout (5 minutes)
export const TX_TIMEOUT_MS = 5 * 60 * 1000;

// Polling intervals
export const POSITION_POLL_INTERVAL = 30000;   // 30 seconds
export const PRICE_POLL_INTERVAL = 60000;      // 1 minute
export const YIELD_POLL_INTERVAL = 300000;     // 5 minutes
