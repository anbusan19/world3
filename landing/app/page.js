import { AppPhone, HeroGlobe, OnboardingArts, PassportBook } from '@/components/Rn';
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

const GIFS = [
  ['explore', 'Explore', 'A full-screen map that opens on you, with an altitude readout and spots grouped as you zoom.'],
  ['globe', 'Globe', 'Stamps blink on the globe where they were collected. The feed in this recording is simulated.'],
  ['stamps', 'Stamps', 'Your stamps by event, with limited-time events first and finished ones kept as memories.'],
  ['passport', 'Passport', 'Your name, your achievements and an optional public passport on ENS.'],
];

const STEPS = [
  ['Go there.', 'Prove it.', 'Visit real landmarks and event spots around you. The map shows what is nearby and how far it is.'],
  ['Capture stamps.', 'Be really there.', 'Stand in the right place and the stamp unlocks. It is checked against where you really are.'],
  ['Keep your passport.', 'Show it off.', 'Every stamp you collect lives in one place, yours to keep, with your name on the cover.'],
];

const CHECKS = [
  ['Where', 'A fresh, accurate location', 'The phone sends its position and how sure it is. The backend recomputes the distance itself and refuses an old or fuzzy reading.', 'M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21Zm0-8.6a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z'],
  ['Who', 'One human, one stamp', 'World ID proves you are a unique person, tied to the spot, so a farm of bots can’t collect it twice.', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0'],
  ['Decision', 'The server decides', 'Your phone only sends evidence. Every check runs on the server, and a refusal says plainly why.', 'M5 12.5l4 4 10-10'],
  ['Privacy', 'No coordinates stored', 'Location evidence is discarded after checking. A stamp records the place’s name and the time, never where you stood.', 'M5 11h14v9H5Zm3 0V8a4 4 0 0 1 8 0v3'],
];

const NUMS = [
  [1, '', 'human per stamp, per spot. World ID makes it one.'],
  [0, '', 'exact coordinates on a public chain. Spots are shown rounded.'],
  [81, '', 'stamps to find: 65 landmarks across India, the venue and its tracks, and the Aqua Line stations.'],
  [80, ' s', 'to create a public passport on ENS, from one tap.'],
];
const BLOCKS = [
  ['/sponsors/world.svg', 'World ID', 'Proves you are one unique human, without telling us who you are.', 'Checked on our server for every capture, and once more to sign in.'],
  ['/sponsors/ens.svg', 'ENS', 'Your passport is a name anyone can look up, like a7k2.wrld3.eth.', 'Your stamps are one record on it. We can write that record and nothing else.'],
  ['/sponsors/arkiv.svg', 'Arkiv', 'Spots and sponsor ads live as public records, owned by their authors.', 'A sponsor’s ad is a record only their wallet can change or delete. Read them yourself, no wrld3 server needed.'],
];

const DONE = [
  ['Android app', 'with a full-screen map, a globe, your stamps, events, a public passport and settings, in light and dark.'],
  ['Sign in and capture with World ID', 'one verified human per stamp, checked on our server for every capture.'],
  ['Events and quests', 'spots that open and close on their own clock, and stamps you earn by finishing a quest.'],
  ['Public passport on ENS', 'opt-in, with a name you choose, on Sepolia, written with permissions that only allow the stamps record.'],
  ['Sponsor ads on Arkiv', 'a sponsor publishes from their own wallet and the ad shows after a verified capture. Share cards for X.'],
  ['Organizer dashboard', 'for spots, 3D models, events, quests, sponsors and a public explorer of recent stamps.'],
];
const NEXT = [
  ['Onchain stamp mint', 'the non-transferable stamp contract is written and tested, not deployed yet.'],
  ['Sponsor payouts', 'splitting a sponsor’s stake between the people who collected is designed, not built.'],
  ['Production hosting', 'one stable server for everyone, with a signed release APK.'],
  ['iOS', 'the app is Android only for now.'],
];

// The APK lives on the repository's latest GitHub release, under this fixed name; set NEXT_PUBLIC_APK_URL to host it elsewhere.
const APK_URL = process.env.NEXT_PUBLIC_APK_URL || 'https://github.com/anbusan19/world3/releases/latest/download/wrld3.apk';

export default function Home() {
  return (
    <>
      <Reveal />
      {/* hero */}
      <div className="hero-track" id="top">
      <header className="hero sky">
        <DitherField />
        <div className="wrap pad">
          <nav>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/logo-light.png" alt="wrld3" width="120" height="40" />
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
                <a className="btn solid" href={APK_URL} download>
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
              <AppPhone startPhase="onboarding" label="The wrld3 app from first launch: onboarding, sign in, then the app" />
            </div>
            <div>
              <p className="eyebrow">From the first launch</p>
              <h2 style={{ marginTop: 14 }}>Swipe through, sign in, start exploring.</h2>
              <p className="lede" style={{ marginTop: 18 }}>This is the real onboarding and sign-in from the app, running in your browser. Swipe the slides or tap Next, then pick a way to continue and you are in. Nothing here is saved.</p>
              <div className="list">
                <div><Tick /><span><b>Sign in with World ID.</b> One verified human, no password, no wallet to set up.</span></div>
                <div><Tick /><span><b>Location and camera, explained.</b> Each permission asks with a plain reason first.</span></div>
                <div><Tick /><span><b>Light and dark.</b> The app follows your phone, or you can pick.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* on a real phone */}
      <section className="sec sky" id="real">
        <Wave color="#FFF7D1" flip />
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">On a real phone</p>
            <h2>This is the app, recorded as it runs.</h2>
          </div>
          <div className="gifs">
            {GIFS.map(([src, title, body]) => (
              <figure className="gif reveal" key={src}>
                <div className="phone gifphone"><div className="screen">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/gifs/${src}.gif`} alt={`The ${title.toLowerCase()} screen of the wrld3 app, recorded on an Android phone`} loading="lazy" />
                </div></div>
                <figcaption><b>{title}</b>{body}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* events and quests */}
      <section className="sec peach" id="events">
        <Wave color="#E6F7FB" flip />
        <div className="wrap pad">
          <div className="head reveal">
            <p className="eyebrow">Limited time</p>
            <h2>Events open, run and close. Stamps stay as memories.</h2>
            <p className="lede">Every spot belongs to an event with its own start and end. When it ends nothing more can be collected, ads stop, and the stamps you earned stay in your passport.</p>
          </div>
          <div className="bento">
            <div className="b big"><h3>ETHGlobal Mumbai</h3><p>The venue stamp is open to everyone. Visit any two of the three track anchors (ENS, Arkiv, World) and a bonus <b>Mumbai Builder</b> quest stamp unlocks.</p></div>
            <div className="b"><h3>Aqua Line Passport</h3><p>An independent event for Mumbai Metro Line 3’s ten passport stations, with a finale stamp for all ten. Not run by or affiliated with MMRC.</p></div>
            <div className="b"><h3>India Landmarks</h3><p>Sixty-five famous places from the Taj Mahal to the Golden Temple, always on, with cartoon 3D models for twenty of them.</p></div>
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
          <p className="note">A camera fix is a stronger signal than GPS, not a guarantee: someone could point a camera at a screen. wrld3 weighs presence as evidence and refuses clearly when it is weak. Too far, poor signal, already captured and not verified all end with nothing minted.</p>
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
              <div className="top"><i /><i /><i /><span style={{ marginLeft: 6 }}>wrld3 Spots · local</span></div>
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
                <li><b>Venues and landmarks.</b> GPS spots outdoors, or a printed QR anchor indoors.</li>
                <li><b>Events and quests.</b> Each spot belongs to an event that opens and closes on its own clock. A quest stamp unlocks after a few others, like any two of three sponsor tracks.</li>
                <li><b>Sponsors, hands off.</b> They connect MetaMask, get free test tokens and publish an ad in a guided tour.</li>
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
            <p className="lede">Made for ETHGlobal Mumbai. Capture, sign-in, passports and sponsor ads run end to end on a real phone and a testnet. What is left is minting on a contract and paying sponsors out.</p>
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

      {/* get the app */}
      <section className="sec getapp" id="get">
        <div className="wrap pad">
          <div className="getcard reveal">
            <div className="getcopy">
              <p className="eyebrow">Get the app</p>
              <h2>Scan it. Install it. Go there.</h2>
              <p className="lede">wrld3 is an Android app. Scan the code with your phone, or press the button, to download the APK from our latest GitHub release.</p>
              <div className="cta">
                <a className="btn solid" href={APK_URL} download>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sponsors/android.svg" alt="" width="22" height="22" style={{ filter: 'invert(1)', marginRight: 10 }} />
                  Download the APK
                </a>
              </div>
              <ul className="getnotes">
                <li>Android 8 or newer.</li>
                <li>Android asks to allow installs from your browser the first time. That is normal for apps outside the Play Store.</li>
                <li>It is a testnet prototype for ETHGlobal Mumbai, not audited.</li>
              </ul>
            </div>
            <figure className="getqr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/apk-qr.svg" alt="QR code that downloads the wrld3 APK" width="220" height="220" />
              <figcaption>Scan to download</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <footer className="site pad">
        <div className="wrap in">
          <div className="foot-top">
            <div className="foot-cta">
              <p>Walking somewhere worth remembering? Pick up the app, collect a stamp, and keep it as a memory. Running an event or a brand? We will help you set up your spots and your ads in minutes.</p>
              <a className="pillcta" href="#get"><span>Get the app</span><i aria-hidden="true">›</i></a>
            </div>
            <div className="foot-links" role="navigation" aria-label="Footer">
              <ul>
                <li><a href="#steps">How it works</a></li>
                <li><a href="#real">On a phone</a></li>
                <li><a href="#events">Events</a></li>
                <li><a href="#proof">Proof</a></li>
                <li><a href="#passport">Passport</a></li>
                <li><a href="#organizers">Organizers</a></li>
              </ul>
              <ul>
                <li><a href="#get">Get the app</a></li>
                <li><a href="https://github.com/anbusan19/wrld3" target="_blank" rel="noreferrer">GitHub</a></li>
                <li><a href="https://world.org" target="_blank" rel="noreferrer">World ID</a></li>
                <li><a href="https://ens.domains" target="_blank" rel="noreferrer">ENS</a></li>
                <li><a href="https://arkiv.network" target="_blank" rel="noreferrer">Arkiv</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-mid">
            <p className="foot-big reveal">Go there.<br /><span>Prove it.</span><br /><em>Keep it.</em>
              <svg className="foot-wave" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22 Q37 2 75 22 T150 22 T225 22 T300 22 T375 22 T450 22 T525 22 T600 22" fill="none" stroke="#0265AD" strokeWidth="14" strokeLinecap="round" /></svg>
            </p>
            <div className="foot-info">
              <div><b>Built for</b><span>ETHGlobal Mumbai</span><span>November 5–7, 2026</span></div>
              <div><b>Runs on</b><span>Android, World ID</span><span>Sepolia and Arkiv testnets</span></div>
              <div><b>Status</b><span>A prototype. Testnet only, not audited.</span></div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 wrld3. An independent project, not affiliated with World.</span>
            <span className="foot-badge">Testnet only</span>
            <a href="https://github.com/anbusan19/wrld3" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </>
  );
}
