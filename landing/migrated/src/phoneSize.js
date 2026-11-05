import { createContext, useContext } from 'react';
// The app runs inside a phone frame on the page, so "window" width means the frame, not the browser.
export const PhoneSizeContext = createContext({ width: 390, height: 780 });
export const usePhoneSize = () => useContext(PhoneSizeContext);
