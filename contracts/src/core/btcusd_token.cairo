/// BTCUSD Token Contract
///
/// An ERC20-compliant stablecoin backed by Bitcoin.
/// Key features:
/// - Only the vault contract can mint and burn tokens
/// - Pausable by owner for emergencies
/// - Standard ERC20 interface via OpenZeppelin

#[starknet::contract]
pub mod BTCUSDToken {
    use core::num::traits::Zero;
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;
    use btcusd_protocol::interfaces::i_btcusd_token::IBTCUSDToken;

    // Component declarations
    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    // External implementations (exposed in ABI)
    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    // Internal implementations
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    // For calling is_paused in our implementation
    use openzeppelin_security::interface::IPausable;

    // ============ Storage ============

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        /// The vault contract address - only address that can mint/burn
        vault: ContractAddress,
    }

    // ============ Events ============

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        VaultUpdated: VaultUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultUpdated {
        #[key]
        pub old_vault: ContractAddress,
        #[key]
        pub new_vault: ContractAddress,
    }

    // ============ Errors ============

    pub mod Errors {
        pub const ONLY_VAULT: felt252 = 'BTCUSD: caller is not vault';
        pub const ZERO_ADDRESS: felt252 = 'BTCUSD: zero address';
        pub const ZERO_AMOUNT: felt252 = 'BTCUSD: zero amount';
    }

    // ============ Constructor ============

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, vault: ContractAddress) {
        // Initialize ERC20 with name and symbol
        self.erc20.initializer("Bitcoin USD Stablecoin", "BTCUSD");

        // Initialize Ownable
        self.ownable.initializer(owner);

        // Store vault address
        assert(!vault.is_zero(), Errors::ZERO_ADDRESS);
        self.vault.write(vault);
    }

    // ============ IBTCUSDToken Implementation ============

    #[abi(embed_v0)]
    impl BTCUSDTokenImpl of IBTCUSDToken<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            // Only vault can mint
            self._assert_only_vault();

            // Validate inputs
            assert(!to.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            // Check not paused
            self.pausable.assert_not_paused();

            // Mint tokens
            self.erc20.mint(to, amount);
        }

        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            // Only vault can burn
            self._assert_only_vault();

            // Validate inputs
            assert(!from.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            // Check not paused
            self.pausable.assert_not_paused();

            // Burn tokens
            self.erc20.burn(from, amount);
        }

        fn set_vault(ref self: ContractState, new_vault: ContractAddress) {
            // Only owner can update vault
            self.ownable.assert_only_owner();

            assert(!new_vault.is_zero(), Errors::ZERO_ADDRESS);

            let old_vault = self.vault.read();
            self.vault.write(new_vault);

            self.emit(VaultUpdated { old_vault, new_vault });
        }

        fn get_vault(self: @ContractState) -> ContractAddress {
            self.vault.read()
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }

        fn get_paused_status(self: @ContractState) -> bool {
            self.pausable.is_paused()
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
    }
}
