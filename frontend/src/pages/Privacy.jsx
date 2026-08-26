import '../styles/legal.css';

const Privacy = () => {
  return (
    <main className="legal-wrap">
      <a href="/" className="legal-back">&larr; Back</a>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: August 23, 2026</p>

      <h2>Data We Collect</h2>
      <p>
        We store your account data (email, username, hashed password or OAuth identity), the
        endpoint URLs you configure, and the health-check results those endpoints produce
        (status codes, response times, timestamps). We also keep standard technical logs such
        as IP address and user agent for security purposes. We never read the traffic between
        your services and their clients.
      </p>

      <h2>How We Use Your Data</h2>
      <p>
        Your data is used to run monitoring and alerts, authenticate you, send transactional
        email (alerts, verification, password resets), and prevent abuse. <strong>We never
        sell your data</strong>, and monitoring results stay private unless you publish them
        yourself on a public status page.
      </p>

      <h2>Data Retention</h2>
      <p>
        Ping logs are kept for the retention window of your plan (e.g. 90 days) and then
        permanently purged; aggregate uptime stats remain. Account data is kept while your
        account is active. Deleting your account cascades to all associated data within 30 days.
      </p>

      <h2>Your Rights (GDPR)</h2>
      <p>
        You may access, correct, export (in-app Export feature), or erase your personal data.
        To exercise a right, contact <a href="mailto:support@devpulse.example">support@devpulse.example</a>;
        we respond within 30 days.
      </p>

      <h2>Cookies</h2>
      <p>
        We use an essential authentication cookie so you stay signed in, plus optional
        privacy-friendly analytics cookies that can be declined without losing any feature.
        No advertising cookies or cross-site trackers.
      </p>

      <h2>Third-Party Services</h2>
      <ul>
        <li>Email delivery provider (SMTP) — sends transactional email on our behalf.</li>
        <li>Google / GitHub OAuth — identity exchange only, if you sign in with them.</li>
        <li>PagerDuty — only if you configure the integration yourself.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href="mailto:support@devpulse.example">support@devpulse.example</a>.
        The full policy is available at the{' '}
        <a href="/landing/privacy.html" target="_blank" rel="noopener noreferrer">
          landing site
        </a>.
      </p>
    </main>
  );
};

export default Privacy;
