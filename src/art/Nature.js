import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

// The flat nature shapes from the landing page (sun, cloud, tree, flower, hills), drawn with react-native-svg so the
// app and the website share one illustration style.

export const Sun = ({ size = 56 }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="60" r="56" fill="#F6E27A" />
    <Circle cx="60" cy="60" r="38" fill="#F9D77E" />
    <Circle cx="60" cy="60" r="26" fill="#F26B21" />
  </Svg>
);

export const Cloud = ({ w = 90, color = '#FFFFFF' }) => (
  <Svg width={w} height={w * 0.5} viewBox="0 0 160 80">
    <Path d="M30 70a24 24 0 0 1-2-47 32 32 0 0 1 60-8 26 26 0 0 1 44 20 20 20 0 0 1-2 35Z" fill={color} />
  </Svg>
);

export const Tree = ({ h = 90, trunk = '#B98B5E', leaf = '#8CC152', leaf2 = '#A6D16C' }) => (
  <Svg height={h} width={h * 0.7} viewBox="0 0 70 100">
    <Rect x="31" y="52" width="8" height="46" rx="3" fill={trunk} />
    <Circle cx="35" cy="34" r="26" fill={leaf} />
    <Circle cx="20" cy="48" r="17" fill={leaf2} />
    <Circle cx="51" cy="47" r="18" fill={leaf2} />
  </Svg>
);

export const Flower = ({ size = 26, petal = '#F9C9B0' }) => (
  <Svg width={size} height={size * 1.8} viewBox="0 0 40 72">
    <Path d="M20 72V30" stroke="#5F9E2F" strokeWidth="3" strokeLinecap="round" />
    <Path d="M20 58C10 58 6 50 8 44c9 0 13 5 12 14Z" fill="#8CC152" />
    <G fill={petal}>
      <Circle cx="20" cy="9" r="8" /><Circle cx="31" cy="18" r="8" /><Circle cx="9" cy="18" r="8" /><Circle cx="26" cy="28" r="8" /><Circle cx="14" cy="28" r="8" />
    </G>
    <Circle cx="20" cy="19" r="7" fill="#F6E27A" />
  </Svg>
);

// A sky-coloured band with a sun, a cloud, rolling hills, two trees and a few flowers. Fills the width it is given.
export function Meadow({ height = 150, sky = '#BFE3EC' }) {
  return (
    <View style={{ height, borderRadius: 28, overflow: 'hidden', backgroundColor: sky }}>
      <View style={{ position: 'absolute', right: 26, top: 16 }}><Sun size={52} /></View>
      <View style={{ position: 'absolute', left: 30, top: 22 }}><Cloud w={84} /></View>
      <View style={{ position: 'absolute', left: 150, top: 54, opacity: 0.85 }}><Cloud w={56} /></View>
      <Svg width="100%" height={height * 0.62} viewBox="0 0 1440 220" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Path d="M0 120C180 60 340 60 520 110s360 60 560 0 240-40 360 0V220H0Z" fill="#B9DC8E" />
        <Path d="M0 170C200 120 380 130 560 165s340 40 520-10 260-20 360 10V220H0Z" fill="#A6D16C" />
      </Svg>
      <View style={{ position: 'absolute', left: 36, bottom: 18 }}><Tree h={84} /></View>
      <View style={{ position: 'absolute', right: 70, bottom: 14 }}><Tree h={64} leaf="#7FB04A" leaf2="#8CC152" /></View>
      <View style={{ position: 'absolute', left: 128, bottom: 8 }}><Flower petal="#F9C9B0" /></View>
      <View style={{ position: 'absolute', left: 168, bottom: 6 }}><Flower petal="#FFFFFF" size={22} /></View>
      <View style={{ position: 'absolute', right: 130, bottom: 6 }}><Flower petal="#F6E27A" size={24} /></View>
    </View>
  );
}
