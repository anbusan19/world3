import { AppPhone, Flow, HeroGlobe, OnboardingArts, PassportBook } from '@/components/Rn';
import NavMenu from '@/components/NavMenu';
import { Walk } from '@/components/Walk';
import DitherField from '@/components/DitherField';
import Counter from '@/components/Counter';
import Reveal from '@/components/Reveal';
import { Blob, Dot, Squiggle } from '@/components/Squiggle';
import { Birds, Boat, Wave } from '@/components/Nature';

const Icon = ({ d }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B0B0F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Tick = () => (
  <span className="tick"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.4l2.8 2.8L11 4.6" fill="none" stroke="#0B0B0F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
);

const STEPS = [
  ['Go there.', 'Prove it.', 'Visit real landmarks and event spots around you. The map shows what is nearby and how far it is.'],
  ['Capture stamps.', 'Be really there.', 'Stand in the right place and the stamp unlocks. It is checked against where you really are.'],
  ['Keep your passport.', 'Show it off.', 'Every stamp you collect lives in one place, yours to keep, with your name on the cover.'],
];

const CHECKS = [
  ['Where', 'A camera-based location fix', 'Not raw GPS alone. The phone sends evidence of where it is and the backend recomputes the distance itself.', 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  ['Who', 'One human, one stamp', 'World ID proves you are a unique person, tied to the spot, so a farm of bots can’t collect it twice.', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0'],
  ['Decision', 'The server signs, the chain obeys', 'The contract mints only against a signed, expiring voucher. Verification can change without redeploying.', 'M5 12.5l4.5 4.5L19 7.5'],
  ['Privacy', 'No coordinates onchain', 'Location evidence is discarded after checking. Passports are private unless you share them.', 'M5 11h14v9H5Zm3 0V8a4 4 0 0 1 8 0v3'],
];

const NUMS = [
  [1, '', 'human per stamp, per spot. World ID makes it one.'],
  [0, '', 'exact coordinates on a public chain. Spots are shown rounded.'],
  [3, '', 'checks on every capture: where you are, that you are a person, and that the request is fresh.'],
  [80, ' s', 'to create a public passport on ENS, from one tap.'],
];
const BLOCKS = [
  ['/sponsors/world.svg', 'World ID', 'Proves you are one unique human, without telling us who you are.', 'Checked on our server for every capture, and once more to sign in.'],
  ['/sponsors/ens.svg', 'ENS', 'Your passport is a name anyone can look up, like a7k2.wrld3.eth.', 'Your stamps are one record on it. We can write that record and nothing else.'],
  ['/sponsors/arkiv.svg', 'Arkiv', 'Spots and sponsor ads live as public records, owned by their authors.', 'Read them yourself, no World3 server needed.'],
];

const DONE = [
  ['Android app', 'with map, spot list, passport and settings, in light and dark.'],
  ['AR capture', 'with a real 3D model placed at the spot’s coordinate, growing as you walk up to it.'],
  ['Capture zone', 'that unlocks the button from live GPS distance.'],
  ['Spot dashboard', 'for pinning and publishing models, feeding the app.'],
];
const NEXT = [
  ['World ID', 'check on every capture, verified on the server.'],
  ['Backend verifier', 'that recomputes distance and refuses weak evidence.'],
  ['Stamp mint', 'on Sepolia with a signed voucher.'],
  ['ENS passport', 'with permissioned stamp records.'],
];

export default function Home() {
  return (
    <>
      <Reveal />
      <Flow />
      {/* hero */}
      <div className="hero-track" id="top">
      <header className="hero sky">
        <DitherField />
        <div className="wrap pad">
          <nav>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/logo-light.png" alt="World3" width="120" height="40" />
            <div className="nav-r">
              <a className="btn solid" style={{ height: 44, padding: '0 22px', fontSize: 14 }} href="#launch">Try the app</a>
              <NavMenu />
            </div>
          </nav>
          <div className="hero-grid">
            <div className="hero-top">
              <p className="eyebrow" style={{ marginBottom: 18 }}>Your world, collected</p>
              <h1><span>Go there.</span><span className="l">Prove it.</span><span className="k">Keep it.</span></h1>
              <p className="lede">A 3D collectible pinned to a real place. Walk up to it through your camera, prove you are a real person standing there, and keep it as a stamp in your passport.</p>
              <div className="sponsors">
                <span>Built with</span>
                {/* eslint-disable @next/next/no-img-element */}
                <a href="https://world.org" target="_blank" rel="noreferrer"><img src="/sponsors/world.svg" alt="" width="26" height="26" />World</a>
                <a href="https://ens.domains" target="_blank" rel="noreferrer"><img src="/sponsors/ens.svg" alt="" width="26" height="26" />ENS</a>
                <a href="https://arkiv.network" target="_blank" rel="noreferrer"><img src="/sponsors/arkiv.svg" alt="" width="26" height="26" />Arkiv</a>
                {/* eslint-enable @next/next/no-img-element */}
              </div>
            </div>
            <div className="hero-bottom">
              <div className="cta">
                <a className="btn solid" href="#launch">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sponsors/android.svg" alt="" width="22" height="22" style={{ filter: 'invert(1)', marginRight: 10 }} />
                  Download for Android
                </a>
                <a className="btn soft" href="#steps">Explore the docs</a>
              </div>
            </div>
          </div>
        </div>
        <HeroGlobe />
      </header>
      </div>

      {/* how it works */}
      <section className="sec ocean" id="steps">
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">How it works</p>
            <h2>Three things, in order.</h2>
          </div>
          <div className="steps">
            {STEPS.map(([a, b, body], i) => (
              <div className="step" key={a} style={{ '--i': i }}>
                <div className="art"><OnboardingArts index={i} /></div>
                <h3>{a}<em>{b}</em></h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* numbers */}
      <section className="sec numbers" id="numbers">
        <Squiggle className="sq1" color="#F6E27A" />
        <Blob className="sq2" color="#F9C9B0" />
        <Dot className="sq3" color="#0265AD" />
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">By the numbers</p>
            <h2>A few numbers behind every stamp.</h2>
          </div>
          <div className="nums">
            {NUMS.map(([n, suffix, text], i) => (
              <div className="num reveal" key={text} style={{ transitionDelay: `${i * 90}ms` }}>
                <b><Counter to={n} suffix={suffix} /></b>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* built with */}
      <section className="sec blocks" id="built">
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">Built with</p>
            <h2>Three open building blocks.</h2>
            <p className="lede">Each one does one job, and each one can be checked by anyone, without asking us.</p>
          </div>
          <div className="blockgrid">
            {BLOCKS.map(([logo, name, line, how]) => (
              <div className="block reveal" key={name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" width="44" height="44" />
                <h3>{name}</h3>
                <p>{line}</p>
                <small>{how}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* walk toward it */}
      <section className="sec peach" id="capture">
        <Wave color="#0265AD" flip />
        <div className="wrap pad"><Walk /></div>
      </section>

      {/* first launch */}
      <section className="sec sun" id="launch">
        <Wave color="#FFE9D6" flip />
        <div className="wrap pad">
          <div className="split rev">
            <div className="phone-wrap">
              <div className="tile blue" />
              <AppPhone startPhase="onboarding" label="The World3 app from first launch: onboarding, sign in, then the app" />
            </div>
            <div>
              <p className="eyebrow">From the first launch</p>
              <h2 style={{ marginTop: 14 }}>Swipe through, sign in, start exploring.</h2>
              <p className="lede" style={{ marginTop: 18 }}>This is the real onboarding and sign-in from the app, running in your browser. Swipe the slides or tap Next, then pick a way to continue and you are in. Nothing here is saved.</p>
              <div className="list">
                <div><Tick /><span><b>No wallet to set up.</b> Email, Google or a passkey. Minting is gasless.</span></div>
                <div><Tick /><span><b>Camera and location, explained.</b> Each permission asks with a plain reason first.</span></div>
                <div><Tick /><span><b>Light and dark.</b> The app follows your phone, or you can pick.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* proof */}
      <section className="sec sky" id="proof">
        <Wave color="#FFF7D1" flip />
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">Proof of presence</p>
            <h2>A stamp only means something if it can’t be faked.</h2>
            <p className="lede">Location rewards fail when bots and GPS spoofers farm them. Every capture is treated as evidence, and the backend decides. The phone never gets to say where it is.</p>
          </div>
          <div className="checks">
            {CHECKS.map(([tag, title, body, d]) => (
              <div className="check" key={tag}>
                <span className="ic"><Icon d={d} /></span>
                <p className="eyebrow">{tag}</p>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <p className="note">A camera fix is a stronger signal than GPS, not a guarantee: someone could point a camera at a screen. World3 weighs presence as evidence and refuses clearly when it is weak. Too far, poor signal, already captured and not verified all end with nothing minted.</p>
        </div>
      </section>

      {/* passport */}
      <section className="sec peach" id="passport">
        <Wave color="#E6F7FB" flip />
        <div className="wrap pad">
          <div className="split">
            <div>
              <p className="eyebrow">Keep it</p>
              <h2 style={{ marginTop: 14 }}>Your name is your passport.</h2>
              <p className="lede" style={{ marginTop: 18 }}>Each capture mints a non-transferable stamp and adds it to your ENS name, so anything that reads ENS can show where you’ve been.</p>
              <div className="list">
                <div><Tick /><span><b>Non-transferable.</b> A stamp keeps meaning “I was there”.</span></div>
                <div><Tick /><span><b>You own the name.</b> The backend may edit only the stamp records, nothing else.</span></div>
                <div><Tick /><span><b>Private by default.</b> Share your passport when you want to.</span></div>
              </div>
            </div>
            <div className="book" role="group" aria-label="Example passport with three of six stamps collected">
              <header><span className="ens">you<em>.parent.eth</em></span><span className="chip">Example · 3 of 6</span></header>
              <PassportBook />
              <footer>These are the app’s own stamps. The name is an example until the parent name is chosen.</footer>
            </div>
          </div>
        </div>
      </section>

      {/* organizers */}
      <section className="sec leaf" id="organizers">
        <Wave color="#FFE9D6" flip />
        <div className="wrap pad">
          <div className="split">
            <div className="dash" role="img" aria-label="The spot dashboard: a map with a pin, a capture radius and an approach radius">
              <div className="top"><i /><i /><i /><span style={{ marginLeft: 6 }}>World3 Spots · local</span></div>
              <div className="body">
                <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <rect width="400" height="300" fill="#BFE3EC" />
                  <path d="M0 0H250L210 90 190 160 120 210 60 300H0Z" fill="#DDEFC0" />
                  <g stroke="#FFFFFF" strokeWidth="9" fill="none" strokeLinecap="round"><path d="M20 40L220 20" /><path d="M60 90L200 120" /><path d="M110 20L90 250" /><path d="M30 190L150 160" /></g>
                  <g fill="#F9C9B0"><rect x="130" y="40" width="34" height="22" rx="5" /><rect x="170" y="60" width="26" height="30" rx="5" /><rect x="40" y="120" width="40" height="26" rx="5" /><rect x="140" y="140" width="30" height="22" rx="5" /></g>
                  <circle cx="260" cy="170" r="92" fill="none" stroke="#0265AD" strokeWidth="2.5" strokeDasharray="7 7" />
                  <circle cx="260" cy="170" r="38" fill="#A6D16C" fillOpacity=".45" stroke="#5F9E2F" strokeWidth="2.5" />
                  <circle cx="260" cy="170" r="13" fill="#F9C9B0" stroke="#FFFFFF" strokeWidth="4" />
                  <text x="260" y="175" fontSize="11" fontWeight="800" textAnchor="middle" fill="#0B0B0F">01</text>
                </svg>
                <div className="side">
                  <div><b>Gateway of India</b>Published</div>
                  <div>Capture radius<b>20 m</b></div>
                  <div>Approach radius<b>100 m</b></div>
                  <div className="drop">Drop a .glb here<br />8.3 × 7.3 × 4 m · 84 triangles</div>
                </div>
              </div>
            </div>
            <div>
              <p className="eyebrow">For organizers</p>
              <h2 style={{ marginTop: 14 }}>Pin a model to any place in minutes.</h2>
              <p className="lede" style={{ marginTop: 18 }}>Drop in a 3D file, click the map, set how close someone has to be, and publish. The app picks it up on its own.</p>
              <ul className="org-list">
                <li><b>Checks your model.</b> Size, triangle count, units and a base that floats above the ground are flagged before you publish.</li>
                <li><b>Two radii.</b> Where the model starts to appear, and where capture unlocks.</li>
                <li><b>Venues and landmarks.</b> GPS spots outdoors, or a printed QR anchor where GPS and VPS don’t reach.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* status */}
      <section className="sec sun" id="status">
        <Wave color="#CFE8A8" flip />
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">Where it stands</p>
            <h2>A prototype, built in the open.</h2>
            <p className="lede">Made for ETHGlobal Mumbai. The capture experience runs on a real phone. The verification and onchain parts are next.</p>
          </div>
          <div className="status">
            <div className="col">
              <h3>Working on a phone today</h3>
              <ul>{DONE.map(([b, t]) => <li key={b}><span className="dotok"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.4l2.8 2.8L11 4.6" fill="none" stroke="#0B0B0F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span><b>{b}</b> {t}</span></li>)}</ul>
            </div>
            <div className="col">
              <h3>Still to build</h3>
              <ul>{NEXT.map(([b, t]) => <li key={b}><span className="dotnext" /><span><b>{b}</b> {t}</span></li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="site pad">
        <Birds className="birds2" />
        <Boat className="boat" w={110} />
        <div className="wrap in">
          <p className="signoff reveal">Go there.<br /><span>Prove it.</span><br /><em>Keep it.</em></p>
          <a className="pillcta" href="#launch"><span>Try the app</span><i aria-hidden="true">›</i></a>
          <div className="foot-notes">
            <strong>World3</strong>
            <span>Built for ETHGlobal Mumbai, November 5–7, 2026. Testnet only, not audited.</span>
            <span>World3 is an independent project. It uses World ID and is not affiliated with World.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
