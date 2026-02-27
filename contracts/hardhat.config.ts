import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "0x" + "1".repeat(64);
const BNB_RPC_URL = process.env.BNB_RPC_URL ?? "https://bsc-dataseed.binance.org/";
const BNB_TESTNET_RPC_URL = process.env.BNB_TESTNET_RPC_URL ?? "https://data-seed-prebsc-1-s1.binance.org:8545/";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },

    networks: {
        hardhat: {
            chainId: 31337,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337,
        },
        "bsc-testnet": {
            url: BNB_TESTNET_RPC_URL,
            chainId: 97,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: 10_000_000_000, // 10 gwei
        },
        bsc: {
            url: BNB_RPC_URL,
            chainId: 56,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: 5_000_000_000, // 5 gwei
        },
    },

    etherscan: {
        apiKey: {
            bsc: BSCSCAN_API_KEY,
            bscTestnet: BSCSCAN_API_KEY,
        },
    },

    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
        token: "BNB",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },

    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

export default config;
