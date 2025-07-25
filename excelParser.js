const xlsx = require('xlsx');
const ip = require('ip');
const sharedState = require('./sharedState');
const logger = require('./logger');

const skipSheets = new Set(['unicast', 'profiles', 'validation']);

function parseWorkbook(filePath) {
  const workbook = xlsx.readFile(filePath);

  sharedState.set('currentFile', filePath);
  sharedState.set('workbook', workbook);

  // Sheet names = groups (excluding skipped)
  const sheetNames = workbook.SheetNames.filter(name => !skipSheets.has(name));
  if (sheetNames.length === 0) throw new Error('No valid sheets to process in Excel file.');

  // Extract probes, interface map
  const { probeNames, interfaceByNameVlan } = processUnicastSheet(workbook);
  const profiles = processProfilesSheet(workbook);

  sharedState.set('profiles', profiles);
  sharedState.set('probes', probeNames);
  sharedState.set('groups', sheetNames);
  sharedState.set('interfaceMap', interfaceByNameVlan);
}

/**
 * Parse the IPGW string like '192.168.219.1/24/.1' into its components:
 *  - Host IP address
 *  - Prefix length
 *  - Calculated Gateway IP address - validates that the host and gateway are in the same /24 subnet
 * returns an object with hostIP, prefix, and gatewayIP.
 */
function parseIPGW(input) {
  const result = { hostIP: '', prefix: '', gatewayIP: '' };

  if (!input || !input.includes('/') || !input.includes('.')) return result;

  const match = input.match(/^(.+?)\/(\d{1,2})\/(\.\d+)$/);
  if (!match) return result;

  const [_, hostIP, prefixStr, suffixStr] = match;
  const prefix = parseInt(prefixStr, 10);

  if (!ip.isV4Format(hostIP) || isNaN(prefix) || prefix < 24 || prefix > 32) return result;

  const hostParts = hostIP.split('.');
  const suffix = suffixStr.slice(1); // strip the leading dot

  const gatewayIP = `${hostParts[0]}.${hostParts[1]}.${hostParts[2]}.${suffix}`;
  if (!ip.isV4Format(gatewayIP)) return result;

  // Sanity check: host and gateway must be in the same /24
  if (hostParts.slice(0, 3).join('.') !== gatewayIP.split('.').slice(0, 3).join('.')) {
    return result;
  }

  result.hostIP = hostIP;
  result.prefix = prefix;
  result.gatewayIP = gatewayIP;
  return result;
}

// Process unicast sheet and extract interface data
// return a list of probe friendly names and a
// dictionary of interfaces by friendly name and VLAN
// we need the IP address of the DTV interface to push the config to the probe
function processUnicastSheet(workbook) {
  const sheet = workbook.Sheets['unicast'];
  if (!sheet) throw new Error('⚠️  Error: "unicast" sheet not found');

  let json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) throw new Error('⚠️  Error: "unicast" sheet is empty');

  const probeNames = [];
  const interfaceByNameVlan = {};

  for (const row of json) {
    const Name = row['FRIENDLY_NAME'];
    if (!Name) continue;

    const Vlan = row['VLAN'] ? row['VLAN'].toString().toLowerCase() : '';
    const Interface = row['INTERFACE'];
    const {hostIP, prefix, gatewayIP} = parseIPGW(row['IP_PRFX_GW']);

    if (!hostIP || !prefix || !gatewayIP) {
      logger.warn(`Invalid IP/Prefix/Gateway for ${Name} (${Vlan}) address "${row['IP_PRFX_GW']}", skipping...`);
      continue;
    }

    if (Name && !probeNames.includes(Name)) probeNames.push(Name);

    if (Name && Interface) {
      const key = `${Name}-${Vlan}`;
      if (!interfaceByNameVlan[key]) {
        interfaceByNameVlan[key] = {
          Interface,
          hostIP,
          prefix,
          gatewayIP
        };
      }
    }
  }

  const validProbes = probeNames.filter(probe => {
    const hasDTV = interfaceByNameVlan[`${probe}-dtv`];
    const hasDFF = interfaceByNameVlan[`${probe}-dff-a`] || interfaceByNameVlan[`${probe}-dff-b`];
    if (!hasDTV || !hasDFF) {
      logger.warn(`Probe "${probe}" is missing DTV or DFF interfaces, skipping...`);
      return false;
    }
    return true;
  });

  logger.info(`Found ${validProbes.length} valid Probes in unicast sheet`);
  return { probeNames: validProbes, interfaceByNameVlan };
}

// Process profiles sheet
// return a dictionary of audio/video profiles from the profiles sheet
// assume reasonable defaults for sample rate, audio depth, channel order, and ports
function processProfilesSheet(workbook) {
  const sheet = workbook.Sheets['profiles'];
  if (!sheet) throw new Error('⚠️  Error: "profiles" sheet not found, I need some data from it.');

  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) throw new Error('⚠️  Error: "profiles" sheet is empty, I need some data from it.');

  const profiles = {};

  for (const row of json) {
    const profile = row['profile'];
    if (profile) {
      profiles[profile] = {
        profile,
        content: row['content'] || 'aes67',
        audiodepth: row['audiodepth'] || '24',
        channelorder: row['channelorder'] || 'ST',
        audiosr: row['audiosr'] || '48000',
        port_no_a: row['port_no_a'] || '5004',
        port_no_b: row['port_no_b'] || '5004',
      };
    }
  }

  logger.info(`Found ${Object.keys(profiles).length} profiles in profiles sheet`);
  return profiles;
}


module.exports = { parseWorkbook };

