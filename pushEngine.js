// pushEngine.js
const fs = require('fs');
const xlsx = require('xlsx');
const { parseWorkbook } = require('./excelParser');

const { processSheet, processAllSheets, pushConfig } = require('./probeLogic');  

function pushSelected(filePath, probe, groups, interfaceMap, profiles) {
  const workbook = xlsx.readFile(filePath);

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


async function generateAll(filePath, outputDir) {
  const workbook = xlsx.readFile(filePath);
  const { probes, groups, interfaceByNameVlan, profiles } = parseWorkbook(filePath);

  processAllSheets(workbook, groups, probes, interfaceByNameVlan, profiles, outputDir);
  return `Config files generated for ${probes.length} probes × ${groups.length} groups.`;
}


module.exports = { pushSelected, generateAll };

