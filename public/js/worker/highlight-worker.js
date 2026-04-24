importScripts('/js/highlight.min.js');

onmessage = (event) => {
  const jsonString = event.data;
  const highlighted = self.hljs.highlight(jsonString, { language: 'json' }).value;
  postMessage(highlighted);
};
