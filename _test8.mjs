// Quick test — just check events for both plugins
async function testPlugin(pluginId, msg) {
  const body = JSON.stringify({ message: msg, history: [], plugin: pluginId });
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const text = await res.text();
  const events = [...new Set(
    text.split('\n')
      .filter(l => l.startsWith('event: '))
      .map(l => l.slice(7))
  )];
  console.log(`${pluginId}: ${events.join(', ')}`);
}

await testPlugin('expense_approval', '报销差旅费500元');