// A sponsor, track or event spot shows its logo on the map pin instead of a generic icon (matched on the spot's name).
const LOGOS = [
  [/\b0g\b/i, require('../assets/pins/0g.png')], [/\b1inch\b/i, require('../assets/pins/1inch.png')], [/ethereum foundation/i, require('../assets/pins/ef.png')],
  [/\barc\b/i, require('../assets/pins/arc.png')], [/chainlink/i, require('../assets/pins/chainlink.png')], [/definitive/i, require('../assets/pins/definitive.png')],
  [/hedera/i, require('../assets/pins/hedera.png')], [/uniswap/i, require('../assets/pins/uniswap.png')], [/whitechain/i, require('../assets/pins/whitechain.png')],
  [/\bworld\b/i, require('../assets/pins/world.png')], [/\bens\b/i, require('../assets/pins/ens.png')], [/arkiv/i, require('../assets/pins/arkiv.png')],
  [/ethglobal/i, require('../assets/pins/ethmumbai.png')],
];

export const pinLogo = (name) => LOGOS.find(([re]) => re.test(String(name ?? '')))?.[1] ?? null;
