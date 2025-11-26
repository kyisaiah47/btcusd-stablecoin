/// Vesu Yield Manager Contract
///
/// Production yield manager that integrates with the Vesu lending protocol.
/// Deposits wBTC collateral to Vesu to earn yield, then distributes to users.
///
/// Key behaviors:
/// - Deposits wBTC to Vesu pools for yield generation
/// - Tracks user shares based on their deposited collateral
/// - Harvests yield and distributes with configurable fee split
/// - Emergency withdrawal functionality

#[starknet::contract]
pub mod VesuYieldManager {
    use core::num::traits::Zero;
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry,
    };
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use btcusd_protocol::interfaces::i_yield_manager::IYieldManager;
    use btcusd_protocol::interfaces::i_vesu::{
        IVesuSingletonDispatcher, IVesuSingletonDispatcherTrait,
        Amount, AmountType, AmountDenomination, ModifyPositionParams,
    };
    use alexandria_math::i257::I257Impl;

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // External implementations
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    // Internal implementations
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // ============ Constants ============

    /// Precision for basis point calculations
    const PRECISION: u256 = 10000;

    /// Default user share: 70%
    const DEFAULT_USER_SHARE: u256 = 7000;

    /// Default protocol share: 30%
    const DEFAULT_PROTOCOL_SHARE: u256 = 3000;

    /// Vesu Singleton on Sepolia
    const VESU_SINGLETON_SEPOLIA: felt252 = 0x2110b3cde727cd34407e257e1070857a06010cf02a14b1ee181612fb1b61c30;

    // ============ Storage ============

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        /// The vault contract address - only address that can deposit/withdraw
        vault: ContractAddress,
        /// The wBTC token address
        wbtc_token: ContractAddress,
        /// Vesu Singleton contract address
        vesu_singleton: ContractAddress,
        /// Vesu pool ID for wBTC
        vesu_pool_id: felt252,
        /// Per-user deposit tracking (principal only)
        user_deposits: Map<ContractAddress, u256>,
        /// Per-user share tracking (for yield calculation)
        user_shares: Map<ContractAddress, u256>,
        /// Total wBTC deposited across all users (principal)
        total_deposits: u256,
        /// Total shares issued
        total_shares: u256,
        /// Last recorded total value (for yield calculation)
        last_total_value: u256,
        /// Total yield harvested (for stats)
        total_yield_harvested: u256,
        /// User's share of yield in basis points (e.g., 7000 = 70%)
        user_share: u256,
        /// Protocol's share of yield in basis points (e.g., 3000 = 30%)
        protocol_share: u256,
        /// Treasury address for protocol fees
        treasury: ContractAddress,
        /// Pause flag for emergency
        paused: bool,
    }

    // ============ Events ============

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        YieldHarvested: YieldHarvested,
        ConfigUpdated: ConfigUpdated,
        EmergencyWithdraw: EmergencyWithdraw,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub shares: u256,
        pub total_deposit: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawn {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub shares: u256,
        pub remaining_deposit: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldHarvested {
        #[key]
        pub user: ContractAddress,
        pub total_yield: u256,
        pub user_amount: u256,
        pub protocol_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConfigUpdated {
        pub user_share: u256,
        pub protocol_share: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EmergencyWithdraw {
        pub amount: u256,
        pub timestamp: u64,
    }

    // ============ Errors ============

    pub mod Errors {
        pub const ONLY_VAULT: felt252 = 'VesuYieldMgr: not vault';
        pub const ZERO_ADDRESS: felt252 = 'VesuYieldMgr: zero address';
        pub const ZERO_AMOUNT: felt252 = 'VesuYieldMgr: zero amount';
        pub const INSUFFICIENT_BALANCE: felt252 = 'VesuYieldMgr: insufficient bal';
        pub const INVALID_FEE_CONFIG: felt252 = 'VesuYieldMgr: invalid fees';
        pub const PAUSED: felt252 = 'VesuYieldMgr: paused';
        pub const VESU_DEPOSIT_FAILED: felt252 = 'VesuYieldMgr: deposit fail';
        pub const VESU_WITHDRAW_FAILED: felt252 = 'VesuYieldMgr: withdraw fail';
    }

    // ============ Constructor ============

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault: ContractAddress,
        wbtc_token: ContractAddress,
        vesu_singleton: ContractAddress,
        vesu_pool_id: felt252,
        treasury: ContractAddress,
    ) {
        self.ownable.initializer(owner);

        assert(!vault.is_zero(), Errors::ZERO_ADDRESS);
        assert(!wbtc_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(!vesu_singleton.is_zero(), Errors::ZERO_ADDRESS);
        assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);

        self.vault.write(vault);
        self.wbtc_token.write(wbtc_token);
        self.vesu_singleton.write(vesu_singleton);
        self.vesu_pool_id.write(vesu_pool_id);
        self.treasury.write(treasury);

        // Set default configuration
        self.user_share.write(DEFAULT_USER_SHARE);
        self.protocol_share.write(DEFAULT_PROTOCOL_SHARE);
        self.paused.write(false);
    }

    // ============ IYieldManager Implementation ============

    #[abi(embed_v0)]
    impl YieldManagerImpl of IYieldManager<ContractState> {
        fn deposit(ref self: ContractState, user: ContractAddress, amount: u256) {
            self._assert_only_vault();
            self._assert_not_paused();
            assert(!user.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            // Transfer wBTC from vault to this contract
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let vault = self.vault.read();
            wbtc.transfer_from(vault, get_contract_address(), amount);

            // Calculate shares to mint
            let shares = self._calculate_shares_for_deposit(amount);

            // Deposit to Vesu
            self._deposit_to_vesu(amount);

            // Update user state
            let current_deposit = self.user_deposits.entry(user).read();
            let current_shares = self.user_shares.entry(user).read();
            self.user_deposits.entry(user).write(current_deposit + amount);
            self.user_shares.entry(user).write(current_shares + shares);

            // Update totals
            self.total_deposits.write(self.total_deposits.read() + amount);
            self.total_shares.write(self.total_shares.read() + shares);

            self.emit(Deposited {
                user,
                amount,
                shares,
                total_deposit: current_deposit + amount,
            });
        }

        fn withdraw(ref self: ContractState, user: ContractAddress, amount: u256) {
            self._assert_only_vault();
            assert(!user.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            let current_deposit = self.user_deposits.entry(user).read();
            assert(current_deposit >= amount, Errors::INSUFFICIENT_BALANCE);

            // Calculate shares to burn proportionally
            let user_shares = self.user_shares.entry(user).read();
            let shares_to_burn = (user_shares * amount) / current_deposit;

            // Withdraw from Vesu
            self._withdraw_from_vesu(amount);

            // Update user state
            self.user_deposits.entry(user).write(current_deposit - amount);
            self.user_shares.entry(user).write(user_shares - shares_to_burn);

            // Update totals
            self.total_deposits.write(self.total_deposits.read() - amount);
            self.total_shares.write(self.total_shares.read() - shares_to_burn);

            // Transfer wBTC back to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let vault = self.vault.read();
            wbtc.transfer(vault, amount);

            self.emit(Withdrawn {
                user,
                amount,
                shares: shares_to_burn,
                remaining_deposit: current_deposit - amount,
            });
        }

        fn harvest_yield(ref self: ContractState, user: ContractAddress) -> u256 {
            self._assert_not_paused();

            // Get user's current value vs principal
            let user_shares = self.user_shares.entry(user).read();
            if user_shares == 0 {
                return 0;
            }

            let total_shares = self.total_shares.read();
            let total_value = self._get_total_vesu_value();

            // Calculate user's share of total value
            let user_value = (total_value * user_shares) / total_shares;
            let user_principal = self.user_deposits.entry(user).read();

            // Yield = current value - principal
            if user_value <= user_principal {
                return 0;
            }

            let total_yield = user_value - user_principal;

            // Calculate fee split
            let user_share_bps = self.user_share.read();
            let user_amount = (total_yield * user_share_bps) / PRECISION;
            let protocol_amount = total_yield - user_amount;

            // Withdraw yield from Vesu and distribute
            self._withdraw_from_vesu(total_yield);

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };

            // Send user share
            if user_amount > 0 {
                wbtc.transfer(user, user_amount);
            }

            // Send protocol share to treasury
            if protocol_amount > 0 {
                let treasury = self.treasury.read();
                wbtc.transfer(treasury, protocol_amount);
            }

            // Update stats
            self.total_yield_harvested.write(self.total_yield_harvested.read() + total_yield);

            self.emit(YieldHarvested {
                user,
                total_yield,
                user_amount,
                protocol_amount,
            });

            user_amount
        }

        fn harvest_all(ref self: ContractState) {
            // This is called by keeper - currently a no-op
            // In production, you'd iterate over users or use a batching mechanism
        }

        fn get_user_deposit(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_deposits.entry(user).read()
        }

        fn get_user_yield(self: @ContractState, user: ContractAddress) -> u256 {
            let user_shares = self.user_shares.entry(user).read();
            if user_shares == 0 {
                return 0;
            }

            let total_shares = self.total_shares.read();
            if total_shares == 0 {
                return 0;
            }

            let total_value = self._get_total_vesu_value();
            let user_value = (total_value * user_shares) / total_shares;
            let user_principal = self.user_deposits.entry(user).read();

            if user_value > user_principal {
                user_value - user_principal
            } else {
                0
            }
        }

        fn get_total_deposits(self: @ContractState) -> u256 {
            self.total_deposits.read()
        }

        fn get_total_yield(self: @ContractState) -> u256 {
            let total_value = self._get_total_vesu_value();
            let total_deposits = self.total_deposits.read();

            if total_value > total_deposits {
                total_value - total_deposits
            } else {
                0
            }
        }

        fn get_yield_rate(self: @ContractState) -> u256 {
            // Query Vesu for current supply APY
            // For now, return a placeholder - Vesu's rate varies by utilization
            500 // 5% APY as placeholder
        }

        fn get_fee_config(self: @ContractState) -> (u256, u256) {
            (self.user_share.read(), self.protocol_share.read())
        }

        fn set_vault(ref self: ContractState, vault: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!vault.is_zero(), Errors::ZERO_ADDRESS);
            self.vault.write(vault);
        }

        fn set_yield_rate(ref self: ContractState, rate: u256) {
            // No-op for Vesu - rate is determined by the protocol
            self.ownable.assert_only_owner();
            let _ = rate; // Suppress unused warning
        }

        fn set_fee_config(ref self: ContractState, user_share: u256, protocol_share: u256) {
            self.ownable.assert_only_owner();
            assert(user_share + protocol_share == PRECISION, Errors::INVALID_FEE_CONFIG);

            self.user_share.write(user_share);
            self.protocol_share.write(protocol_share);

            self.emit(ConfigUpdated { user_share, protocol_share });
        }

        fn emergency_withdraw(ref self: ContractState) {
            self.ownable.assert_only_owner();

            // Withdraw all from Vesu
            let total_value = self._get_total_vesu_value();
            if total_value > 0 {
                self._withdraw_from_vesu(total_value);
            }

            // Transfer all wBTC to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let balance = wbtc.balance_of(get_contract_address());

            if balance > 0 {
                let vault = self.vault.read();
                wbtc.transfer(vault, balance);
            }

            // Pause the contract
            self.paused.write(true);

            self.emit(EmergencyWithdraw {
                amount: balance,
                timestamp: get_block_timestamp(),
            });
        }
    }

    // ============ Admin Functions ============

    #[generate_trait]
    #[abi(per_item)]
    impl AdminImpl of AdminTrait {
        #[external(v0)]
        fn set_vesu_pool_id(ref self: ContractState, pool_id: felt252) {
            self.ownable.assert_only_owner();
            self.vesu_pool_id.write(pool_id);
        }

        #[external(v0)]
        fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);
            self.treasury.write(treasury);
        }

        #[external(v0)]
        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.paused.write(false);
        }

        #[external(v0)]
        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.paused.write(true);
        }

        #[external(v0)]
        fn get_vesu_position(self: @ContractState) -> (u256, u256) {
            let vesu = IVesuSingletonDispatcher {
                contract_address: self.vesu_singleton.read()
            };
            let pool_id = self.vesu_pool_id.read();
            let wbtc = self.wbtc_token.read();
            let zero_addr: ContractAddress = 0.try_into().unwrap();

            let (position, collateral_value, _) = vesu.position_unsafe(
                pool_id,
                wbtc,
                zero_addr, // No debt asset
                get_contract_address()
            );

            (position.collateral_shares.into(), collateral_value)
        }
    }

    // ============ Internal Functions ============

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_only_vault(self: @ContractState) {
            let caller = get_caller_address();
            let vault = self.vault.read();
            assert(caller == vault, Errors::ONLY_VAULT);
        }

        fn _assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), Errors::PAUSED);
        }

        fn _calculate_shares_for_deposit(self: @ContractState, amount: u256) -> u256 {
            let total_shares = self.total_shares.read();
            let total_value = self._get_total_vesu_value();

            if total_shares == 0 || total_value == 0 {
                // First deposit: 1:1 shares
                amount
            } else {
                // Pro-rata shares based on current value
                (amount * total_shares) / total_value
            }
        }

        fn _get_total_vesu_value(self: @ContractState) -> u256 {
            let total_deposits = self.total_deposits.read();
            if total_deposits == 0 {
                return 0;
            }

            let vesu = IVesuSingletonDispatcher {
                contract_address: self.vesu_singleton.read()
            };
            let pool_id = self.vesu_pool_id.read();
            let wbtc = self.wbtc_token.read();
            let zero_addr: ContractAddress = 0.try_into().unwrap();

            // Get our position in Vesu
            let (_position, collateral_value, _) = vesu.position_unsafe(
                pool_id,
                wbtc,
                zero_addr, // No debt asset - we're only supplying
                get_contract_address()
            );

            // collateral_value is the current value of our position including yield
            collateral_value
        }

        fn _deposit_to_vesu(ref self: ContractState, amount: u256) {
            let vesu_singleton = self.vesu_singleton.read();
            let wbtc_token = self.wbtc_token.read();
            let pool_id = self.vesu_pool_id.read();

            // Approve Vesu to spend wBTC
            let wbtc = IERC20Dispatcher { contract_address: wbtc_token };
            wbtc.approve(vesu_singleton, amount);

            // Create modify_position params for deposit
            let zero_addr: ContractAddress = 0.try_into().unwrap();

            // Collateral amount - Delta type, Native denomination
            // I257Impl::new(abs, is_negative) - positive deposit
            let collateral = Amount {
                amount_type: AmountType::Delta,
                denomination: AmountDenomination::Native,
                value: I257Impl::new(amount, false), // positive = deposit
            };

            // No debt changes
            let debt = Amount {
                amount_type: AmountType::Delta,
                denomination: AmountDenomination::Native,
                value: I257Impl::new(0, false), // zero
            };

            let params = ModifyPositionParams {
                pool_id,
                collateral_asset: wbtc_token,
                debt_asset: zero_addr,
                user: get_contract_address(),
                collateral,
                debt,
                data: array![].span(),
            };

            // Execute deposit
            let vesu = IVesuSingletonDispatcher { contract_address: vesu_singleton };
            vesu.modify_position(params);
        }

        fn _withdraw_from_vesu(ref self: ContractState, amount: u256) {
            let vesu_singleton = self.vesu_singleton.read();
            let wbtc_token = self.wbtc_token.read();
            let pool_id = self.vesu_pool_id.read();
            let zero_addr: ContractAddress = 0.try_into().unwrap();

            // Collateral amount - negative = withdraw
            // I257Impl::new(abs, is_negative) - negative for withdrawal
            let collateral = Amount {
                amount_type: AmountType::Delta,
                denomination: AmountDenomination::Native,
                value: I257Impl::new(amount, true), // true = negative = withdraw
            };

            // No debt changes
            let debt = Amount {
                amount_type: AmountType::Delta,
                denomination: AmountDenomination::Native,
                value: I257Impl::new(0, false), // zero
            };

            let params = ModifyPositionParams {
                pool_id,
                collateral_asset: wbtc_token,
                debt_asset: zero_addr,
                user: get_contract_address(),
                collateral,
                debt,
                data: array![].span(),
            };

            // Execute withdrawal
            let vesu = IVesuSingletonDispatcher { contract_address: vesu_singleton };
            vesu.modify_position(params);
        }
    }
}
