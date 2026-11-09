import { PlanList } from '../../components/ItemTools';
import { loadContent, meta } from '../../lib/content.mjs';

export const metadata = { title: 'Day-by-day plan · System Design Manual' };

export default function Page() {
  const { items } = loadContent();
  return (
    <div className="wrap" style={{ maxWidth: 860 }}>
      <div className="eyebrow">// {items.length} days · ~1 hour a day</div>
      <h1 className="page-title">Day-by-day plan</h1>
      <p className="lede">Ordered so that each case study comes right after the lessons it needs. Interview in less than 4 weeks? Do the ⭐ days first. LLD round coming up soon? Start Week 8 in parallel.</p>
      <PlanList items={items.map(meta)} />
    </div>
  );
}
