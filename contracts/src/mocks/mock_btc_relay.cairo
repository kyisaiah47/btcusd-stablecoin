/// Mock BTC Relay for Testing
///
/// A simplified mock implementation of the Bitcoin relay interface.
/// For testnet only - always returns true for verification.
/// In production, use the real Atomiq BTC relay.

#[starknet::interface]
pub trait IMockBtcRelay<TContractState> {
    fn submit_block_header(ref self: TContractState, header: Span<felt252>);
    fn get_latest_block_height(self: @TContractState) -> u64;
    fn verify_tx_inclusion(
        self: @TContractState,
        tx_hash: u256,
        block_height: u64,
        merkle_proof: Span<u256>,
        tx_index: u32,
    ) -> bool;
    fn get_required_confirmations(self: @TContractState) -> u64;
    fn set_block_height(ref self: TContractState, height: u64);
    fn set_required_confirmations(ref self: TContractState, confirmations: u64);
    fn set_verification_result(ref self: TContractState, result: bool);
}

#[starknet::contract]
pub mod MockBtcRelay {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::IMockBtcRelay;

    #[storage]
    struct Storage {
        block_height: u64,
        required_confirmations: u64,
        verification_result: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        // Initialize with reasonable testnet defaults
        self.block_height.write(850000); // Approximate current BTC testnet height
        self.required_confirmations.write(3);
        self.verification_result.write(true); // Always verify true for testing
    }

    #[abi(embed_v0)]
    impl MockBtcRelayImpl of IMockBtcRelay<ContractState> {
        fn submit_block_header(ref self: ContractState, header: Span<felt252>) {
            // In mock, just increment block height
            let current = self.block_height.read();
            self.block_height.write(current + 1);
        }

        fn get_latest_block_height(self: @ContractState) -> u64 {
            self.block_height.read()
        }

        fn verify_tx_inclusion(
            self: @ContractState,
            tx_hash: u256,
            block_height: u64,
            merkle_proof: Span<u256>,
            tx_index: u32,
        ) -> bool {
            // For testing, return configured result (default: true)
            self.verification_result.read()
        }

        fn get_required_confirmations(self: @ContractState) -> u64 {
            self.required_confirmations.read()
        }

        fn set_block_height(ref self: ContractState, height: u64) {
            self.block_height.write(height);
        }

        fn set_required_confirmations(ref self: ContractState, confirmations: u64) {
            self.required_confirmations.write(confirmations);
        }

        fn set_verification_result(ref self: ContractState, result: bool) {
            self.verification_result.write(result);
        }
    }
}
