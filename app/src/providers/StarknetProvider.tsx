/**
 * Starknet Provider
 *
 * Wraps the app with Starknet React context for wallet connectivity
 */

import React, { ReactNode } from 'react';
import { sepolia } from '@starknet-react/chains';
import {
  StarknetConfig,
  publicProvider,
  argent,
  braavos,
  useInjectedConnectors,
} from '@starknet-react/core';

interface Props {
  children: ReactNode;
}

export function StarknetProvider({ children }: Props) {
  // Get available wallet connectors
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: 'always',
    order: 'alphabetical',
  });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={publicProvider()}
      connectors={connectors}
    >
      {children}
    </StarknetConfig>
  );
}
