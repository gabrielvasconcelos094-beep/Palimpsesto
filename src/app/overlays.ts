/**
 * Pilha de sobreposições (folhas e diálogos). O botão "voltar" fecha a do
 * topo antes de navegar.
 */
const stack: Array<() => void> = [];

export function pushOverlay(close: () => void) {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}
