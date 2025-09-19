#[starknet::contract]
mod AtomiqAdapter {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,

        // Core contracts
        vault_address: ContractAddress,
        wbtc_token: ContractAddress,

        // Atomiq integration
        atomiq_bridge: ContractAddress,
        atomiq_escrow: ContractAddress,

        // Bitcoin tracking
        pending_deposits: LegacyMap<felt252, PendingDeposit>, // tx_hash -> deposit info
        completed_deposits: LegacyMap<ContractAddress, u256>, // user -> total deposited

        // Configuration
        min_confirmations: u8,
        fee_rate: u256, // Basis points
    }

    #[derive(Drop, Serde, starknet::Store)]
    struct PendingDeposit {
        user: ContractAddress,
        btc_amount: u256,
        wbtc_amount: u256,
        confirmations: u8,
        timestamp: u64,
        completed: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        BitcoinDepositInitiated: BitcoinDepositInitiated,
        BitcoinDepositConfirmed: BitcoinDepositConfirmed,
        WBTCMinted: WBTCMinted,
        BridgeSwap: BridgeSwap,
    }

    #[derive(Drop, starknet::Event)]
    struct BitcoinDepositInitiated {
        #[key]
        user: ContractAddress,
        #[key]
        btc_tx_hash: felt252,
        btc_amount: u256,
        expected_wbtc: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct BitcoinDepositConfirmed {
        #[key]
        user: ContractAddress,
        #[key]
        btc_tx_hash: felt252,
        confirmations: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct WBTCMinted {
        #[key]
        user: ContractAddress,
        wbtc_amount: u256,
        btc_tx_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct BridgeSwap {
        #[key]
        user: ContractAddress,
        btc_amount: u256,
        wbtc_amount: u256,
        fee_paid: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault_address: ContractAddress,
        wbtc_token: ContractAddress,
        atomiq_bridge: ContractAddress,
        atomiq_escrow: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.vault_address.write(vault_address);
        self.wbtc_token.write(wbtc_token);
        self.atomiq_bridge.write(atomiq_bridge);
        self.atomiq_escrow.write(atomiq_escrow);
        self.min_confirmations.write(6); // 6 Bitcoin confirmations
        self.fee_rate.write(50); // 0.5% fee
    }

    #[abi(embed_v0)]
    impl AtomiqAdapterImpl of super::IAtomiqAdapter<ContractState> {
        fn initiate_bitcoin_deposit(
            ref self: ContractState,
            user: ContractAddress,
            btc_tx_hash: felt252,
            btc_amount: u256,
        ) {
            // This would typically be called by a relayer monitoring Bitcoin network
            self.ownable.assert_only_owner();

            let expected_wbtc = self._calculate_wbtc_amount(btc_amount);

            let deposit = PendingDeposit {
                user,
                btc_amount,
                wbtc_amount: expected_wbtc,
                confirmations: 0,
                timestamp: starknet::get_block_timestamp(),
                completed: false,
            };

            self.pending_deposits.write(btc_tx_hash, deposit);

            self.emit(BitcoinDepositInitiated {
                user,
                btc_tx_hash,
                btc_amount,
                expected_wbtc,
            });
        }

        fn update_confirmation_status(
            ref self: ContractState,
            btc_tx_hash: felt252,
            confirmations: u8,
        ) {
            self.ownable.assert_only_owner();

            let mut deposit = self.pending_deposits.read(btc_tx_hash);
            assert(!deposit.completed, 'Deposit already completed');

            deposit.confirmations = confirmations;
            self.pending_deposits.write(btc_tx_hash, deposit);

            self.emit(BitcoinDepositConfirmed {
                user: deposit.user,
                btc_tx_hash,
                confirmations,
            });

            // Auto-complete if enough confirmations
            if confirmations >= self.min_confirmations.read() {
                self._complete_deposit(btc_tx_hash);
            }
        }

        fn complete_deposit(ref self: ContractState, btc_tx_hash: felt252) {
            let deposit = self.pending_deposits.read(btc_tx_hash);
            assert(deposit.confirmations >= self.min_confirmations.read(), 'Insufficient confirmations');
            assert(!deposit.completed, 'Already completed');

            self._complete_deposit(btc_tx_hash);
        }

        fn swap_btc_to_wbtc(ref self: ContractState, btc_amount: u256) -> u256 {
            let caller = get_caller_address();

            // Calculate wBTC amount and fees
            let wbtc_amount = self._calculate_wbtc_amount(btc_amount);
            let fee = btc_amount * self.fee_rate.read() / 10000;
            let net_wbtc = wbtc_amount - fee;

            // Interact with Atomiq bridge
            let atomiq_bridge = IAtomiqBridgeDispatcher {
                contract_address: self.atomiq_bridge.read()
            };

            // This is a simplified interface - actual Atomiq integration would be more complex
            atomiq_bridge.swap_btc_to_wbtc(caller, btc_amount);

            // Mint wBTC to user (this would actually come from Atomiq)
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };

            // In reality, wBTC would be minted by Atomiq bridge
            // This is a placeholder for the actual integration

            // Update user's completed deposits
            let current_total = self.completed_deposits.read(caller);
            self.completed_deposits.write(caller, current_total + net_wbtc);

            self.emit(BridgeSwap {
                user: caller,
                btc_amount,
                wbtc_amount: net_wbtc,
                fee_paid: fee,
            });

            net_wbtc
        }

        fn get_pending_deposit(self: @ContractState, btc_tx_hash: felt252) -> PendingDeposit {
            self.pending_deposits.read(btc_tx_hash)
        }

        fn get_user_deposits(self: @ContractState, user: ContractAddress) -> u256 {
            self.completed_deposits.read(user)
        }

        fn set_min_confirmations(ref self: ContractState, confirmations: u8) {
            self.ownable.assert_only_owner();
            self.min_confirmations.write(confirmations);
        }

        fn set_fee_rate(ref self: ContractState, fee_rate: u256) {
            self.ownable.assert_only_owner();
            assert(fee_rate <= 1000, 'Fee rate too high'); // Max 10%
            self.fee_rate.write(fee_rate);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _calculate_wbtc_amount(self: @ContractState, btc_amount: u256) -> u256 {
            // 1:1 conversion for simplicity (both have 8 decimals)
            // In practice, there might be slight differences in precision
            btc_amount
        }

        fn _complete_deposit(ref self: ContractState, btc_tx_hash: felt252) {
            let mut deposit = self.pending_deposits.read(btc_tx_hash);
            deposit.completed = true;
            self.pending_deposits.write(btc_tx_hash, deposit);

            // Update user's completed deposits
            let current_total = self.completed_deposits.read(deposit.user);
            self.completed_deposits.write(deposit.user, current_total + deposit.wbtc_amount);

            self.emit(WBTCMinted {
                user: deposit.user,
                wbtc_amount: deposit.wbtc_amount,
                btc_tx_hash,
            });
        }
    }
}

// Simplified Atomiq Bridge interface
#[starknet::interface]
trait IAtomiqBridge<TContractState> {
    fn swap_btc_to_wbtc(ref self: TContractState, user: ContractAddress, btc_amount: u256);
    fn get_conversion_rate(self: @TContractState) -> u256;
}

#[starknet::interface]
trait IAtomiqAdapter<TContractState> {
    fn initiate_bitcoin_deposit(
        ref self: TContractState,
        user: ContractAddress,
        btc_tx_hash: felt252,
        btc_amount: u256,
    );
    fn update_confirmation_status(
        ref self: TContractState,
        btc_tx_hash: felt252,
        confirmations: u8,
    );
    fn complete_deposit(ref self: TContractState, btc_tx_hash: felt252);
    fn swap_btc_to_wbtc(ref self: TContractState, btc_amount: u256) -> u256;
    fn get_pending_deposit(self: @TContractState, btc_tx_hash: felt252) -> AtomiqAdapter::PendingDeposit;
    fn get_user_deposits(self: @TContractState, user: ContractAddress) -> u256;
    fn set_min_confirmations(ref self: TContractState, confirmations: u8);
    fn set_fee_rate(ref self: TContractState, fee_rate: u256);
}