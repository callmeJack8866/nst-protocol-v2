import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import "isomorphic-fetch";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const BSC_MAINNET_RPC = process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.binance.org/";
const BSC_TESTNET_RPC = process.env.BSC_TESTNET_RPC || "https://lb.drpc.live/bsc-testnet/Ag-nIvHP5U9dvYvuRGoZQwldtM7y0C4R8K6HOmy9-kY5";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC,
      chainId: 97,
      accounts: [PRIVATE_KEY],
      timeout: 120000, // 120秒超时
      httpHeaders: {
        "Content-Type": "application/json",
      },
    },
    bscMainnet: {
      url: BSC_MAINNET_RPC,
      chainId: 56,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      bsc: BSCSCAN_API_KEY,
      bscTestnet: BSCSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
