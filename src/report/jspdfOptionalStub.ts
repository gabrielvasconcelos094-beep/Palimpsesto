/**
 * O jsPDF importa sob demanda html2canvas, DOMPurify e canvg — usados só por
 * `doc.html()` e por SVG, que o Palimpsesto não usa (os PDFs são montados com texto
 * e formas). Trocá-los por este módulo tira ~380 KB do APK. Se algum dia forem
 * chamados, o erro é explícito em vez de silencioso.
 */
const unavailable = () => {
  throw new Error('Recurso do jsPDF não incluído no Palimpsesto (html/svg).');
};
export default unavailable;
export const sanitize = unavailable;
export const Canvg = { fromString: unavailable };
