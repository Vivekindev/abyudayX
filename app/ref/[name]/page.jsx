import Prose from '../../../components/Prose';
import { loadContent, renderPage } from '../../../lib/content.mjs';

export const dynamicParams = false;
export async function generateStaticParams() {
  return Object.keys(loadContent().pages).map(name => ({ name }));
}

export default function Page({ params }) {
  const { html, toc } = renderPage(loadContent().pages[params.name]);
  return (
    <div className="reader">
      <article><Prose html={html} /></article>
      {toc.length > 2 && <aside className="toc"><b>On this page</b>{toc.map(h => <a key={h.id} href={`#${h.id}`}>{h.text}</a>)}</aside>}
    </div>
  );
}
