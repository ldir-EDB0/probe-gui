
function log(level, msg) {
  const logEl = document.getElementById('log');
  const emoji = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌'
  }[level] || '';
  logEl.textContent += `${emoji} ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

window.electronAPI.onLogMessage((level, msg) => {
  log(level, msg);
});

let currentFile = '';

document.getElementById('pushBtn').disabled = true;
document.getElementById('generateAllBtn').disabled = true;

document.getElementById('selectFileBtn').addEventListener('click', async () => {
  const filePath = await window.electronAPI.selectExcelFile();
  if (!filePath) return;

  currentFile = filePath;
  const filename = filePath.split(/[/\\]/).pop(); // handles Windows + POSIX paths
  document.getElementById('selectedFile').innerText = `Loaded: ${filename}`;

  const result = await window.electronAPI.parseExcelFile(filePath);
  if (result.error) {
    alert(`Error: ${result.error}`);
    return;
  }

  const { probes, groups } = result;

  const probeSelect = document.getElementById('probeSelect');
  probeSelect.innerHTML = '<option value="" disabled selected>-- Select a probe --</option>';

  probes.forEach(probe => {
    const option = document.createElement('option');
    option.value = probe;
    option.textContent = probe;
    probeSelect.appendChild(option);
  });

  const groupList = document.getElementById('groupList');
  groupList.innerHTML = groups.map(g =>
    `<label><input type="checkbox" value="${g}"> ${g}</label>`
  ).join('');

  document.getElementById('generateAllBtn').disabled = false;
});

document.getElementById('probeSelect').addEventListener('change', () => {
  const selected = document.getElementById('probeSelect').value;
  document.getElementById('pushBtn').disabled = !selected;
});

document.getElementById('pushBtn').addEventListener('click', async () => {
  if (!currentFile) return alert('Please select an Excel file.');
  const probe = document.getElementById('probeSelect').value;
  const groups = Array.from(
    document.querySelectorAll('#groupList input:checked')
  ).map(cb => cb.value);

  if (!probe) return alert('Select a probe.');
  if (!groups.length) return alert('Select at least one group.');

  log('info', `📤 Pushing to probe: ${probe}...`);
  const res = await window.electronAPI.pushSelected(
    probe,
    groups,
  );
  log('info', res.msg || JSON.stringify(res));
});

document.getElementById('generateAllBtn').addEventListener('click', async () => {
  if (!currentFile) return alert('Please select an Excel file.');
  const res = await window.electronAPI.generateAll();
  log('info', res.msg || JSON.stringify(res));
});