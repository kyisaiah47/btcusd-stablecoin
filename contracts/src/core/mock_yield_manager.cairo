/// Mock Yield Manager Contract
///
/// A simplified yield manager for Stage 1 testing.
/// Tracks deposits and simulates yield accrual without real Vesu integration.
///
/// Key behaviors:
/// - Accepts wBTC deposits from the vault
/// - Holds wBTC (doesn't actually invest it anywhere)
/// - Simulates yield based on configurable APY rate
/// - Distributes yield with configurable fee split
///
/// In Stage 3, this will be replaced with VesuYieldManager.

#[starknet::contract]
pub mod MockYieldManager {
    use core::num::traits::Zero;
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry,
    };
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use btcusd_protocol::interfaces::i_yield_manager::IYieldManager;

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

    /// Seconds per year (for APY calculation)
    const SECONDS_PER_YEAR: u256 = 31536000;

    /// Default yield rate: 8% APY (800 basis points)
    const DEFAULT_YIELD_RATE: u256 = 800;

    /// Default user share: 70%
    const DEFAULT_USER_SHARE: u256 = 7000;

    /// Default protocol share: 30%
    const DEFAULT_PROTOCOL_SHARE: u256 = 3000;

    // ============ Storage ============

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        /// The vault contract address - only address that can deposit/withdraw
        vault: ContractAddress,
        /// The wBTC token address
        wbtc_token: ContractAddress,
        /// Per-user deposit tracking
        user_deposits: Map<ContractAddress, u256>,
        /// Per-user yield tracking (accumulated, unharvested)
        user_yield: Map<ContractAddress, u256>,
        /// Per-user last update timestamp
        user_last_update: Map<ContractAddress, u64>,
        /// Total wBTC deposited across all users
        total_deposits: u256,
        /// Total yield accumulated (for stats)
        total_yield_generated: u256,
        /// Yield rate in basis points (e.g., 800 = 8% APY)
        yield_rate: u256,
        /// User's share of yield in basis points (e.g., 7000 = 70%)
        user_share: u256,
        /// Protocol's share of yield in basis points (e.g., 3000 = 30%)
        protocol_share: u256,
        /// Treasury address for protocol fees
        treasury: ContractAddress,
    }

    // ============ Events ============

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        YieldAccrued: YieldAccrued,
        YieldHarvested: YieldHarvested,
        ConfigUpdated: ConfigUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub total_deposit: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawn {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub remaining_deposit: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldAccrued {
        #[key]
        pub user: ContractAddress,
        pub yield_amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldHarvested {
        #[key]
        pub user: ContractAddress,
        pub user_amount: u256,
        pub protocol_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConfigUpdated {
        pub yield_rate: u256,
        pub user_share: u256,
        pub protocol_share: u256,
    }

    // ============ Errors ============

    pub mod Errors {
        pub const ONLY_VAULT: felt252 = 'YieldMgr: caller is not vault';
        pub const ZERO_ADDRESS: felt252 = 'YieldMgr: zero address';
        pub const ZERO_AMOUNT: felt252 = 'YieldMgr: zero amount';
        pub const INSUFFICIENT_BALANCE: felt252 = 'YieldMgr: insufficient balance';
        pub const INVALID_FEE_CONFIG: felt252 = 'YieldMgr: invalid fee config';
    }

    // ============ Constructor ============

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault: ContractAddress,
        wbtc_token: ContractAddress,
        treasury: ContractAddress,
    ) {
        self.ownable.initializer(owner);

        assert(!vault.is_zero(), Errors::ZERO_ADDRESS);
        assert(!wbtc_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);

        self.vault.write(vault);
        self.wbtc_token.write(wbtc_token);
        self.treasury.write(treasury);

        // Set default configuration
        self.yield_rate.write(DEFAULT_YIELD_RATE);
        self.user_share.write(DEFAULT_USER_SHARE);
        self.protocol_share.write(DEFAULT_PROTOCOL_SHARE);
    }

    // ============ IYieldManager Implementation ============

    #[abi(embed_v0)]
    impl YieldManagerImpl of IYieldManager<ContractState> {
        fn deposit(ref self: ContractState, user: ContractAddress, amount: u256) {
            self._assert_only_vault();
            assert(!user.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            // Accrue any pending yield first
            self._accrue_yield(user);

            // Transfer wBTC from vault to this contract
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let vault = self.vault.read();
            wbtc.transfer_from(vault, get_contract_address(), amount);

            // Update user deposit
            let current_deposit = self.user_deposits.entry(user).read();
            let new_deposit = current_deposit + amount;
            self.user_deposits.entry(user).write(new_deposit);

            // Update totals
            self.total_deposits.write(self.total_deposits.read() + amount);

            // Update timestamp
            self.user_last_update.entry(user).write(get_block_timestamp());

            self.emit(Deposited { user, amount, total_deposit: new_deposit });
        }

        fn withdraw(ref self: ContractState, user: ContractAddress, amount: u256) {
            self._assert_only_vault();
            assert(!user.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            let current_deposit = self.user_deposits.entry(user).read();
            assert(current_deposit >= amount, Errors::INSUFFICIENT_BALANCE);

            // Accrue any pending yield first
            self._accrue_yield(user);

            // Update user deposit
            let new_deposit = current_deposit - amount;
            self.user_deposits.entry(user).write(new_deposit);

            // Update totals
            self.total_deposits.write(self.total_deposits.read() - amount);

            // Transfer wBTC back to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let vault = self.vault.read();
            wbtc.transfer(vault, amount);

            self.emit(Withdrawn { user, amount, remaining_deposit: new_deposit });
        }

        fn harvest_yield(ref self: ContractState, user: ContractAddress) -> u256 {
            // Accrue latest yield
            self._accrue_yield(user);

            let total_yield = self.user_yield.entry(user).read();
            if total_yield == 0 {
                return 0;
            }

            // Calculate fee split
            let user_share_bps = self.user_share.read();
            let user_amount = total_yield * user_share_bps / PRECISION;
            let protocol_amount = total_yield - user_amount;

            // Clear user yield
            self.user_yield.entry(user).write(0);

            // In mock version, we don't actually have yield tokens to transfer
            // In real version, this would withdraw from Vesu and transfer
            // For now, we emit the event for tracking

            self.emit(YieldHarvested { user, user_amount, protocol_amount });

            user_amount
        }

        fn harvest_all(ref self: ContractState) {
            // In a real implementation, this would iterate over users
            // For mock, this is a no-op since we accrue on-demand
        }

        fn get_user_deposit(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_deposits.entry(user).read()
        }

        fn get_user_yield(self: @ContractState, user: ContractAddress) -> u256 {
            // Return stored yield plus any pending yield
            let stored_yield = self.user_yield.entry(user).read();
            let pending_yield = self._calculate_pending_yield(user);
            stored_yield + pending_yield
        }

        fn get_total_deposits(self: @ContractState) -> u256 {
            self.total_deposits.read()
        }

        fn get_total_yield(self: @ContractState) -> u256 {
            self.total_yield_generated.read()
        }

        fn get_yield_rate(self: @ContractState) -> u256 {
            self.yield_rate.read()
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
            self.ownable.assert_only_owner();
            self.yield_rate.write(rate);

            self
                .emit(
                    ConfigUpdated {
                        yield_rate: rate,
                        user_share: self.user_share.read(),
                        protocol_share: self.protocol_share.read(),
                    },
                );
        }

        fn set_fee_config(ref self: ContractState, user_share: u256, protocol_share: u256) {
            self.ownable.assert_only_owner();
            assert(user_share + protocol_share == PRECISION, Errors::INVALID_FEE_CONFIG);

            self.user_share.write(user_share);
            self.protocol_share.write(protocol_share);

            self
                .emit(
                    ConfigUpdated {
                        yield_rate: self.yield_rate.read(), user_share, protocol_share,
                    },
                );
        }

        fn emergency_withdraw(ref self: ContractState) {
            self.ownable.assert_only_owner();

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let balance = wbtc.balance_of(get_contract_address());

            if balance > 0 {
                let vault = self.vault.read();
                wbtc.transfer(vault, balance);
            }
        }
    }

    // ============ Internal Functions ============

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Asserts that the caller is the vault contract.
        fn _assert_only_vault(self: @ContractState) {
            let caller = get_caller_address();
            let vault = self.vault.read();
            assert(caller == vault, Errors::ONLY_VAULT);
        }

        /// Calculates pending yield for a user since last update.
        fn _calculate_pending_yield(self: @ContractState, user: ContractAddress) -> u256 {
            let deposit = self.user_deposits.entry(user).read();
            if deposit == 0 {
                return 0;
            }

            let last_update = self.user_last_update.entry(user).read();
            let current_time = get_block_timestamp();

            if current_time <= last_update {
                return 0;
            }

            let time_elapsed: u256 = (current_time - last_update).into();
            let yield_rate = self.yield_rate.read();

            // yield = deposit * rate * time / (PRECISION * SECONDS_PER_YEAR)
            // Using basis points: rate of 800 = 8% = 0.08
            deposit * yield_rate * time_elapsed / (PRECISION * SECONDS_PER_YEAR)
        }

        /// Accrues pending yield for a user and updates state.
        fn _accrue_yield(ref self: ContractState, user: ContractAddress) {
            let pending_yield = self._calculate_pending_yield(user);

            if pending_yield > 0 {
                let current_yield = self.user_yield.entry(user).read();
                self.user_yield.entry(user).write(current_yield + pending_yield);
                self.total_yield_generated.write(self.total_yield_generated.read() + pending_yield);

                self
                    .emit(
                        YieldAccrued {
                            user, yield_amount: pending_yield, timestamp: get_block_timestamp(),
                        },
                    );
            }

            // Update timestamp regardless
            self.user_last_update.entry(user).write(get_block_timestamp());
        }
    }
}
