// electron-vite copies `?asset` imports out and gives back their path
// (used for the window icon).
declare module '*?asset' {
  const path: string
  export default path
}

// Vite inlines `?raw` imports as strings (used for welcome.md).
declare module '*?raw' {
  const content: string
  export default content
}
