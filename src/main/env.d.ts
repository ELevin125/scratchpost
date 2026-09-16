// Vite inlines `?raw` imports as strings (used for welcome.md).
declare module '*?raw' {
  const content: string
  export default content
}
