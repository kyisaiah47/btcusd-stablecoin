/// Tests for MockOracle contract
///
/// Test coverage:
/// - Deployment and default values
/// - Price setting by owner
/// - Price staleness detection
/// - Access control

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use btcusd_protocol::interfaces::{
    IPriceOracleDispatcher, IPriceOracleDispatcherTrait, IMockOracleDispatcher,
    IMockOracleDispatcherTrait,
};

// ============ Test Helpers ============

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

/// Default BTC price: $65,000 with 8 decimals
const DEFAULT_BTC_PRICE: u256 = 6500000000000; // 65000 * 10^8

/// Default max price age: 1 hour
const DEFAULT_MAX_AGE: u64 = 3600;

fn deploy_mock_oracle() -> (ContractAddress, IPriceOracleDispatcher, IMockOracleDispatcher) {
    let contract = declare("MockOracle").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();

    let price_oracle = IPriceOracleDispatcher { contract_address };
    let mock_oracle = IMockOracleDispatcher { contract_address };

    (contract_address, price_oracle, mock_oracle)
}

// ============ Deployment Tests ============

#[test]
fn test_deployment_with_default_values() {
    let (_, oracle, _) = deploy_mock_oracle();

    let (price, _timestamp) = oracle.get_btc_price();

    assert(price == DEFAULT_BTC_PRICE, 'Wrong default price');
    assert(oracle.get_max_price_age() == DEFAULT_MAX_AGE, 'Wrong default max age');
}

#[test]
fn test_price_not_stale_immediately_after_deploy() {
    let (contract_address, oracle, _) = deploy_mock_oracle();

    // Set block timestamp to a known value
    start_cheat_block_timestamp(contract_address, 1000);

    // Price should not be stale right after deployment
    // (deployment sets last_update to current timestamp)
    assert(!oracle.is_price_stale(), 'Should not be stale');

    stop_cheat_block_timestamp(contract_address);
}

// ============ Price Setting Tests ============

#[test]
fn test_owner_can_set_price() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    let new_price: u256 = 7000000000000; // $70,000

    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(new_price);
    stop_cheat_caller_address(contract_address);

    let (price, _) = oracle.get_btc_price();
    assert(price == new_price, 'Price not updated');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_set_price() {
    let (contract_address, _, mock_oracle) = deploy_mock_oracle();

    start_cheat_caller_address(contract_address, USER1());
    mock_oracle.set_btc_price(7000000000000);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'MockOracle: zero price')]
fn test_cannot_set_zero_price() {
    let (contract_address, _, mock_oracle) = deploy_mock_oracle();

    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(0);
    stop_cheat_caller_address(contract_address);
}

#[test]
fn test_set_price_updates_timestamp() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    let timestamp1: u64 = 1000;
    let timestamp2: u64 = 2000;

    // Set initial timestamp
    start_cheat_block_timestamp(contract_address, timestamp1);
    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(6000000000000);
    stop_cheat_caller_address(contract_address);

    let (_, ts1) = oracle.get_btc_price();
    assert(ts1 == timestamp1, 'Wrong timestamp 1');

    // Update price at new timestamp
    start_cheat_block_timestamp(contract_address, timestamp2);
    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(7000000000000);
    stop_cheat_caller_address(contract_address);

    let (_, ts2) = oracle.get_btc_price();
    assert(ts2 == timestamp2, 'Wrong timestamp 2');

    stop_cheat_block_timestamp(contract_address);
}

// ============ Staleness Tests ============

#[test]
fn test_price_becomes_stale_after_max_age() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    let initial_time: u64 = 1000;
    let after_max_age: u64 = initial_time + DEFAULT_MAX_AGE + 1;

    // Set price at initial time
    start_cheat_block_timestamp(contract_address, initial_time);
    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(6500000000000);
    stop_cheat_caller_address(contract_address);

    // Check not stale immediately
    assert(!oracle.is_price_stale(), 'Should not be stale yet');

    // Move time forward past max age
    start_cheat_block_timestamp(contract_address, after_max_age);
    assert(oracle.is_price_stale(), 'Should be stale now');

    stop_cheat_block_timestamp(contract_address);
}

#[test]
fn test_price_not_stale_exactly_at_max_age() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    let initial_time: u64 = 1000;
    let exactly_max_age: u64 = initial_time + DEFAULT_MAX_AGE;

    // Set price at initial time
    start_cheat_block_timestamp(contract_address, initial_time);
    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(6500000000000);
    stop_cheat_caller_address(contract_address);

    // At exactly max_age, should not be stale (needs to be > not >=)
    start_cheat_block_timestamp(contract_address, exactly_max_age);
    assert(!oracle.is_price_stale(), 'Should not be stale at boundary');

    stop_cheat_block_timestamp(contract_address);
}

// ============ Max Age Configuration Tests ============

#[test]
fn test_owner_can_set_max_price_age() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    let new_max_age: u64 = 7200; // 2 hours

    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_max_price_age(new_max_age);
    stop_cheat_caller_address(contract_address);

    assert(oracle.get_max_price_age() == new_max_age, 'Max age not updated');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_set_max_price_age() {
    let (contract_address, _, mock_oracle) = deploy_mock_oracle();

    start_cheat_caller_address(contract_address, USER1());
    mock_oracle.set_max_price_age(7200);
    stop_cheat_caller_address(contract_address);
}

// ============ Edge Cases ============

#[test]
fn test_very_high_price() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    // $1,000,000 BTC with 8 decimals
    let high_price: u256 = 100000000000000;

    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(high_price);
    stop_cheat_caller_address(contract_address);

    let (price, _) = oracle.get_btc_price();
    assert(price == high_price, 'High price not set');
}

#[test]
fn test_very_low_price() {
    let (contract_address, oracle, mock_oracle) = deploy_mock_oracle();

    // $1 BTC with 8 decimals (extreme bear market!)
    let low_price: u256 = 100000000;

    start_cheat_caller_address(contract_address, OWNER());
    mock_oracle.set_btc_price(low_price);
    stop_cheat_caller_address(contract_address);

    let (price, _) = oracle.get_btc_price();
    assert(price == low_price, 'Low price not set');
}
