#[starknet::contract]
mod SimpleBTCUSD {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[storage]
    struct Storage {
        name: felt252,
        symbol: felt252,
        decimals: u8,
        total_supply: u256,
        balances: LegacyMap<ContractAddress, u256>,
        allowances: LegacyMap<(ContractAddress, ContractAddress), u256>,
        owner: ContractAddress,

        // Vault specific storage
        collateral_balances: LegacyMap<ContractAddress, u256>,
        debt_balances: LegacyMap<ContractAddress, u256>,
        total_collateral: u256,
        total_debt: u256,
        collateral_ratio: u256, // 150 = 150%
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
        Deposit: Deposit,
        Withdraw: Withdraw,
        Mint: Mint,
        Burn: Burn,
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
    struct Approval {
        #[key]
        owner: ContractAddress,
        #[key]
        spender: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        user: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdraw {
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

    #[derive(Drop, starknet::Event)]
    struct Burn {
        #[key]
        from: ContractAddress,
        amount: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.name.write('Bitcoin USD Stablecoin');
        self.symbol.write('BTCUSD');
        self.decimals.write(18);
        self.total_supply.write(0);
        self.owner.write(owner);
        self.collateral_ratio.write(150); // 150% collateral ratio
    }

    #[abi(embed_v0)]
    impl SimpleBTCUSDImpl of super::ISimpleBTCUSD<ContractState> {
        // ERC20 Functions
        fn name(self: @ContractState) -> felt252 {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> felt252 {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn transfer(ref self: ContractState, to: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self._transfer(caller, to, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.read((from, caller));
            assert(current_allowance >= amount, 'Insufficient allowance');

            self.allowances.write((from, caller), current_allowance - amount);
            self._transfer(from, to, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.write((caller, spender), amount);

            self.emit(Approval { owner: caller, spender, value: amount });
            true
        }

        // Vault Functions
        fn deposit_and_mint(ref self: ContractState, collateral_amount: u256) -> u256 {
            let caller = get_caller_address();

            // Simple calculation: mint 66.67% of collateral value as stablecoin
            let mint_amount = collateral_amount * 6667 / 10000;

            // Update collateral and debt
            let current_collateral = self.collateral_balances.read(caller);
            let current_debt = self.debt_balances.read(caller);

            self.collateral_balances.write(caller, current_collateral + collateral_amount);
            self.debt_balances.write(caller, current_debt + mint_amount);

            // Update totals
            self.total_collateral.write(self.total_collateral.read() + collateral_amount);
            self.total_debt.write(self.total_debt.read() + mint_amount);

            // Mint tokens
            self._mint(caller, mint_amount);

            self.emit(Deposit { user: caller, amount: collateral_amount });
            self.emit(Mint { to: caller, amount: mint_amount });

            mint_amount
        }

        fn repay_and_withdraw(ref self: ContractState, repay_amount: u256) -> u256 {
            let caller = get_caller_address();

            let current_debt = self.debt_balances.read(caller);
            let current_collateral = self.collateral_balances.read(caller);

            assert(repay_amount <= current_debt, 'Repay amount exceeds debt');
            assert(repay_amount <= self.balances.read(caller), 'Insufficient balance');

            // Calculate collateral to return proportionally
            let collateral_return = repay_amount * current_collateral / current_debt;

            // Update balances
            self.debt_balances.write(caller, current_debt - repay_amount);
            self.collateral_balances.write(caller, current_collateral - collateral_return);

            // Update totals
            self.total_debt.write(self.total_debt.read() - repay_amount);
            self.total_collateral.write(self.total_collateral.read() - collateral_return);

            // Burn tokens
            self._burn(caller, repay_amount);

            self.emit(Burn { from: caller, amount: repay_amount });
            self.emit(Withdraw { user: caller, amount: collateral_return });

            collateral_return
        }

        fn get_user_collateral(self: @ContractState, user: ContractAddress) -> u256 {
            self.collateral_balances.read(user)
        }

        fn get_user_debt(self: @ContractState, user: ContractAddress) -> u256 {
            self.debt_balances.read(user)
        }

        fn get_collateral_ratio_for_user(self: @ContractState, user: ContractAddress) -> u256 {
            let debt = self.debt_balances.read(user);
            if debt == 0 {
                return 0;
            }
            let collateral = self.collateral_balances.read(user);
            // Assuming 1:1 price for simplicity (collateral value = collateral amount)
            collateral * 100 / debt
        }

        fn get_total_stats(self: @ContractState) -> (u256, u256) {
            (self.total_collateral.read(), self.total_debt.read())
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer(ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256) {
            assert(!from.is_zero(), 'Transfer from zero address');
            assert(!to.is_zero(), 'Transfer to zero address');

            let from_balance = self.balances.read(from);
            assert(from_balance >= amount, 'Insufficient balance');

            self.balances.write(from, from_balance - amount);
            self.balances.write(to, self.balances.read(to) + amount);

            self.emit(Transfer { from, to, value: amount });
        }

        fn _mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            assert(!to.is_zero(), 'Mint to zero address');

            self.total_supply.write(self.total_supply.read() + amount);
            self.balances.write(to, self.balances.read(to) + amount);

            self.emit(Transfer { from: starknet::contract_address_const::<0>(), to, value: amount });
        }

        fn _burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            assert(!from.is_zero(), 'Burn from zero address');

            let from_balance = self.balances.read(from);
            assert(from_balance >= amount, 'Insufficient balance');

            self.balances.write(from, from_balance - amount);
            self.total_supply.write(self.total_supply.read() - amount);

            self.emit(Transfer { from, to: starknet::contract_address_const::<0>(), value: amount });
        }
    }
}

#[starknet::interface]
trait ISimpleBTCUSD<TContractState> {
    // ERC20 Interface
    fn name(self: @TContractState) -> felt252;
    fn symbol(self: @TContractState) -> felt252;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, to: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

    // Vault Interface
    fn deposit_and_mint(ref self: TContractState, collateral_amount: u256) -> u256;
    fn repay_and_withdraw(ref self: TContractState, repay_amount: u256) -> u256;
    fn get_user_collateral(self: @TContractState, user: ContractAddress) -> u256;
    fn get_user_debt(self: @TContractState, user: ContractAddress) -> u256;
    fn get_collateral_ratio_for_user(self: @TContractState, user: ContractAddress) -> u256;
    fn get_total_stats(self: @TContractState) -> (u256, u256);
}