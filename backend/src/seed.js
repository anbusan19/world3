// The three spots that were hard-coded in the app. They start published, without models, so the app keeps working
// exactly as before once it reads from the server. The ETHGlobal coordinates are a PLACEHOLDER (Bandra Kurla Complex).
export const SEED = [
  { name: 'Gateway of India', label: 'GATEWAY', city: 'Mumbai', type: 'LANDMARK', kind: 'geospatial', lat: 18.922, lng: 72.8347, theme: 'coral', art: 'gateway', icon: 'business' },
  { name: 'ETHGlobal Mumbai', label: 'ETHGLOBAL', city: 'Mumbai', type: 'EVENT', kind: 'anchor', lat: 19.0653, lng: 72.8697, theme: 'sky', art: 'ethglobal', icon: 'ticket' },
  { name: 'Chhatrapati Shivaji Terminus', label: 'CSMT', city: 'Mumbai', type: 'LANDMARK', kind: 'geospatial', lat: 18.9398, lng: 72.8355, theme: 'sun', art: 'csmt', icon: 'train' },
];
