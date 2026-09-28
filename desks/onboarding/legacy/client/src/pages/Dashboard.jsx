import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useHubContent } from '../context/HubContentContext';
import { getSectionCheckpointIds } from '../data/checkpoints';
import { useProgress } from '../hooks/useProgress';
import { brand } from '../data/brand';
import SearchBar from '../components/SearchBar';
import './Dashboard.css';

function SectionCard({ section, progress }) {
  const sectionCheckpointId = `section-${section.id}`;

  const itemsRead = section.items.filter((item) =>
    progress.readItems.includes(item.id)
  ).length;

  const sectionQuizDone = progress.passedCheckpoints.includes(sectionCheckpointId);
  const hasDocs = section.items.length > 0;
  const totalSteps = hasDocs ? section.items.length + 1 : 0;
  const doneSteps = hasDocs ? itemsRead + (sectionQuizDone ? 1 : 0) : 0;
  const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <Link to={`/section/${section.id}`} className="section-card">
      <div className="section-card-header">
        <span className="section-emoji">{section.icon}</span>
        <div>
          <span className="section-num">Section {section.number}</span>
          <h3 className="section-name">{section.title}</h3>
        </div>
      </div>
      <p className="section-desc">{section.description}</p>
      <p className="section-doc-count">
        {hasDocs ? `${section.items.length} documents · 1 checkpoint` : 'Documents coming soon'}
      </p>
      <div className="section-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-text">{pct}% complete</span>
      </div>
      <span className="section-link">
        Start section <ArrowRight size={16} />
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { sections } = useHubContent();
  const { progress } = useProgress();
  const sectionIds = getSectionCheckpointIds();

  const sectionPassed = sectionIds.filter((id) => progress.passedCheckpoints.includes(id)).length;
  const totalCheckpoints = sectionIds.length;
  const pct = totalCheckpoints ? Math.round((sectionPassed / totalCheckpoints) * 100) : 0;

  return (
    <div className="dashboard">
      <section className="hero">
        <img
          src={brand.logos.logomarkWhite}
          alt=""
          className="hero-watermark"
          aria-hidden="true"
        />
        <div className="hero-content">
          <img
            src={brand.logos.brandmarkTaglineWhite}
            alt={brand.name}
            className="hero-brandmark"
          />
          <p className="hero-tagline">{brand.tagline}</p>
          <h1>Staff Onboarding Hub</h1>
          <p className="hero-sub">
            Read each document in order and press <strong>Mark as done</strong> when finished.
            Then pass one checkpoint question at the end of each section.
            If you don't pass, re-read the materials and try again.
          </p>
          <SearchBar />
        </div>
        <div className="hero-accent" />
      </section>

      <div className="overall-progress">
        <div className="overall-header">
          <h2>Your Onboarding Progress</h2>
          <span className="overall-pct">{pct}%</span>
        </div>
        <div className="overall-bar">
          <div className="overall-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="overall-note">
          {sectionPassed} of {totalCheckpoints} section checkpoints completed
        </p>
      </div>

      <section className="start-here">
        <h2>Start Here</h2>
        <div className="start-cards">
          <Link to="/section/welcome" className="start-card featured">
            <span className="start-icon">👋</span>
            <div>
              <h3>Welcome & About Us</h3>
              <p>Watch the CEO video, meet the team, and learn our mission</p>
            </div>
            <ArrowRight size={20} />
          </Link>
          <Link to="/section/digital-tools" className="start-card">
            <span className="start-icon">💻</span>
            <div>
              <h3>Set Up Your Tools</h3>
              <p>Google, Slack, Classroom & your first week checklist</p>
            </div>
            <ArrowRight size={20} />
          </Link>
          <Link to="/section/policies" className="start-card">
            <span className="start-icon">📋</span>
            <div>
              <h3>Read Key Policies</h3>
              <p>Handbook, HR policy, child protection & more</p>
            </div>
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="all-sections">
        <h2>All Sections</h2>
        <div className="sections-grid">
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} progress={progress} />
          ))}
        </div>
      </section>
    </div>
  );
}
