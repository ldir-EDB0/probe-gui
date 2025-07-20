// pushEngine.js
const fs = require('fs');
const xlsx = require('xlsx');

const { processSheet, processAllSheets, pushConfig } = require('./probeLogic');  

function pushSelected(probe, groups) {
  let allmulticasts = [];

  for (const sheet of groups) {
    const casts = processSheet(sheet, probe);
    if (Array.isArray(casts) && casts.length) {
      allmulticasts.push(...casts);
    }
  }

  if (!allmulticasts.length) {
    return `⚠️ No valid multicasts found for probe “${probe}”.`;
  }

  return pushConfig(probe, allmulticasts).then(result => result.msg);
}


function generateAll(outputDir) {
  return processAllSheets(outputDir).then(result => result.msg);
}


module.exports = { pushSelected, generateAll };

