export default function DataDeletion() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Data Deletion Request</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: April 22, 2026</p>

      <section className="mb-8">
        <p className="mb-4">
          You can request deletion of all data associated with your Instagram account at any time. This includes your connected account, access tokens, and post history.
        </p>
        <p className="mb-4">
          You can also revoke our access directly from Instagram: <strong>Instagram → Settings → Apps and Websites → Insta Automation → Remove</strong>. When you revoke access via Instagram, we automatically delete your data within 30 days.
        </p>
      </section>

      <section className="mb-8 bg-purple-50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Request Manual Deletion</h2>
        <p className="text-sm text-gray-600 mb-4">
          Email us at{' '}
          <a href="mailto:privacy@insta-automation.app" className="text-purple-600 underline">
            privacy@insta-automation.app
          </a>{' '}
          with the subject line <strong>"Data Deletion Request"</strong> and include your Instagram username. We will confirm deletion within 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">What gets deleted</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>Your Instagram account connection and encrypted access token</li>
          <li>All post records and history</li>
          <li>Any other data associated with your account</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Automated deletion callback</h2>
        <p className="text-sm text-gray-600">
          Meta may send automated data deletion requests to our callback endpoint at{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">/api/data-deletion</code>.
          These are processed automatically and immediately.
        </p>
      </section>
    </div>
  );
}
