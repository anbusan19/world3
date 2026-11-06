import { WORLD_PATH } from './WorldMark';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

// Hand-drawn vector scenes for the stamps. All share one 160 x 180 canvas and are scaled with "slice", so they fill
// whatever stamp size they sit in. Flat shapes plus one soft sky gradient, kept to the stamp palette.
// To add a spot: write a scene below, add it to ART, and set `art: '<key>'` on the spot in src/spots.js.

const VB = '0 0 160 180';

function Frame({ children }) {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="xMidYMid slice">
      {children}
    </Svg>
  );
}

const range = (n) => Array.from({ length: n }, (_, i) => i);

/* ------------------------------ Gateway of India ----------------------------- */

function Gateway() {
  const INK = '#4A2412';
  return (
    <Frame>
      <Defs>
        <LinearGradient id="gwSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFC9A3" />
          <Stop offset="1" stopColor="#FFEAD8" />
        </LinearGradient>
      </Defs>
      <Rect width="160" height="180" fill="url(#gwSky)" />

      {/* sun and halo */}
      <Circle cx="122" cy="44" r="38" fill="#F26B21" opacity="0.10" />
      <Circle cx="122" cy="44" r="28" fill="#F26B21" opacity="0.18" />
      <Circle cx="122" cy="44" r="17" fill="#F26B21" />

      {/* clouds */}
      <G fill="#FFFFFF" opacity="0.9">
        <Ellipse cx="34" cy="38" rx="20" ry="6" />
        <Ellipse cx="46" cy="33" rx="12" ry="7" />
        <Ellipse cx="25" cy="34" rx="9" ry="5.5" />
        <Ellipse cx="96" cy="24" rx="13" ry="4" />
        <Ellipse cx="104" cy="21" rx="7" ry="4.5" />
      </G>
      {/* gulls */}
      <Path d="M66 22 q3 -4 6 0 q3 -4 6 0" stroke="#7A3B1D" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Path d="M84 34 q2.5 -3 5 0 q2.5 -3 5 0" stroke="#7A3B1D" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* harbour */}
      <Rect y="122" width="160" height="58" fill="#2B8AC9" />
      <Rect y="150" width="160" height="30" fill="#0265AD" />
      <G stroke="#FFFFFF" strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round">
        <Path d="M8 134 q6 -3 12 0 t12 0" />
        <Path d="M118 130 q6 -3 12 0 t12 0" />
        <Path d="M20 160 q6 -3 12 0 t12 0 t12 0" />
        <Path d="M96 164 q6 -3 12 0 t12 0 t12 0" />
      </G>

      {/* quay */}
      <Rect x="12" y="116" width="136" height="9" fill="#E0A072" />
      <Rect x="12" y="116" width="136" height="3" fill="#F2C39B" />

      {/* corner turrets */}
      {[
        { x: 42, c: 47 },
        { x: 108, c: 113 },
      ].map((t) => (
        <G key={t.x}>
          <Rect x={t.x} y="44" width="10" height="24" fill="#D9984F" />
          <Rect x={t.x + 5} y="44" width="5" height="24" fill="#B8793A" />
          <Path d={`M${t.x - 1} 45 Q${t.c} 28 ${t.x + 11} 45 Z`} fill="#EBB67C" />
          <Line x1={t.c} y1="31" x2={t.c} y2="22" stroke="#7A3B1D" strokeWidth="1.4" />
          <Circle cx={t.c} cy="21" r="1.8" fill="#F26B21" />
          <Rect x={t.c - 1.6} y="50" width="3.2" height="9" rx="1.6" fill="#6B3818" />
        </G>
      ))}

      {/* main body */}
      <Rect x="46" y="62" width="68" height="54" fill="#D9984F" />
      <Rect x="96" y="62" width="18" height="54" fill="#B8793A" />
      {/* cornice and crenellations */}
      <Rect x="43" y="60" width="74" height="6" fill="#EBB67C" />
      {range(10).map((i) => (
        <Rect key={i} x={45 + i * 7.4} y="55" width="4" height="5" fill="#EBB67C" />
      ))}
      {/* central pediment with small dome */}
      <Rect x="66" y="50" width="28" height="11" fill="#E8AD70" />
      <Path d="M72 51 Q80 36 88 51 Z" fill="#EBB67C" />
      <Line x1="80" y1="39" x2="80" y2="31" stroke="#7A3B1D" strokeWidth="1.4" />
      <Circle cx="80" cy="30" r="1.8" fill="#F26B21" />

      {/* great arch */}
      <Path d="M66 116 V82 Q66 64 80 64 Q94 64 94 82 V116 Z" fill="#F4CE9C" />
      <Path d="M69 116 V83 Q69 68 80 68 Q91 68 91 83 V116 Z" fill={INK} />
      <Path d="M72 116 V84 Q72 71 80 71 Q88 71 88 84 V116 Z" fill="#FFC8A0" />
      <Rect x="72" y="107" width="16" height="9" fill="#2B8AC9" />
      <Rect x="72" y="104" width="16" height="3" fill="#FFE0C6" opacity="0.7" />
      {/* side bays and windows */}
      {[52, 100].map((x) => (
        <G key={x}>
          <Path d={`M${x} 116 V96 Q${x} 88 ${x + 4} 88 Q${x + 8} 88 ${x + 8} 96 V116 Z`} fill="#6B3818" />
          <Rect x={x} y="70" width="8" height="11" rx="4" fill="#6B3818" />
          <Line x1={x + 4} y1="70" x2={x + 4} y2="81" stroke="#D9984F" strokeWidth="1" />
        </G>
      ))}
      {/* steps */}
      <Rect x="60" y="116" width="40" height="3" fill="#F2C39B" />

      {/* boats */}
      <Path d="M112 146 H142 L138 152 H116 Z" fill="#7A3B1D" />
      <Line x1="127" y1="122" x2="127" y2="146" stroke="#7A3B1D" strokeWidth="1.4" />
      <Path d="M127 123 L127 144 L113 144 Z" fill="#FFFFFF" />
      <Path d="M129 128 L129 144 L140 144 Z" fill="#FFE0C6" />
      <Path d="M16 152 H40 L36 157 H20 Z" fill="#F26B21" />
      <Rect x="24" y="147" width="9" height="5" fill="#FFE0C6" />
    </Frame>
  );
}

/* ------------------------- ETHGlobal Mumbai (Sea Link) ------------------------ */

function EthGlobal() {
  const cableTargets = [70, 80, 90, 100, 111, 122, 134, 147, 46, 36, 27, 18, 9];
  return (
    <Frame>
      <Defs>
        <LinearGradient id="ethSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#A9DDF0" />
          <Stop offset="1" stopColor="#EAF9FD" />
        </LinearGradient>
      </Defs>
      <Rect width="160" height="180" fill="url(#ethSky)" />

      {/* confetti */}
      <G>
        <Circle cx="24" cy="26" r="2.4" fill="#F26B21" />
        <Circle cx="44" cy="50" r="1.8" fill="#A6D16C" />
        <Circle cx="146" cy="24" r="2" fill="#F4D35E" />
        <Circle cx="150" cy="78" r="1.8" fill="#0265AD" />
        <Circle cx="84" cy="18" r="1.8" fill="#F26B21" />
      </G>
      {/* clouds */}
      <G fill="#FFFFFF" opacity="0.95">
        <Ellipse cx="30" cy="70" rx="20" ry="6" />
        <Ellipse cx="42" cy="65" rx="12" ry="7" />
        <Ellipse cx="124" cy="92" rx="16" ry="4.5" />
      </G>

      {/* Ethereum diamond */}
      <Circle cx="112" cy="52" r="34" fill="#FFFFFF" opacity="0.55" />
      <G transform="translate(112 50)">
        <Polygon points="0,-28 -17,1 0,10" fill="#3D8FD0" />
        <Polygon points="0,-28 17,1 0,10" fill="#0265AD" />
        <Polygon points="-17,5 0,14 0,30" fill="#7FBDE8" />
        <Polygon points="17,5 0,14 0,30" fill="#3D8FD0" />
        <Polygon points="-17,1 0,10 17,1 0,-3" fill="#0B4F86" opacity="0.35" />
      </G>

      {/* skyline across the bay */}
      <G fill="#8FCBE4">
        <Rect x="88" y="98" width="9" height="20" />
        <Rect x="99" y="90" width="8" height="28" />
        <Rect x="109" y="100" width="10" height="18" />
        <Rect x="121" y="94" width="8" height="24" />
        <Rect x="131" y="102" width="12" height="16" />
        <Rect x="145" y="96" width="9" height="22" />
      </G>

      {/* sea */}
      <Rect y="118" width="160" height="62" fill="#4DAED6" />
      <Rect y="146" width="160" height="34" fill="#0265AD" />
      <G stroke="#FFFFFF" strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round">
        <Path d="M10 132 q6 -3 12 0 t12 0" />
        <Path d="M104 138 q6 -3 12 0 t12 0" />
        <Path d="M30 160 q6 -3 12 0 t12 0 t12 0" />
        <Path d="M100 168 q6 -3 12 0 t12 0 t12 0" />
      </G>

      {/* cables (drawn first so the tower and deck sit on top) */}
      <G stroke="#FFFFFF" strokeWidth="1" opacity="0.95">
        {cableTargets.map((x, i) => (
          <Line key={x} x1="58" y1={i < 8 ? 62 - i * 3 : 62 - (i - 8) * 3 - 1} x2={x} y2="116" />
        ))}
      </G>

      {/* inverted-Y tower */}
      <G strokeLinecap="round">
        <Line x1="58" y1="34" x2="49" y2="120" stroke="#0265AD" strokeWidth="6.5" />
        <Line x1="58" y1="34" x2="67" y2="120" stroke="#0265AD" strokeWidth="6.5" />
        <Line x1="58" y1="34" x2="49" y2="120" stroke="#FFFFFF" strokeWidth="3.6" />
        <Line x1="58" y1="34" x2="67" y2="120" stroke="#FFFFFF" strokeWidth="3.6" />
        <Line x1="53.2" y1="76" x2="62.8" y2="76" stroke="#0265AD" strokeWidth="4.5" />
        <Line x1="53.2" y1="76" x2="62.8" y2="76" stroke="#FFFFFF" strokeWidth="2" />
      </G>
      {/* deck */}
      <Rect x="-2" y="115" width="164" height="5" fill="#FFFFFF" />
      <Rect x="-2" y="120" width="164" height="3" fill="#7CC0DE" />
      {/* piers */}
      {[20, 98, 138].map((x) => (
        <Rect key={x} x={x} y="123" width="4" height="23" fill="#7CC0DE" opacity="0.8" />
      ))}

      {/* dhow */}
      <Path d="M18 156 H46 L42 162 H22 Z" fill="#F26B21" />
      <Line x1="32" y1="134" x2="32" y2="156" stroke="#7A3B1D" strokeWidth="1.4" />
      <Path d="M32 135 L32 154 L18 154 Z" fill="#FFFFFF" />
    </Frame>
  );
}

/* ------------------------------------ CSMT ----------------------------------- */

function Csmt() {
  const DARK = '#5A3410';
  const pointed = (x, y, w, h) => `M${x} ${y + h} V${y + h * 0.35} Q${x} ${y} ${x + w / 2} ${y - 2} Q${x + w} ${y} ${x + w} ${y + h * 0.35} V${y + h} Z`;
  return (
    <Frame>
      <Defs>
        <LinearGradient id="csSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE79A" />
          <Stop offset="1" stopColor="#FFF8DC" />
        </LinearGradient>
      </Defs>
      <Rect width="160" height="180" fill="url(#csSky)" />

      {/* sun behind the dome */}
      <Circle cx="80" cy="56" r="40" fill="#F26B21" opacity="0.10" />
      <Circle cx="80" cy="56" r="30" fill="#F26B21" opacity="0.2" />
      <Circle cx="80" cy="56" r="20" fill="#F26B21" />

      {/* pigeons and clouds */}
      <Path d="M24 30 q3 -4 6 0 q3 -4 6 0" stroke="#7A4B1E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <Path d="M126 24 q3 -4 6 0 q3 -4 6 0" stroke="#7A4B1E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <G fill="#FFFFFF" opacity="0.9">
        <Ellipse cx="128" cy="48" rx="16" ry="5" />
        <Ellipse cx="136" cy="44" rx="9" ry="5" />
        <Ellipse cx="22" cy="58" rx="12" ry="4" />
      </G>

      {/* wings of the building */}
      <Rect x="14" y="106" width="132" height="38" fill="#E8B450" />
      <Rect x="14" y="104" width="132" height="4" fill="#B45F06" />
      {[20, 30, 40, 50, 108, 118, 128, 138].map((x) => (
        <Path key={x} d={pointed(x, 116, 6, 20)} fill={DARK} />
      ))}
      {[20, 30, 40, 50, 108, 118, 128, 138].map((x) => (
        <Rect key={`s${x}`} x={x - 1} y="136" width="8" height="2" fill="#B45F06" />
      ))}

      {/* end turrets */}
      {[10, 134].map((x) => (
        <G key={x}>
          <Rect x={x} y="84" width="16" height="60" fill="#D99A30" />
          <Rect x={x + 8} y="84" width="8" height="60" fill="#C98A2B" />
          <Polygon points={`${x - 1},85 ${x + 8},66 ${x + 17},85`} fill="#B45F06" />
          <Line x1={x + 8} y1="66" x2={x + 8} y2="59" stroke="#7A4B1E" strokeWidth="1.3" />
          <Path d={pointed(x + 5, 96, 6, 14)} fill={DARK} />
          <Path d={pointed(x + 5, 118, 6, 14)} fill={DARK} />
        </G>
      ))}
      {/* inner turrets */}
      {[54, 98].map((x) => (
        <G key={x}>
          <Rect x={x} y="92" width="8" height="52" fill="#D99A30" />
          <Polygon points={`${x - 1},93 ${x + 4},80 ${x + 9},93`} fill="#B45F06" />
        </G>
      ))}

      {/* central block, drum and ribbed dome */}
      <Rect x="58" y="94" width="44" height="50" fill="#EEC261" />
      <Rect x="62" y="70" width="36" height="26" fill="#E8B450" />
      {[67, 75, 83, 91].map((x) => (
        <Path key={x} d={pointed(x, 76, 5, 12)} fill={DARK} />
      ))}
      <Path d="M62 71 Q80 30 98 71 Z" fill="#D99A30" />
      <G stroke="#F0C770" strokeWidth="1.2" fill="none">
        <Path d="M80 70 V38" />
        <Path d="M72 70 Q73 50 80 38" />
        <Path d="M88 70 Q87 50 80 38" />
      </G>
      <Rect x="76" y="32" width="8" height="9" fill="#B45F06" />
      <Polygon points="80,18 76.5,33 83.5,33" fill="#B45F06" />
      <Circle cx="80" cy="17" r="1.8" fill="#F26B21" />

      {/* grand entrance */}
      <Path d="M70 144 V114 Q70 98 80 93 Q90 98 90 114 V144 Z" fill="#F7D98C" />
      <Path d="M73 144 V115 Q73 102 80 98 Q87 102 87 115 V144 Z" fill={DARK} />
      <Path d="M76 144 V117 Q76 107 80 104 Q84 107 84 117 V144 Z" fill="#FFB347" />

      {/* platform and train */}
      <Rect y="144" width="160" height="36" fill="#C9A66B" />
      <Rect y="144" width="160" height="3" fill="#E2C48A" />
      <Rect x="6" y="152" width="148" height="20" rx="4" fill="#2F6FB5" />
      <Rect x="6" y="160" width="148" height="3" fill="#FFFFFF" />
      {range(8).map((i) => (
        <Rect key={i} x={14 + i * 17} y="155" width="11" height="6" rx="1.5" fill="#FFF0B8" />
      ))}
      <Rect x="138" y="152" width="16" height="20" rx="4" fill="#F26B21" />
      <Rect x="141" y="155" width="9" height="7" rx="1.5" fill="#FFF0B8" />
      <G fill="#2A2A33">
        {[24, 52, 80, 108].map((x) => (
          <Circle key={x} cx={x} cy="173" r="3.6" />
        ))}
      </G>

      {/* palm */}
      <Path d="M9 146 Q12 126 7 108" stroke="#7A4B1E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <G fill="#5F9E2F">
        <Path d="M7 108 Q-6 100 -12 110 Q-1 103 7 108 Z" />
        <Path d="M7 108 Q18 98 26 104 Q16 101 7 108 Z" />
        <Path d="M7 108 Q2 94 -4 94 Q3 98 7 108 Z" />
        <Path d="M7 108 Q12 94 20 92 Q12 98 7 108 Z" />
      </G>
    </Frame>
  );
}


/* ------------------------- sponsor anchors: ENS, Arkiv, World ------------------------- */

// One logo, big and centred, on a pastel sky with two hills, in the stamp style.
function LogoScene({ sky, hill, hill2, children }) {
  return (
    <Frame>
      <Rect width="160" height="180" fill={sky} />
      <Circle cx="132" cy="30" r="14" fill="#F26B21" />
      <Ellipse cx="30" cy="190" rx="110" ry="58" fill={hill} />
      <Ellipse cx="150" cy="196" rx="110" ry="62" fill={hill2} />
      {children}
    </Frame>
  );
}

const ENS_D = 'M11.725.223 5.107 11.13a.146.146 0 0 1-.237.018c-.583-.692-2.753-3.64-.067-6.327 2.45-2.452 5.572-4.2 6.73-4.804.13-.068.269.08.192.206m-.366 23.747c.132.093.295-.064.206-.2-1.478-2.251-6.392-9.744-7.07-10.869-.67-1.11-1.987-2.953-2.097-4.53-.011-.158-.228-.19-.283-.042a10 10 0 0 0-.27.85c-1.105 4.11.5 8.472 3.985 10.916zm.909-.193 6.618-10.907a.146.146 0 0 1 .237-.018c.582.692 2.753 3.64.067 6.327-2.45 2.452-5.572 4.2-6.73 4.804-.13.068-.269-.08-.192-.206M12.641.028c-.132-.093-.295.065-.206.2 1.478 2.252 6.392 9.745 7.07 10.87.67 1.109 1.987 2.952 2.097 4.53.011.157.228.19.283.041.088-.239.182-.524.27-.85 1.105-4.11-.5-8.472-3.985-10.915z';
function Ens() {
  return (
    <LogoScene sky="#DCEBFA" hill="#9CC8EA" hill2="#6FA9DB">
      <G transform="translate(36 40) scale(3.55)"><Path d={ENS_D} fill="#0080BC" /></G>
    </LogoScene>
  );
}

function Arkiv() {
  return (
    <LogoScene sky="#FFE9D6" hill="#F7C59F" hill2="#F2A065">
      <G transform="translate(35 38) scale(4.1)">
        <Path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z" fill="#F26B21" />
        <Path d="M3.8 7.6L12 12.4l8.2-4.8M12 12.4v9" stroke="#FFFFFF" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      </G>
    </LogoScene>
  );
}

function World() {
  const k = 100 / 528;
  return (
    <LogoScene sky="#EAF6EA" hill="#CFE8A8" hill2="#A6D16C">
      <G transform={`translate(30 36) scale(${k})`}>
        <G transform="translate(0,528) scale(0.1,-0.1)"><Path d={WORLD_PATH} fill="#0B0B0F" /></G>
      </G>
    </LogoScene>
  );
}

const ART = { gateway: Gateway, ethglobal: EthGlobal, csmt: Csmt, ens: Ens, arkiv: Arkiv, world: World };

export function hasArt(name) {
  return name != null && ART[name] != null;
}

export function StampArt({ name }) {
  const Scene = ART[name];
  return Scene ? <Scene /> : null;
}
