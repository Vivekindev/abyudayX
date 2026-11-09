import { ItemGrid } from '../../components/ItemTools';
import { loadContent, meta } from '../../lib/content.mjs';

export const metadata = { title: 'Low-Level Design · System Design Manual' };

export default function Page() {
  const { items } = loadContent();
  return (
    <div className="wrap">
      <div className="eyebrow">// low-level design · Java</div>
      <h1 className="page-title">Low-Level Design</h1>
      <p className="lede">Banks and fintechs in Bangalore (JPMorgan, Morgan Stanley, Visa, Goldman, PhonePe, Razorpay) often have an LLD or machine-coding round alongside HLD. Do the foundations first, then the problems.</p>
      <h2 className="section-h">Foundations</h2>
      <ItemGrid items={items.filter(i => i.module === 'lld' && i.type === 'lesson').map(meta)} />
      <h2 className="section-h">Problems</h2>
      <ItemGrid items={items.filter(i => i.type === 'lld').map(meta)} />
    </div>
  );
}
