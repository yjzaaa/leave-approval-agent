// Test expense
const body = JSON.stringify({
  message: "报销差旅费500元",
  history: [],
  plugin: "expense_approval",
});

const res = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

const text = await res.text();
const lines = text.split('\n');
let eventType = '';
for (const line of lines) {
  if (line.startsWith('event: ')) eventType = line.slice(7);
  if (line.startsWith('data: ') && eventType !== 'text') {
    console.log(eventType, line.slice(6));
  }
}