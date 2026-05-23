const body = JSON.stringify({
  message: "家人住院需要照顾",
  history: [],
  plugin: "leave_approval",
});

const res = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

const text = await res.text();
const lines = text.split('\n');
let eventType = '';
let fullText = '';
let toolEvents = [];
for (const line of lines) {
  if (line.startsWith('event: ')) eventType = line.slice(7);
  if (line.startsWith('data: ')) {
    if (eventType === 'text') {
      fullText += JSON.parse(line.slice(6)).content;
    } else {
      const data = line.slice(6);
      console.log(eventType, data.substring(0, 100));
      toolEvents.push(eventType);
    }
  }
}
console.log('\n=== Text ===');
console.log(fullText.substring(0, 300));
console.log('\n=== Has tool events:', toolEvents.length > 0);