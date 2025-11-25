/// Mock Price Oracle Contract
///
/// A simple price oracle for testing and development.
/// Allows manual setting of BTC price.
/// In production, this will be replaced with Pragma or Chainlink integration.

#[starknet::contract]
pub mod MockOracle {
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use btcusd_protocol::interfaces::i_price_oracle::{IPriceOracle, IMockOracle};

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // External implementations
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    // Internal implementations
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // ============ Constants ============

    /// Default max price age: 1 hour (3600 seconds)
    const DEFAULT_MAX_PRICE_AGE: u64 = 3600;

    /// Default BTC price: $65,000 with 8 decimals
    const DEFAULT_BTC_PRICE: u256 = 65000_00000000;

    // ============ Storage ============

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        /// Current BTC price with 8 decimals
        btc_price: u256,
        /// Timestamp of last price update
        last_update: u64,
        /// Maximum allowed price age in seconds
        max_price_age: u64,
    }

    // ============ Events ============

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        PriceUpdated: PriceUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PriceUpdated {
        pub old_price: u256,
        pub new_price: u256,
        pub timestamp: u64,
    }

    // ============ Constructor ============

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.btc_price.write(DEFAULT_BTC_PRICE);
        self.last_update.write(get_block_timestamp());
        self.max_price_age.write(DEFAULT_MAX_PRICE_AGE);
    }

    // ============ IPriceOracle Implementation ============

    #[abi(embed_v0)]
    impl PriceOracleImpl of IPriceOracle<ContractState> {
        fn get_btc_price(self: @ContractState) -> (u256, u64) {
            let price = self.btc_price.read();
            let timestamp = self.last_update.read();
            (price, timestamp)
        }

        fn is_price_stale(self: @ContractState) -> bool {
            let last_update = self.last_update.read();
            let max_age = self.max_price_age.read();
            let current_time = get_block_timestamp();

            current_time > last_update + max_age
        }

        fn get_max_price_age(self: @ContractState) -> u64 {
            self.max_price_age.read()
        }
    }

    // ============ IMockOracle Implementation ============

    #[abi(embed_v0)]
    impl MockOracleImpl of IMockOracle<ContractState> {
        fn set_btc_price(ref self: ContractState, price: u256) {
            self.ownable.assert_only_owner();
            assert(price > 0, 'MockOracle: zero price');

            let old_price = self.btc_price.read();
            let timestamp = get_block_timestamp();

            self.btc_price.write(price);
            self.last_update.write(timestamp);

            self.emit(PriceUpdated { old_price, new_price: price, timestamp });
        }

        fn set_max_price_age(ref self: ContractState, max_age: u64) {
            self.ownable.assert_only_owner();
            self.max_price_age.write(max_age);
        }
    }
}
