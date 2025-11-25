/// Tests for BTCUSDToken contract
///
/// Test coverage:
/// - Deployment and initialization
/// - Vault-only minting restrictions
/// - Vault-only burning restrictions
/// - Vault address management
/// - Pause/unpause functionality
/// - ERC20 standard operations

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use btcusd_protocol::interfaces::{IBTCUSDTokenDispatcher, IBTCUSDTokenDispatcherTrait};

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

fn ZERO_ADDRESS() -> ContractAddress {
    contract_address_const::<0>()
}

fn deploy_btcusd_token() -> (ContractAddress, IBTCUSDTokenDispatcher, IERC20Dispatcher) {
    let contract = declare("BTCUSDToken").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    VAULT().serialize(ref calldata);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();

    let token_dispatcher = IBTCUSDTokenDispatcher { contract_address };
    let erc20_dispatcher = IERC20Dispatcher { contract_address };

    (contract_address, token_dispatcher, erc20_dispatcher)
}

// ============ Deployment Tests ============

#[test]
fn test_deployment_initializes_correctly() {
    let (_, token, erc20) = deploy_btcusd_token();

    // Check ERC20 metadata
    assert(erc20.name() == "Bitcoin USD Stablecoin", 'Wrong name');
    assert(erc20.symbol() == "BTCUSD", 'Wrong symbol');
    assert(erc20.total_supply() == 0, 'Should start with 0 supply');

    // Check vault address
    assert(token.get_vault() == VAULT(), 'Wrong vault address');

    // Check not paused
    assert(!token.get_paused_status(), 'Should not be paused');
}

// ============ Minting Tests ============

#[test]
fn test_vault_can_mint() {
    let (contract_address, token, erc20) = deploy_btcusd_token();

    let mint_amount: u256 = 1000_000000000000000000; // 1000 BTCUSD

    // Mint as vault
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), mint_amount);
    stop_cheat_caller_address(contract_address);

    // Verify balance
    assert(erc20.balance_of(USER1()) == mint_amount, 'Wrong balance after mint');
    assert(erc20.total_supply() == mint_amount, 'Wrong total supply');
}

#[test]
#[should_panic(expected: 'BTCUSD: caller is not vault')]
fn test_non_vault_cannot_mint() {
    let (contract_address, token, _) = deploy_btcusd_token();

    // Try to mint as non-vault (USER1)
    start_cheat_caller_address(contract_address, USER1());
    token.mint(USER1(), 1000);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'BTCUSD: caller is not vault')]
fn test_owner_cannot_mint() {
    let (contract_address, token, _) = deploy_btcusd_token();

    // Even owner cannot mint - only vault
    start_cheat_caller_address(contract_address, OWNER());
    token.mint(USER1(), 1000);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'BTCUSD: zero address')]
fn test_cannot_mint_to_zero_address() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, VAULT());
    token.mint(ZERO_ADDRESS(), 1000);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'BTCUSD: zero amount')]
fn test_cannot_mint_zero_amount() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), 0);
    stop_cheat_caller_address(contract_address);
}

// ============ Burning Tests ============

#[test]
fn test_vault_can_burn() {
    let (contract_address, token, erc20) = deploy_btcusd_token();

    let mint_amount: u256 = 1000_000000000000000000;
    let burn_amount: u256 = 400_000000000000000000;

    // First mint
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), mint_amount);

    // Then burn
    token.burn(USER1(), burn_amount);
    stop_cheat_caller_address(contract_address);

    // Verify balance
    assert(erc20.balance_of(USER1()) == mint_amount - burn_amount, 'Wrong balance after burn');
    assert(erc20.total_supply() == mint_amount - burn_amount, 'Wrong supply after burn');
}

#[test]
#[should_panic(expected: 'BTCUSD: caller is not vault')]
fn test_non_vault_cannot_burn() {
    let (contract_address, token, _) = deploy_btcusd_token();

    // Mint first
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), 1000);
    stop_cheat_caller_address(contract_address);

    // Try to burn as non-vault
    start_cheat_caller_address(contract_address, USER1());
    token.burn(USER1(), 500);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'BTCUSD: zero amount')]
fn test_cannot_burn_zero_amount() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), 1000);
    token.burn(USER1(), 0);
    stop_cheat_caller_address(contract_address);
}

// ============ Vault Management Tests ============

#[test]
fn test_owner_can_set_vault() {
    let (contract_address, token, _) = deploy_btcusd_token();

    let new_vault = contract_address_const::<'NEW_VAULT'>();

    start_cheat_caller_address(contract_address, OWNER());
    token.set_vault(new_vault);
    stop_cheat_caller_address(contract_address);

    assert(token.get_vault() == new_vault, 'Vault not updated');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_set_vault() {
    let (contract_address, token, _) = deploy_btcusd_token();

    let new_vault = contract_address_const::<'NEW_VAULT'>();

    start_cheat_caller_address(contract_address, USER1());
    token.set_vault(new_vault);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'BTCUSD: zero address')]
fn test_cannot_set_zero_vault() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, OWNER());
    token.set_vault(ZERO_ADDRESS());
    stop_cheat_caller_address(contract_address);
}

// ============ Pause Tests ============

#[test]
fn test_owner_can_pause() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, OWNER());
    token.pause();
    stop_cheat_caller_address(contract_address);

    assert(token.get_paused_status(), 'Should be paused');
}

#[test]
fn test_owner_can_unpause() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, OWNER());
    token.pause();
    token.unpause();
    stop_cheat_caller_address(contract_address);

    assert(!token.get_paused_status(), 'Should not be paused');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_pause() {
    let (contract_address, token, _) = deploy_btcusd_token();

    start_cheat_caller_address(contract_address, USER1());
    token.pause();
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_cannot_mint_when_paused() {
    let (contract_address, token, _) = deploy_btcusd_token();

    // Pause
    start_cheat_caller_address(contract_address, OWNER());
    token.pause();
    stop_cheat_caller_address(contract_address);

    // Try to mint
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), 1000);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_cannot_burn_when_paused() {
    let (contract_address, token, _) = deploy_btcusd_token();

    // Mint first
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), 1000);
    stop_cheat_caller_address(contract_address);

    // Pause
    start_cheat_caller_address(contract_address, OWNER());
    token.pause();
    stop_cheat_caller_address(contract_address);

    // Try to burn
    start_cheat_caller_address(contract_address, VAULT());
    token.burn(USER1(), 500);
    stop_cheat_caller_address(contract_address);
}

// ============ ERC20 Transfer Tests ============

#[test]
fn test_erc20_transfer() {
    let (contract_address, token, erc20) = deploy_btcusd_token();

    let amount: u256 = 1000_000000000000000000;

    // Mint to USER1
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), amount);
    stop_cheat_caller_address(contract_address);

    // Transfer from USER1 to USER2
    start_cheat_caller_address(contract_address, USER1());
    erc20.transfer(USER2(), 400_000000000000000000);
    stop_cheat_caller_address(contract_address);

    assert(erc20.balance_of(USER1()) == 600_000000000000000000, 'Wrong USER1 balance');
    assert(erc20.balance_of(USER2()) == 400_000000000000000000, 'Wrong USER2 balance');
}

#[test]
fn test_erc20_approve_and_transfer_from() {
    let (contract_address, token, erc20) = deploy_btcusd_token();

    let amount: u256 = 1000_000000000000000000;

    // Mint to USER1
    start_cheat_caller_address(contract_address, VAULT());
    token.mint(USER1(), amount);
    stop_cheat_caller_address(contract_address);

    // USER1 approves USER2
    start_cheat_caller_address(contract_address, USER1());
    erc20.approve(USER2(), 500_000000000000000000);
    stop_cheat_caller_address(contract_address);

    // USER2 transfers from USER1
    start_cheat_caller_address(contract_address, USER2());
    erc20.transfer_from(USER1(), USER2(), 300_000000000000000000);
    stop_cheat_caller_address(contract_address);

    assert(erc20.balance_of(USER1()) == 700_000000000000000000, 'Wrong USER1 balance');
    assert(erc20.balance_of(USER2()) == 300_000000000000000000, 'Wrong USER2 balance');
    assert(erc20.allowance(USER1(), USER2()) == 200_000000000000000000, 'Wrong allowance');
}
