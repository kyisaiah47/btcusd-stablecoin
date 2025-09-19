#[starknet::contract]
mod BTCUSDToken {
    use starknet::{ContractAddress, get_caller_address};
    use openzeppelin::token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        vault_address: ContractAddress,
        liquidation_paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Mint: Mint,
        Burn: Burn,
    }

    #[derive(Drop, starknet::Event)]
    struct Mint {
        #[key]
        to: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Burn {
        #[key]
        from: ContractAddress,
        amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault_address: ContractAddress
    ) {
        self.erc20.initializer("Bitcoin USD Stablecoin", "BTCUSD");
        self.ownable.initializer(owner);
        self.vault_address.write(vault_address);
    }

    #[abi(embed_v0)]
    impl BTCUSDTokenImpl of super::IBTCUSDToken<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self._only_vault();
            self.erc20._mint(to, amount);
            self.emit(Mint { to, amount });
        }

        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            self._only_vault();
            self.erc20._burn(from, amount);
            self.emit(Burn { from, amount });
        }

        fn set_vault_address(ref self: ContractState, new_vault: ContractAddress) {
            self.ownable.assert_only_owner();
            self.vault_address.write(new_vault);
        }

        fn pause_liquidation_transfers(ref self: ContractState, paused: bool) {
            self._only_vault();
            self.liquidation_paused.write(paused);
        }

        fn get_vault_address(self: @ContractState) -> ContractAddress {
            self.vault_address.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_vault(self: @ContractState) {
            let caller = get_caller_address();
            let vault = self.vault_address.read();
            assert(caller == vault, 'Only vault can call');
        }
    }

    impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) {
            let contract_state = ERC20Component::HasComponent::get_contract(@self);

            // Prevent transfers during liquidation except from vault
            if contract_state.liquidation_paused.read() {
                let caller = get_caller_address();
                let vault = contract_state.vault_address.read();
                assert(caller == vault, 'Transfers paused for liquidation');
            }
        }

        fn after_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) {}
    }
}

#[starknet::interface]
trait IBTCUSDToken<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
    fn burn(ref self: TContractState, from: ContractAddress, amount: u256);
    fn set_vault_address(ref self: TContractState, new_vault: ContractAddress);
    fn pause_liquidation_transfers(ref self: TContractState, paused: bool);
    fn get_vault_address(self: @TContractState) -> ContractAddress;
}