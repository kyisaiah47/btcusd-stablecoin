/// Tests for BTCUSDVault contract
///
/// Test coverage:
/// - Deployment and initialization
/// - Collateral deposits
/// - Collateral withdrawals
/// - BTCUSD minting with collateral ratio enforcement
/// - BTCUSD burning
/// - Combined operations (deposit_and_mint, repay_and_withdraw)
/// - Health factor and liquidation checks
/// - Pause/unpause functionality
/// - Admin functions

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use btcusd_protocol::interfaces::{
    IBTCUSDVaultDispatcher, IBTCUSDVaultDispatcherTrait, IBTCUSDTokenDispatcher,
    IBTCUSDTokenDispatcherTrait, IMockOracleDispatcher, IMockOracleDispatcherTrait,
    IYieldManagerDispatcher, IYieldManagerDispatcherTrait, Position,
};

// ============ Test Helpers ============

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
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

/// BTC price: $65,000 with 8 decimals
const BTC_PRICE: u256 = 6500000000000; // 65000 * 10^8

/// 1 wBTC in satoshis (8 decimals)
const ONE_WBTC: u256 = 100000000; // 10^8

/// 1 BTCUSD (18 decimals)
const ONE_BTCUSD: u256 = 1000000000000000000; // 10^18

/// Minimum deposit: 0.001 wBTC
const MIN_DEPOSIT: u256 = 100000;

/// Protocol constants
const MIN_COLLATERAL_RATIO: u256 = 15000; // 150%
const MAX_LTV: u256 = 6667; // 66.67%
const PRECISION: u256 = 10000;

/// Deploy all required contracts for vault testing
fn deploy_full_system() -> (
    ContractAddress, // vault address
    IBTCUSDVaultDispatcher, // vault dispatcher
    IERC20Dispatcher, // wbtc dispatcher
    IERC20Dispatcher, // btcusd erc20 dispatcher
    IMockOracleDispatcher, // oracle dispatcher
) {
    // Deploy MockWBTC
    let wbtc_contract = declare("MockWBTC").unwrap().contract_class();
    let mut wbtc_calldata = array![];
    OWNER().serialize(ref wbtc_calldata);
    let (wbtc_address, _) = wbtc_contract.deploy(@wbtc_calldata).unwrap();
    let wbtc = IERC20Dispatcher { contract_address: wbtc_address };

    // Deploy MockOracle
    let oracle_contract = declare("MockOracle").unwrap().contract_class();
    let mut oracle_calldata = array![];
    OWNER().serialize(ref oracle_calldata);
    let (oracle_address, _) = oracle_contract.deploy(@oracle_calldata).unwrap();
    let oracle = IMockOracleDispatcher { contract_address: oracle_address };

    // Deploy BTCUSDToken (with temporary vault address - will update)
    let token_contract = declare("BTCUSDToken").unwrap().contract_class();
    let mut token_calldata = array![];
    OWNER().serialize(ref token_calldata);
    OWNER().serialize(ref token_calldata); // temporary vault = owner
    let (token_address, _) = token_contract.deploy(@token_calldata).unwrap();
    let btcusd = IERC20Dispatcher { contract_address: token_address };
    let btcusd_token = IBTCUSDTokenDispatcher { contract_address: token_address };

    // Deploy MockYieldManager (with temporary vault address - will update)
    let ym_contract = declare("MockYieldManager").unwrap().contract_class();
    let mut ym_calldata = array![];
    OWNER().serialize(ref ym_calldata);
    OWNER().serialize(ref ym_calldata); // temporary vault = owner
    wbtc_address.serialize(ref ym_calldata);
    TREASURY().serialize(ref ym_calldata);
    let (ym_address, _) = ym_contract.deploy(@ym_calldata).unwrap();
    let yield_manager = IYieldManagerDispatcher { contract_address: ym_address };

    // Deploy BTCUSDVault
    let vault_contract = declare("BTCUSDVault").unwrap().contract_class();
    let mut vault_calldata = array![];
    OWNER().serialize(ref vault_calldata);
    wbtc_address.serialize(ref vault_calldata);
    token_address.serialize(ref vault_calldata);
    oracle_address.serialize(ref vault_calldata);
    ym_address.serialize(ref vault_calldata);
    let (vault_address, _) = vault_contract.deploy(@vault_calldata).unwrap();
    let vault = IBTCUSDVaultDispatcher { contract_address: vault_address };

    // Update token vault address
    start_cheat_caller_address(token_address, OWNER());
    btcusd_token.set_vault(vault_address);
    stop_cheat_caller_address(token_address);

    // Update yield manager vault address
    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_vault(vault_address);
    stop_cheat_caller_address(ym_address);

    // Mint wBTC to users for testing
    start_cheat_caller_address(wbtc_address, OWNER());
    let mock_wbtc = btcusd_protocol::interfaces::IMockWBTCDispatcher { contract_address: wbtc_address };
    mock_wbtc.mint(USER1(), 10 * ONE_WBTC); // 10 wBTC
    mock_wbtc.mint(USER2(), 10 * ONE_WBTC); // 10 wBTC
    stop_cheat_caller_address(wbtc_address);

    (vault_address, vault, wbtc, btcusd, oracle)
}

/// Helper to approve and deposit collateral
fn approve_and_deposit(
    vault_address: ContractAddress,
    vault: IBTCUSDVaultDispatcher,
    wbtc: IERC20Dispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Approve vault to spend wBTC
    start_cheat_caller_address(wbtc.contract_address, user);
    wbtc.approve(vault_address, amount);
    stop_cheat_caller_address(wbtc.contract_address);

    // Deposit
    start_cheat_caller_address(vault_address, user);
    vault.deposit_collateral(amount);
    stop_cheat_caller_address(vault_address);
}

// ============ Deployment Tests ============

#[test]
fn test_vault_deployment() {
    let (vault_address, vault, wbtc, btcusd, _) = deploy_full_system();

    let (wbtc_addr, btcusd_addr, oracle_addr, ym_addr) = vault.get_addresses();
    assert(wbtc_addr == wbtc.contract_address, 'Wrong wBTC address');
    assert(btcusd_addr == btcusd.contract_address, 'Wrong BTCUSD address');
    assert(!oracle_addr.is_zero(), 'Zero oracle address');
    assert(!ym_addr.is_zero(), 'Zero yield manager address');

    let (total_collateral, total_debt) = vault.get_protocol_stats();
    assert(total_collateral == 0, 'Should start with 0 collateral');
    assert(total_debt == 0, 'Should start with 0 debt');
}

// ============ Deposit Tests ============

#[test]
fn test_deposit_collateral() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    let deposit_amount = ONE_WBTC; // 1 wBTC

    // Check initial balance
    let initial_balance = wbtc.balance_of(USER1());

    // Deposit
    approve_and_deposit(vault_address, vault, wbtc, USER1(), deposit_amount);

    // Verify position
    let position = vault.get_position(USER1());
    assert(position.collateral == deposit_amount, 'Wrong collateral');
    assert(position.debt == 0, 'Should have no debt');

    // Verify balances
    assert(wbtc.balance_of(USER1()) == initial_balance - deposit_amount, 'Wrong user balance');

    // Verify global stats
    let (total_collateral, _) = vault.get_protocol_stats();
    assert(total_collateral == deposit_amount, 'Wrong total collateral');
}

#[test]
fn test_multiple_deposits() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // First deposit
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Second deposit
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Verify position has both deposits
    let position = vault.get_position(USER1());
    assert(position.collateral == 2 * ONE_WBTC, 'Wrong total collateral');
}

#[test]
#[should_panic(expected: 'Vault: zero amount')]
fn test_cannot_deposit_zero() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    start_cheat_caller_address(wbtc.contract_address, USER1());
    wbtc.approve(vault_address, 1000);
    stop_cheat_caller_address(wbtc.contract_address);

    start_cheat_caller_address(vault_address, USER1());
    vault.deposit_collateral(0);
    stop_cheat_caller_address(vault_address);
}

#[test]
#[should_panic(expected: 'Vault: below min deposit')]
fn test_cannot_deposit_below_minimum() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    let small_amount = MIN_DEPOSIT - 1; // Below minimum

    start_cheat_caller_address(wbtc.contract_address, USER1());
    wbtc.approve(vault_address, small_amount);
    stop_cheat_caller_address(wbtc.contract_address);

    start_cheat_caller_address(vault_address, USER1());
    vault.deposit_collateral(small_amount);
    stop_cheat_caller_address(vault_address);
}

// ============ Mint Tests ============

#[test]
fn test_mint_btcusd() {
    let (vault_address, vault, wbtc, btcusd, _) = deploy_full_system();

    // Deposit 1 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Calculate safe mint amount (well under 150% ratio)
    // 1 BTC at $65,000 = $65,000 collateral value
    // At 150% ratio, max debt = $43,333
    // Let's mint $30,000 BTCUSD to be safe
    let mint_amount = 30000 * ONE_BTCUSD;

    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(mint_amount);
    stop_cheat_caller_address(vault_address);

    // Verify position
    let position = vault.get_position(USER1());
    assert(position.debt == mint_amount, 'Wrong debt');

    // Verify BTCUSD balance
    assert(btcusd.balance_of(USER1()) == mint_amount, 'Wrong BTCUSD balance');

    // Verify global stats
    let (_, total_debt) = vault.get_protocol_stats();
    assert(total_debt == mint_amount, 'Wrong total debt');
}

#[test]
fn test_mint_at_max_ltv() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Deposit 1 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Get max mintable amount
    let max_mintable = vault.get_max_mintable(USER1());
    assert(max_mintable > 0, 'Should have mintable amount');

    // Mint exactly at max
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(max_mintable);
    stop_cheat_caller_address(vault_address);

    // Should have debt at max LTV
    let position = vault.get_position(USER1());
    assert(position.debt == max_mintable, 'Wrong debt amount');
}

#[test]
#[should_panic(expected: 'Vault: unhealthy position')]
fn test_cannot_mint_beyond_max_ltv() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Deposit 1 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Try to mint more than max
    let max_mintable = vault.get_max_mintable(USER1());
    let excess_amount = max_mintable + ONE_BTCUSD;

    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(excess_amount);
    stop_cheat_caller_address(vault_address);
}

#[test]
#[should_panic(expected: 'Vault: no position')]
fn test_cannot_mint_without_collateral() {
    let (vault_address, vault, _, _, _) = deploy_full_system();

    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(1000 * ONE_BTCUSD);
    stop_cheat_caller_address(vault_address);
}

// ============ Withdrawal Tests ============

#[test]
fn test_withdraw_collateral_no_debt() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    let deposit_amount = ONE_WBTC;
    let initial_balance = wbtc.balance_of(USER1());

    // Deposit
    approve_and_deposit(vault_address, vault, wbtc, USER1(), deposit_amount);

    // Withdraw all
    start_cheat_caller_address(vault_address, USER1());
    vault.withdraw_collateral(deposit_amount);
    stop_cheat_caller_address(vault_address);

    // Verify position is empty
    let position = vault.get_position(USER1());
    assert(position.collateral == 0, 'Should have no collateral');

    // Verify user got their wBTC back
    assert(wbtc.balance_of(USER1()) == initial_balance, 'Wrong final balance');
}

#[test]
fn test_withdraw_partial_collateral_with_debt() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Deposit 2 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), 2 * ONE_WBTC);

    // Mint some BTCUSD
    let mint_amount = 20000 * ONE_BTCUSD; // $20,000
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(mint_amount);
    stop_cheat_caller_address(vault_address);

    // Get max withdrawable
    let max_withdrawable = vault.get_max_withdrawable(USER1());
    assert(max_withdrawable > 0, 'Should be able to withdraw');

    // Withdraw partial amount
    let withdraw_amount = max_withdrawable / 2;
    start_cheat_caller_address(vault_address, USER1());
    vault.withdraw_collateral(withdraw_amount);
    stop_cheat_caller_address(vault_address);

    // Verify position updated
    let position = vault.get_position(USER1());
    assert(position.collateral == 2 * ONE_WBTC - withdraw_amount, 'Wrong remaining collateral');
}

#[test]
#[should_panic(expected: 'Vault: unhealthy position')]
fn test_cannot_withdraw_below_min_ratio() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Deposit 1 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Mint at max LTV
    let max_mintable = vault.get_max_mintable(USER1());
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(max_mintable);

    // Try to withdraw any collateral (should fail as we're at max LTV)
    vault.withdraw_collateral(MIN_DEPOSIT);
    stop_cheat_caller_address(vault_address);
}

#[test]
#[should_panic(expected: 'Vault: insufficient collateral')]
fn test_cannot_withdraw_more_than_deposited() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Deposit 1 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // Try to withdraw 2 wBTC
    start_cheat_caller_address(vault_address, USER1());
    vault.withdraw_collateral(2 * ONE_WBTC);
    stop_cheat_caller_address(vault_address);
}

// ============ Burn Tests ============

#[test]
fn test_burn_btcusd() {
    let (vault_address, vault, wbtc, btcusd, _) = deploy_full_system();

    // Setup: deposit and mint
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);
    let mint_amount = 30000 * ONE_BTCUSD;
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(mint_amount);
    stop_cheat_caller_address(vault_address);

    // Burn half
    let burn_amount = 15000 * ONE_BTCUSD;
    start_cheat_caller_address(vault_address, USER1());
    vault.burn_btcusd(burn_amount);
    stop_cheat_caller_address(vault_address);

    // Verify position
    let position = vault.get_position(USER1());
    assert(position.debt == mint_amount - burn_amount, 'Wrong remaining debt');

    // Verify BTCUSD balance
    assert(btcusd.balance_of(USER1()) == mint_amount - burn_amount, 'Wrong BTCUSD balance');
}

#[test]
fn test_burn_all_debt() {
    let (vault_address, vault, wbtc, btcusd, _) = deploy_full_system();

    // Setup: deposit and mint
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);
    let mint_amount = 30000 * ONE_BTCUSD;
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(mint_amount);

    // Burn all debt
    vault.burn_btcusd(mint_amount);
    stop_cheat_caller_address(vault_address);

    // Verify no debt
    let position = vault.get_position(USER1());
    assert(position.debt == 0, 'Should have no debt');
    assert(btcusd.balance_of(USER1()) == 0, 'Should have no BTCUSD');

    // Should be able to withdraw all collateral now
    start_cheat_caller_address(vault_address, USER1());
    vault.withdraw_collateral(ONE_WBTC);
    stop_cheat_caller_address(vault_address);
}

#[test]
#[should_panic(expected: 'Vault: insufficient debt')]
fn test_cannot_burn_more_than_debt() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Setup
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);
    let mint_amount = 30000 * ONE_BTCUSD;
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(mint_amount);

    // Try to burn more than minted
    vault.burn_btcusd(mint_amount + ONE_BTCUSD);
    stop_cheat_caller_address(vault_address);
}

// ============ Combined Operations Tests ============

#[test]
fn test_deposit_and_mint() {
    let (vault_address, vault, wbtc, btcusd, _) = deploy_full_system();

    // Approve vault
    start_cheat_caller_address(wbtc.contract_address, USER1());
    wbtc.approve(vault_address, ONE_WBTC);
    stop_cheat_caller_address(wbtc.contract_address);

    // Deposit and mint in one tx
    start_cheat_caller_address(vault_address, USER1());
    let minted = vault.deposit_and_mint(ONE_WBTC);
    stop_cheat_caller_address(vault_address);

    // Should have minted at MAX_LTV
    assert(minted > 0, 'Should have minted');

    let position = vault.get_position(USER1());
    assert(position.collateral == ONE_WBTC, 'Wrong collateral');
    assert(position.debt == minted, 'Wrong debt');
    assert(btcusd.balance_of(USER1()) == minted, 'Wrong BTCUSD balance');
}

#[test]
fn test_repay_and_withdraw() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Setup: deposit and mint
    start_cheat_caller_address(wbtc.contract_address, USER1());
    wbtc.approve(vault_address, ONE_WBTC);
    stop_cheat_caller_address(wbtc.contract_address);

    start_cheat_caller_address(vault_address, USER1());
    let minted = vault.deposit_and_mint(ONE_WBTC);

    // Repay half and get proportional collateral
    let repay_amount = minted / 2;
    let withdrawn = vault.repay_and_withdraw(repay_amount);
    stop_cheat_caller_address(vault_address);

    // Should have withdrawn proportional collateral
    assert(withdrawn > 0, 'Should have withdrawn');

    let position = vault.get_position(USER1());
    assert(position.collateral == ONE_WBTC - withdrawn, 'Wrong remaining collateral');
    assert(position.debt == minted - repay_amount, 'Wrong remaining debt');
}

// ============ Health Factor Tests ============

#[test]
fn test_collateral_ratio_calculation() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Deposit 1 wBTC
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // No debt = ratio should be 0 (represents infinity)
    let ratio = vault.get_collateral_ratio(USER1());
    assert(ratio == 0, 'Ratio should be 0 with no debt');

    // Mint some BTCUSD
    // With 1 BTC at $65,000 and $32,500 debt, ratio should be 200% (20000 basis points)
    let mint_amount = 32500 * ONE_BTCUSD;
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(mint_amount);
    stop_cheat_caller_address(vault_address);

    let new_ratio = vault.get_collateral_ratio(USER1());
    // Allow some tolerance due to rounding
    assert(new_ratio >= 19900 && new_ratio <= 20100, 'Ratio should be ~200%');
}

#[test]
fn test_is_liquidatable() {
    let (vault_address, vault, wbtc, _, oracle) = deploy_full_system();

    // Deposit and mint at max LTV
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);
    let max_mintable = vault.get_max_mintable(USER1());
    start_cheat_caller_address(vault_address, USER1());
    vault.mint_btcusd(max_mintable);
    stop_cheat_caller_address(vault_address);

    // At 150% ratio, should not be liquidatable
    assert(!vault.is_liquidatable(USER1()), 'Should not be liquidatable');

    // Drop price significantly (simulate crash)
    // If price drops enough, position becomes liquidatable
    // At 150% ratio with $65k BTC, if BTC drops to ~$50k, ratio becomes ~115%
    start_cheat_caller_address(oracle.contract_address, OWNER());
    oracle.set_btc_price(5000000000000); // $50,000
    stop_cheat_caller_address(oracle.contract_address);

    // Now should be liquidatable (ratio < 120%)
    assert(vault.is_liquidatable(USER1()), 'Should be liquidatable now');
}

// ============ Pause Tests ============

#[test]
fn test_owner_can_pause_vault() {
    let (vault_address, vault, _, _, _) = deploy_full_system();

    start_cheat_caller_address(vault_address, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_address);

    // Pausing should prevent operations (tested by expect_panic tests)
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_cannot_deposit_when_paused() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // Pause
    start_cheat_caller_address(vault_address, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_address);

    // Approve
    start_cheat_caller_address(wbtc.contract_address, USER1());
    wbtc.approve(vault_address, ONE_WBTC);
    stop_cheat_caller_address(wbtc.contract_address);

    // Try to deposit
    start_cheat_caller_address(vault_address, USER1());
    vault.deposit_collateral(ONE_WBTC);
    stop_cheat_caller_address(vault_address);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_pause() {
    let (vault_address, vault, _, _, _) = deploy_full_system();

    start_cheat_caller_address(vault_address, USER1());
    vault.pause();
    stop_cheat_caller_address(vault_address);
}

// ============ Admin Tests ============

#[test]
fn test_owner_can_set_oracle() {
    let (vault_address, vault, _, _, _) = deploy_full_system();

    let new_oracle = contract_address_const::<'NEW_ORACLE'>();

    start_cheat_caller_address(vault_address, OWNER());
    vault.set_oracle(new_oracle);
    stop_cheat_caller_address(vault_address);

    let (_, _, oracle_addr, _) = vault.get_addresses();
    assert(oracle_addr == new_oracle, 'Oracle not updated');
}

#[test]
fn test_owner_can_set_min_deposit() {
    let (vault_address, vault, _, _, _) = deploy_full_system();

    let new_min_deposit: u256 = 200000; // 0.002 wBTC

    start_cheat_caller_address(vault_address, OWNER());
    vault.set_min_deposit(new_min_deposit);
    stop_cheat_caller_address(vault_address);

    // Verify by trying to deposit old minimum (should fail)
    // (not tested here as it requires complex setup)
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_set_oracle() {
    let (vault_address, vault, _, _, _) = deploy_full_system();

    let new_oracle = contract_address_const::<'NEW_ORACLE'>();

    start_cheat_caller_address(vault_address, USER1());
    vault.set_oracle(new_oracle);
    stop_cheat_caller_address(vault_address);
}

// ============ Multi-user Tests ============

#[test]
fn test_multiple_users_positions() {
    let (vault_address, vault, wbtc, _, _) = deploy_full_system();

    // User1 deposits
    approve_and_deposit(vault_address, vault, wbtc, USER1(), ONE_WBTC);

    // User2 deposits different amount
    approve_and_deposit(vault_address, vault, wbtc, USER2(), 2 * ONE_WBTC);

    // Verify independent positions
    let pos1 = vault.get_position(USER1());
    let pos2 = vault.get_position(USER2());

    assert(pos1.collateral == ONE_WBTC, 'Wrong USER1 collateral');
    assert(pos2.collateral == 2 * ONE_WBTC, 'Wrong USER2 collateral');

    // Verify total
    let (total, _) = vault.get_protocol_stats();
    assert(total == 3 * ONE_WBTC, 'Wrong total collateral');
}
