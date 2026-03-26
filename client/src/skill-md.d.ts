// Type declaration for importing .skill.md files as raw strings via Vite ?raw
declare module '*.skill.md?raw' {
  const content: string;
  export default content;
}
