/// Integration Tests for BTCUSD Protocol
///
/// End-to-end tests that verify the complete protocol flow:
/// - Full deposit -> mint -> burn -> withdraw cycle
/// - Yield accrual across the system
/// - Multi-user interactions
/// - Price changes and collateral ratio effects

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
    IYieldManagerDispatcher, IYieldManagerDispatcherTrait, IMockWBTCDispatcher,
    IMockWBTCDispatcherTrait, Position,
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

fn USER3() -> ContractAddress {
    contract_address_const::<'USER3'>()
}

fn TREASURY() -> ContractAddress {
    contract_address_const::<'TREASURY'>()
}

/// BTC prices for testing
const BTC_PRICE_65K: u256 = 6500000000000; // $65,000
const BTC_PRICE_70K: u256 = 7000000000000; // $70,000
const BTC_PRICE_50K: u256 = 5000000000000; // $50,000
const BTC_PRICE_100K: u256 = 10000000000000; // $100,000

/// 1 wBTC in satoshis (8 decimals)
const ONE_WBTC: u256 = 100000000; // 10^8

/// 1 BTCUSD (18 decimals)
const ONE_BTCUSD: u256 = 1000000000000000000; // 10^18

/// Minimum deposit: 0.001 wBTC
const MIN_DEPOSIT: u256 = 100000;

/// Full system deployment
struct DeployedSystem {
    vault_address: ContractAddress,
    vault: IBTCUSDVaultDispatcher,
    wbtc_address: ContractAddress,
    wbtc: IERC20Dispatcher,
    btcusd_address: ContractAddress,
    btcusd: IERC20Dispatcher,
    oracle_address: ContractAddress,
    oracle: IMockOracleDispatcher,
    yield_manager_address: ContractAddress,
    yield_manager: IYieldManagerDispatcher,
}

fn deploy_full_system() -> DeployedSystem {
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

    // Deploy BTCUSDToken (with temporary vault address)
    let token_contract = declare("BTCUSDToken").unwrap().contract_class();
    let mut token_calldata = array![];
    OWNER().serialize(ref token_calldata);
    OWNER().serialize(ref token_calldata); // temporary vault
    let (btcusd_address, _) = token_contract.deploy(@token_calldata).unwrap();
    let btcusd = IERC20Dispatcher { contract_address: btcusd_address };
    let btcusd_token = IBTCUSDTokenDispatcher { contract_address: btcusd_address };

    // Deploy MockYieldManager (with temporary vault address)
    let ym_contract = declare("MockYieldManager").unwrap().contract_class();
    let mut ym_calldata = array![];
    OWNER().serialize(ref ym_calldata);
    OWNER().serialize(ref ym_calldata); // temporary vault
    wbtc_address.serialize(ref ym_calldata);
    TREASURY().serialize(ref ym_calldata);
    let (ym_address, _) = ym_contract.deploy(@ym_calldata).unwrap();
    let yield_manager = IYieldManagerDispatcher { contract_address: ym_address };

    // Deploy BTCUSDVault
    let vault_contract = declare("BTCUSDVault").unwrap().contract_class();
    let mut vault_calldata = array![];
    OWNER().serialize(ref vault_calldata);
    wbtc_address.serialize(ref vault_calldata);
    btcusd_address.serialize(ref vault_calldata);
    oracle_address.serialize(ref vault_calldata);
    ym_address.serialize(ref vault_calldata);
    let (vault_address, _) = vault_contract.deploy(@vault_calldata).unwrap();
    let vault = IBTCUSDVaultDispatcher { contract_address: vault_address };

    // Update token vault address
    start_cheat_caller_address(btcusd_address, OWNER());
    btcusd_token.set_vault(vault_address);
    stop_cheat_caller_address(btcusd_address);

    // Update yield manager vault address
    start_cheat_caller_address(ym_address, OWNER());
    yield_manager.set_vault(vault_address);
    stop_cheat_caller_address(ym_address);

    // Mint wBTC to test users
    start_cheat_caller_address(wbtc_address, OWNER());
    let mock_wbtc = IMockWBTCDispatcher { contract_address: wbtc_address };
    mock_wbtc.mint(USER1(), 100 * ONE_WBTC);
    mock_wbtc.mint(USER2(), 100 * ONE_WBTC);
    mock_wbtc.mint(USER3(), 100 * ONE_WBTC);
    stop_cheat_caller_address(wbtc_address);

    DeployedSystem {
        vault_address,
        vault,
        wbtc_address,
        wbtc,
        btcusd_address,
        btcusd,
        oracle_address,
        oracle,
        yield_manager_address: ym_address,
        yield_manager,
    }
}

/// Helper to perform full deposit operation
fn user_deposit(sys: @DeployedSystem, user: ContractAddress, amount: u256) {
    // Approve vault
    start_cheat_caller_address(*sys.wbtc_address, user);
    (*sys.wbtc).approve(*sys.vault_address, amount);
    stop_cheat_caller_address(*sys.wbtc_address);

    // Deposit
    start_cheat_caller_address(*sys.vault_address, user);
    (*sys.vault).deposit_collateral(amount);
    stop_cheat_caller_address(*sys.vault_address);
}

/// Helper to mint BTCUSD
fn user_mint(sys: @DeployedSystem, user: ContractAddress, amount: u256) {
    start_cheat_caller_address(*sys.vault_address, user);
    (*sys.vault).mint_btcusd(amount);
    stop_cheat_caller_address(*sys.vault_address);
}

/// Helper to burn BTCUSD
fn user_burn(sys: @DeployedSystem, user: ContractAddress, amount: u256) {
    start_cheat_caller_address(*sys.vault_address, user);
    (*sys.vault).burn_btcusd(amount);
    stop_cheat_caller_address(*sys.vault_address);
}

/// Helper to withdraw collateral
fn user_withdraw(sys: @DeployedSystem, user: ContractAddress, amount: u256) {
    start_cheat_caller_address(*sys.vault_address, user);
    (*sys.vault).withdraw_collateral(amount);
    stop_cheat_caller_address(*sys.vault_address);
}

// ============ Full Cycle Tests ============

#[test]
fn test_full_deposit_mint_burn_withdraw_cycle() {
    let sys = deploy_full_system();

    let initial_wbtc = sys.wbtc.balance_of(USER1());

    // Step 1: Deposit 1 wBTC
    user_deposit(@sys, USER1(), ONE_WBTC);

    assert(sys.wbtc.balance_of(USER1()) == initial_wbtc - ONE_WBTC, 'wBTC not deducted');
    assert(sys.vault.get_position(USER1()).collateral == ONE_WBTC, 'Collateral not recorded');

    // Step 2: Mint BTCUSD at safe ratio
    let mint_amount = 30000 * ONE_BTCUSD;
    user_mint(@sys, USER1(), mint_amount);

    assert(sys.btcusd.balance_of(USER1()) == mint_amount, 'BTCUSD not minted');
    assert(sys.vault.get_position(USER1()).debt == mint_amount, 'Debt not recorded');

    // Step 3: Burn all BTCUSD
    user_burn(@sys, USER1(), mint_amount);

    assert(sys.btcusd.balance_of(USER1()) == 0, 'BTCUSD not burned');
    assert(sys.vault.get_position(USER1()).debt == 0, 'Debt not cleared');

    // Step 4: Withdraw all collateral
    user_withdraw(@sys, USER1(), ONE_WBTC);

    assert(sys.vault.get_position(USER1()).collateral == 0, 'Collateral not withdrawn');
    assert(sys.wbtc.balance_of(USER1()) == initial_wbtc, 'wBTC not returned');
}

#[test]
fn test_deposit_and_mint_convenience_function() {
    let sys = deploy_full_system();

    // Approve vault
    start_cheat_caller_address(sys.wbtc_address, USER1());
    sys.wbtc.approve(sys.vault_address, ONE_WBTC);
    stop_cheat_caller_address(sys.wbtc_address);

    // Use deposit_and_mint
    start_cheat_caller_address(sys.vault_address, USER1());
    let minted = sys.vault.deposit_and_mint(ONE_WBTC);
    stop_cheat_caller_address(sys.vault_address);

    // Should have minted at max LTV (~66.67%)
    assert(minted > 0, 'Should have minted');

    let position = sys.vault.get_position(USER1());
    assert(position.collateral == ONE_WBTC, 'Wrong collateral');
    assert(position.debt == minted, 'Wrong debt');
    assert(sys.btcusd.balance_of(USER1()) == minted, 'Wrong BTCUSD balance');
}

#[test]
fn test_repay_and_withdraw_convenience_function() {
    let sys = deploy_full_system();

    // Setup: deposit and mint
    start_cheat_caller_address(sys.wbtc_address, USER1());
    sys.wbtc.approve(sys.vault_address, ONE_WBTC);
    stop_cheat_caller_address(sys.wbtc_address);

    start_cheat_caller_address(sys.vault_address, USER1());
    let minted = sys.vault.deposit_and_mint(ONE_WBTC);

    // Repay all and withdraw
    let withdrawn = sys.vault.repay_and_withdraw(minted);
    stop_cheat_caller_address(sys.vault_address);

    // Should have gotten all collateral back
    assert(withdrawn == ONE_WBTC, 'Should withdraw all');

    let position = sys.vault.get_position(USER1());
    assert(position.collateral == 0, 'Should have no collateral');
    assert(position.debt == 0, 'Should have no debt');
}

// ============ Multi-User Tests ============

#[test]
fn test_multiple_users_independent_positions() {
    let sys = deploy_full_system();

    // User1 deposits and mints
    user_deposit(@sys, USER1(), ONE_WBTC);
    user_mint(@sys, USER1(), 25000 * ONE_BTCUSD);

    // User2 deposits more and mints more
    user_deposit(@sys, USER2(), 2 * ONE_WBTC);
    user_mint(@sys, USER2(), 50000 * ONE_BTCUSD);

    // User3 only deposits, no minting
    user_deposit(@sys, USER3(), ONE_WBTC / 2);

    // Verify positions are independent
    let pos1 = sys.vault.get_position(USER1());
    let pos2 = sys.vault.get_position(USER2());
    let pos3 = sys.vault.get_position(USER3());

    assert(pos1.collateral == ONE_WBTC, 'Wrong USER1 collateral');
    assert(pos1.debt == 25000 * ONE_BTCUSD, 'Wrong USER1 debt');

    assert(pos2.collateral == 2 * ONE_WBTC, 'Wrong USER2 collateral');
    assert(pos2.debt == 50000 * ONE_BTCUSD, 'Wrong USER2 debt');

    assert(pos3.collateral == ONE_WBTC / 2, 'Wrong USER3 collateral');
    assert(pos3.debt == 0, 'USER3 should have no debt');

    // Verify protocol totals
    let (total_collateral, total_debt) = sys.vault.get_protocol_stats();
    assert(
        total_collateral == ONE_WBTC + 2 * ONE_WBTC + ONE_WBTC / 2, 'Wrong total collateral',
    );
    assert(total_debt == 25000 * ONE_BTCUSD + 50000 * ONE_BTCUSD, 'Wrong total debt');
}

#[test]
fn test_btcusd_transfers_between_users() {
    let sys = deploy_full_system();

    // User1 gets BTCUSD
    user_deposit(@sys, USER1(), ONE_WBTC);
    user_mint(@sys, USER1(), 30000 * ONE_BTCUSD);

    // Transfer to User2
    let transfer_amount = 10000 * ONE_BTCUSD;
    start_cheat_caller_address(sys.btcusd_address, USER1());
    sys.btcusd.transfer(USER2(), transfer_amount);
    stop_cheat_caller_address(sys.btcusd_address);

    // Verify balances
    assert(sys.btcusd.balance_of(USER1()) == 20000 * ONE_BTCUSD, 'Wrong USER1 balance');
    assert(sys.btcusd.balance_of(USER2()) == transfer_amount, 'Wrong USER2 balance');

    // User2 can now deposit collateral and use received BTCUSD to start a position
    // Or they could just hold it as a stablecoin
}

// ============ Price Change Tests ============

#[test]
fn test_price_increase_improves_health() {
    let sys = deploy_full_system();

    // User deposits and mints near max LTV
    user_deposit(@sys, USER1(), ONE_WBTC);
    let max_mintable = sys.vault.get_max_mintable(USER1());
    user_mint(@sys, USER1(), max_mintable);

    // Get initial collateral ratio
    let initial_ratio = sys.vault.get_collateral_ratio(USER1());

    // Price increases to $100k
    start_cheat_caller_address(sys.oracle_address, OWNER());
    sys.oracle.set_btc_price(BTC_PRICE_100K);
    stop_cheat_caller_address(sys.oracle_address);

    // Collateral ratio should improve
    let new_ratio = sys.vault.get_collateral_ratio(USER1());
    assert(new_ratio > initial_ratio, 'Ratio should improve');

    // Should be able to mint more
    let new_max_mintable = sys.vault.get_max_mintable(USER1());
    assert(new_max_mintable > 0, 'Should be able to mint more');
}

#[test]
fn test_price_decrease_worsens_health() {
    let sys = deploy_full_system();

    // User deposits and mints at moderate LTV
    user_deposit(@sys, USER1(), ONE_WBTC);
    user_mint(@sys, USER1(), 30000 * ONE_BTCUSD);

    let initial_ratio = sys.vault.get_collateral_ratio(USER1());
    assert(!sys.vault.is_liquidatable(USER1()), 'Should not be liquidatable');

    // Price drops to $50k
    start_cheat_caller_address(sys.oracle_address, OWNER());
    sys.oracle.set_btc_price(BTC_PRICE_50K);
    stop_cheat_caller_address(sys.oracle_address);

    // Collateral ratio should worsen
    let new_ratio = sys.vault.get_collateral_ratio(USER1());
    assert(new_ratio < initial_ratio, 'Ratio should worsen');

    // With $50k BTC and $30k debt, ratio = 50000/30000 = 166% > 120%
    // So should not be liquidatable yet
    assert(!sys.vault.is_liquidatable(USER1()), 'Should not be liquidatable yet');
}

#[test]
fn test_severe_price_drop_makes_liquidatable() {
    let sys = deploy_full_system();

    // User deposits and mints at max LTV (66.67%)
    user_deposit(@sys, USER1(), ONE_WBTC);
    let max_mintable = sys.vault.get_max_mintable(USER1());
    user_mint(@sys, USER1(), max_mintable);

    // At $65k BTC, max mint is ~$43,333 at 66.67% LTV
    // Ratio is 150% (15000 basis points)
    assert(!sys.vault.is_liquidatable(USER1()), 'Should not be liquidatable');

    // Price drops 30% to ~$45.5k (actually we'll use $45k for easy math)
    // With ~$43k debt, ratio becomes ~104% < 120% liquidation threshold
    start_cheat_caller_address(sys.oracle_address, OWNER());
    sys.oracle.set_btc_price(4500000000000); // $45,000
    stop_cheat_caller_address(sys.oracle_address);

    // Now should be liquidatable
    assert(sys.vault.is_liquidatable(USER1()), 'Should be liquidatable');
}

// ============ Yield Manager Integration Tests ============

#[test]
fn test_collateral_flows_to_yield_manager() {
    let sys = deploy_full_system();

    // Deposit collateral
    user_deposit(@sys, USER1(), ONE_WBTC);

    // Verify yield manager received the deposit
    let ym_deposit = sys.yield_manager.get_user_deposit(USER1());
    assert(ym_deposit == ONE_WBTC, 'YM should have deposit');

    // Verify wBTC is held by yield manager
    assert(sys.wbtc.balance_of(sys.yield_manager_address) == ONE_WBTC, 'wBTC not in YM');
}

#[test]
fn test_yield_accrues_while_deposited() {
    let sys = deploy_full_system();

    let initial_time: u64 = 1000000;
    start_cheat_block_timestamp(sys.vault_address, initial_time);
    start_cheat_block_timestamp(sys.yield_manager_address, initial_time);

    // Deposit
    user_deposit(@sys, USER1(), ONE_WBTC);

    // Move time forward by 1 year
    let one_year_later: u64 = initial_time + 31536000;
    start_cheat_block_timestamp(sys.vault_address, one_year_later);
    start_cheat_block_timestamp(sys.yield_manager_address, one_year_later);

    // Check yield accrued
    let accrued_yield = sys.yield_manager.get_user_yield(USER1());
    assert(accrued_yield > 0, 'Should have accrued yield');

    // Expected: 8% of 1 wBTC = 0.08 wBTC = 8,000,000 satoshis
    let expected_yield: u256 = 8000000;
    let tolerance = expected_yield / 10; // 10% tolerance
    assert(accrued_yield >= expected_yield - tolerance, 'Yield too low');
    assert(accrued_yield <= expected_yield + tolerance, 'Yield too high');

    stop_cheat_block_timestamp(sys.vault_address);
    stop_cheat_block_timestamp(sys.yield_manager_address);
}

#[test]
fn test_withdrawal_returns_from_yield_manager() {
    let sys = deploy_full_system();

    let initial_balance = sys.wbtc.balance_of(USER1());

    // Deposit
    user_deposit(@sys, USER1(), ONE_WBTC);

    // Verify in yield manager
    assert(sys.yield_manager.get_user_deposit(USER1()) == ONE_WBTC, 'Not in YM');

    // Withdraw
    user_withdraw(@sys, USER1(), ONE_WBTC);

    // Verify yield manager balance updated
    assert(sys.yield_manager.get_user_deposit(USER1()) == 0, 'Still in YM');

    // Verify user got wBTC back
    assert(sys.wbtc.balance_of(USER1()) == initial_balance, 'wBTC not returned');
}

// ============ Edge Case Tests ============

#[test]
fn test_minimum_deposit_works() {
    let sys = deploy_full_system();

    // Deposit exactly minimum (0.001 wBTC)
    user_deposit(@sys, USER1(), MIN_DEPOSIT);

    let position = sys.vault.get_position(USER1());
    assert(position.collateral == MIN_DEPOSIT, 'Min deposit failed');
}

#[test]
fn test_very_small_mint() {
    let sys = deploy_full_system();

    // Deposit 1 wBTC
    user_deposit(@sys, USER1(), ONE_WBTC);

    // Mint just 1 BTCUSD
    user_mint(@sys, USER1(), ONE_BTCUSD);

    let position = sys.vault.get_position(USER1());
    assert(position.debt == ONE_BTCUSD, 'Small mint failed');
}

#[test]
fn test_partial_operations() {
    let sys = deploy_full_system();

    // Deposit 2 wBTC
    user_deposit(@sys, USER1(), 2 * ONE_WBTC);

    // Mint some BTCUSD
    user_mint(@sys, USER1(), 40000 * ONE_BTCUSD);

    // Burn partial
    user_burn(@sys, USER1(), 10000 * ONE_BTCUSD);

    // Withdraw partial (need to stay above min ratio)
    let max_withdraw = sys.vault.get_max_withdrawable(USER1());
    if max_withdraw >= MIN_DEPOSIT {
        user_withdraw(@sys, USER1(), MIN_DEPOSIT);
    }

    let position = sys.vault.get_position(USER1());
    assert(position.debt == 30000 * ONE_BTCUSD, 'Wrong remaining debt');
}

// ============ Protocol Stats Tests ============

#[test]
fn test_protocol_stats_accurate() {
    let sys = deploy_full_system();

    // Multiple users deposit and mint
    user_deposit(@sys, USER1(), ONE_WBTC);
    user_mint(@sys, USER1(), 20000 * ONE_BTCUSD);

    user_deposit(@sys, USER2(), 2 * ONE_WBTC);
    user_mint(@sys, USER2(), 40000 * ONE_BTCUSD);

    let (total_collateral, total_debt) = sys.vault.get_protocol_stats();
    assert(total_collateral == 3 * ONE_WBTC, 'Wrong total collateral');
    assert(total_debt == 60000 * ONE_BTCUSD, 'Wrong total debt');

    // User1 repays and withdraws
    user_burn(@sys, USER1(), 20000 * ONE_BTCUSD);
    user_withdraw(@sys, USER1(), ONE_WBTC);

    let (new_collateral, new_debt) = sys.vault.get_protocol_stats();
    assert(new_collateral == 2 * ONE_WBTC, 'Wrong new collateral');
    assert(new_debt == 40000 * ONE_BTCUSD, 'Wrong new debt');
}
