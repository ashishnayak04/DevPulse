import '../styles/legal.css';

const Terms = () => {
  return (
    <main className="legal-wrap">
      <a href="/" className="legal-back">&larr; Back</a>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: August 23, 2026</p>

      <h2>Acceptance</h2>
      <p>
        By creating an account or using DevPulse you agree to these terms and our{' '}
        <a href="/landing/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        If you use DevPulse for an organization, you confirm you can bind it to these terms.
      </p>

      <h2>The Service</h2>
      <p>
        DevPulse is an open-source API health monitoring service: it checks your endpoints at
        configured intervals, records results, and sends alerts. The service is provided{' '}
        <strong>as is</strong>; check intervals and alert delivery are best-effort and not
        guaranteed within any specific time frame.
      </p>

      <h2>Your Obligations</h2>
      <ul>
        <li>Provide accurate account information.</li>
        <li>Safeguard your credentials and API keys.</li>
        <li>Only monitor targets you own or have explicit permission to monitor.</li>
        <li>Respect rate limits and check-interval minimums.</li>
      </ul>

      <h2>Prohibited Use</h2>
      <ul>
        <li>Monitoring or attacking third-party systems without authorization.</li>
        <li>Illegal content of any kind.</li>
        <li>Load designed to harm or degrade a target system.</li>
        <li>Circumventing usage limits or security controls.</li>
      </ul>

      <h2>Limitation of Liability</h2>
      <p>
        DevPulse is not liable for indirect or consequential damages, including lost profits
        or missed alerts. The service is provided without warranty of any kind, and uptime is
        not warranted.
      </p>

      <h2>Termination</h2>
      <p>
        You may delete your account at any time from settings. We may suspend accounts that
        violate these terms, with notice where practicable.
      </p>

      <h2>Governing Law &amp; Contact</h2>
      <p className="legal-example">
        Governing law placeholder (replace before production): the laws of India, venue Bengaluru.
      </p>
      <p>
        Questions about these terms? Email{' '}
        <a href="mailto:support@devpulse.example">support@devpulse.example</a>. The full text
        lives at the{' '}
        <a href="/landing/terms.html" target="_blank" rel="noopener noreferrer">
          landing site
        </a>.
      </p>
    </main>
  );
};

export default Terms;
