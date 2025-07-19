// pushEngine.js
const fs = require('fs');
const xlsx = require('xlsx');

const { processSheet, processAllSheets, pushConfig } = require('./probeLogic');  

function pushSelected(workbook, probe, groups, interfaceMap, profiles) {
  let allmulticasts = [];

  for (const sheet of groups) {
    const casts = processSheet(workbook, sheet, probe, interfaceMap, profiles);
    if (Array.isArray(casts) && casts.length) {
      allmulticasts.push(...casts);
    }
  }

  if (!allmulticasts.length) {
    return `⚠️ No valid multicasts found for probe “${probe}”.`;
  }

  return pushConfig(interfaceMap, probe, allmulticasts).then(result => result.msg);
}


async function generateAll(workbook, probes, groups, interfaceByNameVlan, profiles, outputDir) {
  processAllSheets(workbook, groups, probes, interfaceByNameVlan, profiles, outputDir);
  return `Config files generated for ${probes.length} probes × ${groups.length} groups.`;
}


module.exports = { pushSelected, generateAll };

