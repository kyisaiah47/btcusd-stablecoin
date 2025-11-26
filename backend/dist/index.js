// src/index.ts
import pino6 from "pino";

// src/config/index.ts
import dotenv from "dotenv";
dotenv.config();
var NETWORK = {
  name: process.env.NETWORK || "sepolia",
  rpcUrl: process.env.RPC_URL || "https://starknet-sepolia.public.blastapi.io",
  chainId: process.env.CHAIN_ID || "SN_SEPOLIA"
};
var CONTRACTS = {
  vault: process.env.VAULT_ADDRESS || "0x0",
  btcusdToken: process.env.TOKEN_ADDRESS || "0x0",
  wbtc: process.env.WBTC_ADDRESS || "0x0",
  oracle: process.env.ORACLE_ADDRESS || "0x0",
  yieldManager: process.env.YIELD_MANAGER_ADDRESS || "0x0",
  liquidator: process.env.LIQUIDATOR_ADDRESS || "0x0"
};
var KEEPER_ACCOUNT = {
  address: process.env.KEEPER_ADDRESS || "",
  privateKey: process.env.KEEPER_PRIVATE_KEY || ""
};
var PROTOCOL = {
  PRECISION: 10000n,
  MIN_COLLATERAL_RATIO: 15000n,
  // 150%
  LIQUIDATION_THRESHOLD: 12000n,
  // 120%
  LIQUIDATION_PENALTY: 1000n,
  // 10%
  LIQUIDATOR_REWARD: 500n,
  // 5%
  WBTC_DECIMALS: 8,
  BTCUSD_DECIMALS: 18,
  PRICE_DECIMALS: 8
};
var LIQUIDATION_CONFIG = {
  enabled: process.env.LIQUIDATION_KEEPER_ENABLED === "true",
  pollIntervalMs: parseInt(process.env.LIQUIDATION_POLL_INTERVAL || "30000"),
  minProfitUSD: parseFloat(process.env.LIQUIDATION_MIN_PROFIT || "10"),
  maxGasPrice: BigInt(process.env.LIQUIDATION_MAX_GAS || "1000000000"),
  healthThreshold: parseInt(process.env.LIQUIDATION_THRESHOLD || "12000"),
  batchSize: parseInt(process.env.LIQUIDATION_BATCH_SIZE || "5"),
  alertWebhook: process.env.ALERT_WEBHOOK
};
var YIELD_CONFIG = {
  enabled: process.env.YIELD_KEEPER_ENABLED === "true",
  pollIntervalMs: parseInt(process.env.YIELD_POLL_INTERVAL || "300000"),
  minProfitUSD: parseFloat(process.env.YIELD_MIN_PROFIT || "1"),
  maxGasPrice: BigInt(process.env.YIELD_MAX_GAS || "1000000000"),
  minHarvestAmount: BigInt(process.env.YIELD_MIN_HARVEST || "10000"),
  // 0.0001 wBTC
  harvestCron: process.env.YIELD_HARVEST_CRON || "0 */6 * * *",
  // Every 6 hours
  alertWebhook: process.env.ALERT_WEBHOOK
};
var PRICE_CONFIG = {
  enabled: process.env.PRICE_KEEPER_ENABLED === "true",
  pollIntervalMs: parseInt(process.env.PRICE_POLL_INTERVAL || "60000"),
  minProfitUSD: 0,
  maxGasPrice: 0n,
  priceDropAlertPercent: parseFloat(process.env.PRICE_DROP_ALERT || "5"),
  stalePriceAlertSeconds: parseInt(process.env.STALE_PRICE_ALERT || "3600"),
  alertWebhook: process.env.ALERT_WEBHOOK
};
var LOG_LEVEL = process.env.LOG_LEVEL || "info";

// src/keepers/liquidation-bot.ts
import pino2 from "pino";

// src/services/starknet.ts
import { RpcProvider, Account, Contract } from "starknet";
import pino from "pino";
var createLogger = pino.default || pino;
var logger = createLogger({ name: "starknet" });
var provider = null;
var keeperAccount = null;
function getProvider() {
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: NETWORK.rpcUrl });
    logger.info(`Connected to ${NETWORK.name} at ${NETWORK.rpcUrl}`);
  }
  return provider;
}
function getKeeperAccount() {
  if (!keeperAccount) {
    if (!KEEPER_ACCOUNT.address || !KEEPER_ACCOUNT.privateKey) {
      throw new Error("Keeper account not configured");
    }
    keeperAccount = new Account(
      getProvider(),
      KEEPER_ACCOUNT.address,
      KEEPER_ACCOUNT.privateKey
    );
    logger.info(`Keeper account: ${KEEPER_ACCOUNT.address}`);
  }
  return keeperAccount;
}
var VAULT_ABI = [
  {
    name: "get_position",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [
      {
        type: "struct",
        members: [
          { name: "collateral", type: "u256" },
          { name: "debt", type: "u256" },
          { name: "last_update", type: "u64" }
        ]
      }
    ],
    state_mutability: "view"
  },
  {
    name: "get_collateral_ratio",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [{ type: "u256" }],
    state_mutability: "view"
  },
  {
    name: "is_liquidatable",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [{ type: "bool" }],
    state_mutability: "view"
  },
  {
    name: "get_protocol_stats",
    type: "function",
    inputs: [],
    outputs: [{ type: "u256" }, { type: "u256" }],
    state_mutability: "view"
  },
  {
    name: "get_btc_price",
    type: "function",
    inputs: [],
    outputs: [{ type: "u256" }],
    state_mutability: "view"
  }
];
var ORACLE_ABI = [
  {
    name: "get_btc_price",
    type: "function",
    inputs: [],
    outputs: [{ type: "u256" }, { type: "u64" }],
    state_mutability: "view"
  },
  {
    name: "is_price_stale",
    type: "function",
    inputs: [],
    outputs: [{ type: "bool" }],
    state_mutability: "view"
  }
];
var YIELD_MANAGER_ABI = [
  {
    name: "get_user_deposit",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [{ type: "u256" }],
    state_mutability: "view"
  },
  {
    name: "get_user_yield",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [{ type: "u256" }],
    state_mutability: "view"
  },
  {
    name: "harvest_yield",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [{ type: "u256" }],
    state_mutability: "external"
  },
  {
    name: "harvest_all",
    type: "function",
    inputs: [],
    outputs: [],
    state_mutability: "external"
  },
  {
    name: "get_total_deposits",
    type: "function",
    inputs: [],
    outputs: [{ type: "u256" }],
    state_mutability: "view"
  },
  {
    name: "get_total_yield",
    type: "function",
    inputs: [],
    outputs: [{ type: "u256" }],
    state_mutability: "view"
  }
];
var LIQUIDATOR_ABI = [
  {
    name: "liquidate",
    type: "function",
    inputs: [
      { name: "user", type: "ContractAddress" },
      { name: "btcusd_amount", type: "u256" }
    ],
    outputs: [{ type: "u256" }, { type: "u256" }],
    state_mutability: "external"
  },
  {
    name: "calculate_liquidation",
    type: "function",
    inputs: [
      { name: "user", type: "ContractAddress" },
      { name: "btcusd_amount", type: "u256" }
    ],
    outputs: [{ type: "u256" }, { type: "u256" }, { type: "u256" }],
    state_mutability: "view"
  }
];
function getContracts(account) {
  const p = getProvider();
  const acc = account || p;
  return {
    vault: new Contract(VAULT_ABI, CONTRACTS.vault, acc),
    oracle: new Contract(ORACLE_ABI, CONTRACTS.oracle, acc),
    yieldManager: new Contract(YIELD_MANAGER_ABI, CONTRACTS.yieldManager, acc),
    liquidator: new Contract(LIQUIDATOR_ABI, CONTRACTS.liquidator, acc)
  };
}
async function executeTransaction(calls) {
  const account = getKeeperAccount();
  const response = await account.execute(calls);
  logger.info(`Transaction submitted: ${response.transaction_hash}`);
  await getProvider().waitForTransaction(response.transaction_hash);
  logger.info(`Transaction confirmed: ${response.transaction_hash}`);
  return response.transaction_hash;
}

// src/keepers/liquidation-bot.ts
var createLogger2 = pino2.default || pino2;
var logger2 = createLogger2({
  name: "liquidation-bot",
  level: process.env.LOG_LEVEL || "info"
});
var LiquidationBot = class {
  running = false;
  lastScan = 0;
  async start() {
    if (!LIQUIDATION_CONFIG.enabled) {
      logger2.warn("Liquidation keeper is disabled");
      return;
    }
    logger2.info("Starting liquidation bot...");
    logger2.info(`Poll interval: ${LIQUIDATION_CONFIG.pollIntervalMs}ms`);
    logger2.info(`Health threshold: ${LIQUIDATION_CONFIG.healthThreshold} (${LIQUIDATION_CONFIG.healthThreshold / 100}%)`);
    logger2.info(`Min profit: $${LIQUIDATION_CONFIG.minProfitUSD}`);
    this.running = true;
    await this.runLoop();
  }
  async stop() {
    logger2.info("Stopping liquidation bot...");
    this.running = false;
  }
  async runLoop() {
    while (this.running) {
      try {
        await this.scan();
      } catch (err) {
        logger2.error({ err }, "Scan failed");
      }
      await this.sleep(LIQUIDATION_CONFIG.pollIntervalMs);
    }
  }
  /**
   * Scan for liquidatable positions
   */
  async scan() {
    const startTime = Date.now();
    logger2.debug("Scanning for liquidatable positions...");
    const { oracle, vault } = getContracts();
    const [priceResult, isStale] = await Promise.all([
      oracle.get_btc_price(),
      oracle.is_price_stale()
    ]);
    if (isStale) {
      logger2.warn("Price is stale, skipping scan");
      return;
    }
    const btcPrice = BigInt(priceResult[0].toString());
    logger2.debug(`Current BTC price: $${Number(btcPrice) / 1e8}`);
    const userAddresses = [];
    const candidates = [];
    for (const user of userAddresses) {
      try {
        const isLiquidatable = await vault.is_liquidatable(user);
        if (isLiquidatable) {
          const position = await this.getPositionWithHealth(user, btcPrice);
          const candidate = await this.evaluateLiquidation(user, position, btcPrice);
          if (candidate && candidate.estimatedProfit >= LIQUIDATION_CONFIG.minProfitUSD) {
            candidates.push(candidate);
          }
        }
      } catch (err) {
        logger2.error({ err, user }, "Failed to check position");
      }
    }
    logger2.info(`Found ${candidates.length} profitable liquidation candidates`);
    candidates.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
    const batch = candidates.slice(0, LIQUIDATION_CONFIG.batchSize);
    for (const candidate of batch) {
      await this.executeLiquidation(candidate);
    }
    this.lastScan = Date.now();
    logger2.debug(`Scan completed in ${Date.now() - startTime}ms`);
  }
  /**
   * Get position with health metrics
   */
  async getPositionWithHealth(user, btcPrice) {
    const { vault } = getContracts();
    const [position, ratio] = await Promise.all([
      vault.get_position(user),
      vault.get_collateral_ratio(user)
    ]);
    const collateral = BigInt(position.collateral.toString());
    const debt = BigInt(position.debt.toString());
    const collateralRatio = BigInt(ratio.toString());
    const collateralValueUSD = Number(collateral) * Number(btcPrice) / (1e8 * 1e8);
    const debtValueUSD = Number(debt) / 1e18;
    return {
      user,
      collateral,
      debt,
      lastUpdate: Number(position.last_update),
      collateralRatio,
      healthFactor: Number(collateralRatio) / Number(PROTOCOL.PRECISION),
      isLiquidatable: collateralRatio < PROTOCOL.LIQUIDATION_THRESHOLD,
      collateralValueUSD,
      debtValueUSD
    };
  }
  /**
   * Evaluate liquidation profitability
   */
  async evaluateLiquidation(user, position, btcPrice) {
    const { liquidator } = getContracts();
    const maxLiquidation = position.debt / 2n;
    try {
      const [collateralSeized, debtRepaid, bonus] = await liquidator.calculate_liquidation(user, maxLiquidation);
      const collateralValue = Number(collateralSeized) * Number(btcPrice) / (1e8 * 1e8);
      const debtValue = Number(debtRepaid) / 1e18;
      const bonusValue = Number(bonus) * Number(btcPrice) / (1e8 * 1e8);
      const estimatedGas = 1e-3;
      const estimatedProfit = bonusValue - estimatedGas * (Number(btcPrice) / 1e8);
      return {
        user,
        position,
        maxLiquidation,
        estimatedProfit,
        estimatedGas
      };
    } catch (err) {
      logger2.error({ err, user }, "Failed to calculate liquidation");
      return null;
    }
  }
  /**
   * Execute liquidation
   */
  async executeLiquidation(candidate) {
    logger2.info(
      {
        user: candidate.user,
        debt: candidate.position.debtValueUSD,
        profit: candidate.estimatedProfit
      },
      "Executing liquidation"
    );
    try {
      const { liquidator } = getContracts(getKeeperAccount());
      const txHash = await executeTransaction([
        liquidator.populate("liquidate", [
          candidate.user,
          candidate.maxLiquidation
        ])
      ]);
      const result = {
        txHash,
        user: candidate.user,
        collateralSeized: 0n,
        // Would get from tx receipt
        debtRepaid: candidate.maxLiquidation,
        profit: candidate.estimatedProfit,
        timestamp: Date.now()
      };
      logger2.info({ result }, "Liquidation successful");
      await this.sendAlert("Liquidation Executed", {
        user: candidate.user,
        profit: candidate.estimatedProfit,
        txHash
      });
      return result;
    } catch (err) {
      logger2.error({ err, user: candidate.user }, "Liquidation failed");
      return null;
    }
  }
  /**
   * Send alert to webhook
   */
  async sendAlert(title, data) {
    if (!LIQUIDATION_CONFIG.alertWebhook) return;
    try {
      await fetch(LIQUIDATION_CONFIG.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*${title}*
\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    } catch (err) {
      logger2.error({ err }, "Failed to send alert");
    }
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};
if (process.argv[1]?.includes("liquidation-bot")) {
  const bot = new LiquidationBot();
  process.on("SIGINT", async () => {
    await bot.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await bot.stop();
    process.exit(0);
  });
  bot.start().catch((err) => {
    logger2.error({ err }, "Failed to start bot");
    process.exit(1);
  });
}

// src/keepers/yield-harvester.ts
import pino3 from "pino";
import { CronJob } from "cron";
var createLogger3 = pino3.default || pino3;
var logger3 = createLogger3({
  name: "yield-harvester",
  level: process.env.LOG_LEVEL || "info"
});
var YieldHarvester = class {
  cronJob = null;
  running = false;
  async start() {
    if (!YIELD_CONFIG.enabled) {
      logger3.warn("Yield harvester is disabled");
      return;
    }
    logger3.info("Starting yield harvester...");
    logger3.info(`Cron schedule: ${YIELD_CONFIG.harvestCron}`);
    logger3.info(`Min harvest amount: ${Number(YIELD_CONFIG.minHarvestAmount) / 1e8} wBTC`);
    this.cronJob = new CronJob(
      YIELD_CONFIG.harvestCron,
      () => this.runHarvest(),
      null,
      true,
      "UTC"
    );
    this.running = true;
    logger3.info("Yield harvester started");
    await this.runHarvest();
  }
  async stop() {
    logger3.info("Stopping yield harvester...");
    this.cronJob?.stop();
    this.running = false;
  }
  /**
   * Run harvest cycle
   */
  async runHarvest() {
    const startTime = Date.now();
    logger3.info("Starting harvest cycle...");
    try {
      await this.harvestAll();
      logger3.info(`Harvest cycle completed in ${Date.now() - startTime}ms`);
    } catch (err) {
      logger3.error({ err }, "Harvest cycle failed");
    }
  }
  /**
   * Harvest all users in one transaction
   */
  async harvestAll() {
    const { yieldManager } = getContracts();
    const totalYield = await yieldManager.get_total_yield();
    logger3.info(`Total protocol yield: ${Number(totalYield) / 1e8} wBTC`);
    if (BigInt(totalYield.toString()) === 0n) {
      logger3.info("No yield to harvest");
      return;
    }
    const account = getKeeperAccount();
    const yieldManagerWithAccount = getContracts(account).yieldManager;
    const txHash = await executeTransaction([
      yieldManagerWithAccount.populate("harvest_all", [])
    ]);
    logger3.info({ txHash }, "Batch harvest executed");
    await this.sendAlert("Yield Harvested", {
      totalYield: Number(totalYield) / 1e8,
      txHash
    });
  }
  /**
   * Harvest individual users (more granular control)
   */
  async harvestIndividual() {
    const results = [];
    const users = [];
    const { yieldManager } = getContracts();
    for (const user of users) {
      try {
        const userYield = await yieldManager.get_user_yield(user);
        const yieldAmount = BigInt(userYield.toString());
        if (yieldAmount < YIELD_CONFIG.minHarvestAmount) {
          logger3.debug({ user, yield: yieldAmount }, "Yield below threshold");
          continue;
        }
        logger3.info({ user, yield: Number(yieldAmount) / 1e8 }, "Harvesting user yield");
        const account = getKeeperAccount();
        const yieldManagerWithAccount = getContracts(account).yieldManager;
        const txHash = await executeTransaction([
          yieldManagerWithAccount.populate("harvest_yield", [user])
        ]);
        results.push({
          txHash,
          user,
          amount: yieldAmount,
          timestamp: Date.now()
        });
        logger3.info({ user, txHash }, "Harvest successful");
      } catch (err) {
        logger3.error({ err, user }, "Failed to harvest user");
      }
    }
    return results;
  }
  /**
   * Get yield info for a specific user
   */
  async getUserYield(user) {
    const { yieldManager } = getContracts();
    const [deposit, earnedYield] = await Promise.all([
      yieldManager.get_user_deposit(user),
      yieldManager.get_user_yield(user)
    ]);
    const deposited = BigInt(deposit.toString());
    const earned = BigInt(earnedYield.toString());
    const userShare = earned * 7000n / 10000n;
    return {
      user,
      deposited,
      earnedYield: earned,
      userShare,
      lastHarvest: 0
      // Would track this in a database
    };
  }
  /**
   * Get protocol yield stats
   */
  async getProtocolYieldStats() {
    const { yieldManager } = getContracts();
    const [totalDeposits, totalYield] = await Promise.all([
      yieldManager.get_total_deposits(),
      yieldManager.get_total_yield()
    ]);
    return {
      totalDeposits: BigInt(totalDeposits.toString()),
      totalYield: BigInt(totalYield.toString())
    };
  }
  /**
   * Send alert to webhook
   */
  async sendAlert(title, data) {
    if (!YIELD_CONFIG.alertWebhook) return;
    try {
      await fetch(YIELD_CONFIG.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*${title}*
\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    } catch (err) {
      logger3.error({ err }, "Failed to send alert");
    }
  }
};
if (process.argv[1]?.includes("yield-harvester")) {
  const harvester = new YieldHarvester();
  process.on("SIGINT", async () => {
    await harvester.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await harvester.stop();
    process.exit(0);
  });
  harvester.start().catch((err) => {
    logger3.error({ err }, "Failed to start harvester");
    process.exit(1);
  });
}

// src/keepers/price-monitor.ts
import pino4 from "pino";
var createLogger4 = pino4.default || pino4;
var logger4 = createLogger4({
  name: "price-monitor",
  level: process.env.LOG_LEVEL || "info"
});
var PriceMonitor = class {
  running = false;
  priceHistory = [];
  lastAlertTime = 0;
  ALERT_COOLDOWN = 3e5;
  // 5 minutes
  async start() {
    if (!PRICE_CONFIG.enabled) {
      logger4.warn("Price monitor is disabled");
      return;
    }
    logger4.info("Starting price monitor...");
    logger4.info(`Poll interval: ${PRICE_CONFIG.pollIntervalMs}ms`);
    logger4.info(`Drop alert threshold: ${PRICE_CONFIG.priceDropAlertPercent}%`);
    logger4.info(`Stale price threshold: ${PRICE_CONFIG.stalePriceAlertSeconds}s`);
    this.running = true;
    await this.runLoop();
  }
  async stop() {
    logger4.info("Stopping price monitor...");
    this.running = false;
  }
  async runLoop() {
    while (this.running) {
      try {
        await this.checkPrice();
      } catch (err) {
        logger4.error({ err }, "Price check failed");
      }
      await this.sleep(PRICE_CONFIG.pollIntervalMs);
    }
  }
  /**
   * Check current price and analyze
   */
  async checkPrice() {
    const { oracle } = getContracts();
    const [priceResult, isStale] = await Promise.all([
      oracle.get_btc_price(),
      oracle.is_price_stale()
    ]);
    const price = BigInt(priceResult[0].toString());
    const timestamp = Number(priceResult[1]);
    const priceData = {
      btcPrice: price,
      timestamp,
      isStale,
      source: "oracle"
    };
    const priceUSD = Number(price) / 1e8;
    logger4.debug(`BTC Price: $${priceUSD.toFixed(2)}, Stale: ${isStale}`);
    if (isStale) {
      await this.handleStalePrice(priceData);
    }
    this.priceHistory.push(priceData);
    if (this.priceHistory.length > 60) {
      this.priceHistory.shift();
    }
    await this.checkPriceDrop(priceData);
  }
  /**
   * Check for significant price drops
   */
  async checkPriceDrop(current) {
    if (this.priceHistory.length < 2) return;
    const fiveMinAgo = Date.now() - 3e5;
    const recentPrice = this.priceHistory.find(
      (p) => p.timestamp * 1e3 >= fiveMinAgo
    );
    if (!recentPrice) return;
    const dropPercent = (Number(recentPrice.btcPrice) - Number(current.btcPrice)) / Number(recentPrice.btcPrice) * 100;
    if (dropPercent >= PRICE_CONFIG.priceDropAlertPercent) {
      const alert = {
        type: "price_drop",
        message: `BTC price dropped ${dropPercent.toFixed(2)}% in 5 minutes`,
        price: Number(current.btcPrice) / 1e8,
        changePercent: -dropPercent,
        timestamp: Date.now()
      };
      logger4.warn(alert, "Significant price drop detected");
      await this.sendAlert(alert);
    }
    if (dropPercent <= -PRICE_CONFIG.priceDropAlertPercent) {
      const alert = {
        type: "price_spike",
        message: `BTC price spiked ${Math.abs(dropPercent).toFixed(2)}% in 5 minutes`,
        price: Number(current.btcPrice) / 1e8,
        changePercent: Math.abs(dropPercent),
        timestamp: Date.now()
      };
      logger4.warn(alert, "Significant price spike detected");
      await this.sendAlert(alert);
    }
  }
  /**
   * Handle stale price alert
   */
  async handleStalePrice(price) {
    const now = Date.now();
    const priceAge = now / 1e3 - price.timestamp;
    if (priceAge >= PRICE_CONFIG.stalePriceAlertSeconds) {
      const alert = {
        type: "stale_price",
        message: `Oracle price is ${Math.floor(priceAge / 60)} minutes old`,
        price: Number(price.btcPrice) / 1e8,
        timestamp: Date.now()
      };
      logger4.warn(alert, "Stale price detected");
      await this.sendAlert(alert);
    }
  }
  /**
   * Send alert to webhook
   */
  async sendAlert(alert) {
    const now = Date.now();
    if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
      logger4.debug("Alert cooldown active, skipping");
      return;
    }
    this.lastAlertTime = now;
    if (!PRICE_CONFIG.alertWebhook) return;
    const emoji = alert.type === "price_drop" ? ":chart_with_downwards_trend:" : alert.type === "price_spike" ? ":chart_with_upwards_trend:" : ":warning:";
    try {
      await fetch(PRICE_CONFIG.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${emoji} *${alert.type.toUpperCase()}*
${alert.message}
Price: $${alert.price.toFixed(2)}`
        })
      });
    } catch (err) {
      logger4.error({ err }, "Failed to send alert");
    }
  }
  /**
   * Get current price
   */
  async getCurrentPrice() {
    const { oracle } = getContracts();
    const [priceResult, isStale] = await Promise.all([
      oracle.get_btc_price(),
      oracle.is_price_stale()
    ]);
    return {
      btcPrice: BigInt(priceResult[0].toString()),
      timestamp: Number(priceResult[1]),
      isStale,
      source: "oracle"
    };
  }
  /**
   * Get price history
   */
  getPriceHistory() {
    return [...this.priceHistory];
  }
  /**
   * Calculate price change percentage
   */
  getPriceChange(minutes = 60) {
    if (this.priceHistory.length < 2) return 0;
    const now = Date.now();
    const targetTime = now - minutes * 60 * 1e3;
    const oldPrice = this.priceHistory.find(
      (p) => p.timestamp * 1e3 >= targetTime
    );
    if (!oldPrice) return 0;
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    return (Number(currentPrice.btcPrice) - Number(oldPrice.btcPrice)) / Number(oldPrice.btcPrice) * 100;
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};
if (process.argv[1]?.includes("price-monitor")) {
  const monitor = new PriceMonitor();
  process.on("SIGINT", async () => {
    await monitor.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await monitor.stop();
    process.exit(0);
  });
  monitor.start().catch((err) => {
    logger4.error({ err }, "Failed to start monitor");
    process.exit(1);
  });
}

// src/services/atomiq-bridge.ts
import { Contract as Contract2 } from "starknet";
import pino5 from "pino";
var createLogger5 = pino5.default || pino5;
var logger5 = createLogger5({ name: "atomiq-bridge" });
var ATOMIQ_ADAPTER_ABI = [
  {
    name: "request_deposit",
    type: "function",
    inputs: [{ name: "amount_sats", type: "u64" }],
    outputs: [{ type: "u256" }, { type: "felt252" }],
    state_mutability: "external"
  },
  {
    name: "claim_deposit",
    type: "function",
    inputs: [
      { name: "deposit_id", type: "u256" },
      { name: "btc_tx_hash", type: "u256" },
      { name: "merkle_proof", type: "Array<u256>" }
    ],
    outputs: [],
    state_mutability: "external"
  },
  {
    name: "get_deposit",
    type: "function",
    inputs: [{ name: "deposit_id", type: "u256" }],
    outputs: [
      {
        type: "struct",
        members: [
          { name: "user", type: "ContractAddress" },
          { name: "amount_sats", type: "u64" },
          { name: "btc_address_hash", type: "felt252" },
          { name: "created_at", type: "u64" },
          { name: "expires_at", type: "u64" },
          { name: "status", type: "u8" },
          { name: "escrow_id", type: "u256" }
        ]
      }
    ],
    state_mutability: "view"
  },
  {
    name: "get_user_deposits",
    type: "function",
    inputs: [{ name: "user", type: "ContractAddress" }],
    outputs: [{ type: "Array<u256>" }],
    state_mutability: "view"
  }
];
var AtomiqBridgeService = class {
  config;
  atomiqAdapter = null;
  pendingDeposits = /* @__PURE__ */ new Map();
  monitoringInterval = null;
  constructor(config) {
    this.config = config;
  }
  /**
   * Initialize the bridge service
   */
  async initialize() {
    const atomiqAdapterAddress = process.env.ATOMIQ_ADAPTER_ADDRESS;
    if (!atomiqAdapterAddress) {
      logger5.warn("ATOMIQ_ADAPTER_ADDRESS not set, bridge service disabled");
      return;
    }
    const account = getKeeperAccount();
    this.atomiqAdapter = new Contract2(
      ATOMIQ_ADAPTER_ABI,
      atomiqAdapterAddress,
      account
    );
    logger5.info(`Atomiq Bridge Service initialized`);
    logger5.info(`Atomiq Adapter: ${atomiqAdapterAddress}`);
  }
  /**
   * Start monitoring for Bitcoin deposits
   */
  async startMonitoring() {
    if (!this.config.enabled) {
      logger5.info("Atomiq Bridge monitoring disabled");
      return;
    }
    logger5.info("Starting Atomiq Bridge monitoring...");
    logger5.info(`Poll interval: ${this.config.pollIntervalMs}ms`);
    logger5.info(`Required confirmations: ${this.config.requiredConfirmations}`);
    await this.scanPendingDeposits();
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.scanPendingDeposits();
        await this.processConfirmedDeposits();
      } catch (error) {
        logger5.error({ error }, "Bridge monitoring error");
      }
    }, this.config.pollIntervalMs);
  }
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger5.info("Atomiq Bridge monitoring stopped");
    }
  }
  /**
   * Request a new deposit address for a user
   */
  async requestDeposit(request) {
    if (!this.atomiqAdapter) {
      throw new Error("Atomiq adapter not initialized");
    }
    logger5.info({
      user: request.starknetAddress,
      amountSats: request.amountSats.toString()
    }, "Requesting deposit address");
    try {
      const depositId = BigInt(Date.now());
      const btcAddressHash = this.generateBtcAddressHash(
        request.starknetAddress,
        depositId
      );
      const btcAddress = this.hashToBtcAddress(btcAddressHash);
      const expiresAt = Math.floor(Date.now() / 1e3) + 86400;
      const deposit = {
        depositId: depositId.toString(),
        user: request.starknetAddress,
        amountSats: request.amountSats,
        btcAddressHash,
        status: 0 /* Pending */,
        createdAt: Math.floor(Date.now() / 1e3),
        expiresAt
      };
      this.pendingDeposits.set(depositId.toString(), deposit);
      logger5.info({
        depositId: depositId.toString(),
        btcAddress,
        expiresAt
      }, "Deposit address generated");
      return {
        depositId: depositId.toString(),
        btcAddress,
        btcAddressHash,
        amountSats: request.amountSats,
        expiresAt
      };
    } catch (error) {
      logger5.error({ error }, "Failed to request deposit");
      throw error;
    }
  }
  /**
   * Scan for pending deposits that need to be monitored
   */
  async scanPendingDeposits() {
    logger5.debug("Scanning pending deposits...");
    const now = Math.floor(Date.now() / 1e3);
    for (const [depositId, deposit] of this.pendingDeposits) {
      if (now > deposit.expiresAt) {
        deposit.status = 3 /* Expired */;
        logger5.info({ depositId }, "Deposit expired");
        continue;
      }
      if (deposit.status === 0 /* Pending */) {
        const btcTx = await this.checkBtcDeposit(deposit.btcAddressHash);
        if (btcTx) {
          deposit.btcTxHash = btcTx.txHash;
          deposit.confirmations = btcTx.confirmations;
          if (btcTx.confirmations >= this.config.requiredConfirmations) {
            deposit.status = 1 /* Confirmed */;
            logger5.info({
              depositId,
              txHash: btcTx.txHash,
              confirmations: btcTx.confirmations
            }, "Deposit confirmed");
          } else {
            logger5.debug({
              depositId,
              confirmations: btcTx.confirmations,
              required: this.config.requiredConfirmations
            }, "Waiting for confirmations");
          }
        }
      }
    }
  }
  /**
   * Process confirmed deposits by triggering wBTC minting
   */
  async processConfirmedDeposits() {
    for (const [depositId, deposit] of this.pendingDeposits) {
      if (deposit.status === 1 /* Confirmed */ && deposit.btcTxHash) {
        try {
          await this.claimDeposit(depositId, deposit);
        } catch (error) {
          logger5.error({ error, depositId }, "Failed to claim deposit");
        }
      }
    }
  }
  /**
   * Claim a confirmed deposit to mint wBTC
   */
  async claimDeposit(depositId, deposit) {
    if (!this.atomiqAdapter || !deposit.btcTxHash) {
      return;
    }
    logger5.info({ depositId, btcTxHash: deposit.btcTxHash }, "Claiming deposit");
    try {
      const btcTxHashU256 = BigInt("0x" + deposit.btcTxHash);
      const merkleProof = [];
      const calls = [
        {
          contractAddress: this.atomiqAdapter.address,
          entrypoint: "claim_deposit",
          calldata: [
            depositId,
            btcTxHashU256.toString(),
            merkleProof.length.toString(),
            ...merkleProof.map((p) => p.toString())
          ]
        }
      ];
      const txHash = await executeTransaction(calls);
      deposit.status = 2 /* Claimed */;
      logger5.info({ depositId, txHash }, "Deposit claimed successfully");
      this.pendingDeposits.delete(depositId);
    } catch (error) {
      logger5.error({ error, depositId }, "Failed to claim deposit");
      throw error;
    }
  }
  /**
   * Check Bitcoin blockchain for deposit to address
   * In production, this would query a Bitcoin node or Atomiq's API
   */
  async checkBtcDeposit(btcAddressHash) {
    return null;
  }
  /**
   * Generate BTC address hash from user address and deposit ID
   */
  generateBtcAddressHash(starknetAddress, depositId) {
    const combined = starknetAddress + depositId.toString();
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return "0x" + Math.abs(hash).toString(16).padStart(64, "0");
  }
  /**
   * Convert hash to testnet BTC address (simplified)
   */
  hashToBtcAddress(hash) {
    const shortHash = hash.slice(2, 34);
    return `tb1q${shortHash}`;
  }
  /**
   * Get deposit status by ID
   */
  async getDepositStatus(depositId) {
    return this.pendingDeposits.get(depositId) || null;
  }
  /**
   * Get all pending deposits for a user
   */
  async getUserDeposits(starknetAddress) {
    const deposits = [];
    for (const deposit of this.pendingDeposits.values()) {
      if (deposit.user === starknetAddress) {
        deposits.push(deposit);
      }
    }
    return deposits;
  }
  /**
   * Get bridge statistics
   */
  getStats() {
    let pendingCount = 0;
    let confirmedCount = 0;
    let totalValue = 0n;
    for (const deposit of this.pendingDeposits.values()) {
      if (deposit.status === 0 /* Pending */) {
        pendingCount++;
        totalValue += deposit.amountSats;
      } else if (deposit.status === 1 /* Confirmed */) {
        confirmedCount++;
      }
    }
    return {
      pendingDeposits: pendingCount,
      confirmedDeposits: confirmedCount,
      totalValuePending: totalValue
    };
  }
};
var DEFAULT_ATOMIQ_CONFIG = {
  enabled: process.env.ATOMIQ_BRIDGE_ENABLED === "true",
  pollIntervalMs: parseInt(process.env.ATOMIQ_POLL_INTERVAL || "60000"),
  requiredConfirmations: parseInt(process.env.ATOMIQ_CONFIRMATIONS || "3"),
  atomiqApiUrl: process.env.ATOMIQ_API_URL || "https://api.atomiq.exchange",
  atomiqApiKey: process.env.ATOMIQ_API_KEY,
  alertWebhook: process.env.ALERT_WEBHOOK
};
var bridgeServiceInstance = null;
function getBridgeService(config = DEFAULT_ATOMIQ_CONFIG) {
  if (!bridgeServiceInstance) {
    bridgeServiceInstance = new AtomiqBridgeService(config);
  }
  return bridgeServiceInstance;
}

// src/index.ts
var createLogger6 = pino6.default || pino6;
var logger6 = createLogger6({
  name: "btcusd-backend",
  level: process.env.LOG_LEVEL || "info"
});
async function main() {
  logger6.info("Starting BTCUSD Backend...");
  logger6.info("Contract addresses:");
  logger6.info(`  Vault: ${CONTRACTS.vault}`);
  logger6.info(`  Liquidator: ${CONTRACTS.liquidator}`);
  logger6.info(`  Oracle: ${CONTRACTS.oracle}`);
  logger6.info(`  YieldManager: ${CONTRACTS.yieldManager}`);
  const keepers = [];
  if (LIQUIDATION_CONFIG.enabled) {
    logger6.info("Liquidation keeper enabled");
    const bot = new LiquidationBot();
    keepers.push({ name: "liquidation", start: () => bot.start(), stop: () => bot.stop() });
  }
  if (YIELD_CONFIG.enabled) {
    logger6.info("Yield keeper enabled");
    const harvester = new YieldHarvester();
    keepers.push({ name: "yield", start: () => harvester.start(), stop: () => harvester.stop() });
  }
  if (PRICE_CONFIG.enabled) {
    logger6.info("Price keeper enabled");
    const monitor = new PriceMonitor();
    keepers.push({ name: "price", start: () => monitor.start(), stop: () => monitor.stop() });
  }
  if (DEFAULT_ATOMIQ_CONFIG.enabled) {
    logger6.info("Atomiq Bridge service enabled");
    const bridgeService = getBridgeService();
    keepers.push({
      name: "atomiq-bridge",
      start: async () => {
        await bridgeService.initialize();
        await bridgeService.startMonitoring();
      },
      stop: async () => bridgeService.stopMonitoring()
    });
  }
  if (keepers.length === 0) {
    logger6.warn("No keepers enabled! Set LIQUIDATION_KEEPER_ENABLED, YIELD_KEEPER_ENABLED, PRICE_KEEPER_ENABLED, or ATOMIQ_BRIDGE_ENABLED to true");
    return;
  }
  for (const keeper of keepers) {
    try {
      await keeper.start();
      logger6.info(`${keeper.name} keeper started`);
    } catch (err) {
      logger6.error({ err }, `Failed to start ${keeper.name} keeper`);
    }
  }
  const shutdown = async () => {
    logger6.info("Shutting down...");
    for (const keeper of keepers) {
      try {
        await keeper.stop();
        logger6.info(`${keeper.name} keeper stopped`);
      } catch (err) {
        logger6.error({ err }, `Failed to stop ${keeper.name} keeper`);
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
main().catch((err) => {
  logger6.error({ err }, "Fatal error");
  process.exit(1);
});
