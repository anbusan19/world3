// Flat, hand-drawn style nature shapes in the app's pastel palette. No gradients, no shadows.
export const Sun = ({ size = 120, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="56" fill="#F6E27A" />
    <circle cx="60" cy="60" r="38" fill="#F9D77E" />
    <circle cx="60" cy="60" r="26" fill="#F26B21" />
  </svg>
);

export const Cloud = ({ w = 160, color = '#FFFFFF', className, style }) => (
  <svg className={className} style={style} width={w} height={w * 0.5} viewBox="0 0 160 80" aria-hidden="true">
    <path d="M30 70a24 24 0 0 1-2-47 32 32 0 0 1 60-8 26 26 0 0 1 44 20 20 20 0 0 1-2 35Z" fill={color} />
  </svg>
);

export const Birds = ({ className, style }) => (
  <svg className={className} style={style} width="96" height="48" viewBox="0 0 96 48" aria-hidden="true" fill="none" stroke="#0B0B0F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22q10-14 20 0q10-14 20 0" />
    <path d="M56 36q7-10 14 0q7-10 14 0" />
    <path d="M40 8q5-7 10 0q5-7 10 0" />
  </svg>
);

export const Tree = ({ h = 150, trunk = '#B98B5E', leaf = '#8CC152', leaf2 = '#A6D16C', className, style }) => (
  <svg className={className} style={style} height={h} width={h * 0.7} viewBox="0 0 70 100" aria-hidden="true">
    <rect x="31" y="52" width="8" height="46" rx="3" fill={trunk} />
    <circle cx="35" cy="34" r="26" fill={leaf} />
    <circle cx="20" cy="48" r="17" fill={leaf2} />
    <circle cx="51" cy="47" r="18" fill={leaf2} />
  </svg>
);

export const Sprig = ({ h = 90, color = '#8CC152', className, style }) => (
  <svg className={className} style={style} height={h} width={h * 0.6} viewBox="0 0 60 100" aria-hidden="true">
    <path d="M30 100V18" stroke="#5F9E2F" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M30 70C10 66 6 48 8 36c18 2 26 14 22 34Z" fill={color} />
    <path d="M30 52C50 48 54 30 52 18 34 20 26 32 30 52Z" fill="#A6D16C" />
    <path d="M30 30C20 26 18 14 22 4c12 4 14 14 8 26Z" fill={color} />
  </svg>
);

export const Flower = ({ size = 40, petal = '#F9C9B0', className, style }) => (
  <svg className={className} style={style} width={size} height={size * 1.8} viewBox="0 0 40 72" aria-hidden="true">
    <path d="M20 72V30" stroke="#5F9E2F" strokeWidth="3" strokeLinecap="round" />
    <path d="M20 58C10 58 6 50 8 44c9 0 13 5 12 14Z" fill="#8CC152" />
    <g fill={petal}>
      <circle cx="20" cy="9" r="8" /><circle cx="31" cy="18" r="8" /><circle cx="9" cy="18" r="8" /><circle cx="26" cy="28" r="8" /><circle cx="14" cy="28" r="8" />
    </g>
    <circle cx="20" cy="19" r="7" fill="#F6E27A" />
  </svg>
);

export const Boat = ({ w = 120, className, style }) => (
  <svg className={className} style={style} width={w} height={w * 0.8} viewBox="0 0 120 96" aria-hidden="true">
    <path d="M60 6v54" stroke="#0B0B0F" strokeWidth="3" strokeLinecap="round" />
    <path d="M64 10c20 12 30 28 32 46H64Z" fill="#FFFFFF" />
    <path d="M56 20C40 30 30 44 28 56h28Z" fill="#F9C9B0" />
    <path d="M18 62h84l-12 20H32Z" fill="#F26B21" />
    <path d="M0 88q15-10 30 0t30 0 30 0 30 0v8H0Z" fill="#8FD3E4" />
  </svg>
);

// A wavy edge between two coloured sections. `color` is the section it leads into.
export const Wave = ({ color, flip = false, h = 56 }) => (
  <svg className="wave" style={{ transform: flip ? 'scaleY(-1)' : undefined, height: h }} viewBox="0 0 1440 56" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 56V28C120 6 240 6 360 24s240 26 360 8 240-30 360-10 240 26 360 6V56Z" fill={color} />
  </svg>
);

// Rolling hills along the bottom of a section, with trees and flowers standing on them.
export const Meadow = ({ back = '#B9DC8E', front = '#A6D16C' }) => (
  <div className="meadow" aria-hidden="true">
    <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="meadow-hills">
      <path d="M0 120C180 60 340 60 520 110s360 60 560 0 240-40 360 0V220H0Z" fill={back} />
      <path d="M0 170C200 120 380 130 560 165s340 40 520-10 260-20 360 10V220H0Z" fill={front} />
    </svg>
    <Tree className="m-tree t1" h={150} />
    <Tree className="m-tree t2" h={110} leaf="#7FB04A" leaf2="#8CC152" />
    <Tree className="m-tree t3" h={130} leaf="#A6D16C" leaf2="#B9DC8E" />
    <Flower className="m-flower f1" petal="#F9C9B0" />
    <Flower className="m-flower f2" petal="#FFFFFF" size={34} />
    <Flower className="m-flower f3" petal="#F6E27A" size={36} />
    <Sprig className="m-flower f4" h={70} />
  </div>
);
