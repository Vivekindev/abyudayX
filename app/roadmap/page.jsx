import { PhaseCards, RoadmapTotal } from '../../components/Roadmap';
import { loadContent, phaseSummaries } from '../../lib/content.mjs';

export const metadata = { title: 'Roadmap · System Design Manual' };

export default function Page() {
  const phases = phaseSummaries(loadContent().roadmap);
  return (
    <div className="wrap" style={{ maxWidth: 940 }}>
      <div className="eyebrow">// your original 12 phases + fintech + LLD</div>
      <h1 className="page-title">System Design Roadmap</h1>
      <p className="lede">Every topic from your original roadmap, now with an explanation you can read, plus an "in the interview" tip and a video link. Open a phase, read it top to bottom, and tick topics off as you go.</p>
      <RoadmapTotal ids={phases.flatMap(p => p.topicIds)} />
      <div style={{ height: 20 }} />
      <PhaseCards phases={phases} />
    </div>
  );
}
