use starknet::ContractAddress;

#[starknet::interface]
trait IDemoBTCUSD<TContractState> {
    fn name(self: @TContractState) -> felt252;
    fn symbol(self: @TContractState) -> felt252;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn deposit_and_mint(ref self: TContractState, collateral_amount: u256) -> u256;
    fn get_user_stats(self: @TContractState, user: ContractAddress) -> (u256, u256, u256);
    fn get_contract_stats(self: @TContractState) -> (felt252, felt252, u256);
}

#[starknet::contract]
mod DemoBTCUSD {
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        name: felt252,
        symbol: felt252,
        total_supply: u256,
        balances: starknet::storage::Map<ContractAddress, u256>,
        collateral: starknet::storage::Map<ContractAddress, u256>,
        debt: starknet::storage::Map<ContractAddress, u256>,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Deposit: Deposit,
        Mint: Mint,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        user: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Mint {
        #[key]
        to: ContractAddress,
        amount: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.name.write('BTCUSD Demo');
        self.symbol.write('BTCUSD');
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl DemoBTCUSDImpl of super::IDemoBTCUSD<ContractState> {
        fn name(self: @ContractState) -> felt252 {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> felt252 {
            self.symbol.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn deposit_and_mint(ref self: ContractState, collateral_amount: u256) -> u256 {
            let caller = get_caller_address();

            // Mint 66.67% of collateral value
            let mint_amount = collateral_amount * 6667 / 10000;

            // Update storage
            let current_collateral = self.collateral.read(caller);
            let current_debt = self.debt.read(caller);
            let current_balance = self.balances.read(caller);

            self.collateral.write(caller, current_collateral + collateral_amount);
            self.debt.write(caller, current_debt + mint_amount);
            self.balances.write(caller, current_balance + mint_amount);
            self.total_supply.write(self.total_supply.read() + mint_amount);

            // Emit events
            self.emit(Deposit { user: caller, amount: collateral_amount });
            self.emit(Mint { to: caller, amount: mint_amount });

            mint_amount
        }

        fn get_user_stats(self: @ContractState, user: ContractAddress) -> (u256, u256, u256) {
            let collateral = self.collateral.read(user);
            let debt = self.debt.read(user);
            let balance = self.balances.read(user);
            (collateral, debt, balance)
        }

        fn get_contract_stats(self: @ContractState) -> (felt252, felt252, u256) {
            (self.name.read(), self.symbol.read(), self.total_supply.read())
        }
    }
}