/// Atomiq Adapter Contract
///
/// Provides a simplified interface for BTCUSD Protocol to interact with
/// Atomiq's escrow-based Bitcoin bridge. This adapter handles:
///
/// 1. BTC → wBTC bridging (via Atomiq escrow + Bitcoin verification)
/// 2. wBTC → BTC unbridging (via Atomiq LP vaults)
/// 3. Swap status tracking
///
/// Flow for BTC → wBTC:
/// 1. User sends BTC to Atomiq-generated address
/// 2. Backend monitors for Bitcoin confirmations
/// 3. Once confirmed, user/relayer calls `claim_bridge_deposit`
/// 4. Atomiq releases wBTC to user
///
/// Flow for wBTC → BTC:
/// 1. User calls `initiate_withdrawal` with wBTC
/// 2. wBTC is locked in Atomiq escrow
/// 3. LP sends BTC to user's Bitcoin address
/// 4. LP claims escrowed wBTC with Bitcoin tx proof

use starknet::ContractAddress;

/// Bridge deposit request
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct BridgeDeposit {
    /// User's Starknet address
    pub user: ContractAddress,
    /// Expected BTC amount in satoshis
    pub amount_sats: u64,
    /// Bitcoin deposit address (derived from user + nonce)
    pub btc_address_hash: felt252,
    /// Creation timestamp
    pub created_at: u64,
    /// Expiration timestamp
    pub expires_at: u64,
    /// Status: 0=pending, 1=confirmed, 2=claimed, 3=expired
    pub status: u8,
    /// Associated Atomiq escrow ID (set when BTC is confirmed)
    pub escrow_id: u256,
}

/// Bridge withdrawal request
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct BridgeWithdrawal {
    /// User's Starknet address
    pub user: ContractAddress,
    /// wBTC amount
    pub amount: u256,
    /// User's Bitcoin address hash
    pub btc_address_hash: felt252,
    /// Creation timestamp
    pub created_at: u64,
    /// Status: 0=pending, 1=processing, 2=completed, 3=refunded
    pub status: u8,
    /// Associated Atomiq escrow ID
    pub escrow_id: u256,
}

#[starknet::interface]
pub trait IAtomiqAdapter<TContractState> {
    /// Request a BTC → wBTC bridge deposit
    /// Returns a unique deposit ID and the Bitcoin address to send to
    fn request_deposit(ref self: TContractState, amount_sats: u64) -> (u256, felt252);

    /// Claim a confirmed bridge deposit
    /// Called after Bitcoin tx is confirmed and verified by Atomiq
    fn claim_deposit(
        ref self: TContractState,
        deposit_id: u256,
        btc_tx_hash: u256,
        merkle_proof: Span<u256>,
    );

    /// Initiate a wBTC → BTC withdrawal
    fn initiate_withdrawal(
        ref self: TContractState,
        amount: u256,
        btc_address_hash: felt252,
    ) -> u256;

    /// Get deposit details
    fn get_deposit(self: @TContractState, deposit_id: u256) -> BridgeDeposit;

    /// Get withdrawal details
    fn get_withdrawal(self: @TContractState, withdrawal_id: u256) -> BridgeWithdrawal;

    /// Get user's pending deposits
    fn get_user_deposits(self: @TContractState, user: ContractAddress) -> Span<u256>;

    /// Get user's pending withdrawals
    fn get_user_withdrawals(self: @TContractState, user: ContractAddress) -> Span<u256>;
}

#[starknet::interface]
pub trait IAtomiqAdapterAdmin<TContractState> {
    /// Set Atomiq escrow manager address
    fn set_escrow_manager(ref self: TContractState, address: ContractAddress);

    /// Set Atomiq BTC relay address
    fn set_btc_relay(ref self: TContractState, address: ContractAddress);

    /// Set wBTC token address
    fn set_wbtc(ref self: TContractState, address: ContractAddress);

    /// Set deposit expiry duration (seconds)
    fn set_deposit_expiry(ref self: TContractState, duration: u64);

    /// Emergency pause
    fn pause(ref self: TContractState);

    /// Unpause
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod AtomiqAdapter {
    use core::num::traits::Zero;
    use starknet::{
        ContractAddress, get_caller_address, get_block_timestamp, get_contract_address,
        storage::{
            Map, StorageMapReadAccess, StorageMapWriteAccess,
            StoragePointerReadAccess, StoragePointerWriteAccess,
        },
    };
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    use super::{BridgeDeposit, BridgeWithdrawal, IAtomiqAdapter, IAtomiqAdapterAdmin};
    use crate::interfaces::i_atomiq::{IBtcRelayDispatcher, IBtcRelayDispatcherTrait};

    // Components
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    // Deposit status constants
    const STATUS_PENDING: u8 = 0;
    const STATUS_CONFIRMED: u8 = 1;
    const STATUS_CLAIMED: u8 = 2;
    const STATUS_EXPIRED: u8 = 3;
    const STATUS_REFUNDED: u8 = 3;

    // Default expiry: 24 hours
    const DEFAULT_DEPOSIT_EXPIRY: u64 = 86400;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        /// Atomiq escrow manager contract
        escrow_manager: ContractAddress,
        /// Atomiq BTC relay contract
        btc_relay: ContractAddress,
        /// wBTC token address
        wbtc: ContractAddress,
        /// Deposit expiry duration in seconds
        deposit_expiry: u64,
        /// Next deposit ID
        next_deposit_id: u256,
        /// Next withdrawal ID
        next_withdrawal_id: u256,
        /// Deposit ID → BridgeDeposit
        deposits: Map<u256, BridgeDeposit>,
        /// Withdrawal ID → BridgeWithdrawal
        withdrawals: Map<u256, BridgeWithdrawal>,
        /// User → deposit count
        user_deposit_count: Map<ContractAddress, u256>,
        /// User → withdrawal count
        user_withdrawal_count: Map<ContractAddress, u256>,
        /// (User, index) → deposit ID
        user_deposits: Map<(ContractAddress, u256), u256>,
        /// (User, index) → withdrawal ID
        user_withdrawals: Map<(ContractAddress, u256), u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        DepositRequested: DepositRequested,
        DepositClaimed: DepositClaimed,
        WithdrawalInitiated: WithdrawalInitiated,
        WithdrawalCompleted: WithdrawalCompleted,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositRequested {
        #[key]
        pub deposit_id: u256,
        #[key]
        pub user: ContractAddress,
        pub amount_sats: u64,
        pub btc_address_hash: felt252,
        pub expires_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositClaimed {
        #[key]
        pub deposit_id: u256,
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub btc_tx_hash: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalInitiated {
        #[key]
        pub withdrawal_id: u256,
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub btc_address_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalCompleted {
        #[key]
        pub withdrawal_id: u256,
        pub btc_tx_hash: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        escrow_manager: ContractAddress,
        btc_relay: ContractAddress,
        wbtc: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.escrow_manager.write(escrow_manager);
        self.btc_relay.write(btc_relay);
        self.wbtc.write(wbtc);
        self.deposit_expiry.write(DEFAULT_DEPOSIT_EXPIRY);
        self.next_deposit_id.write(1);
        self.next_withdrawal_id.write(1);
    }

    #[abi(embed_v0)]
    impl AtomiqAdapterImpl of IAtomiqAdapter<ContractState> {
        fn request_deposit(ref self: ContractState, amount_sats: u64) -> (u256, felt252) {
            self.pausable.assert_not_paused();

            let caller = get_caller_address();
            let deposit_id = self.next_deposit_id.read();
            self.next_deposit_id.write(deposit_id + 1);

            let now = get_block_timestamp();
            let expires_at = now + self.deposit_expiry.read();

            // Generate deterministic Bitcoin address hash from user + deposit_id
            // In production, this would involve more sophisticated key derivation
            let btc_address_hash = core::pedersen::pedersen(caller.into(), deposit_id.low.into());

            let deposit = BridgeDeposit {
                user: caller,
                amount_sats,
                btc_address_hash,
                created_at: now,
                expires_at,
                status: STATUS_PENDING,
                escrow_id: 0,
            };

            self.deposits.write(deposit_id, deposit);

            // Track user deposits
            let count = self.user_deposit_count.read(caller);
            self.user_deposits.write((caller, count), deposit_id);
            self.user_deposit_count.write(caller, count + 1);

            self.emit(DepositRequested {
                deposit_id,
                user: caller,
                amount_sats,
                btc_address_hash,
                expires_at,
            });

            (deposit_id, btc_address_hash)
        }

        fn claim_deposit(
            ref self: ContractState,
            deposit_id: u256,
            btc_tx_hash: u256,
            merkle_proof: Span<u256>,
        ) {
            self.pausable.assert_not_paused();

            let mut deposit = self.deposits.read(deposit_id);
            assert(deposit.status == STATUS_PENDING, 'Deposit not pending');
            assert(get_block_timestamp() < deposit.expires_at, 'Deposit expired');

            // Verify Bitcoin transaction via BTC relay
            let btc_relay = IBtcRelayDispatcher {
                contract_address: self.btc_relay.read()
            };

            let required_confirmations = btc_relay.get_required_confirmations();
            let latest_height = btc_relay.get_latest_block_height();

            // Verify tx inclusion (simplified - in production would check output details)
            let is_valid = btc_relay.verify_tx_inclusion(
                btc_tx_hash,
                latest_height - required_confirmations,
                merkle_proof,
                0, // tx_index - would need actual value
            );
            assert(is_valid, 'BTC tx not verified');

            // Calculate wBTC amount (satoshis with 8 decimals)
            let wbtc_amount: u256 = deposit.amount_sats.into();

            // Transfer wBTC from escrow/LP to user
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc.read() };

            // In production: claim from Atomiq escrow using self.escrow_manager.read()
            // For now: transfer from this contract (assumes it has liquidity)
            wbtc.transfer(deposit.user, wbtc_amount);

            // Update deposit status
            deposit.status = STATUS_CLAIMED;
            self.deposits.write(deposit_id, deposit);

            self.emit(DepositClaimed {
                deposit_id,
                user: deposit.user,
                amount: wbtc_amount,
                btc_tx_hash,
            });
        }

        fn initiate_withdrawal(
            ref self: ContractState,
            amount: u256,
            btc_address_hash: felt252,
        ) -> u256 {
            self.pausable.assert_not_paused();

            let caller = get_caller_address();
            assert(amount > 0, 'Amount must be positive');

            // Transfer wBTC from user to this contract
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc.read() };
            wbtc.transfer_from(caller, get_contract_address(), amount);

            let withdrawal_id = self.next_withdrawal_id.read();
            self.next_withdrawal_id.write(withdrawal_id + 1);

            let now = get_block_timestamp();

            let withdrawal = BridgeWithdrawal {
                user: caller,
                amount,
                btc_address_hash,
                created_at: now,
                status: STATUS_PENDING,
                escrow_id: 0,
            };

            self.withdrawals.write(withdrawal_id, withdrawal);

            // Track user withdrawals
            let count = self.user_withdrawal_count.read(caller);
            self.user_withdrawals.write((caller, count), withdrawal_id);
            self.user_withdrawal_count.write(caller, count + 1);

            self.emit(WithdrawalInitiated {
                withdrawal_id,
                user: caller,
                amount,
                btc_address_hash,
            });

            withdrawal_id
        }

        fn get_deposit(self: @ContractState, deposit_id: u256) -> BridgeDeposit {
            self.deposits.read(deposit_id)
        }

        fn get_withdrawal(self: @ContractState, withdrawal_id: u256) -> BridgeWithdrawal {
            self.withdrawals.read(withdrawal_id)
        }

        fn get_user_deposits(self: @ContractState, user: ContractAddress) -> Span<u256> {
            let count = self.user_deposit_count.read(user);
            let mut deposits: Array<u256> = array![];
            let mut i: u256 = 0;
            while i < count {
                deposits.append(self.user_deposits.read((user, i)));
                i += 1;
            };
            deposits.span()
        }

        fn get_user_withdrawals(self: @ContractState, user: ContractAddress) -> Span<u256> {
            let count = self.user_withdrawal_count.read(user);
            let mut withdrawals: Array<u256> = array![];
            let mut i: u256 = 0;
            while i < count {
                withdrawals.append(self.user_withdrawals.read((user, i)));
                i += 1;
            };
            withdrawals.span()
        }
    }

    #[abi(embed_v0)]
    impl AtomiqAdapterAdminImpl of IAtomiqAdapterAdmin<ContractState> {
        fn set_escrow_manager(ref self: ContractState, address: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!address.is_zero(), 'Invalid address');
            self.escrow_manager.write(address);
        }

        fn set_btc_relay(ref self: ContractState, address: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!address.is_zero(), 'Invalid address');
            self.btc_relay.write(address);
        }

        fn set_wbtc(ref self: ContractState, address: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!address.is_zero(), 'Invalid address');
            self.wbtc.write(address);
        }

        fn set_deposit_expiry(ref self: ContractState, duration: u64) {
            self.ownable.assert_only_owner();
            assert(duration >= 3600, 'Minimum 1 hour');
            self.deposit_expiry.write(duration);
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }
    }
}
