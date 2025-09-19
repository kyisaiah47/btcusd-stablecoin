#[starknet::contract]
mod BTCUSDVault {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::btcusd_token::{IBTCUSDTokenDispatcher, IBTCUSDTokenDispatcherTrait};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const COLLATERAL_RATIO: u256 = 150; // 150% minimum collateral ratio
    const LIQUIDATION_THRESHOLD: u256 = 120; // 120% liquidation threshold
    const LIQUIDATION_PENALTY: u256 = 10; // 10% liquidation penalty
    const PRECISION: u256 = 100;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,

        // Token contracts
        wbtc_token: ContractAddress,
        btcusd_token: ContractAddress,

        // Oracle and integrations
        price_oracle: ContractAddress,
        yield_manager: ContractAddress,

        // User positions
        positions: LegacyMap<ContractAddress, Position>,

        // Global stats
        total_collateral: u256,
        total_debt: u256,

        // Configuration
        min_collateral_amount: u256,
        liquidation_reward: u256,
    }

    #[derive(Drop, Serde, starknet::Store)]
    struct Position {
        collateral_amount: u256,
        debt_amount: u256,
        last_update: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposit: Deposit,
        Withdraw: Withdraw,
        Borrow: Borrow,
        Repay: Repay,
        Liquidation: Liquidation,
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
    struct Borrow {
        #[key]
        user: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Repay {
        #[key]
        user: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Liquidation {
        #[key]
        user: ContractAddress,
        #[key]
        liquidator: ContractAddress,
        collateral_seized: u256,
        debt_repaid: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        wbtc_token: ContractAddress,
        btcusd_token: ContractAddress,
        price_oracle: ContractAddress,
        yield_manager: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.wbtc_token.write(wbtc_token);
        self.btcusd_token.write(btcusd_token);
        self.price_oracle.write(price_oracle);
        self.yield_manager.write(yield_manager);
        self.min_collateral_amount.write(1000000); // 0.01 wBTC minimum
        self.liquidation_reward.write(5); // 5% liquidation reward
    }

    #[abi(embed_v0)]
    impl BTCUSDVaultImpl of super::IBTCUSDVault<ContractState> {
        fn deposit_and_mint(ref self: ContractState, wbtc_amount: u256) -> u256 {
            let caller = get_caller_address();
            let contract_address = get_contract_address();

            // Minimum collateral check
            assert(wbtc_amount >= self.min_collateral_amount.read(), 'Amount below minimum');

            // Transfer wBTC to vault
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer_from(caller, contract_address, wbtc_amount);

            // Calculate max BTCUSD to mint (66.67% LTV at 150% collateral ratio)
            let btc_price = self._get_btc_price();
            let collateral_value = wbtc_amount * btc_price;
            let max_mint_amount = collateral_value * PRECISION / COLLATERAL_RATIO;

            // Update position
            let mut position = self.positions.read(caller);
            position.collateral_amount += wbtc_amount;
            position.debt_amount += max_mint_amount;
            position.last_update = get_block_timestamp();
            self.positions.write(caller, position);

            // Update global stats
            self.total_collateral.write(self.total_collateral.read() + wbtc_amount);
            self.total_debt.write(self.total_debt.read() + max_mint_amount);

            // Mint BTCUSD
            let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
            btcusd.mint(caller, max_mint_amount);

            // Send collateral to yield manager
            wbtc.transfer(self.yield_manager.read(), wbtc_amount);

            self.emit(Deposit { user: caller, amount: wbtc_amount });
            self.emit(Borrow { user: caller, amount: max_mint_amount });

            max_mint_amount
        }

        fn repay_and_withdraw(ref self: ContractState, btcusd_amount: u256) -> u256 {
            let caller = get_caller_address();
            let position = self.positions.read(caller);

            assert(position.debt_amount > 0, 'No debt to repay');
            assert(btcusd_amount <= position.debt_amount, 'Amount exceeds debt');

            // Calculate wBTC to return
            let wbtc_to_return = btcusd_amount * position.collateral_amount / position.debt_amount;

            // Burn BTCUSD
            let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
            btcusd.burn(caller, btcusd_amount);

            // Update position
            let mut new_position = position;
            new_position.collateral_amount -= wbtc_to_return;
            new_position.debt_amount -= btcusd_amount;
            new_position.last_update = get_block_timestamp();
            self.positions.write(caller, new_position);

            // Update global stats
            self.total_collateral.write(self.total_collateral.read() - wbtc_to_return);
            self.total_debt.write(self.total_debt.read() - btcusd_amount);

            // Withdraw from yield manager and transfer to user
            let yield_manager = super::yield_manager::IYieldManagerDispatcher {
                contract_address: self.yield_manager.read()
            };
            yield_manager.withdraw_collateral(wbtc_to_return);

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer(caller, wbtc_to_return);

            self.emit(Repay { user: caller, amount: btcusd_amount });
            self.emit(Withdraw { user: caller, amount: wbtc_to_return });

            wbtc_to_return
        }

        fn liquidate(ref self: ContractState, user: ContractAddress) {
            let liquidator = get_caller_address();
            let position = self.positions.read(user);

            assert(position.debt_amount > 0, 'No position to liquidate');
            assert(self._is_liquidatable(user), 'Position not liquidatable');

            // Calculate liquidation amounts
            let collateral_value = position.collateral_amount * self._get_btc_price();
            let debt_value = position.debt_amount;

            // Full liquidation if severely undercollateralized
            let debt_to_repay = position.debt_amount;
            let collateral_to_seize = position.collateral_amount;

            // Liquidation penalty and reward
            let penalty_amount = collateral_to_seize * LIQUIDATION_PENALTY / PRECISION;
            let liquidator_reward = collateral_to_seize * self.liquidation_reward.read() / PRECISION;

            // Burn liquidator's BTCUSD
            let btcusd = IBTCUSDTokenDispatcher { contract_address: self.btcusd_token.read() };
            btcusd.burn(liquidator, debt_to_repay);

            // Transfer collateral to liquidator (minus penalty)
            let yield_manager = super::yield_manager::IYieldManagerDispatcher {
                contract_address: self.yield_manager.read()
            };
            yield_manager.withdraw_collateral(collateral_to_seize);

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            wbtc.transfer(liquidator, collateral_to_seize - penalty_amount);

            // Clear position
            let empty_position = Position {
                collateral_amount: 0,
                debt_amount: 0,
                last_update: get_block_timestamp(),
            };
            self.positions.write(user, empty_position);

            // Update global stats
            self.total_collateral.write(self.total_collateral.read() - collateral_to_seize);
            self.total_debt.write(self.total_debt.read() - debt_to_repay);

            self.emit(Liquidation {
                user,
                liquidator,
                collateral_seized: collateral_to_seize,
                debt_repaid: debt_to_repay
            });
        }

        fn get_position(self: @ContractState, user: ContractAddress) -> Position {
            self.positions.read(user)
        }

        fn get_collateral_ratio(self: @ContractState, user: ContractAddress) -> u256 {
            let position = self.positions.read(user);
            if position.debt_amount == 0 {
                return 0;
            }

            let collateral_value = position.collateral_amount * self._get_btc_price();
            collateral_value * PRECISION / position.debt_amount
        }

        fn is_liquidatable(self: @ContractState, user: ContractAddress) -> bool {
            self._is_liquidatable(user)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_btc_price(self: @ContractState) -> u256 {
            // Mock price oracle - replace with actual Chainlink integration
            65000_000000000000000000 // $65,000 with 18 decimals
        }

        fn _is_liquidatable(self: @ContractState, user: ContractAddress) -> bool {
            let ratio = self.get_collateral_ratio(user);
            ratio != 0 && ratio < LIQUIDATION_THRESHOLD
        }
    }
}

#[starknet::interface]
trait IBTCUSDVault<TContractState> {
    fn deposit_and_mint(ref self: TContractState, wbtc_amount: u256) -> u256;
    fn repay_and_withdraw(ref self: TContractState, btcusd_amount: u256) -> u256;
    fn liquidate(ref self: TContractState, user: ContractAddress);
    fn get_position(self: @TContractState, user: ContractAddress) -> BTCUSDVault::Position;
    fn get_collateral_ratio(self: @TContractState, user: ContractAddress) -> u256;
    fn is_liquidatable(self: @TContractState, user: ContractAddress) -> bool;
}