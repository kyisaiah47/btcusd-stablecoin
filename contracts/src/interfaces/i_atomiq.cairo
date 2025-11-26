/// Atomiq Bridge Interface
///
/// Interface for interacting with Atomiq's escrow-based Bitcoin bridge.
/// Atomiq uses an onchain escrow system combined with Bitcoin's PoW security
/// to process trustless BTC ↔ wBTC swaps.
///
/// Architecture:
/// - EscrowManager: Central contract managing escrows, LP vaults, and reputation
/// - Claim Handlers: Define conditions for claimers to receive funds
/// - Refund Handlers: Define conditions for offerers to recover funds
///
/// @see https://github.com/atomiqlabs/atomiq-contracts-starknet

use starknet::ContractAddress;

/// Escrow status enum
#[derive(Drop, Copy, Serde, PartialEq, Default)]
pub enum EscrowStatus {
    #[default]
    None,
    Pending,
    Claimed,
    Refunded,
    Expired,
}

/// Escrow data structure
#[derive(Drop, Copy, Serde)]
pub struct Escrow {
    /// The address that can claim the escrow
    pub claimer: ContractAddress,
    /// The address that created the escrow (can refund if conditions met)
    pub offerer: ContractAddress,
    /// Token address (wBTC)
    pub token: ContractAddress,
    /// Amount in escrow
    pub amount: u256,
    /// Expiration timestamp
    pub expiry: u64,
    /// Current status
    pub status: EscrowStatus,
    /// Claim handler contract address
    pub claim_handler: ContractAddress,
    /// Refund handler contract address
    pub refund_handler: ContractAddress,
}

/// LP Vault deposit info
#[derive(Drop, Copy, Serde)]
pub struct VaultDeposit {
    /// LP address
    pub lp: ContractAddress,
    /// Token address
    pub token: ContractAddress,
    /// Deposited amount
    pub amount: u256,
    /// Available amount (not locked in escrows)
    pub available: u256,
}

/// Swap request for BTC → wBTC
#[derive(Drop, Copy, Serde)]
pub struct SwapRequest {
    /// Bitcoin transaction hash (32 bytes)
    pub btc_tx_hash: u256,
    /// Output index in the Bitcoin transaction
    pub output_index: u32,
    /// Expected amount in satoshis
    pub amount_sats: u64,
    /// Recipient Starknet address
    pub recipient: ContractAddress,
    /// LP providing liquidity
    pub lp: ContractAddress,
}

/// Atomiq EscrowManager interface
#[starknet::interface]
pub trait IAtomiqEscrowManager<TContractState> {
    /// Create a new escrow
    /// @param claimer Address that can claim the escrow
    /// @param token Token address (wBTC)
    /// @param amount Amount to escrow
    /// @param expiry Expiration timestamp
    /// @param claim_handler Handler contract for claim conditions
    /// @param refund_handler Handler contract for refund conditions
    /// @return escrow_id Unique escrow identifier
    fn create_escrow(
        ref self: TContractState,
        claimer: ContractAddress,
        token: ContractAddress,
        amount: u256,
        expiry: u64,
        claim_handler: ContractAddress,
        refund_handler: ContractAddress,
    ) -> u256;

    /// Claim an escrow by satisfying claim handler conditions
    /// @param escrow_id Escrow identifier
    /// @param proof Proof data for claim handler verification
    fn claim_escrow(ref self: TContractState, escrow_id: u256, proof: Span<felt252>);

    /// Refund an escrow (after expiry or via refund handler)
    /// @param escrow_id Escrow identifier
    fn refund_escrow(ref self: TContractState, escrow_id: u256);

    /// Get escrow details
    fn get_escrow(self: @TContractState, escrow_id: u256) -> Escrow;

    /// Check if escrow is claimable
    fn is_claimable(self: @TContractState, escrow_id: u256) -> bool;

    /// Check if escrow is refundable
    fn is_refundable(self: @TContractState, escrow_id: u256) -> bool;
}

/// Atomiq LP Vault interface
#[starknet::interface]
pub trait IAtomiqVault<TContractState> {
    /// Deposit tokens into LP vault
    /// @param token Token address
    /// @param amount Amount to deposit
    fn deposit(ref self: TContractState, token: ContractAddress, amount: u256);

    /// Withdraw tokens from LP vault
    /// @param token Token address
    /// @param amount Amount to withdraw
    fn withdraw(ref self: TContractState, token: ContractAddress, amount: u256);

    /// Get vault balance for an LP
    fn get_balance(self: @TContractState, lp: ContractAddress, token: ContractAddress) -> u256;

    /// Get available (unlocked) balance for an LP
    fn get_available(self: @TContractState, lp: ContractAddress, token: ContractAddress) -> u256;
}

/// Bitcoin Output Claim Handler interface
/// Used for verifying Bitcoin transactions for BTC → wBTC swaps
#[starknet::interface]
pub trait IBtcOutputClaimHandler<TContractState> {
    /// Verify a Bitcoin output for claiming
    /// @param escrow_id Associated escrow
    /// @param btc_tx_hash Bitcoin transaction hash
    /// @param output_index Output index
    /// @param merkle_proof Merkle proof for block inclusion
    /// @param block_header Bitcoin block header
    fn verify_btc_output(
        self: @TContractState,
        escrow_id: u256,
        btc_tx_hash: u256,
        output_index: u32,
        merkle_proof: Span<u256>,
        block_header: Span<felt252>,
    ) -> bool;
}

/// Bitcoin Relay (Light Client) interface
/// Verifies Bitcoin block headers and transaction inclusion
#[starknet::interface]
pub trait IBtcRelay<TContractState> {
    /// Submit a Bitcoin block header
    fn submit_block_header(ref self: TContractState, header: Span<felt252>);

    /// Get the latest verified block height
    fn get_latest_block_height(self: @TContractState) -> u64;

    /// Verify transaction inclusion in a block
    fn verify_tx_inclusion(
        self: @TContractState,
        tx_hash: u256,
        block_height: u64,
        merkle_proof: Span<u256>,
        tx_index: u32,
    ) -> bool;

    /// Get required confirmations
    fn get_required_confirmations(self: @TContractState) -> u64;
}
