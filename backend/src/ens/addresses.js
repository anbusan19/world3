// ENSv2 on Sepolia (from docs.ens.domains/learn/deployments). Testnet only.
export const SEPOLIA = {
  chainId: 11155111,
  ethRegistry: '0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4',
  ethRegistrar: '0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3',
  universalResolver: '0x24e1d8e068620b647ca097f961a61055f4f42d72',
  verifiableFactory: '0xda70306c98e97ece36f997a21368e53298572991',
  userRegistryImpl: '0x9bd8a88719068d09ecee662f36c0e3856708366a',
  permissionedResolverImpl: '0x115eb53f0c60696633855f90b138178fb40b2b2c',
  mockUsdc: '0x240b0316df57887dbbe58b586508b19e633a14aa', // free to mint; the registrar's payment token on Sepolia (checked on-chain)
};
