use starknet::ContractAddress;

/// Interface for the BTCUSD stablecoin token.
/// Only the vault contract can mint and burn tokens.
#[starknet::interface]
pub trait IBTCUSDToken<TContractState> {
    /// Mints BTCUSD tokens to a recipient. Only callable by the vault.
    ///
    /// # Arguments
    /// * `to` - The address to receive the minted tokens
    /// * `amount` - The amount of tokens to mint (18 decimals)
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);

    /// Burns BTCUSD tokens from an address. Only callable by the vault.
    ///
    /// # Arguments
    /// * `from` - The address to burn tokens from
    /// * `amount` - The amount of tokens to burn (18 decimals)
    fn burn(ref self: TContractState, from: ContractAddress, amount: u256);

    /// Updates the vault address. Only callable by owner.
    ///
    /// # Arguments
    /// * `new_vault` - The new vault contract address
    fn set_vault(ref self: TContractState, new_vault: ContractAddress);

    /// Returns the current vault address.
    fn get_vault(self: @TContractState) -> ContractAddress;

    /// Pauses all transfers. Only callable by owner. Used for emergencies.
    fn pause(ref self: TContractState);

    /// Unpauses transfers. Only callable by owner.
    fn unpause(ref self: TContractState);

    /// Returns whether the contract is paused.
    fn get_paused_status(self: @TContractState) -> bool;
}
