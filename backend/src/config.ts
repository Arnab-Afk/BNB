import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'testnet', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // BNB Chain RPC
  BNB_RPC_URL: z.string().url(),
  BNB_TESTNET_RPC_URL: z.string().url().optional(),
  CHAIN_ID: z.coerce.number().default(56),

  // Relayer / hot wallet
  RELAYER_PRIVATE_KEY: z.string().startsWith('0x').length(66),
  RELAYER_ADDRESS: z.string().startsWith('0x').length(42),

  // Smart contracts
  PAYMASTER_CONTRACT_ADDRESS: z.string().startsWith('0x').length(42),
  GHOST_POOL_ADDRESS: z.string().startsWith('0x').length(42),
  ENTRYPOINT_ADDRESS: z
    .string()
    .startsWith('0x')
    .length(42)
    .default('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2781'),

  // Bundler
  BUNDLER_URL: z.string().url(),
  PIMLICO_API_KEY: z.string().optional(),

  // ZK Circuits
  CIRCUIT_WASM_PATH: z.string().default('./src/zk/circuits/merkle_proof.wasm'),
  CIRCUIT_ZKEY_PATH: z.string().default('./src/zk/circuits/merkle_proof_final.zkey'),
  CIRCUIT_VERIFICATION_KEY_PATH: z.string().default('./src/zk/circuits/verification_key.json'),

  // Merkle tree
  MERKLE_TREE_HEIGHT: z.coerce.number().min(1).max(32).default(20),

  // Compliance
  OFAC_SYNC_INTERVAL_MS: z.coerce.number().default(3_600_000),
  CHAINALYSIS_API_KEY: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

function parseConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌  Invalid environment variables:\n', result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = parseConfig();

export type Config = typeof config;
