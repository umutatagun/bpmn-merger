declare module 'bpmn-js/lib/NavigatedViewer' {
  interface ViewerOptions {
    container: HTMLElement;
  }

  class NavigatedViewer {
    constructor(options: ViewerOptions);
    importXML(xml: string): Promise<{ warnings: string[] }>;
    get(name: string): any;
    destroy(): void;
  }

  export default NavigatedViewer;
}

declare module 'bpmn-js/dist/assets/diagram-js.css';
declare module 'bpmn-js/dist/assets/bpmn-js.css';
declare module 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
