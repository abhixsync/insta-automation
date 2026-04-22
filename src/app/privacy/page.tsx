export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: April 22, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Overview</h2>
        <p>Insta Automation ("we", "us", "our") operates an Instagram content scheduling and publishing tool. This policy explains what data we collect, how we use it, and your rights regarding your data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Instagram account information</strong>: Instagram user ID, username, obtained via Instagram Business Login (OAuth).</li>
          <li><strong>Access tokens</strong>: Instagram API access tokens, encrypted at rest using AES-256-GCM. Never stored in plaintext.</li>
          <li><strong>Post content</strong>: Image URLs and captions you create or schedule through our platform.</li>
          <li><strong>Usage data</strong>: Post history, publish status, and timestamps.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Meta / Instagram Data Usage</h2>
        <p className="mb-3">We access Instagram data solely through the official Meta Graph API using permissions you explicitly grant. Specifically:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>instagram_business_basic</strong>: To identify your Instagram Business/Creator account.</li>
          <li><strong>instagram_business_content_publish</strong>: To publish posts to your Instagram account on your behalf.</li>
        </ul>
        <p className="mt-3">We do not sell, share, or transfer your Instagram data to third parties. We do not use your data to train AI models. We only use Meta platform data to provide the service you requested.</p>
        <p className="mt-3">We comply with <a href="https://developers.facebook.com/policy/" className="text-purple-600 underline" target="_blank" rel="noopener noreferrer">Meta's Platform Terms</a> and <a href="https://developers.facebook.com/devpolicy/" className="text-purple-600 underline" target="_blank" rel="noopener noreferrer">Developer Policies</a>.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. How We Use Your Data</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Authenticate your Instagram account and maintain your session</li>
          <li>Publish images to Instagram on your behalf when you initiate a post</li>
          <li>Display your post history within the app</li>
        </ul>
        <p className="mt-3">We do not use your data for advertising, profiling, or any purpose beyond operating the service.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data Storage and Security</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>All data is stored in a secured PostgreSQL database (Neon).</li>
          <li>Instagram access tokens are encrypted using AES-256-GCM before storage.</li>
          <li>Connections use TLS/SSL in transit.</li>
          <li>Access tokens are refreshed automatically and expired tokens are invalidated.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
        <p>We retain your data for as long as your account is active. You may request deletion at any time. Upon deletion, all your Instagram tokens, account data, and post history are permanently removed from our systems within 30 days.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Access</strong>: Request a copy of the data we hold about you.</li>
          <li><strong>Deletion</strong>: Request deletion of all your data. See our <a href="/data-deletion" className="text-purple-600 underline">Data Deletion page</a>.</li>
          <li><strong>Revocation</strong>: You can revoke our access to your Instagram account at any time via Instagram Settings → Apps and Websites.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Third-Party Services</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Meta / Instagram Graph API</strong>: For publishing content.</li>
          <li><strong>Pexels</strong>: For stock photo search (your topic query is sent to Pexels).</li>
          <li><strong>Groq / Anthropic</strong>: Your topic is sent to generate search queries and captions. No personal data is included.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
        <p>For privacy questions or data requests, contact us at: <a href="mailto:privacy@insta-automation.app" className="text-purple-600 underline">privacy@insta-automation.app</a></p>
      </section>
    </div>
  );
}
