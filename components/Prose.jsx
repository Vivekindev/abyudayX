'use client';
// Renders pre-built HTML and turns ```mermaid blocks into diagrams (re-drawn on theme change).
import { useEffect, useRef } from 'react';

export default function Prose({ html }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    root.querySelectorAll('pre > code.language-mermaid').forEach(code => {
      const div = document.createElement('div');
      div.className = 'mermaid'; div.dataset.src = code.textContent;
      code.parentElement.replaceWith(div);
    });
    const nodes = [...root.querySelectorAll('.mermaid')];
    if (!nodes.length) return;
    let cancelled = false;
    const draw = async () => {
      const mermaid = (await import('mermaid')).default;
      if (cancelled) return;
      // Diagram colours come from the site's own tokens, so they always match the current theme.
      const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
      const dark = document.documentElement.getAttribute('data-theme') !== 'light';
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: 'Inter, sans-serif',
        themeVariables: {
          darkMode: dark, background: v('--surf'), fontSize: '15px',
          primaryColor: v('--card-h'), primaryBorderColor: v('--acc'), primaryTextColor: v('--t1'),
          secondaryColor: v('--card'), secondaryBorderColor: v('--bdr-h'), secondaryTextColor: v('--t1'),
          tertiaryColor: v('--surf'), tertiaryBorderColor: v('--bdr-h'), tertiaryTextColor: v('--t1'),
          lineColor: v('--t2'), textColor: v('--t1'), mainBkg: v('--card-h'), nodeBorder: v('--acc'),
          clusterBkg: v('--bg'), clusterBorder: v('--bdr-h'), titleColor: v('--t1'), edgeLabelBackground: v('--surf'),
          actorBkg: v('--card-h'), actorBorder: v('--acc'), actorTextColor: v('--t1'), actorLineColor: v('--t3'),
          signalColor: v('--t2'), signalTextColor: v('--t1'), labelBoxBkgColor: v('--card'), labelBoxBorderColor: v('--bdr-h'),
          labelTextColor: v('--t1'), loopTextColor: v('--t1'), activationBkgColor: v('--card'), activationBorderColor: v('--acc'),
          noteBkgColor: v('--card'), noteBorderColor: v('--warn'), noteTextColor: v('--t1'),
          sequenceNumberColor: v('--surf'),
          // State diagrams: base theme defaults stateLabelColor to the state background, which makes labels invisible.
          stateBkg: v('--card-h'), stateLabelColor: v('--t1'), stateBorder: v('--acc'),
          transitionColor: v('--t2'), transitionLabelColor: v('--t1'), labelBackgroundColor: v('--surf'),
          compositeBackground: v('--card'), compositeTitleBackground: v('--card-h'), altBackground: v('--card'),
          specialStateColor: v('--t2'), innerEndBackground: v('--t2'),
          // Charts get an explicit accent palette; their defaults derive from primaryColor and vanish on light backgrounds.
          xyChart: {
            backgroundColor: v('--surf'), titleColor: v('--t1'),
            xAxisLabelColor: v('--t2'), xAxisTitleColor: v('--t1'), xAxisTickColor: v('--t3'), xAxisLineColor: v('--t3'),
            yAxisLabelColor: v('--t2'), yAxisTitleColor: v('--t1'), yAxisTickColor: v('--t3'), yAxisLineColor: v('--t3'),
            plotColorPalette: [v('--acc'), v('--ok'), v('--warn')].join(','),
          },
          pie1: v('--acc'), pie2: v('--ok'), pie3: v('--warn'), pieStrokeColor: v('--surf'), pieTitleTextColor: v('--t1'),
        },
      });
      // Render one diagram at a time with unique ids: concurrent runs (React strict mode, quick theme toggles)
      // otherwise race on shared element ids and leave state-diagram labels empty.
      for (const n of nodes) {
        if (cancelled) return;
        try {
          const { svg } = await mermaid.render('mmd-' + Math.random().toString(36).slice(2), n.dataset.src);
          if (!cancelled) n.innerHTML = svg;
        } catch (e) { console.warn('mermaid', e); n.textContent = n.dataset.src; }
      }
    };
    draw();
    addEventListener('themechange', draw);
    return () => { cancelled = true; removeEventListener('themechange', draw); };
  }, [html]);

  return <div className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
