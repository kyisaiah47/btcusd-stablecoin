/// BTCUSD Vault Contract
///
/// The core protocol contract managing collateralized debt positions.
///
/// Key responsibilities:
/// - Accept wBTC collateral deposits
/// - Mint/burn BTCUSD stablecoin against collateral
/// - Enforce minimum collateral ratio (150%)
/// - Track user positions (collateral, debt)
/// - Integrate with price oracle for valuations
/// - Route collateral to yield manager
///
/// Security invariants:
/// 1. Total BTCUSD supply == sum of all user debts
/// 2. Each position must have collateral_ratio >= MIN_COLLATERAL_RATIO (or debt == 0)
/// 3. Only this contract can mint/burn BTCUSD

#[starknet::contract]
pub mod BTCUSDVault {
    use core::num::traits::Zero;
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry,
    };
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_security::reentrancyguard::ReentrancyGuardComponent;
    use btcusd_protocol::interfaces::{
        IBTCUSDVault, Position, IBTCUSDTokenDispatcher, IBTCUSDTokenDispatcherTrait,
        IYieldManagerDispatcher, IYieldManagerDispatcherTrait, IPriceOracleDispatcher,
        IPriceOracleDispatcherTrait,
    };

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy, event: ReentrancyEvent);

    // External implementations
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    // Internal implementations
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl ReentrancyInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    // ============ Constants ============

    /// Precision for basis point calculations (10000 = 100%)
    const PRECISION: u256 = 10000;

    /// Minimum collateral ratio: 150% (15000 basis points)
    const MIN_COLLATERAL_RATIO: u256 = 15000;

    /// Liquidation threshold: 120% (12000 basis points) - for Stage 2
    const LIQUIDATION_THRESHOLD: u256 = 12000;

    /// Maximum LTV: 66.67% (6667 basis points)
    const MAX_LTV: u256 = 6667;

    /// wBTC decimals
    const WBTC_DECIMALS: u256 = 100000000; // 10^8

    /// BTCUSD decimals
    const BTCUSD_DECIMALS: u256 = 1000000000000000000; // 10^18

    /// Price decimals (oracle returns 8 decimals)
    const PRICE_DECIMALS: u256 = 100000000; // 10^8

    /// Default minimum deposit: 0.001 wBTC (100000 satoshis)
    const DEFAULT_MIN_DEPOSIT: u256 = 100000;

    // ============ Storage ============

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        #[substorage(v0)]
        reentrancy: ReentrancyGuardComponent::Storage,
        // Token contracts
        wbtc_token: ContractAddress,
        btcusd_token: ContractAddress,
        // External contracts
        price_oracle: ContractAddress,
        yield_manager: ContractAddress,
        // User positions
        positions: Map<ContractAddress, Position>,
        // Global state
        total_collateral: u256,
        total_debt: u256,
        // Configuration
        min_deposit: u256,
    }

    // ============ Events ============

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        ReentrancyEvent: ReentrancyGuardComponent::Event,
        CollateralDeposited: CollateralDeposited,
        CollateralWithdrawn: CollateralWithdrawn,
        BTCUSDMinted: BTCUSDMinted,
        BTCUSDBurned: BTCUSDBurned,
        PositionUpdated: PositionUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralDeposited {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub total_collateral: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralWithdrawn {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub remaining_collateral: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BTCUSDMinted {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub total_debt: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BTCUSDBurned {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub remaining_debt: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PositionUpdated {
        #[key]
        pub user: ContractAddress,
        pub collateral: u256,
        pub debt: u256,
        pub collateral_ratio: u256,
    }

    // ============ Errors ============

    pub mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Vault: zero address';
        pub const ZERO_AMOUNT: felt252 = 'Vault: zero amount';
        pub const BELOW_MIN_DEPOSIT: felt252 = 'Vault: below min deposit';
        pub const INSUFFICIENT_COLLATERAL: felt252 = 'Vault: insufficient collateral';
        pub const INSUFFICIENT_DEBT: felt252 = 'Vault: insufficient debt';
        pub const UNHEALTHY_POSITION: felt252 = 'Vault: unhealthy position';
        pub const NO_POSITION: felt252 = 'Vault: no position';
        pub const STALE_PRICE: felt252 = 'Vault: stale price';
        pub const ZERO_PRICE: felt252 = 'Vault: zero price';
    }

    // ============ Constructor ============

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        wbtc_token: ContractAddress,
        btcusd_token: ContractAddress,
        price_oracle: ContractAddress,
        yield_manager: ContractAddress,
    ) {
        // Initialize components
        self.ownable.initializer(owner);

        // Validate addresses
        assert(!wbtc_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(!btcusd_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(!price_oracle.is_zero(), Errors::ZERO_ADDRESS);
        assert(!yield_manager.is_zero(), Errors::ZERO_ADDRESS);

        // Store contract addresses
        self.wbtc_token.write(wbtc_token);
        self.btcusd_token.write(btcusd_token);
        self.price_oracle.write(price_oracle);
        self.yield_manager.write(yield_manager);

        // Set default configuration
        self.min_deposit.write(DEFAULT_MIN_DEPOSIT);
    }

    // ============ IBTCUSDVault Implementation ============

    #[abi(embed_v0)]
    impl BTCUSDVaultImpl of IBTCUSDVault<ContractState> {
        // ============ Core User Operations ============

        fn deposit_collateral(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            self.reentrancy.start();

            let caller = get_caller_address();
            assert(amount > 0, Errors::ZERO_AMOUNT);
            assert(amount >= self.min_deposit.read(), Errors::BELOW_MIN_DEPOSIT);

            // Transfer wBTC from user to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer_from(caller, get_contract_address(), amount);

            // Update position
            let mut position = self.positions.entry(caller).read();
            position.collateral = position.collateral + amount;
            position.last_update = get_block_timestamp();
            self.positions.entry(caller).write(position);

            // Update global state
            self.total_collateral.write(self.total_collateral.read() + amount);

            // Route collateral to yield manager
            self._deposit_to_yield_manager(caller, amount);

            self
                .emit(
                    CollateralDeposited { user: caller, amount, total_collateral: position.collateral },
                );
            self._emit_position_updated(caller, position);

            self.reentrancy.end();
        }

        fn withdraw_collateral(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            self.reentrancy.start();

            let caller = get_caller_address();
            assert(amount > 0, Errors::ZERO_AMOUNT);

            let mut position = self.positions.entry(caller).read();
            assert(position.collateral >= amount, Errors::INSUFFICIENT_COLLATERAL);

            // Calculate new position
            let new_collateral = position.collateral - amount;

            // Check if withdrawal would make position unhealthy
            if position.debt > 0 {
                let new_ratio = self._calculate_collateral_ratio(new_collateral, position.debt);
                assert(new_ratio >= MIN_COLLATERAL_RATIO, Errors::UNHEALTHY_POSITION);
            }

            // Update position
            position.collateral = new_collateral;
            position.last_update = get_block_timestamp();
            self.positions.entry(caller).write(position);

            // Update global state
            self.total_collateral.write(self.total_collateral.read() - amount);

            // Withdraw from yield manager and transfer to user
            self._withdraw_from_yield_manager(caller, amount);
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer(caller, amount);

            self
                .emit(
                    CollateralWithdrawn { user: caller, amount, remaining_collateral: new_collateral },
                );
            self._emit_position_updated(caller, position);

            self.reentrancy.end();
        }

        fn mint_btcusd(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            self.reentrancy.start();

            let caller = get_caller_address();
            assert(amount > 0, Errors::ZERO_AMOUNT);

            let mut position = self.positions.entry(caller).read();
            assert(position.collateral > 0, Errors::NO_POSITION);

            // Calculate new debt
            let new_debt = position.debt + amount;

            // Check if minting would make position unhealthy
            let new_ratio = self._calculate_collateral_ratio(position.collateral, new_debt);
            assert(new_ratio >= MIN_COLLATERAL_RATIO, Errors::UNHEALTHY_POSITION);

            // Update position
            position.debt = new_debt;
            position.last_update = get_block_timestamp();
            self.positions.entry(caller).write(position);

            // Update global state
            self.total_debt.write(self.total_debt.read() + amount);

            // Mint BTCUSD to user
            let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
            btcusd.mint(caller, amount);

            self.emit(BTCUSDMinted { user: caller, amount, total_debt: new_debt });
            self._emit_position_updated(caller, position);

            self.reentrancy.end();
        }

        fn burn_btcusd(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            self.reentrancy.start();

            let caller = get_caller_address();
            assert(amount > 0, Errors::ZERO_AMOUNT);

            let mut position = self.positions.entry(caller).read();
            assert(position.debt >= amount, Errors::INSUFFICIENT_DEBT);

            // Update position
            position.debt = position.debt - amount;
            position.last_update = get_block_timestamp();
            self.positions.entry(caller).write(position);

            // Update global state
            self.total_debt.write(self.total_debt.read() - amount);

            // Burn BTCUSD from user
            let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
            btcusd.burn(caller, amount);

            self.emit(BTCUSDBurned { user: caller, amount, remaining_debt: position.debt });
            self._emit_position_updated(caller, position);

            self.reentrancy.end();
        }

        fn deposit_and_mint(ref self: ContractState, collateral_amount: u256) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy.start();

            let caller = get_caller_address();
            assert(collateral_amount > 0, Errors::ZERO_AMOUNT);
            assert(collateral_amount >= self.min_deposit.read(), Errors::BELOW_MIN_DEPOSIT);

            // Transfer wBTC from user to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer_from(caller, get_contract_address(), collateral_amount);

            // Get current position
            let mut position = self.positions.entry(caller).read();
            let new_collateral = position.collateral + collateral_amount;

            // Calculate max BTCUSD to mint at MAX_LTV
            let collateral_value = self._get_collateral_value(new_collateral);
            let max_debt_value = collateral_value * MAX_LTV / PRECISION;
            let current_debt_value = self._get_debt_value(position.debt);
            let mint_amount = if max_debt_value > current_debt_value {
                max_debt_value - current_debt_value
            } else {
                0
            };

            // Update position
            position.collateral = new_collateral;
            position.debt = position.debt + mint_amount;
            position.last_update = get_block_timestamp();
            self.positions.entry(caller).write(position);

            // Update global state
            self.total_collateral.write(self.total_collateral.read() + collateral_amount);
            self.total_debt.write(self.total_debt.read() + mint_amount);

            // Route collateral to yield manager
            self._deposit_to_yield_manager(caller, collateral_amount);

            // Mint BTCUSD to user
            if mint_amount > 0 {
                let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
                btcusd.mint(caller, mint_amount);
            }

            self
                .emit(
                    CollateralDeposited {
                        user: caller, amount: collateral_amount, total_collateral: new_collateral,
                    },
                );
            self.emit(BTCUSDMinted { user: caller, amount: mint_amount, total_debt: position.debt });
            self._emit_position_updated(caller, position);

            self.reentrancy.end();

            mint_amount
        }

        fn repay_and_withdraw(ref self: ContractState, btcusd_amount: u256) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy.start();

            let caller = get_caller_address();
            assert(btcusd_amount > 0, Errors::ZERO_AMOUNT);

            let position = self.positions.entry(caller).read();
            assert(position.debt > 0, Errors::NO_POSITION);
            assert(btcusd_amount <= position.debt, Errors::INSUFFICIENT_DEBT);

            // Calculate proportional collateral to return
            // collateral_to_return = btcusd_amount * collateral / debt
            let collateral_to_return = btcusd_amount * position.collateral / position.debt;

            // Update position
            let new_collateral = position.collateral - collateral_to_return;
            let new_debt = position.debt - btcusd_amount;

            let mut updated_position = position;
            updated_position.collateral = new_collateral;
            updated_position.debt = new_debt;
            updated_position.last_update = get_block_timestamp();
            self.positions.entry(caller).write(updated_position);

            // Update global state
            self.total_collateral.write(self.total_collateral.read() - collateral_to_return);
            self.total_debt.write(self.total_debt.read() - btcusd_amount);

            // Burn BTCUSD from user
            let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
            btcusd.burn(caller, btcusd_amount);

            // Withdraw from yield manager and transfer to user
            self._withdraw_from_yield_manager(caller, collateral_to_return);
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer(caller, collateral_to_return);

            self.emit(BTCUSDBurned { user: caller, amount: btcusd_amount, remaining_debt: new_debt });
            self
                .emit(
                    CollateralWithdrawn {
                        user: caller, amount: collateral_to_return, remaining_collateral: new_collateral,
                    },
                );
            self._emit_position_updated(caller, updated_position);

            self.reentrancy.end();

            collateral_to_return
        }

        // ============ View Functions ============

        fn get_position(self: @ContractState, user: ContractAddress) -> Position {
            self.positions.entry(user).read()
        }

        fn get_collateral_ratio(self: @ContractState, user: ContractAddress) -> u256 {
            let position = self.positions.entry(user).read();
            if position.debt == 0 {
                return 0;
            }
            self._calculate_collateral_ratio(position.collateral, position.debt)
        }

        fn get_health_factor(self: @ContractState, user: ContractAddress) -> u256 {
            // Health factor is the same as collateral ratio in our model
            self.get_collateral_ratio(user)
        }

        fn is_liquidatable(self: @ContractState, user: ContractAddress) -> bool {
            let ratio = self.get_collateral_ratio(user);
            // Position is liquidatable if ratio > 0 (has debt) and below threshold
            ratio > 0 && ratio < LIQUIDATION_THRESHOLD
        }

        fn get_max_mintable(self: @ContractState, user: ContractAddress) -> u256 {
            let position = self.positions.entry(user).read();
            if position.collateral == 0 {
                return 0;
            }

            let collateral_value = self._get_collateral_value(position.collateral);
            let max_debt_value = collateral_value * MAX_LTV / PRECISION;
            let current_debt_value = self._get_debt_value(position.debt);

            if max_debt_value > current_debt_value {
                max_debt_value - current_debt_value
            } else {
                0
            }
        }

        fn get_max_withdrawable(self: @ContractState, user: ContractAddress) -> u256 {
            let position = self.positions.entry(user).read();

            if position.debt == 0 {
                // No debt, can withdraw everything
                return position.collateral;
            }

            // Calculate minimum collateral needed
            // min_collateral_value = debt_value * MIN_COLLATERAL_RATIO / PRECISION
            let debt_value = self._get_debt_value(position.debt);
            let min_collateral_value = debt_value * MIN_COLLATERAL_RATIO / PRECISION;

            // Convert back to collateral amount
            let (btc_price, _) = self._get_btc_price_safe();
            // min_collateral = min_collateral_value * WBTC_DECIMALS * PRICE_DECIMALS / (btc_price *
            // BTCUSD_DECIMALS)
            let min_collateral = min_collateral_value
                * WBTC_DECIMALS
                * PRICE_DECIMALS
                / (btc_price * BTCUSD_DECIMALS);

            if position.collateral > min_collateral {
                position.collateral - min_collateral
            } else {
                0
            }
        }

        fn get_protocol_stats(self: @ContractState) -> (u256, u256) {
            (self.total_collateral.read(), self.total_debt.read())
        }

        fn get_btc_price(self: @ContractState) -> u256 {
            let (price, _) = self._get_btc_price_safe();
            price
        }

        // ============ Admin Functions ============

        fn set_oracle(ref self: ContractState, oracle: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!oracle.is_zero(), Errors::ZERO_ADDRESS);
            self.price_oracle.write(oracle);
        }

        fn set_yield_manager(ref self: ContractState, yield_manager: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!yield_manager.is_zero(), Errors::ZERO_ADDRESS);
            self.yield_manager.write(yield_manager);
        }

        fn set_min_deposit(ref self: ContractState, min_deposit: u256) {
            self.ownable.assert_only_owner();
            self.min_deposit.write(min_deposit);
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }

        fn get_addresses(
            self: @ContractState,
        ) -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
            (
                self.wbtc_token.read(),
                self.btcusd_token.read(),
                self.price_oracle.read(),
                self.yield_manager.read(),
            )
        }
    }

    // ============ Internal Functions ============

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Gets BTC price from oracle, panics if stale or zero.
        fn _get_btc_price_safe(self: @ContractState) -> (u256, u64) {
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (price, timestamp) = oracle.get_btc_price();

            assert(price > 0, Errors::ZERO_PRICE);
            assert(!oracle.is_price_stale(), Errors::STALE_PRICE);

            (price, timestamp)
        }

        /// Calculates collateral value in BTCUSD (18 decimals).
        /// collateral_value = collateral * btc_price * BTCUSD_DECIMALS / (WBTC_DECIMALS *
        /// PRICE_DECIMALS)
        fn _get_collateral_value(self: @ContractState, collateral: u256) -> u256 {
            if collateral == 0 {
                return 0;
            }

            let (btc_price, _) = self._get_btc_price_safe();

            // collateral (8 dec) * price (8 dec) * 10^18 / (10^8 * 10^8)
            collateral * btc_price * BTCUSD_DECIMALS / (WBTC_DECIMALS * PRICE_DECIMALS)
        }

        /// Converts BTCUSD amount to value (they're the same since BTCUSD = $1).
        fn _get_debt_value(self: @ContractState, debt: u256) -> u256 {
            debt // BTCUSD is already in 18 decimals, pegged to $1
        }

        /// Calculates collateral ratio in basis points.
        /// ratio = collateral_value * PRECISION / debt_value
        fn _calculate_collateral_ratio(
            self: @ContractState, collateral: u256, debt: u256,
        ) -> u256 {
            if debt == 0 {
                return 0; // No debt means infinite ratio, return 0 to indicate no debt
            }

            let collateral_value = self._get_collateral_value(collateral);
            let debt_value = self._get_debt_value(debt);

            collateral_value * PRECISION / debt_value
        }

        /// Deposits collateral to yield manager.
        fn _deposit_to_yield_manager(
            ref self: ContractState, user: ContractAddress, amount: u256,
        ) {
            let yield_manager = self.yield_manager.read();
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };

            // Approve yield manager to spend wBTC
            wbtc.approve(yield_manager, amount);

            // Deposit to yield manager
            let ym = IYieldManagerDispatcher { contract_address: yield_manager };
            ym.deposit(user, amount);
        }

        /// Withdraws collateral from yield manager.
        fn _withdraw_from_yield_manager(
            ref self: ContractState, user: ContractAddress, amount: u256,
        ) {
            let yield_manager = self.yield_manager.read();
            let ym = IYieldManagerDispatcher { contract_address: yield_manager };
            ym.withdraw(user, amount);
        }

        /// Emits a position updated event with current collateral ratio.
        fn _emit_position_updated(
            ref self: ContractState, user: ContractAddress, position: Position,
        ) {
            let ratio = if position.debt > 0 {
                self._calculate_collateral_ratio(position.collateral, position.debt)
            } else {
                0
            };

            self
                .emit(
                    PositionUpdated {
                        user,
                        collateral: position.collateral,
                        debt: position.debt,
                        collateral_ratio: ratio,
                    },
                );
        }
    }
}
