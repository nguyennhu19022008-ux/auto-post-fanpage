/**
 * Machine Code Deduplication Utility
 * Normalizes codes and removes duplicates, always keeping the newest item.
 */

function normalizeMachineCode(code) {
  if (!code) return '';
  let str = String(code).trim().toUpperCase();
  // Remove prefix "MÃ", "MA", "CODE", "#"
  str = str.replace(/^(MÃ|MA|CODE|#)\s*:?\s*/i, '');
  return str.trim();
}

function isValidMachineCode(code) {
  const norm = normalizeMachineCode(code);
  if (!norm) return false;
  const genericWords = ['MÁY', 'MAY', 'LAPTOP', 'KHÔNG', 'NONE', 'UNKNOWN', 'NULL'];
  if (genericWords.includes(norm)) return false;
  return norm.length >= 2;
}

function deduplicateItemsByCode(items) {
  const map = new Map();
  const replacedCodes = [];

  items.forEach((item, idx) => {
    const norm = normalizeMachineCode(item.machineCode);
    if (isValidMachineCode(norm)) {
      if (map.has(norm)) {
        if (!replacedCodes.includes(norm)) replacedCodes.push(norm);
      }
      map.set(norm, item); // latest overwrites earlier
    } else {
      map.set(`idx_${idx}_${Date.now()}`, item);
    }
  });

  return {
    dedupedItems: Array.from(map.values()),
    replacedCount: replacedCodes.length,
    replacedCodes
  };
}

module.exports = {
  normalizeMachineCode,
  isValidMachineCode,
  deduplicateItemsByCode
};
