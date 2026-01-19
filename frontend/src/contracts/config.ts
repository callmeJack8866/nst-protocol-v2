/**
 * Contract Addresses Configuration
 * Updated: 2026-01-19 BSC Testnet Deployment
 */

// BSC Testnet (ChainID: 97)
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    Config: '0xCb58B6e82d7D94480A62C1D95cc9Eb9D0dba67Fd',
    VaultManager: '0xd4487A3E5041148c08c3A3B1d31F59618B7C43DE',
    OptionsCore: '0xa484b6EbC5fb06E619362aeD70822404464b5435',
    FeedProtocol: '0x6cD9cf774b6BC085338AbfB47a091592bA01A7C0',
    SeatManager: '0xe7948Bdd1BB5Ee41C2B0fE7f97CdB6Fe938e1d41',
    PointsManager: '0x1C9296ce4a87A5d6fdDF71142Deff6471Aa9E0E8',
    VolumeBasedFeed: '',
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
