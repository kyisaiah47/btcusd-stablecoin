#[starknet::contract]
mod YieldManager {
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

        // Vesu integration
        vesu_pool: ContractAddress,
        vtoken: ContractAddress,

        // Yield tracking
        total_deposited: u256,
        last_yield_update: u64,
        accumulated_yield: u256,

        // Fee configuration
        protocol_fee_rate: u256, // Basis points (e.g., 3000 = 30%)
        user_fee_rate: u256,     // Basis points (e.g., 7000 = 70%)
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        YieldDeposit: YieldDeposit,
        YieldWithdraw: YieldWithdraw,
        YieldHarvest: YieldHarvest,
        FeeDistribution: FeeDistribution,
    }

    #[derive(Drop, starknet::Event)]
    struct YieldDeposit {
        amount: u256,
        vtokens_received: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct YieldWithdraw {
        amount: u256,
        vtokens_burned: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct YieldHarvest {
        total_yield: u256,
        protocol_fee: u256,
        user_share: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct FeeDistribution {
        protocol_amount: u256,
        user_amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault_address: ContractAddress,
        wbtc_token: ContractAddress,
        vesu_pool: ContractAddress,
        vtoken: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.vault_address.write(vault_address);
        self.wbtc_token.write(wbtc_token);
        self.vesu_pool.write(vesu_pool);
        self.vtoken.write(vtoken);

        // Default fee rates: 70% to users, 30% to protocol
        self.user_fee_rate.write(7000);
        self.protocol_fee_rate.write(3000);
    }

    #[abi(embed_v0)]
    impl YieldManagerImpl of super::IYieldManager<ContractState> {
        fn deposit_collateral(ref self: ContractState, amount: u256) {
            self._only_vault();

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let contract_address = get_contract_address();

            // Approve Vesu pool to spend wBTC
            wbtc.approve(self.vesu_pool.read(), amount);

            // Deposit into Vesu pool and receive vTokens
            let vesu_pool = super::vesu_hook::IVesuPoolDispatcher {
                contract_address: self.vesu_pool.read()
            };
            let vtokens_received = vesu_pool.supply(amount);

            // Update tracking
            self.total_deposited.write(self.total_deposited.read() + amount);

            self.emit(YieldDeposit { amount, vtokens_received });
        }

        fn withdraw_collateral(ref self: ContractState, amount: u256) {
            self._only_vault();

            // Calculate vTokens to burn
            let vtoken = IERC20Dispatcher { contract_address: self.vtoken.read() };
            let total_vtokens = vtoken.balance_of(get_contract_address());
            let vtokens_to_burn = amount * total_vtokens / self.total_deposited.read();

            // Withdraw from Vesu
            let vesu_pool = super::vesu_hook::IVesuPoolDispatcher {
                contract_address: self.vesu_pool.read()
            };
            vesu_pool.withdraw(vtokens_to_burn);

            // Transfer to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer(self.vault_address.read(), amount);

            // Update tracking
            self.total_deposited.write(self.total_deposited.read() - amount);

            self.emit(YieldWithdraw { amount, vtokens_burned: vtokens_to_burn });
        }

        fn harvest_yield(ref self: ContractState) -> u256 {
            // Calculate current yield
            let vtoken = IERC20Dispatcher { contract_address: self.vtoken.read() };
            let current_vtokens = vtoken.balance_of(get_contract_address());

            let vesu_pool = super::vesu_hook::IVesuPoolDispatcher {
                contract_address: self.vesu_pool.read()
            };
            let current_value = vesu_pool.convert_to_assets(current_vtokens);

            let deposited = self.total_deposited.read();

            if current_value <= deposited {
                return 0;
            }

            let total_yield = current_value - deposited;

            // Calculate fee distribution
            let protocol_fee = total_yield * self.protocol_fee_rate.read() / 10000;
            let user_share = total_yield - protocol_fee;

            // Update accumulated yield for users
            self.accumulated_yield.write(self.accumulated_yield.read() + user_share);

            // Transfer protocol fee
            if protocol_fee > 0 {
                let vtokens_for_fee = protocol_fee * current_vtokens / current_value;
                vesu_pool.withdraw(vtokens_for_fee);

                let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
                wbtc.transfer(self.ownable.owner(), protocol_fee);
            }

            self.emit(YieldHarvest { total_yield, protocol_fee, user_share });
            self.emit(FeeDistribution { protocol_amount: protocol_fee, user_amount: user_share });

            total_yield
        }

        fn get_total_deposited(self: @ContractState) -> u256 {
            self.total_deposited.read()
        }

        fn get_accumulated_yield(self: @ContractState) -> u256 {
            self.accumulated_yield.read()
        }

        fn get_current_yield(self: @ContractState) -> u256 {
            let vtoken = IERC20Dispatcher { contract_address: self.vtoken.read() };
            let current_vtokens = vtoken.balance_of(get_contract_address());

            let vesu_pool = super::vesu_hook::IVesuPoolDispatcher {
                contract_address: self.vesu_pool.read()
            };
            let current_value = vesu_pool.convert_to_assets(current_vtokens);
            let deposited = self.total_deposited.read();

            if current_value > deposited {
                current_value - deposited
            } else {
                0
            }
        }

        fn set_fee_rates(ref self: ContractState, protocol_rate: u256, user_rate: u256) {
            self.ownable.assert_only_owner();
            assert(protocol_rate + user_rate == 10000, 'Rates must sum to 10000');

            self.protocol_fee_rate.write(protocol_rate);
            self.user_fee_rate.write(user_rate);
        }

        fn emergency_withdraw(ref self: ContractState) {
            self.ownable.assert_only_owner();

            let vtoken = IERC20Dispatcher { contract_address: self.vtoken.read() };
            let all_vtokens = vtoken.balance_of(get_contract_address());

            if all_vtokens > 0 {
                let vesu_pool = super::vesu_hook::IVesuPoolDispatcher {
                    contract_address: self.vesu_pool.read()
                };
                vesu_pool.withdraw(all_vtokens);
            }
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
}

#[starknet::interface]
trait IYieldManager<TContractState> {
    fn deposit_collateral(ref self: TContractState, amount: u256);
    fn withdraw_collateral(ref self: TContractState, amount: u256);
    fn harvest_yield(ref self: TContractState) -> u256;
    fn get_total_deposited(self: @TContractState) -> u256;
    fn get_accumulated_yield(self: @TContractState) -> u256;
    fn get_current_yield(self: @TContractState) -> u256;
    fn set_fee_rates(ref self: TContractState, protocol_rate: u256, user_rate: u256);
    fn emergency_withdraw(ref self: TContractState);
}