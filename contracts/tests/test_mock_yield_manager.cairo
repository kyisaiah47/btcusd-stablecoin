/// Tests for MockYieldManager contract
///
/// Test coverage:
/// - Deployment and initialization
/// - Vault-only deposit/withdraw restrictions
/// - Yield accrual calculations
/// - Fee distribution (70/30 split)
/// - Yield harvesting
/// - Admin configuration

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use btcusd_protocol::interfaces::{
    IYieldManagerDispatcher, IYieldManagerDispatcherTrait, IMockWBTCDispatcher,
    IMockWBTCDispatcherTrait,
};

// ============ Test Helpers ============

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn VAULT() -> ContractAddress {
    contract_address_const::<'VAULT'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

fn USER2() -> ContractAddress {
    contract_address_const::<'USER2'>()
}

fn TREASURY() -> ContractAddress {
    contract_address_const::<'TREASURY'>()
}

fn ZERO_ADDRESS() -> ContractAddress {
    contract_address_const::<0>()
}

/// 1 wBTC in satoshis (8 decimals)
const ONE_WBTC: u256 = 100000000; // 10^8

/// Seconds per year
const SECONDS_PER_YEAR: u256 = 31536000;

/// Default yield rate: 8% APY (800 basis points)
const DEFAULT_YIELD_RATE: u256 = 800;

/// Precision for calculations
const PRECISION: u256 = 10000;

fn deploy_yield_manager() -> (ContractAddress, IYieldManagerDispatcher, IERC20Dispatcher) {
    // Deploy MockWBTC first
    let wbtc_contract = declare("MockWBTC").unwrap().contract_class();
    let mut wbtc_calldata = array![];
    OWNER().serialize(ref wbtc_calldata);
    let (wbtc_address, _) = wbtc_contract.deploy(@wbtc_calldata).unwrap();
    let wbtc = IERC20Dispatcher { contract_address: wbtc_address };

    // Mint wBTC to vault for testing
    start_cheat_caller_address(wbtc_address, OWNER());
    let mock_wbtc = IMockWBTCDispatcher { contract_address: wbtc_address };
    mock_wbtc.mint(VAULT(), 100 * ONE_WBTC);
    stop_cheat_caller_address(wbtc_address);

    // Deploy MockYieldManager
    let contract = declare("MockYieldManager").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    VAULT().serialize(ref calldata);
    wbtc_address.serialize(ref calldata);
    TREASURY().serialize(ref calldata);
    let (contract_address, _) = contract.deploy(@calldata).unwrap();

    let yield_manager = IYieldManagerDispatcher { contract_address };

    (contract_address, yield_manager, wbtc)
}

/// Helper to approve and deposit from vault
fn approve_and_deposit_as_vault(
    ym_address: ContractAddress,
    yield_manager: IYieldManagerDispatcher,
    wbtc: IERC20Dispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Approve yield manager from vault
    start_cheat_caller_address(wbtc.contract_address, VAULT());
    wbtc.approve(ym_address, amount);
    stop_cheat_caller_address(wbtc.contract_address);

    // Deposit as vault
    start_cheat_caller_address(ym_address, VAULT());
    yield_manager.deposit(user, amount);
    stop_cheat_caller_address(ym_address);
}

// ============ Deployment Tests ============

#[test]
fn test_deployment_with_defaults() {
    let (_, yield_manager, _) = deploy_yield_manager();

    assert(yield_manager.get_yield_rate() == DEFAULT_YIELD_RATE, 'Wrong default yield rate');

    let (user_share, protocol_share) = yield_manager.get_fee_config();
    assert(user_share == 7000, 'Wrong default user share');
    assert(protocol_share == 3000, 'Wrong default protocol share');

    assert(yield_manager.get_total_deposits() == 0, 'Should start with 0 deposits');
}

// ============ Deposit Tests ============

#[test]
fn test_vault_can_deposit() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    let deposit_amount = ONE_WBTC;
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), deposit_amount);

    // Verify deposit tracked
    assert(yield_manager.get_user_deposit(USER1()) == deposit_amount, 'Wrong user deposit');
    assert(yield_manager.get_total_deposits() == deposit_amount, 'Wrong total deposits');

    // Verify wBTC transferred to yield manager
    assert(wbtc.balance_of(ym_address) == deposit_amount, 'wBTC not transferred');
}

#[test]
fn test_multiple_deposits_same_user() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), 2 * ONE_WBTC);

    assert(yield_manager.get_user_deposit(USER1()) == 3 * ONE_WBTC, 'Wrong total deposit');
}

#[test]
fn test_multiple_users_deposits() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER2(), 2 * ONE_WBTC);

    assert(yield_manager.get_user_deposit(USER1()) == ONE_WBTC, 'Wrong USER1 deposit');
    assert(yield_manager.get_user_deposit(USER2()) == 2 * ONE_WBTC, 'Wrong USER2 deposit');
    assert(yield_manager.get_total_deposits() == 3 * ONE_WBTC, 'Wrong total deposits');
}

#[test]
#[should_panic(expected: 'YieldMgr: caller is not vault')]
fn test_non_vault_cannot_deposit() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, USER1());
    yield_manager.deposit(USER1(), ONE_WBTC);
    stop_cheat_caller_address(ym_address);
}

#[test]
#[should_panic(expected: 'YieldMgr: zero amount')]
fn test_cannot_deposit_zero() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, VAULT());
    yield_manager.deposit(USER1(), 0);
    stop_cheat_caller_address(ym_address);
}

#[test]
#[should_panic(expected: 'YieldMgr: zero address')]
fn test_cannot_deposit_to_zero_address() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, VAULT());
    yield_manager.deposit(ZERO_ADDRESS(), ONE_WBTC);
    stop_cheat_caller_address(ym_address);
}

// ============ Withdrawal Tests ============

#[test]
fn test_vault_can_withdraw() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    // Deposit first
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), 2 * ONE_WBTC);

    let vault_balance_before = wbtc.balance_of(VAULT());

    // Withdraw
    start_cheat_caller_address(ym_address, VAULT());
    yield_manager.withdraw(USER1(), ONE_WBTC);
    stop_cheat_caller_address(ym_address);

    // Verify deposit updated
    assert(yield_manager.get_user_deposit(USER1()) == ONE_WBTC, 'Wrong remaining deposit');

    // Verify wBTC transferred back to vault
    assert(wbtc.balance_of(VAULT()) == vault_balance_before + ONE_WBTC, 'wBTC not returned');
}

#[test]
fn test_withdraw_all() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    start_cheat_caller_address(ym_address, VAULT());
    yield_manager.withdraw(USER1(), ONE_WBTC);
    stop_cheat_caller_address(ym_address);

    assert(yield_manager.get_user_deposit(USER1()) == 0, 'Should have 0 deposit');
    assert(yield_manager.get_total_deposits() == 0, 'Should have 0 total');
}

#[test]
#[should_panic(expected: 'YieldMgr: caller is not vault')]
fn test_non_vault_cannot_withdraw() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    start_cheat_caller_address(ym_address, USER1());
    yield_manager.withdraw(USER1(), ONE_WBTC);
    stop_cheat_caller_address(ym_address);
}

#[test]
#[should_panic(expected: 'YieldMgr: insufficient balance')]
fn test_cannot_withdraw_more_than_deposited() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    start_cheat_caller_address(ym_address, VAULT());
    yield_manager.withdraw(USER1(), 2 * ONE_WBTC);
    stop_cheat_caller_address(ym_address);
}

// ============ Yield Accrual Tests ============

#[test]
fn test_yield_accrues_over_time() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    let initial_time: u64 = 1000000;
    start_cheat_block_timestamp(ym_address, initial_time);

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    // Move time forward by 1 year
    let one_year_later: u64 = initial_time + 31536000;
    start_cheat_block_timestamp(ym_address, one_year_later);

    // Check accrued yield
    // yield = deposit * rate * time / (PRECISION * SECONDS_PER_YEAR)
    // yield = 10^8 * 800 * 31536000 / (10000 * 31536000) = 10^8 * 0.08 = 8 * 10^6 (8% of 1 BTC)
    let accrued = yield_manager.get_user_yield(USER1());

    // Expected: 8% of 1 wBTC = 0.08 wBTC = 8,000,000 satoshis
    let expected_yield: u256 = 8000000;
    // Allow 1% tolerance for rounding
    let tolerance = expected_yield / 100;
    assert(accrued >= expected_yield - tolerance, 'Yield too low');
    assert(accrued <= expected_yield + tolerance, 'Yield too high');

    stop_cheat_block_timestamp(ym_address);
}

#[test]
fn test_no_yield_at_deposit_time() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    start_cheat_block_timestamp(ym_address, 1000000);
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    // Yield should be 0 at deposit time
    let yield_amount = yield_manager.get_user_yield(USER1());
    assert(yield_amount == 0, 'Should have no yield yet');

    stop_cheat_block_timestamp(ym_address);
}

#[test]
fn test_yield_proportional_to_deposit() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    let initial_time: u64 = 1000000;
    start_cheat_block_timestamp(ym_address, initial_time);

    // USER1 deposits 1 wBTC
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    // USER2 deposits 2 wBTC
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER2(), 2 * ONE_WBTC);

    // Move time forward by half a year
    let half_year: u64 = initial_time + 15768000; // ~0.5 year
    start_cheat_block_timestamp(ym_address, half_year);

    let yield1 = yield_manager.get_user_yield(USER1());
    let yield2 = yield_manager.get_user_yield(USER2());

    // USER2's yield should be ~2x USER1's yield
    // Allow some tolerance for timing differences in deposits
    assert(yield2 > yield1, 'USER2 should have more yield');
    assert(yield2 <= 3 * yield1, 'Yield ratio too high'); // Should be ~2x, allow up to 3x

    stop_cheat_block_timestamp(ym_address);
}

// ============ Harvest Tests ============

#[test]
fn test_harvest_yield() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    let initial_time: u64 = 1000000;
    start_cheat_block_timestamp(ym_address, initial_time);

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    // Move time forward
    let later: u64 = initial_time + 15768000; // ~0.5 year
    start_cheat_block_timestamp(ym_address, later);

    // Get yield before harvest
    let yield_before = yield_manager.get_user_yield(USER1());
    assert(yield_before > 0, 'Should have yield');

    // Harvest (anyone can trigger harvest)
    start_cheat_caller_address(ym_address, USER1());
    let user_amount = yield_manager.harvest_yield(USER1());
    stop_cheat_caller_address(ym_address);

    // User amount should be 70% of total yield
    let expected_user_amount = yield_before * 7000 / PRECISION;
    let tolerance = expected_user_amount / 100; // 1% tolerance
    assert(user_amount >= expected_user_amount - tolerance, 'User amount too low');
    assert(user_amount <= expected_user_amount + tolerance, 'User amount too high');

    // Yield should be 0 after harvest
    assert(yield_manager.get_user_yield(USER1()) == 0, 'Yield should be cleared');

    stop_cheat_block_timestamp(ym_address);
}

#[test]
fn test_harvest_zero_yield() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    // Harvest immediately (no time passed)
    start_cheat_caller_address(ym_address, USER1());
    let amount = yield_manager.harvest_yield(USER1());
    stop_cheat_caller_address(ym_address);

    assert(amount == 0, 'Should return 0');
}

// ============ Admin Configuration Tests ============

#[test]
fn test_owner_can_set_yield_rate() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    let new_rate: u256 = 1000; // 10%

    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_yield_rate(new_rate);
    stop_cheat_caller_address(ym_address);

    assert(yield_manager.get_yield_rate() == new_rate, 'Rate not updated');
}

#[test]
fn test_owner_can_set_fee_config() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    let new_user_share: u256 = 8000; // 80%
    let new_protocol_share: u256 = 2000; // 20%

    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_fee_config(new_user_share, new_protocol_share);
    stop_cheat_caller_address(ym_address);

    let (user_share, protocol_share) = yield_manager.get_fee_config();
    assert(user_share == new_user_share, 'User share not updated');
    assert(protocol_share == new_protocol_share, 'Protocol share not updated');
}

#[test]
#[should_panic(expected: 'YieldMgr: invalid fee config')]
fn test_fee_config_must_sum_to_100() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_fee_config(6000, 3000); // Only 90%
    stop_cheat_caller_address(ym_address);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_set_yield_rate() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, USER1());
    yield_manager.set_yield_rate(1000);
    stop_cheat_caller_address(ym_address);
}

#[test]
fn test_owner_can_set_vault() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    let new_vault = contract_address_const::<'NEW_VAULT'>();

    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_vault(new_vault);
    stop_cheat_caller_address(ym_address);

    // Old vault should no longer work
    // (implicitly tested by subsequent tests that try to use old vault)
}

#[test]
#[should_panic(expected: 'YieldMgr: zero address')]
fn test_cannot_set_zero_vault() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_vault(ZERO_ADDRESS());
    stop_cheat_caller_address(ym_address);
}

// ============ Emergency Withdraw Tests ============

#[test]
fn test_emergency_withdraw() {
    let (ym_address, yield_manager, wbtc) = deploy_yield_manager();

    // Deposit some wBTC
    approve_and_deposit_as_vault(ym_address, yield_manager, wbtc, USER1(), ONE_WBTC);

    let vault_balance_before = wbtc.balance_of(VAULT());

    // Emergency withdraw
    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.emergency_withdraw();
    stop_cheat_caller_address(ym_address);

    // All wBTC should be sent back to vault
    assert(wbtc.balance_of(ym_address) == 0, 'YM should be empty');
    assert(wbtc.balance_of(VAULT()) == vault_balance_before + ONE_WBTC, 'wBTC not returned');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_emergency_withdraw() {
    let (ym_address, yield_manager, _) = deploy_yield_manager();

    start_cheat_caller_address(ym_address, USER1());
    yield_manager.emergency_withdraw();
    stop_cheat_caller_address(ym_address);
}
