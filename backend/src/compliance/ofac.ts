/**
 * OFAC SDN (Specially Designated Nationals) list sync & check.
 *
 * The SDN list is a US Treasury sanctions list.  We download a consolidated
 * XML from the official OFAC data-feed, extract all Ethereum / BNB addresses,
 * and upsert them into the `blocked_addresses` table.
 *
 * Refreshed every OFAC_SYNC_INTERVAL_MS (default 1 hour).
 */

import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { prisma } from '../db/prisma/client.js';
import { logger } from '../utils/logger.js';
import { isValidAddress, toChecksumAddress } from '../utils/address.js';
import { config } from '../config.js';

const OFAC_SDN_URL =
  'https://www.treasury.gov/ofac/downloads/sdn.xml';

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Download and parse the OFAC SDN XML, extract all crypto addresses,
 * and upsert them into the DB.
 */
export async function syncOfacList(): Promise<{ added: number; total: number }> {
  logger.info('Syncing OFAC SDN list…');
  let xmlData: string;
  try {
    const response = await axios.get<string>(OFAC_SDN_URL, {
      timeout: 30_000,
      responseType: 'text',
    });
    xmlData = response.data;
  } catch (err) {
    logger.error({ err }, 'Failed to download OFAC SDN list');
    throw err;
  }

  const parsed = await parseStringPromise(xmlData, { explicitArray: true });
  const entries = parsed?.sdnList?.sdnEntry ?? [];

  const addresses: string[] = [];
  for (const entry of entries) {
    const idList = entry?.idList?.[0]?.id ?? [];
    for (const id of idList) {
      const idType: string = id?.idType?.[0] ?? '';
      const idNumber: string = id?.idNumber?.[0] ?? '';
      // Match ETH or BNB digital currency addresses
      if (
        (idType.toLowerCase().includes('digital currency') ||
          idType.toLowerCase().includes('ethereum') ||
          idType.toLowerCase().includes('bnb')) &&
        isValidAddress(idNumber)
      ) {
        addresses.push(toChecksumAddress(idNumber));
      }
    }
  }

  // Upsert into DB
  let added = 0;
  for (const address of addresses) {
    const result = await prisma.blockedAddress.upsert({
      where: { address },
      update: { reason: 'OFAC_SDN', source: OFAC_SDN_URL },
      create: { address, reason: 'OFAC_SDN', source: OFAC_SDN_URL },
    });
    if (result) added++;
  }

  logger.info({ extracted: addresses.length, added }, 'OFAC SDN sync complete');
  return { added, total: addresses.length };
}

/** Returns true if the address is on the OFAC SDN list (sourced from DB). */
export async function isOfacBlocked(address: string): Promise<boolean> {
  if (!isValidAddress(address)) return false;
  const checksumAddr = toChecksumAddress(address);
  const record = await prisma.blockedAddress.findFirst({
    where: { address: checksumAddr, reason: 'OFAC_SDN' },
    select: { id: true },
  });
  return record !== null;
}

// ─── Periodic Sync ────────────────────────────────────────────────────────────

let _syncTimer: ReturnType<typeof setInterval> | null = null;

export function startOfacSyncJob(): void {
  // Run immediately
  syncOfacList().catch((err) => logger.error({ err }, 'OFAC initial sync failed'));

  _syncTimer = setInterval(() => {
    syncOfacList().catch((err) => logger.error({ err }, 'OFAC periodic sync failed'));
  }, config.OFAC_SYNC_INTERVAL_MS);

  logger.info(
    { intervalMs: config.OFAC_SYNC_INTERVAL_MS },
    'OFAC SDN sync job started',
  );
}

export function stopOfacSyncJob(): void {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
  }
}
