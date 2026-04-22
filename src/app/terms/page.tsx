export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: April 22, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Acceptance</h2>
        <p>By using Insta Automation, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>You must be 13 years or older to use this service.</li>
          <li>You must have a valid Instagram Business or Creator account.</li>
          <li>You must comply with Instagram's Terms of Use and Community Guidelines.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. What the Service Does</h2>
        <p>Insta Automation allows you to connect your Instagram Business/Creator account and publish image posts using the official Meta Graph API. The service uses Pexels for stock images and AI tools to suggest captions.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Prohibited Activities</h2>
        <p className="mb-3">You may not use this service to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Post content that violates Instagram's Community Guidelines or Terms of Use.</li>
          <li>Spam, harass, or post misleading content.</li>
          <li>Attempt to circumvent Instagram's rate limits or platform restrictions.</li>
          <li>Use the service for any illegal purpose.</li>
          <li>Reverse engineer, scrape, or misuse the application.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Your Content</h2>
        <p>You are solely responsible for the content you post through this service. You represent that you have all necessary rights to any images or text you publish. We do not review or endorse any content you post.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. API Usage and Rate Limits</h2>
        <p>This service uses the Meta Graph API, which enforces rate limits (100 posts per 24 hours per Instagram account, 200 API calls per hour). We enforce these limits on your behalf. Attempting to circumvent them may result in account suspension by Meta.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Disclaimers</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>The service is provided "as is" without warranties of any kind.</li>
          <li>We are not responsible for Instagram API downtime, rate limit changes, or account actions taken by Meta.</li>
          <li>AI-generated captions are suggestions only — review before posting.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
        <p>We reserve the right to suspend or terminate access to the service at any time for violations of these terms. You may disconnect your Instagram account and stop using the service at any time.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Changes</h2>
        <p>We may update these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
        <p>Questions about these terms: <a href="mailto:legal@insta-automation.app" className="text-purple-600 underline">legal@insta-automation.app</a></p>
      </section>
    </div>
  );
}
