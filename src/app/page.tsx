'use client';

import { useState, useEffect, useCallback } from 'react';

interface Account {
  id: string;
  igUserId: string;
  username: string;
  status: string;
  connectedAt: string;
}

interface Post {
  id: string;
  imageUrl: string;
  caption: string;
  mediaId: string | null;
  permalink: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  igAccount: { username: string };
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [topic, setTopic] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [findingImage, setFindingImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [accRes, postsRes] = await Promise.all([
      fetch('/api/ig/accounts'),
      fetch('/api/ig/posts'),
    ]);
    const accData = await accRes.json();
    const postsData = await postsRes.json();
    const accs: Account[] = accData.accounts ?? [];
    setAccounts(accs);
    setPosts(postsData.posts ?? []);
    setSelectedAccountId((prev) => (accs.find((a) => a.id === prev) ? prev : accs[0]?.id ?? ''));
  }, []);

  useEffect(() => {
    // Show feedback from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1')
      setMessage({ type: 'success', text: 'Instagram account connected!' });
    if (params.get('error'))
      setMessage({ type: 'error', text: `Connection failed: ${params.get('error')}` });
    window.history.replaceState({}, '', '/');

    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    const res = await fetch('/api/ig/connect');
    const { url } = await res.json();
    window.location.href = url;
  };

  const handleFindImage = async () => {
    if (!topic.trim()) return;
    setFindingImage(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/ig/generate?topic=${encodeURIComponent(topic)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No images found');
      setImageUrl(data.imageUrl);
      if (data.caption) setCaption(data.caption);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to fetch image' });
    } finally {
      setFindingImage(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/ig/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove account');
      await loadData();
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove account' });
    } finally {
      setRemovingId(null);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !imageUrl) return;
    setPosting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ig/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId, imageUrl, caption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Post failed');
      setMessage({ type: 'success', text: `Posted! ${data.permalink}` });
      setImageUrl('');
      setCaption('');
      loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Post failed' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Instagram Automation</h1>

      {/* Accounts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Connected Accounts</h2>
          <button
            onClick={handleConnect}
            className="text-sm px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90"
          >
            + Connect Account
          </button>
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400">No accounts connected yet.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {a.username[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">@{a.username}</p>
                  <p className="text-xs text-gray-400 capitalize">{a.status}</p>
                </div>
                <button
                  onClick={() => handleRemove(a.id)}
                  disabled={removingId === a.id}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  {removingId === a.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Post form */}
      {accounts.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Post an Image</h2>
          <form
            onSubmit={handlePost}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFindImage())}
                  placeholder="e.g. technology, coffee, nature"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button
                  type="button"
                  onClick={handleFindImage}
                  disabled={findingImage || !topic.trim()}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                >
                  {findingImage ? 'Finding…' : 'Find Image'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              {imageUrl && (
                <div className="mb-2 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="w-full h-48 object-cover rounded-lg bg-gray-100"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-black/70"
                  >
                    ✕
                  </button>
                </div>
              )}
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <p className="text-xs text-gray-400 mt-1">
                Auto-filled by Pexels, or paste any public HTTPS image URL.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={2200}
                placeholder="Write a caption..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <p className="text-xs text-gray-400 text-right">{caption.length}/2200</p>
            </div>

            {message && (
              <div
                className={`text-sm px-3 py-2 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={posting || !imageUrl}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {posting ? 'Posting…' : 'Post to Instagram'}
            </button>
          </form>
        </section>
      )}

      {/* Recent posts */}
      {posts.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Recent Posts</h2>
          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageUrl}
                  alt="post thumbnail"
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">@{post.igAccount.username}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        post.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : post.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="text-sm text-gray-700 truncate">{post.caption}</p>
                  )}
                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-500 hover:underline"
                    >
                      View on Instagram →
                    </a>
                  )}
                  {post.error && (
                    <p className="text-xs text-red-500 truncate">{post.error}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
