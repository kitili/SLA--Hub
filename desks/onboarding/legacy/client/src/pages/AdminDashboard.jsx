import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle, Clock, FileText, Trash2, Plus } from 'lucide-react';
import { api } from '../utils/api';
import { useStaff } from '../context/StaffContext';
import { useAdmin } from '../context/AdminContext';
import { useHubContent } from '../context/HubContentContext';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { staff, loading: staffLoading } = useStaff();
  const { pin, pinVerified, openPinPrompt } = useAdmin();
  const { refresh: refreshHub } = useHubContent();
  const [tab, setTab] = useState('progress');
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Add document form
  const [sectionId, setSectionId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!staff?.id || !pin) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.adminOverview(staff.id, pin));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [staff?.id, pin]);

  const loadContent = useCallback(async () => {
    if (!staff?.id || !pin) return;
    try {
      const res = await api.adminGetContent(staff.id, pin);
      setContent(res.sections);
    } catch (err) {
      setError(err.message);
    }
  }, [staff?.id, pin]);

  useEffect(() => {
    if (pinVerified) {
      loadProgress();
      loadContent();
    }
  }, [pinVerified, loadProgress, loadContent]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!file || !sectionId || !title.trim()) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('sectionId', sectionId);
      fd.append('title', title.trim());
      fd.append('file', file);
      await api.adminAddItem(staff.id, pin, fd);
      setTitle('');
      setFile(null);
      e.target.reset();
      await loadContent();
      await refreshHub();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (itemId, itemTitle) => {
    if (!confirm(`Remove "${itemTitle}" from the hub?`)) return;
    try {
      await api.adminRemoveItem(staff.id, pin, itemId);
      await loadContent();
      await refreshHub();
    } catch (err) {
      setError(err.message);
    }
  };

  if (staffLoading) return <div className="app-loading">Loading…</div>;
  if (!staff) return null;

  if (!pinVerified) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <h1>Admin PIN required</h1>
          <p>Enter your PIN to access the admin dashboard.</p>
          <button type="button" className="admin-refresh" onClick={openPinPrompt}>Enter PIN</button>
          <Link to="/" className="admin-back">← Back to hub</Link>
        </div>
      </div>
    );
  }

  const sections = content || [];

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="admin-back-link"><ArrowLeft size={18} /> Hub</Link>
        <h1>Admin Dashboard</h1>
        <span className="admin-signed-in">{staff.full_name}</span>
      </header>

      <div className="admin-tabs">
        <button type="button" className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          Staff progress
        </button>
        <button type="button" className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}>
          Manage documents
        </button>
      </div>

      {error && <p className="admin-error-banner">{error}</p>}

      {tab === 'progress' && (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <Users size={22} />
              <div>
                <span className="stat-num">{data?.staffCount ?? 0}</span>
                <span className="stat-label">Staff registered</span>
              </div>
            </div>
            <div className="admin-stat">
              <CheckCircle size={22} />
              <div>
                <span className="stat-num">{data?.completedCount ?? 0}</span>
                <span className="stat-label">Fully completed</span>
              </div>
            </div>
            <div className="admin-stat">
              <Clock size={22} />
              <div>
                <span className="stat-num">{data?.totalCheckpoints ?? '—'}</span>
                <span className="stat-label">Checkpoints total</span>
              </div>
            </div>
          </div>
          <button type="button" className="admin-refresh" onClick={loadProgress} disabled={loading} style={{ marginBottom: '1rem' }}>
            Refresh
          </button>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Progress</th>
                  <th>Checkpoints</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.staff ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.full_name}</td>
                    <td>{s.email}</td>
                    <td>
                      <div className="admin-progress-bar">
                        <div className="admin-progress-fill" style={{ width: `${s.completion_pct}%` }} />
                      </div>
                      <span className="admin-pct">{s.completion_pct}%</span>
                    </td>
                    <td>{s.checkpoints_passed} / {data?.totalCheckpoints}</td>
                    <td>
                      <span className={`status-pill ${s.complete ? 'done' : 'pending'}`}>
                        {s.complete ? 'Complete' : 'In progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'docs' && (
        <div className="admin-docs-panel">
          <form className="admin-add-form" onSubmit={handleAdd}>
            <h3><Plus size={18} /> Add document</h3>
            <div className="admin-add-row">
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                <option value="">Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>Section {s.number}: {s.title}</option>
                ))}
              </select>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" required />
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              <button type="submit" className="admin-refresh" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Add'}
              </button>
            </div>
          </form>

          {sections.map((section) => (
            <div key={section.id} className="admin-section-block">
              <h3>{section.icon} Section {section.number}: {section.title}</h3>
              <ul className="admin-doc-list">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <FileText size={16} />
                    <span className="admin-doc-title">{item.title}</span>
                    <span className="admin-doc-file">{item.files?.[0]}</span>
                    <button type="button" className="admin-doc-remove" onClick={() => handleRemove(item.id, item.title)} title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
