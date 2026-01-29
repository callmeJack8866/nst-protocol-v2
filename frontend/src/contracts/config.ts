/**
 * Contract Addresses Configuration
 * Updated: 2026-01-28 17:15 BSC Testnet Deployment
 * Upgrade: Added exerciseDelay & feedRule support to createSellerOrder
 */

// BSC Testnet (ChainID: 97)
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x9f2140319726F9b851073a303415f13EC0cdA269',
    Config: '0x751C17032D38b0b877171cB96039678710b3c76F',
    VaultManager: '0x9FD199A71a1f19Cc095090D5509B9FF6eB49294C',
    OptionsCore: '0xDfeb0078B0Fb3AbEc4BB56E44edfd06947FEc965',
    FeedProtocol: '0xf3964b631dC65f1Ef76F240a2574A61DbBDdB3cB',
    SeatManager: '0x0d6D9Cfd4AAD62d841c9A95e916db951AeDA05bB',
    PointsManager: '0xC01F9b8Ef0E3632F5813fa3695453c817fe647Ea',
    VolumeBasedFeed: '0x79DFdaa7c03C2564DeE5EB73E9c98e8aad765e8b',
    FeederSelector: '',
};

// BSC Mainnet (ChainID: 56) - Not deployed yet
export const BSC_MAINNET_ADDRESSES = {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    Config: '',
    VaultManager: '',
    OptionsCore: '',
    FeedProtocol: '',
    SeatManager: '',
    PointsManager: '',
    VolumeBasedFeed: '',
    FeederSelector: '',
};

// Contract Display Names
export const CONTRACT_NAMES: Record<string, string> = {
    Config: 'System Config',
    VaultManager: 'Vault Manager',
    OptionsCore: 'Options Core',
    FeedProtocol: 'Feed Protocol',
    SeatManager: 'Seat Manager',
    PointsManager: 'Points Manager',
};

// Chain configurations
export const CHAINS = {
    BSC_MAINNET: {
        chainId: 56,
        name: 'BSC Mainnet',
        rpcUrl: 'https://bsc-dataseed1.binance.org/',
        blockExplorer: 'https://bscscan.com',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    },
    BSC_TESTNET: {
        chainId: 97,
        name: 'BSC Testnet',
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        blockExplorer: 'https://testnet.bscscan.com',
        nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    },
};

// Get contract addresses by chainId
export const getContractAddresses = (chainId: number) => {
    if (chainId === 56) return BSC_MAINNET_ADDRESSES;
    if (chainId === 97) return BSC_TESTNET_ADDRESSES;
    return BSC_TESTNET_ADDRESSES;
};

// Get chain config by chainId
export const getChainConfig = (chainId: number) => {
    if (chainId === 56) return CHAINS.BSC_MAINNET;
    if (chainId === 97) return CHAINS.BSC_TESTNET;
    return CHAINS.BSC_TESTNET;
};
