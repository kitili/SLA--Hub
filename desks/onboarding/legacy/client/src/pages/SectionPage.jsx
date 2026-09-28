import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useHubContent } from '../context/HubContentContext';
import { useProgress } from '../hooks/useProgress';
import DocumentCard from '../components/DocumentCard';
import SectionCheckpoint from '../components/SectionCheckpoint';
import './SectionPage.css';

function isItemRead(item, progress) {
  return progress.readItems.includes(item.id);
}

export default function SectionPage() {
  const { sectionId } = useParams();
  const { sections } = useHubContent();
  const { progress } = useProgress();
  const section = sections.find((s) => s.id === sectionId);

  if (!section) {
    return (
      <div className="section-not-found">
        <h2>Section not found</h2>
        <Link to="/">← Back to Dashboard</Link>
      </div>
    );
  }

  const readCount = section.items.filter((item) => isItemRead(item, progress)).length;
  const hasDocs = section.items.length > 0;
  const allItemsRead = hasDocs && readCount === section.items.length;

  return (
    <div className="section-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} />
        Back to Dashboard
      </Link>

      <header className="section-header">
        <img src="/assets/branding/logomark-electric-blue.svg" alt="" className="section-header-logo" aria-hidden="true" />
        <span className="section-header-emoji">{section.icon}</span>
        <div>
          <span className="section-header-num">Section {section.number}</span>
          <h1>{section.title}</h1>
          <p className="section-header-desc">{section.description}</p>
        </div>
      </header>

      <div className="section-progress-bar-wrap">
        <div className="section-progress-label">
          <span>Documents done</span>
          <span>{readCount} / {section.items.length}</span>
        </div>
        <div className="section-progress-bar">
          <div
            className="section-progress-fill"
            style={{ width: `${section.items.length ? (readCount / section.items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="documents-list">
        {section.items.length === 0 ? (
          <div className="section-empty">
            <p>Documents for this section will be added soon.</p>
          </div>
        ) : (
          section.items.map((item, idx) => {
            const prevItem = idx > 0 ? section.items[idx - 1] : null;
            const locked = prevItem ? !isItemRead(prevItem, progress) : false;

            return (
              <DocumentCard
                key={item.id}
                item={item}
                index={idx + 1}
                locked={locked}
              />
            );
          })
        )}
      </div>

      <SectionCheckpoint section={section} itemsComplete={allItemsRead} />
    </div>
  );
}
