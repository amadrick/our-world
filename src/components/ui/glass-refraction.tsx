// Edge refraction for small glass controls: an SVG displacement map that bends
// the backdrop near a control's rim, like light through a thick lens edge.
// Only Chromium applies SVG filters in backdrop-filter, so a tiny script opts
// in there (and never under Reduce Transparency); other browsers keep the
// plain frosted glass.

const edge = (id: string, x2: string, y2: string, channel: (v: number) => string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='${id}' x2='${x2}' y2='${y2}'><stop offset='0' stop-color='${channel(214)}'/><stop offset='.16' stop-color='${channel(128)}'/><stop offset='.84' stop-color='${channel(128)}'/><stop offset='1' stop-color='${channel(42)}'/></linearGradient></defs><rect width='100' height='100' fill='url(#${id})'/></svg>`,
  )}`;

const X_MAP = edge("x", "1", "0", (v) => `rgb(${v},0,0)`);
const Y_MAP = edge("y", "0", "1", (v) => `rgb(0,${v},0)`);

const OPT_IN = `(function(){try{var b=navigator.userAgentData&&navigator.userAgentData.brands||[];if(b.some(function(x){return /Chromium/.test(x.brand)})&&!matchMedia("(prefers-reduced-transparency: reduce)").matches){document.documentElement.setAttribute("data-refraction","")}}catch(e){}})();`;

export function GlassRefraction() {
  return (
    <>
      <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
        <filter id="glass-refraction" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={X_MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="dx" />
          <feImage href={Y_MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="dy" />
          <feComposite in="dx" in2="dy" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <script dangerouslySetInnerHTML={{ __html: OPT_IN }} />
    </>
  );
}
