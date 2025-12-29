/**
 * Contract Addresses Configuration
 * NOTE: Update these addresses after deployment
 */

// BSC Testnet (ChainID: 97)
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // BSC Testnet USDT
    Config: '',
    VaultManager: '',
    OptionsCore: '',
    SeatManager: '',
    PointsManager: '',
    FeedProtocol: '',
    VolumeBasedFeed: '',
    FeederSelector: '',
};

// BSC Mainnet (ChainID: 56)
export const BSC_MAINNET_ADDRESSES = {
    USDT: '0x55d398326f99059fF775485246999027B3197955', // BSC Mainnet USDT
    Config: '',
    VaultManager: '',
    OptionsCore: '',
    SeatManager: '',
    PointsManager: '',
    FeedProtocol: '',
    VolumeBasedFeed: '',
    FeederSelector: '',
};

// Contract names for display
export const CONTRACT_NAMES = {
    Config: 'Config',
    VaultManager: 'VaultManager',
    OptionsCore: 'NST Options Core',
    SeatManager: 'Seat Manager',
    PointsManager: 'Points Manager',
    FeedProtocol: 'Feed Protocol',
    VolumeBasedFeed: 'Volume Based Feed',
    FeederSelector: 'Feeder Selector',
};

// Chain configuration
export const CHAINS = {
    BSC_MAINNET: {
        chainId: 56,
        name: 'BSC Mainnet',
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        blockExplorer: 'https://bscscan.com',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
        },
    },
    BSC_TESTNET: {
        chainId: 97,
        name: 'BSC Testnet',
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        blockExplorer: 'https://testnet.bscscan.com',
        nativeCurrency: {
            name: 'tBNB',
            symbol: 'tBNB',
            decimals: 18,
        },
    },
};

// Get current environment addresses
export const getContractAddresses = (chainId: number) => {
    if (chainId === 56) return BSC_MAINNET_ADDRESSES;
    if (chainId === 97) return BSC_TESTNET_ADDRESSES;
    return BSC_TESTNET_ADDRESSES; // Default to testnet
};

export const getChainConfig = (chainId: number) => {
    if (chainId === 56) return CHAINS.BSC_MAINNET;
    if (chainId === 97) return CHAINS.BSC_TESTNET;
    return CHAINS.BSC_TESTNET;
};
