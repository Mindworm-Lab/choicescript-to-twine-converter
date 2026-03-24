/// <reference types="vite/client" />

declare module 'virtual:sugarcube-template' {
  /** The full SugarCube 2 HTML story template with {{STORY_NAME}} and {{STORY_DATA}} placeholders. */
  const template: string;
  export default template;
}
