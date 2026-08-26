/* ============================================================
   DevPulse — Live Demo Simulation
   Simulates an endpoint monitor cycling through health checks
   with a real-time chart drawn on canvas
   ============================================================ */

(function () {
  'use strict';

  const demoCard = document.getElementById('demoCard');
  const statusDot = document.getElementById('demoStatusDot');
  const statusText = document.getElementById('demoStatusText');
  const statusLabel = document.getElementById('demoStatusLabel');
  const uptimeEl = document.getElementById('demoUptime');
  const latencyEl = document.getElementById('demoLatency');
  const checksEl = document.getElementById('demoChecks');
  const lastCheckEl = document.getElementById('demoLastCheck');
  const canvas = document.getElementById('demoChart');

  if (!canvas || !demoCard) return;

  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;

  // ── State ──
  const MAX_POINTS = 40;
  let dataPoints = [];
  let checkCount = 1440;
  let isDown = false;
  let downCountdown = 0;
  let animationStarted = false;
  let animationId = null;

  // Pre-fill some data
  for (let i = 0; i < 25; i++) {
    dataPoints.push({
      value: 30 + Math.random() * 40,
      isUp: true
    });
  }

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
  }

  function drawChart() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    if (dataPoints.length < 2) return;

    const padding = { top: 10, bottom: 10, left: 5, right: 5 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Find value range
    const values = dataPoints.map(p => p.value);
    const minVal = Math.max(0, Math.min(...values) - 10);
    const maxVal = Math.max(...values) + 20;
    const range = maxVal - minVal || 1;

    const stepX = chartW / (MAX_POINTS - 1);

    // Draw gradient fill
    const startIdx = Math.max(0, dataPoints.length - MAX_POINTS);
    const visiblePoints = dataPoints.slice(startIdx);

    ctx.beginPath();
    visiblePoints.forEach((point, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - ((point.value - minVal) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Close the fill path
    const lastX = padding.left + (visiblePoints.length - 1) * stepX;
    ctx.lineTo(lastX, h);
    ctx.lineTo(padding.left, h);
    ctx.closePath();

    const lastPoint = visiblePoints[visiblePoints.length - 1];
    const fillColor = lastPoint.isUp
      ? 'rgba(34, 211, 238, 0.08)'
      : 'rgba(248, 113, 113, 0.08)';

    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    visiblePoints.forEach((point, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - ((point.value - minVal) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    const strokeColor = lastPoint.isUp ? '#22D3EE' : '#F87171';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw endpoint dot (latest)
    const latestY = padding.top + chartH - ((lastPoint.value - minVal) / range) * chartH;
    ctx.beginPath();
    ctx.arc(lastX, latestY, 4, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();

    // Glow on the latest dot
    ctx.beginPath();
    ctx.arc(lastX, latestY, 8, 0, Math.PI * 2);
    ctx.fillStyle = lastPoint.isUp
      ? 'rgba(34, 211, 238, 0.2)'
      : 'rgba(248, 113, 113, 0.2)';
    ctx.fill();
  }

  function setStatus(up) {
    isDown = !up;

    if (up) {
      statusDot.className = 'status-dot status-dot--up';
      statusText.className = 'demo__status demo__status--up';
      statusLabel.textContent = 'UP';
      uptimeEl.className = 'demo__stat-value demo__stat-value--accent';
    } else {
      statusDot.className = 'status-dot status-dot--down';
      statusText.className = 'demo__status demo__status--down';
      statusLabel.textContent = 'DOWN';
      uptimeEl.className = 'demo__stat-value demo__stat-value--danger';
    }
  }

  function addCheck() {
    checkCount++;

    // Decide if this check should fail
    // Pattern: ~12 checks UP, then 4 DOWN, then recover
    if (downCountdown > 0) {
      // Currently in a DOWN episode
      downCountdown--;
      const val = 0;
      dataPoints.push({ value: val, isUp: false });

      if (downCountdown <= 0) {
        // Recovery
        setStatus(true);
      } else if (downCountdown <= 1) {
        // About to recover — show a spike
        dataPoints[dataPoints.length - 1].value = 200 + Math.random() * 100;
        dataPoints[dataPoints.length - 1].isUp = true;
        setStatus(true);
        downCountdown = 0;
      }
    } else {
      // Normal UP check
      if (Math.random() < 0.06) {
        // Trigger a DOWN episode (3-5 consecutive failures)
        downCountdown = 3 + Math.floor(Math.random() * 3);
        setStatus(false);
        dataPoints.push({ value: 0, isUp: false });
      } else {
        const baseLatency = 35 + Math.random() * 30;
        const jitter = (Math.random() - 0.5) * 15;
        dataPoints.push({ value: Math.max(10, baseLatency + jitter), isUp: true });
      }
    }

    // Keep only last MAX_POINTS * 2 for memory
    if (dataPoints.length > MAX_POINTS * 2) {
      dataPoints = dataPoints.slice(-MAX_POINTS);
    }

    // Update stats
    const recent = dataPoints.slice(-30);
    const upChecks = recent.filter(p => p.isUp).length;
    const uptime = ((upChecks / recent.length) * 100).toFixed(1);
    uptimeEl.textContent = uptime + '%';

    const upLatencies = recent.filter(p => p.isUp && p.value > 0).map(p => p.value);
    if (upLatencies.length > 0) {
      const avgLatency = Math.round(upLatencies.reduce((a, b) => a + b, 0) / upLatencies.length);
      latencyEl.textContent = avgLatency + 'ms';
    } else {
      latencyEl.textContent = '—';
    }

    checksEl.textContent = checkCount.toLocaleString();
    lastCheckEl.textContent = 'just now';

    drawChart();
  }

  function startSimulation() {
    if (animationStarted) return;
    animationStarted = true;

    resizeCanvas();
    drawChart();

    // Add a new check every 2 seconds
    setInterval(addCheck, 2000);
  }

  // Resize handler
  window.addEventListener('resize', () => {
    if (animationStarted) {
      dpr = window.devicePixelRatio || 1;
      resizeCanvas();
      drawChart();
    }
  });

  // Start when the demo section scrolls into view
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startSimulation();
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(demoCard);
})();
