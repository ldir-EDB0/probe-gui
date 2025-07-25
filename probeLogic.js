const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const fetch = require('node-fetch');
const { XMLBuilder } = require('fast-xml-parser');
const sharedState = require('./sharedState');
const logger = require('./logger');

// Build multicast channel object from the passed parameters
// referencing the profile for content, audio depth, sample rate & channel order
function buildMcastChannel(name, source_ip, multicast, port, iface, profile, groups, page, join) {
  return {
    name: name,
    addr: multicast,
    port: port,
    sessionId: "0",
    groups: groups,
    content: profile.content,
    audiodepth: profile.audiodepth,
    audiosr: profile.audiosr,
    channelOrder: profile.channelorder,
    joinIfaceName: iface,
    ssmAddr: source_ip,
    join: join,
    page: page,
    etrEngine: "1",
    extractThumbs: true,
    enableFec: false,
    enableRtcp: true
  };
}

// Process individual sheet and generate multicasts
// returns an array of multicast channel objects for designated probe
function processSheet(sheetName, probe) {
  const workbook = sharedState.get('workbook');
  const interfaceMap = sharedState.get('interfaceMap');
  const profiles = sharedState.get('profiles');

  logger.info(`🔄 Processing sheet: ${sheetName}`);
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (json.length === 0) {
    logger.warn(`⚠️  Skipping empty sheet: ${sheetName}`);
    return null;
  }

  const multicasts = [];
  let skipped = 0;

  for (const row of json) {
    const join = (row['join'] && row['join'].toString().trim().toLowerCase() === 'no') ? false : true;
    if (!join) {
      continue;
    }
    const groups = row['groups'] || '';
    const page = row['page'] || '1';
    const name = row['name'] || '';
    const device = row['device'] || '';
    const profileName = row['profile'] || '';
    const source_ip_a = row['source_ip_a'].toString().trim() || '';
    const multicast_a = row['multicast_a'].toString().trim() || '';
    const vlan_a = row['vlan_a'].toString().trim() || 'dff-a';
    const source_ip_b = row['source_ip_b'].toString().trim() || '';
    const multicast_b = row['multicast_b'].toString().trim() || '';
    const vlan_b = row['vlan_b'].toString().trim() || 'dff-b';

    // Lookup profile data
    const profile = profiles[profileName] || {};
  
    // Get probe interface name for VLAN
    const iface_a = interfaceMap[`${probe}-${vlan_a}`];
    const iface_b = interfaceMap[`${probe}-${vlan_b}`];

    //A leg
    if (iface_a && source_ip_a && multicast_a) {
      const mname = source_ip_b ? `${name}@A` : `${name}`;

      multicasts.push(buildMcastChannel(mname, source_ip_a, multicast_a, profile.port_no_a, iface_a.Interface, profile, groups, page, join));
    }

    //B leg
    if (iface_b && source_ip_b && multicast_b) {
      const mname = source_ip_a ? `${name}@B` : `${name}`;

      multicasts.push(buildMcastChannel(mname, source_ip_b, multicast_b, profile.port_no_b, iface_b.Interface, profile, groups, page, join));
    }

    if (multicast_a && !iface_a) {
      logger.warn(`⚠️  Multicast ${name}: no suitable vlan interface "${vlan_a}" found for probe "${probe}"`);
    }

    if (multicast_b && !iface_b) {
      logger.warn(`⚠️  Multicast ${name}: no suitable vlan interface "${vlan_b}" found for probe "${probe}"`);
    }

    if ((!multicast_a && !multicast_b) || (!source_ip_a && !source_ip_b)) {
      skipped++;
    }
  }

  logger.info(`✅ Sheet "${sheetName}": ${multicasts.length} entries (skipped ${skipped})`);
  return multicasts.length ? multicasts : null;
}

// write XML config for BTech probe
// returns a string of XML containing the multicast channels
// suitable for sending to the probe
function wrapXml(multicasts) {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    suppressBooleanAttributes: false, // you have no idea how long it took to find this option!
  });

  const obj = {
    '?xml': {
      '@_version': '1.0',
    },
    ewe: {
      probe: {
        core: {
          setup: {
            mcastnames: {
              mclist: {
                '@_xmlChildren': 'list',
                mcastChannel: multicasts.map(mc => {
                  const attrs = {};
                  for (const [key, value] of Object.entries(mc)) {
                    attrs[`@_${key}`] = String(value);
                  }
                  return attrs;
                })
              }
            }
          }
        }
      }
    }
  };

  return builder.build(obj);
}


// Write output xml file
// use wrapXml to generate the XML string
// and write it to a file in the specified output directory
function writeConfigFile(outputDir, probe, sheetName, multicasts) {

  const btechxml = wrapXml(multicasts);

  const safeSheetName = sheetName.replace(/[ \\/:*?"<>|]/g, '_');
  const safeprobe = probe.replace(/[ \\/:*?"<>|]/g, '_');
  const probeoutputDir = path.join(outputDir, safeprobe);
  fs.mkdirSync(probeoutputDir, { recursive: true });
  const outputPath = path.join(probeoutputDir, `${safeSheetName}.xml`);

  fs.writeFileSync(outputPath, btechxml);
  logger.info(`💾 Written: ${outputPath}`);
}

// Get the URL for the probe's import/export endpoint
// returns a URL object or null if the interface is not found
// the dtv interface is used for pushing config to the probe
function getProbeUrl(probe) {
  const interfaceMap = sharedState.get('interfaceMap');

  const iface = interfaceMap[`${probe}-dtv`];
  if (!iface) {
    logger.error(`❌ Error: DTV Interface for probe "${probe}" not found.`);
    return null;
  }
  if (!iface.hostIP) {
    logger.error(`❌ Error: Host IP for probe "${probe}" is not defined.`);
    return null;
  }
  return new URL(`http://${iface.hostIP}/probe/core/importExport/data.xml`);
}

// Push config to specified probe
// get the URL for the probe's import/export endpoint, generate the XML from multicasts
// and POST it to the probe
async function pushConfig(probe, multicasts) {
  const probeUrl = getProbeUrl(probe);
  if (!probeUrl) return { ok: false, msg: `No valid interface for probe "${probe}"` };

  const btechxml = wrapXml(multicasts);
  logger.info(`📤 Pushing config to probe ${probe} using URL ${probeUrl}`);

  try {
    const res = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: btechxml,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, msg: `❌ HTTP ${res.status}: ${errorText}` };
    }

    return { ok: true, msg: `✅ Pushed XML config to ${probe}` };
  } catch (err) {
    return { ok: false, msg: `❌ Network error pushing to ${probe}: ${err.message}` };
  }
}


// Process all sheets in the workbook
// for each probe, and for each multicast sheet, generate a config file
// and write it to the output directory
// was async
function processAllSheets(outputDir) {

  // create base output directory if it doesn't exist
  fs.mkdirSync(outputDir, { recursive: true });

  const probes = sharedState.get('probes');
  const groups = sharedState.get('groups');

  for (const sheetName of groups) {
    for (const probe of probes) {
      const multicasts = processSheet(sheetName, probe);

      if (multicasts) writeConfigFile(outputDir, probe, sheetName, multicasts);
    }
  }
  return {ok: true, msg: `Config files generated for ${probes.length} probes × ${groups.length} groups.`};
}

module.exports = {
  processSheet,
  processAllSheets,
  pushConfig,
};

