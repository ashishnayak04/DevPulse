/* ============================================================
   DevPulse — Terminal Typing Effect
   Types out a curl command and JSON response in the hero
   ============================================================ */

(function () {
  'use strict';

  const terminalBody = document.getElementById('terminalBody');
  if (!terminalBody) return;

  // Terminal content — each item is { text, class, delay (ms before next) }
  const lines = [
    { text: '$ ', cls: 'terminal__prompt', delay: 0 },
    { text: 'curl -s https://api.example.com/health | jq', cls: 'terminal__command', delay: 40, typing: true },
    { text: '\n', cls: '', delay: 400 },
    { text: '{', cls: 'terminal__bracket', delay: 80 },
    { text: '\n', cls: '', delay: 50 },
    { text: '  ', cls: '', delay: 0 },
    { text: '"status"', cls: 'terminal__key', delay: 60 },
    { text: ': ', cls: 'terminal__bracket', delay: 30 },
    { text: '"UP"', cls: 'terminal__string', delay: 80 },
    { text: ',', cls: 'terminal__bracket', delay: 50 },
    { text: '\n', cls: '', delay: 50 },
    { text: '  ', cls: '', delay: 0 },
    { text: '"responseTime"', cls: 'terminal__key', delay: 60 },
    { text: ': ', cls: 'terminal__bracket', delay: 30 },
    { text: '"42ms"', cls: 'terminal__number', delay: 80 },
    { text: ',', cls: 'terminal__bracket', delay: 50 },
    { text: '\n', cls: '', delay: 50 },
    { text: '  ', cls: '', delay: 0 },
    { text: '"uptime"', cls: 'terminal__key', delay: 60 },
    { text: ': ', cls: 'terminal__bracket', delay: 30 },
    { text: '"99.97%"', cls: 'terminal__string', delay: 80 },
    { text: ',', cls: 'terminal__bracket', delay: 50 },
    { text: '\n', cls: '', delay: 50 },
    { text: '  ', cls: '', delay: 0 },
    { text: '"checkedAt"', cls: 'terminal__key', delay: 60 },
    { text: ': ', cls: 'terminal__bracket', delay: 30 },
    { text: '"' + new Date().toISOString().slice(0, 19) + 'Z"', cls: 'terminal__string', delay: 80 },
    { text: '\n', cls: '', delay: 50 },
    { text: '}', cls: 'terminal__bracket', delay: 100 },
  ];

  // Create a cursor element
  const cursor = document.createElement('span');
  cursor.className = 'terminal__cursor';

  let currentLine = 0;
  let currentChar = 0;

  function typeChar() {
    if (currentLine >= lines.length) {
      // Done typing — add blinking cursor at end
      terminalBody.appendChild(cursor);
      return;
    }

    const line = lines[currentLine];

    if (line.text === '\n') {
      terminalBody.appendChild(document.createElement('br'));
      currentLine++;
      currentChar = 0;
      setTimeout(typeChar, line.delay);
      return;
    }

    if (line.typing && currentChar < line.text.length) {
      // Type character by character
      if (currentChar === 0 && line.cls) {
        // Create the span container
        const span = document.createElement('span');
        span.className = line.cls;
        span.dataset.lineIdx = currentLine;
        terminalBody.appendChild(span);
      }

      const container = line.cls
        ? terminalBody.querySelector(`[data-line-idx="${currentLine}"]`)
        : terminalBody;

      container.textContent += line.text[currentChar];
      currentChar++;

      // Move cursor
      if (cursor.parentNode) cursor.remove();
      terminalBody.appendChild(cursor);

      setTimeout(typeChar, line.delay);
    } else if (!line.typing) {
      // Print entire chunk at once
      if (line.text.trim() === '' && !line.cls) {
        // Just whitespace
        terminalBody.appendChild(document.createTextNode(line.text));
      } else {
        const span = document.createElement('span');
        span.className = line.cls;
        span.textContent = line.text;

        // Special glow for certain values
        if (line.text === '"UP"') {
          span.style.textShadow = '0 0 10px rgba(34,211,238,0.5)';
          span.style.fontWeight = '600';
        }
        if (line.text.includes('42ms')) {
          span.style.textShadow = '0 0 8px rgba(96,165,250,0.4)';
        }

        terminalBody.appendChild(span);
      }

      currentLine++;
      currentChar = 0;

      if (cursor.parentNode) cursor.remove();
      terminalBody.appendChild(cursor);

      setTimeout(typeChar, line.delay);
    } else {
      // Finished typing this line
      currentLine++;
      currentChar = 0;
      setTimeout(typeChar, 200);
    }
  }

  // Start typing after a delay (wait for preloader to finish)
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(typeChar, 2400); // After preloader
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(terminalBody);
})();
