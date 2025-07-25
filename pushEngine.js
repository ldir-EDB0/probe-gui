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
    return {ok: false, msg: `⚠️ No valid multicasts found for probe “${probe}”.` };
  }

  return pushConfig(probe, allmulticasts);
}

function generateAll(outputDir) {
  return processAllSheets(outputDir);
}

module.exports = { pushSelected, generateAll };

