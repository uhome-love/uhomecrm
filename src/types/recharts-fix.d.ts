// Fix recharts class component JSX compatibility with React 18 types
// This is a known issue: https://github.com/recharts/recharts/issues/3615
import type { Component } from "react";

declare module "recharts" {
  export class PolarAngleAxis extends Component<any, any> {}
  export class PolarRadiusAxis extends Component<any, any> {}
  export class Radar extends Component<any, any> {}
  export class Legend extends Component<any, any> {}
  export class XAxis extends Component<any, any> {}
  export class YAxis extends Component<any, any> {}
  export class Tooltip extends Component<any, any> {}
  export class Bar extends Component<any, any> {}
}
